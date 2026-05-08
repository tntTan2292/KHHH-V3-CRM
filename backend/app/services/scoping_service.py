from sqlalchemy.orm import Session, Query
from ..models import User, HierarchyNode, Transaction, Customer
from .hierarchy_service import HierarchyService
from typing import List, Type

class ScopingService:
    @staticmethod
    def is_admin(user: User) -> bool:
        """
        [GOVERNANCE] Centralized Admin Detection.
        Must be the ONLY authoritative source for admin status.
        """
        if not user or not user.role:
            return False
        return user.role.name.upper() in ("ADMIN", "SUPERADMIN")

    @staticmethod
    def get_user_scope_ids(db: Session, user: User) -> List[int]:
        """
        Lấy toàn bộ ID của các node trong phạm vi của user (bao gồm cả node con).
        Nếu user là ADMIN, trả về None để bỏ qua filter.
        """
        if ScopingService.is_admin(user) and not user.scope_node_id:
            return None
            
        if not user.scope_node_id:
            return []
            
        return HierarchyService.get_descendant_ids_by_id(db, user.scope_node_id, include_children=True)

    @staticmethod
    def get_effective_scope_ids(db: Session, user: User, node_code: str = None) -> List[int]:
        """
        Xác định danh sách Node IDs hiệu lực để truy vấn dữ liệu.
        """
        user_scope_node_id = user.scope_node_id
        is_admin = ScopingService.is_admin(user)

        # 1. Trường hợp là ADMIN / SUPERADMIN (Không giới hạn Scope cứng)
        if is_admin and not user_scope_node_id:
            if not node_code:
                return None # Admin sees all
            return HierarchyService.get_descendant_ids(db, node_code)

        # 2. Trường hợp có scope_node_id (Manager/Leader/Staff)
        user_descendants = HierarchyService.get_descendant_ids_by_id(db, user_scope_node_id, include_children=True)
        
        if not node_code:
            return user_descendants

        # Nếu chọn node_code cụ thể, phải kiểm tra xem node đó có thuộc quyền quản lý không
        requested_node = db.query(HierarchyNode).filter(
            (HierarchyNode.code == node_code) | (HierarchyNode.name == node_code)
        ).first()
        
        if not requested_node:
            # [GOVERNANCE] If node requested but not found, return empty to prevent data leakage
            # Unless user is Admin, then return None to show all (as per previous logic)
            return [] if not is_admin else None
            
        if not is_admin and requested_node.id not in user_descendants:
            return []
            
        return HierarchyService.get_descendant_ids_by_id(db, requested_node.id, include_children=True)

    @staticmethod
    def apply_scope_filter(query: Query, model: Type, db: Session, user: User, node_code: str = None) -> Query:
        """
        Tự động thêm điều kiện lọc theo phạm vi (Scope) vào query.
        """
        scope_ids = ScopingService.get_effective_scope_ids(db, user, node_code)
        if scope_ids is None:
            return query
            
        if not scope_ids:
            return query.filter(False)

        # Mapping model fields for scoping
        if hasattr(model, 'point_id'):
            return query.filter(model.point_id.in_(scope_ids))
        
        if hasattr(model, 'scope_node_id'):
            return query.filter(model.scope_node_id.in_(scope_ids))

        # Đặc thù cho bảng Customer (Nhất quán quyền sở hữu)
        if model == Customer:
            # Ưu tiên dùng point_id nếu đã được backfill
            # Fallback dùng ma_bc_phu_trach nếu point_id rỗng
            nodes = db.query(HierarchyNode.code).filter(HierarchyNode.id.in_(scope_ids)).all()
            codes = [n[0] for n in nodes if n[0]]
            
            from sqlalchemy import or_, and_
            return query.filter(
                or_(
                    Customer.point_id.in_(scope_ids),
                    and_(
                        Customer.point_id == None,
                        Customer.ma_bc_phu_trach.in_(codes)
                    )
                )
            )

        return query

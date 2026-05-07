from sqlalchemy.orm import Session, Query
from ..models import User, HierarchyNode, Transaction, Customer
from .hierarchy_service import HierarchyService
from typing import List, Type

class ScopingService:
    @staticmethod
    def get_user_scope_ids(db: Session, user: User) -> List[int]:
        """
        Lấy toàn bộ ID của các node trong phạm vi của user (bao gồm cả node con).
        Nếu user là ADMIN (không có scope_node_id), trả về None để bỏ qua filter.
        """
        if not user.scope_node_id:
            # Check if user has ADMIN or SUPERADMIN role name to be sure
            if user.role and user.role.name in ("ADMIN", "SUPERADMIN"):
                return None
            return []
            
        return HierarchyService.get_descendant_ids_by_id(db, user.scope_node_id, include_children=True)

    @staticmethod
    def get_effective_scope_ids(db: Session, user: User, node_code: str = None) -> List[int]:
        """
        Xác định danh sách Node IDs hiệu lực để truy vấn dữ liệu.
        - Nếu có node_code: Kiểm tra xem có nằm trong phạm vi của user không.
        - Nếu không có node_code: Trả về toàn bộ phạm vi của user.
        - Trả về None nếu là ADMIN và không chọn node cụ thể.
        """
        user_scope_node_id = user.scope_node_id
        is_admin = (user.role and user.role.name in ("ADMIN", "SUPERADMIN"))

        # 1. Trường hợp là ADMIN / SUPERADMIN
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

        # Đặc thù cho bảng Customer
        if model == Customer:
            nodes = db.query(HierarchyNode.code).filter(HierarchyNode.id.in_(scope_ids)).all()
            codes = [n[0] for n in nodes if n[0]]
            return query.filter(Customer.ma_bc_phu_trach.in_(codes))

        return query

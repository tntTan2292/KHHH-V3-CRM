from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Index, Boolean, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100)) # Ví dụ: "Xem Dashboard"
    slug = Column(String(50), unique=True, index=True) # Ví dụ: "view_dashboard"
    module = Column(String(50)) # Ví dụ: "DASHBOARD", "ADMIN", "STAFF"
    description = Column(String(200))

# Association table for Role <-> Permission
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id")),
    Column("permission_id", Integer, ForeignKey("permissions.id"))
)

# Association table for User <-> Permission (Custom Overrides)
user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("permission_id", Integer, ForeignKey("permissions.id")),
    Column("is_granted", Boolean, default=True) # True: Cho phép, False: Chặn (Cấm quyền của Role)
)

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True) # ADMIN, CENTER_LEADER, REP_LEADER, STAFF
    description = Column(String(200))
    
    permissions = relationship("Permission", secondary=role_permissions)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    full_name = Column(String(200))
    role_id = Column(Integer, ForeignKey("roles.id"))
    nhan_su_id = Column(Integer, ForeignKey("nhan_su.id"), nullable=True) # Liên kết với hồ sơ nhân sự
    scope_node_id = Column(Integer, ForeignKey("hierarchy_nodes.id"), nullable=True) # Phạm vi quản lý dữ liệu (Cây thư mục)
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    
    # Security Fields
    last_login_ip = Column(String(50), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    
    role = relationship("Role")
    nhan_su = relationship("NhanSu")
    scope_node = relationship("HierarchyNode")
    
    # Quyền ghi đè riêng cho từng user
    custom_permissions = relationship("Permission", secondary=user_permissions)

class HierarchyNode(Base):
    __tablename__ = "hierarchy_nodes"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True) # Ma_Don_Vi or Ma_Diem
    name = Column(String(200))
    type = Column(String(50)) # CENTER, UNIT, POINT, CLUSTER
    parent_id = Column(Integer, ForeignKey("hierarchy_nodes.id"), nullable=True)
    
    children = relationship("HierarchyNode", backref="parent", remote_side=[id])

class NhanSu(Base):
    __tablename__ = "nhan_su"
    id = Column(Integer, primary_key=True, index=True)
    hr_id = Column(String(50), unique=True, index=True) # HRM ID
    full_name = Column(String(200))
    username_app = Column(String(100), index=True, nullable=True) # Mapping to Transaction.username
    ma_don_vi = Column(String(50))
    ma_bc = Column(String(50))
    chuc_vu = Column(String(100))
    email = Column(String(200))
    phone = Column(String(20))
    
    # Quan hệ với trạm/bưu cục
    point_id = Column(Integer, ForeignKey("hierarchy_nodes.id"), nullable=True)
    point = relationship("HierarchyNode")

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    stt = Column(Integer, nullable=True)
    ma_crm_cms = Column(String(100), unique=True, index=True, nullable=False)
    loai_kh = Column(String(200), nullable=True)
    nhom_kh = Column(String(100), nullable=True)
    ten_kh = Column(String(500), nullable=True, index=True)
    ten_bc_vhx = Column(String(200), nullable=True)
    bdp_x = Column(String(200), nullable=True)
    cuoc_dac_thu = Column(String(100), nullable=True)
    nguoi_rs_bg_ttkd = Column(String(200), nullable=True)
    nguoi_rs_bg_ttvh = Column(String(200), nullable=True)
    don_vi_gan_hd_cms = Column(String(100), nullable=True)
    da_gui_hd_vly = Column(String(100), nullable=True)
    tinh_hinh_ra_soat = Column(String(200), nullable=True)
    tinh_hinh_ban_giao_cms = Column(String(200), nullable=True)
    don_vi = Column(String(200), nullable=True)

    # Các trường tổng hợp
    tong_doanh_thu = Column(Float, default=0.0)
    rfm_segment = Column(String(100), default="Thường")
    is_churn = Column(Integer, default=0) # 0: Đang hoạt động, 1: Rời bỏ (Không phát sinh DT)

    ma_bc_phu_trach = Column(String(50), nullable=True, index=True) 
    assigned_staff_id = Column(Integer, ForeignKey("nhan_su.id"), nullable=True) # Nhân viên được giao CSKH
    
    # Enrichment fields
    dia_chi = Column(String(500), nullable=True)
    dien_thoai = Column(String(100), nullable=True)
    nguoi_lien_he = Column(String(200), nullable=True)
    so_hop_dong = Column(String(200), nullable=True)
    thoi_han_hop_dong = Column(String(100), nullable=True)
    thoi_han_ket_thuc = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationships
    assigned_staff = relationship("NhanSu")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    shbg = Column(String(100), index=True, nullable=True) # Số hiệu bưu gửi (Cho phép trùng lặp theo yêu cầu đối soát)
    ma_dv = Column(String(50), nullable=True, index=True)
    ma_dv_chap_nhan = Column(String(50), nullable=True, index=True)
    username = Column(String(200), nullable=True)
    ma_kh = Column(String(100), nullable=True, index=True)
    ten_nguoi_gui = Column(String(500), nullable=True)
    dia_chi_nguoi_nhan = Column(Text, nullable=True)
    tinh_thanh_moi = Column(String(200), nullable=True, index=True)
    lien_tinh_noi_tinh = Column(String(100), nullable=True)
    trong_nuoc_quoc_te = Column(String(100), nullable=True)
    ngay_chap_nhan = Column(DateTime, nullable=True, index=True)
    kl_tinh_cuoc = Column(Float, default=0.0)
    
    # Doanh thu chi tiết
    cuoc_chinh_co_vat = Column(Float, default=0.0)
    phu_phi_xang_dau_co_vat = Column(Float, default=0.0)
    phu_phi_vung_xa_co_vat = Column(Float, default=0.0)
    phu_phi_khac_co_vat = Column(Float, default=0.0)
    cuoc_thu_ho = Column(Float, default=0.0)
    cuoc_gtgt = Column(Float, default=0.0)
    
    doanh_thu = Column(Float, default=0.0)
    dich_vu_chinh = Column(String(100), nullable=True, index=True)
    
    # New V3 Meta
    staff_id = Column(Integer, ForeignKey("nhan_su.id"), nullable=True) # Ánh xạ từ username
    point_id = Column(Integer, ForeignKey("hierarchy_nodes.id"), nullable=True) # Cấp bưu cục

    # Index tổ hợp để tăng tốc truy vấn doanh thu theo khách hàng + thời gian
    __table_args__ = (
        Index('idx_trans_ma_kh_date', 'ma_kh', 'ngay_chap_nhan'),
        Index('idx_trans_sender_date', 'ten_nguoi_gui', 'ngay_chap_nhan'),
        Index('idx_trans_staff_date', 'staff_id', 'ngay_chap_nhan'),
    )

class ActionTaskTemplate(Base):
    __tablename__ = "action_task_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    loai_doi_tuong = Column(String(50)) # 'HienHuu' hoặc 'TiemNang'
    nhom_kh = Column(String(100)) # Active, New, At Risk, Churned, Kim Cuong, Vang...
    tieu_de = Column(String(200))
    noi_dung_mau = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

class ActionTask(Base):
    __tablename__ = "action_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(String(200), index=True) # ma_crm_cms (HienHuu) hoặc ten_kh (TiemNang)
    loai_doi_tuong = Column(String(50)) # 'HienHuu' hoặc 'TiemNang'
    phan_loai_giao_viec = Column(String(100), default="Giao Lead") # Phân loại: Giao Lead, Giao VIP, Giao Cảnh báo
    
    # Người được giao việc
    staff_id = Column(Integer, ForeignKey("nhan_su.id"), nullable=True)
    
    # Nguồn gốc task (nếu dùng template)
    template_id = Column(Integer, ForeignKey("action_task_templates.id"), nullable=True)
    
    # Chi tiết công việc
    noi_dung = Column(Text)
    deadline = Column(DateTime, nullable=True)
    
    trang_thai = Column(String(100), default="Mới") # Mới, Đang xử lý, Hoàn thành, Thất bại, Hủy
    
    # Báo cáo kết quả
    bao_cao_ket_qua = Column(Text, nullable=True)
    ngay_hoan_thanh = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    staff = relationship("NhanSu")
    template = relationship("ActionTaskTemplate")

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    folder_name = Column(String(20), unique=True, index=True) # YYYYMMDD
    file_name = Column(String(255))
    file_size = Column(Integer)
    remote_mtime = Column(String(100)) # Thời gian sửa đổi trên server
    sync_date = Column(DateTime, server_default=func.now())
    status = Column(String(50)) # 'COMPLETED', 'FAILED', 'REVISED'

class SyncAttempt(Base):
    __tablename__ = "sync_attempts"

    id = Column(Integer, primary_key=True, index=True)
    attempt_time = Column(DateTime, server_default=func.now())
    folder_name = Column(String(20), index=True) # Ngày đích đang cố gắng đồng bộ
    status = Column(String(50)) # 'STARTED', 'SUCCESS', 'FAILED', 'MISSING_DATA'
    error_details = Column(Text, nullable=True)
    attempt_number = Column(Integer, default=1) # Lần thử thứ mấy trong ngày

class SystemLog(Base):
    __tablename__ = "system_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100)) # Ví dụ: "Giao việc", "Đăng nhập", "Xóa dữ liệu"
    resource = Column(String(100)) # Ví dụ: "Khách hàng", "Nhân sự", "Task 5B"
    details = Column(Text) # JSON hoặc mô tả chi tiết
    ip_address = Column(String(50))
    timestamp = Column(DateTime, server_default=func.now())
    
    user = relationship("User")

class UserSession(Base):
    __tablename__ = "user_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_token = Column(String(255), unique=True, index=True)
    ip_address = Column(String(50))
    user_agent = Column(Text)
    last_activity = Column(DateTime, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    
    user = relationship("User")

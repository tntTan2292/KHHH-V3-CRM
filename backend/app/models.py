from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Index, Boolean, Table, UniqueConstraint, text
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
    lifecycle_state = Column(String(50), index=True, default="NEW")
    growth_tag = Column(String(100), nullable=True)
    vip_tier = Column(String(50), index=True, default="BRONZE")
    priority_score = Column(Integer, default=0)
    priority_level = Column(String(20), index=True, default="LOW")

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
    __table_args__ = (
        Index('idx_potential_drilldown', 'ten_nguoi_gui_canonical', 'dia_chi_nguoi_gui_canonical', 'point_id', 'ngay_chap_nhan'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    shbg = Column(String(100), index=True, nullable=True) # Số hiệu bưu gửi (Cho phép trùng lặp theo yêu cầu đối soát)
    ma_dv = Column(String(50), nullable=True, index=True)
    ma_dv_chap_nhan = Column(String(50), nullable=True, index=True)
    username = Column(String(200), nullable=True)
    ma_kh = Column(String(100), nullable=True, index=True)
    ten_nguoi_gui = Column(String(500), nullable=True)
    ten_nguoi_gui_canonical = Column(String(500), nullable=True, index=True) # Tên đã chuẩn hóa (vô dấu, lowercase)
    dia_chi_nguoi_gui = Column(String(500), nullable=True) # Địa chỉ thực tế người gửi vãng lai
    dia_chi_nguoi_gui_canonical = Column(String(500), nullable=True, index=True) # Địa chỉ đã chuẩn hóa
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
        Index('idx_trans_point_date_canonical', 'point_id', 'ngay_chap_nhan', 'ten_nguoi_gui_canonical', 'dia_chi_nguoi_gui_canonical'),
        Index('idx_sender_canonical_date', 'ten_nguoi_gui_canonical', 'dia_chi_nguoi_gui_canonical', 'ngay_chap_nhan'),
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
    approval_required = Column(Boolean, default=False) # Cấu hình: Task này có cần Leader duyệt không?
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
    
    trang_thai = Column(String(100), default="Mới") # Mới, Đang xử lý, Hoàn thành, Thất bại, Hủy, Escalation, PENDING_VERIFY
    
    # 5B Pipeline & Verification
    pipeline_stage = Column(String(50), nullable=True) # B1, B2, B3, B4, B5
    task_contact_at = Column(DateTime, server_default=func.now()) # Thời điểm tiếp xúc thực tế
    converted_ma_kh = Column(String(100), nullable=True) # Mã CRM mở thành công
    verified = Column(Boolean, default=False) # Hệ thống đã xác thực qua Transaction chưa?
    
    # Structured Reporting
    kenh_tiep_can = Column(String(50), nullable=True) # Gọi điện, Zalo, Gặp trực tiếp
    ket_qua = Column(String(50), nullable=True) # Thành công, Hẹn lại, Từ chối
    
    # Collaboration Mode
    cross_point_flag = Column(Boolean, default=False) # Đánh dấu khách chuyển điểm phục vụ
    original_point_id = Column(Integer, ForeignKey("hierarchy_nodes.id"), nullable=True) # Điểm phục vụ gốc
    original_staff_id = Column(Integer, ForeignKey("nhan_su.id"), nullable=True) # Nhân sự chăm sóc gốc
    
    # Approval Workflow
    approval_status = Column(String(50), default="Không yêu cầu") # Chờ duyệt, Đã duyệt, Từ chối
    
    # Báo cáo kết quả
    bao_cao_ket_qua = Column(Text, nullable=True)
    ngay_hoan_thanh = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    staff = relationship("NhanSu", foreign_keys=[staff_id])
    original_staff = relationship("NhanSu", foreign_keys=[original_staff_id])
    original_point = relationship("HierarchyNode")
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

class MonthlyAnalyticsSummary(Base):
    __tablename__ = "monthly_analytics_summary"
    
    id = Column(Integer, primary_key=True, index=True)
    year_month = Column(String(10), index=True) # 'YYYY-MM'
    point_id = Column(Integer, ForeignKey("hierarchy_nodes.id"), index=True)
    lifecycle_stage = Column(String(50), index=True, nullable=True) # NEW, ACTIVE, AT_RISK, CHURNED, REACTIVATED
    growth_tag = Column(String(50), index=True, nullable=True) # GROWTH, STABLE, DECLINING
    ma_dv = Column(String(50), index=True, nullable=True) # Dịch vụ: C, E, M, R, L
    region_type = Column(String(50), index=True, nullable=True) # Nội tỉnh, Liên tỉnh, Quốc tế
    vip_tier = Column(String(50), index=True, nullable=True) # DIAMOND, PLATINUM, GOLD, SILVER, BRONZE
    priority_level = Column(String(20), index=True, nullable=True) # CRITICAL, HIGH, MEDIUM, LOW
    
    total_revenue = Column(Float, default=0.0)
    total_orders = Column(Integer, default=0)
    total_customers = Column(Integer, default=0)
    
    last_updated_at = Column(DateTime, server_default=func.now())
    
    __table_args__ = (
        Index('idx_summary_main', 'point_id', 'year_month', 'lifecycle_stage', 'growth_tag', 'vip_tier', 'priority_level', 'ma_dv', 'region_type'),
    )

class LifecycleLog(Base):
    __tablename__ = "lifecycle_logs"
    id = Column(Integer, primary_key=True, index=True)
    ma_kh = Column(String(100), index=True)
    previous_state = Column(String(50))
    new_state = Column(String(50))
    trigger_reason = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())

class VipLog(Base):
    __tablename__ = "vip_logs"
    id = Column(Integer, primary_key=True, index=True)
    ma_kh = Column(String(100), index=True)
    previous_tier = Column(String(50))
    new_tier = Column(String(50))
    trigger_reason = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())

class PriorityLog(Base):
    __tablename__ = "priority_logs"
    id = Column(Integer, primary_key=True, index=True)
    ma_kh = Column(String(100), index=True)
    previous_score = Column(Integer)
    new_score = Column(Integer)
    previous_level = Column(String(20))
    new_level = Column(String(20))
    trigger_reason = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())

class CustomerFirstOrder(Base):
    __tablename__ = "customer_first_order"
    name = Column(String(255), primary_key=True)
    addr = Column(String(255), primary_key=True)
    point_id = Column(Integer, primary_key=True)
    first_month = Column(String(10)) # YYYY-MM

class CustomerLastActive(Base):
    __tablename__ = "customer_last_active"
    name = Column(String(255), primary_key=True)
    addr = Column(String(255), primary_key=True)
    point_id = Column(Integer, primary_key=True)
    last_active_month = Column(String(10)) # YYYY-MM
    __table_args__ = (
        Index('idx_last_active_point', 'point_id'),
    )

class UsedToken(Base):
    __tablename__ = "used_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(64), unique=True, index=True)
    expires_at = Column(DateTime, index=True)

class BackfillStatus(Base):
    __tablename__ = "backfill_status"
    filename = Column(String(255), primary_key=True)
    status = Column(String(50)) # COMPLETED, FAILED, IN_PROGRESS
    total_records = Column(Integer, default=0)
    last_processed_at = Column(DateTime, server_default=func.now())

class PotentialCustomer(Base):
    __tablename__ = "potential_customers"
    
    id = Column(Integer, primary_key=True, index=True)
    ten_canonical = Column(String(200), index=True)
    dia_chi_canonical = Column(String(500), index=True)
    point_id = Column(Integer, ForeignKey("hierarchy_nodes.id"), index=True)
    
    so_dien_thoai = Column(String(20), nullable=True)
    dia_chi_chi_tiet = Column(Text, nullable=True)
    ghi_chu_khac = Column(Text, nullable=True)
    
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Unique constraint to prevent duplicates
    __table_args__ = (UniqueConstraint('ten_canonical', 'dia_chi_canonical', 'point_id', name='_potential_uc'),)

class EngineRun(Base):
    __tablename__ = "engine_runs"
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(100), unique=True, index=True)
    engine_name = Column(String(100), index=True)
    status = Column(String(20), default="STARTED") # STARTED, SUCCESS, FAILED
    run_hash = Column(String(100), index=True)
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    processed_entities_count = Column(Integer, default=0)
    generated_events_count = Column(Integer, default=0)
    failed_entities_count = Column(Integer, default=0)
    execution_context_json = Column(Text, nullable=True)
    
    __table_args__ = (
        Index('idx_engine_run_lookup', 'engine_name', 'status', 'started_at'),
    )

class NotificationRule(Base):
    __tablename__ = "notification_rules"
    id = Column(Integer, primary_key=True, index=True)
    event_code = Column(String(100), unique=True, index=True)
    aggregation_category = Column(String(50), index=True) # CUSTOMER_HEALTH, VIP_RISK, OPERATIONS
    default_severity = Column(String(20), default="MEDIUM") # CRITICAL, HIGH, MEDIUM, LOW
    cooldown_hours = Column(Integer, default=24)
    is_enabled = Column(Boolean, default=True)
    default_assigned_role = Column(String(50), nullable=True)
    default_assigned_team = Column(String(100), nullable=True)
    version = Column(Integer, default=1)

class SystemEvent(Base):
    __tablename__ = "system_events"
    id = Column(Integer, primary_key=True, index=True)
    identity_key = Column(String(255), index=True) # REMOVED UNIQUE: Support historical records
    dedup_hash = Column(String(100), unique=True, index=True)
    event_code = Column(String(100), index=True)
    aggregation_category = Column(String(50), index=True)
    entity_type = Column(String(50), default="CUSTOMER")
    entity_id = Column(String(100), index=True)
    source_engine = Column(String(100))
    severity = Column(String(20))
    
    # LOCK STATUS LIFECYCLE
    status = Column(
        String(50), 
        default="OPEN",
        nullable=False
    )
    
    title = Column(String(200))
    message = Column(Text)
    
    # Governance Snapshots
    event_input_snapshot_json = Column(Text) # Immutable Truth
    rule_version = Column(Integer)
    engine_version = Column(String(20))
    run_id = Column(String(100), ForeignKey("engine_runs.run_id"))
    
    # Ownership
    assigned_team = Column(String(100), nullable=True)
    assigned_role = Column(String(50), nullable=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ownership_status = Column(String(50), default="UNASSIGNED") # UNASSIGNED, ASSIGNED, ESCALATED
    
    # Timestamps & Recurrence
    first_triggered_at = Column(DateTime, server_default=func.now())
    last_reoccurred_at = Column(DateTime, server_default=func.now())
    reopened_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    occurrence_count = Column(Integer, default=1)

    __table_args__ = (
        Index('idx_event_identity_status', 'identity_key', 'status'),
        Index('idx_event_entity_time', 'entity_id', 'first_triggered_at'),
        Index('idx_event_code_category', 'event_code', 'aggregation_category'),
        Index('idx_event_ownership', 'assigned_team', 'assigned_role', 'ownership_status'),
        # Enterprise Lock: Only one active event per identity
        Index('idx_unique_active_event', 'identity_key', unique=True, sqlite_where=text("status NOT IN ('RESOLVED', 'SUPPRESSED')")),
    )

class EventStateLog(Base):
    __tablename__ = "event_state_logs"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("system_events.id"))
    previous_status = Column(String(50))
    new_status = Column(String(50))
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(Text)
    snapshot_at_change_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

class EscalationRule(Base):
    """
    GOVERNANCE: Centralized Escalation Policies
    """
    __tablename__ = "escalation_rules"
    id = Column(Integer, primary_key=True, index=True)
    event_code = Column(String(100), index=True)
    escalation_level = Column(Integer, default=1)
    
    # Trigger Governance
    wait_hours = Column(Integer, default=24)
    trigger_condition_type = Column(String(50), default="NO_ACK") # NO_ACK, NO_RESOLUTION, SLA_BREACH
    
    # Action Governance
    action_type = Column(String(50), default="NOTIFY") # NOTIFY, TRANSFER_OWNERSHIP
    
    target_role = Column(String(50))
    target_team = Column(String(100))
    
    is_enabled = Column(Boolean, default=True)
    version = Column(Integer, default=1)

    __table_args__ = (
        Index('idx_escalation_rule_lookup', 'event_code', 'escalation_level', 'is_enabled'),
    )

class EscalationRecord(Base):
    """
    GOVERNANCE: Escalation Lifecycle & Auditability
    """
    __tablename__ = "escalation_records"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("system_events.id"), index=True)
    run_id = Column(String(100), index=True) # Linked to Escalation Engine Run
    rule_id = Column(Integer, ForeignKey("escalation_rules.id"))
    
    escalation_level = Column(Integer)
    is_ownership_transfer = Column(Boolean, default=False)
    
    # Ownership & Coordination Tracking
    previous_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    new_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # HARDENING: Current Responsibility
    current_coordinator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    current_coordinator_team = Column(String(100), nullable=True)
    
    # HARDENING: Reason Classification
    escalation_reason_code = Column(String(50), nullable=True) # NO_ACK, SLA_BREACH, CRITICAL_SITUATION
    
    # Lifecycle State Machine
    status = Column(
        String(50), 
        default="PENDING",
        nullable=False
    ) # PENDING, ESCALATED, ACKNOWLEDGED, RESOLVED, CLOSED
    
    # Immutable Truth
    escalation_snapshot_json = Column(Text)
    
    # Temporal Governance
    escalated_at = Column(DateTime, server_default=func.now())
    due_at = Column(DateTime) # SLA Deadline for this level
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index('idx_escalation_lifecycle', 'event_id', 'status', 'escalation_level'),
        Index('idx_escalation_owner_lookup', 'new_owner_id', 'status'),
        Index('idx_escalation_coordinator', 'current_coordinator_id', 'status'),
    )

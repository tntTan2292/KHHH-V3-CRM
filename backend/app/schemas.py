from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CustomerBase(BaseModel):
    stt: Optional[int]
    ma_crm_cms: str
    loai_kh: Optional[str]
    nhom_kh: Optional[str]
    ten_kh: Optional[str]
    ten_bc_vhx: Optional[str]
    bdp_x: Optional[str]
    cuoc_dac_thu: Optional[str]
    nguoi_rs_bg_ttkd: Optional[str]
    nguoi_rs_bg_ttvh: Optional[str]
    don_vi_gan_hd_cms: Optional[str]
    da_gui_hd_vly: Optional[str]
    tinh_hinh_ra_soat: Optional[str]
    tinh_hinh_ban_giao_cms: Optional[str]
    don_vi: Optional[str]
    tong_doanh_thu: float
    dynamic_revenue: Optional[float] = 0
    transaction_count: Optional[int] = 0
    growth_velocity: Optional[float] = 0
    health_score: Optional[int] = 0
    rfm_segment: str
    is_churn: int
    status_type: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: int
    created_at: Optional[datetime]
    
    class Config:
        orm_mode = True

class ImportResult(BaseModel):
    success: bool
    message: str
    customers_imported: int
    transactions_imported: int
    errors: Optional[List[str]] = []

class CustomerUpdate(BaseModel):
    dia_chi: Optional[str]
    dien_thoai: Optional[str]
    nguoi_lien_he: Optional[str]
    so_hop_dong: Optional[str]
    thoi_han_hop_dong: Optional[str]
    thoi_han_ket_thuc: Optional[str]

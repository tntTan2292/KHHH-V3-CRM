import pandas as pd
from typing import List, Dict

def compute_rfm(customers: List[Dict]) -> List[Dict]:
    """
    Tính toán phân khúc RFM dựa trên tổng doanh thu (revenue).
    - Kim Cương: Top 20% doanh thu
    - Tiềm Năng: Doanh thu > Median
    - Thường: Phần còn lại
    """
    if not customers:
        return customers
    
    df = pd.DataFrame(customers)
    
    # Lọc những người có doanh thu > 0
    active_df = df[df["tong_doanh_thu"] > 0]
    
    if active_df.empty:
        for c in customers:
            c["rfm_segment"] = "Thường"
        return customers
        
    revenue_quantiles = active_df["tong_doanh_thu"].quantile([0.5, 0.8])
    median_val = revenue_quantiles[0.5]
    top_20_val = revenue_quantiles[0.8]
    
    def get_segment(rev):
        if rev == 0:
            return "Thường"
        if rev >= top_20_val:
            return "Kim Cương"
        elif rev > median_val:
            return "Tiềm Năng"
        else:
            return "Thường"
            
    df["rfm_segment"] = df["tong_doanh_thu"].apply(get_segment)
    
    # Chuyển đổi lại thành danh sách dict
    return df.to_dict("records")

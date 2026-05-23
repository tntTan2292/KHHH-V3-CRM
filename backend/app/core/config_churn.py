# backend/app/core/config_churn.py

# ==============================================================================
# [TECHNICAL DEBT NOTE - PHASE 1]: 
# Hiện tại đang dùng subquery COUNT(...) và CASE WHEN runtime.
# Phù hợp cho Phase 1 vì số lượng Churned Population tương đối nhỏ.
# TUY NHIÊN: Nếu sau này dashboard bắt đầu chậm đi theo thời gian (khi dữ liệu phình to),
# cần cân nhắc:
# - Cần aggregate transaction trước (tạo bảng snapshot riêng cho transaction lifetime).
# - Tránh lặp subquery nhiều lần.
# - Cân nhắc đưa thêm lightweight analytics cache layer cho module này.
# Hiện tại KHÔNG TỐI ƯU THÊM để đảm bảo đúng nguyên tắc Additive Only của Phase 1.
# ==============================================================================

class ChurnClassificationConfig:
    """
    Cấu hình luật phân loại Churn Suspect vs Real.
    Tránh hardcode rải rác, giúp dễ tuning business rule về sau.
    """
    # Ngưỡng (Threshold) số lượng giao dịch tối đa để bị coi là "Khách vãng lai"
    CHURN_SUSPECT_SINGLE_TX_THRESHOLD = 1
    
    # Ngưỡng giao dịch tối đa đối với rule kiểm tra tỷ lệ dịch vụ Quốc tế (100% INTL)
    CHURN_SUSPECT_INTL_MAX_TX = 3
    
    # Bật/Tắt tính năng nhận diện Khách gửi 100% Quốc tế là Suspect
    CHURN_SUSPECT_ENABLE_INTL_RULE = True

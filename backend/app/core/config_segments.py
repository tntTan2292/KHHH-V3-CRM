# CONFIGURATION FOR CUSTOMER LIFECYCLE SEGMENTS (CRM 2.0)
# Buu dien Thanh pho Hue - Vnpost Analytics

# 1. POTENTIAL CUSTOMERS (Khách vãng lai - Chưa có mã CRM)
# Dựa trên phân tích TOP 25% - 5% - 1% dữ liệu thực tế (Đã X2 theo yêu cầu)
THRESHOLD_BRONZE_REV = 500000     # Doanh thu > 500K
THRESHOLD_BRONZE_SHIP = 5        # Bạc vẫn cần có doanh thu > 0

THRESHOLD_GOLD_REV = 1000000      # Doanh thu > 1Tr
THRESHOLD_GOLD_SHIP = 10         # Vàng vẫn cần có doanh thu > 0

THRESHOLD_DIAMOND_REV = 5000000   # Doanh thu > 5Tr
THRESHOLD_DIAMOND_SHIP = 20      # Kim cương vẫn cần có doanh thu > 0


# 2. LIFECYCLE PHASES (Khách hàng Định danh)
# Số tháng liên tiếp không hoạt động để coi là RỜI BỎ (CHURN)
MONTHS_UNTIL_CHURN = 3

# Số tháng lũy kế để coi là KHÁCH MỚI (NEW)
# (Kể từ đơn hàng đầu tiên trong lịch sử)
MONTHS_FOR_NEW = 3

# Ngưỡng doanh thu tối thiểu để tính là "Có hoạt động" trong tháng
MIN_REVENUE_ACTIVE = 1000  # > 1000 VNĐ 

# 3. VIP TIER RANKING (Relative Top-N)
# Xếp hạng dựa trên vị trí doanh thu lũy kế 03 tháng (Rolling 3 Months)
VIP_THRESHOLD_DIAMOND = 10   # Top 10
VIP_THRESHOLD_PLATINUM = 50  # Top 11-50
VIP_THRESHOLD_GOLD = 150     # Top 51-150
VIP_THRESHOLD_SILVER = 500    # Top 151-500
VIP_THRESHOLD_BRONZE = 1000   # Top 501-1000

# 4. PRIORITY SCORING (Hybrid Model - CRM 3.0)
# Fixed Scores (Điểm số cố định dựa trên phân tầng)
SCORE_VIP = {
    'DIAMOND': 50,
    'PLATINUM': 40,
    'GOLD': 30,
    'SILVER': 20,
    'BRONZE': 10,
    'NORMAL': 0
}

SCORE_LIFECYCLE = {
    'NEW': 5,
    'ACTIVE': 5,
    'AT_RISK': 20,
    'CHURNED': 10,
    'REACTIVATED': 15
}

# Dynamic Weights (Trọng số biến động dựa trên tín hiệu thị trường)
WEIGHT_REVENUE_DROP = 30       # Giảm doanh thu trượt mạnh (>30%)
WEIGHT_RISK_AGING = 20         # Trạng thái AT_RISK kéo dài (>15 ngày)
WEIGHT_GROWTH_MOMENTUM = 10    # Tăng trưởng mạnh (ưu tiên đẩy số)
WEIGHT_VIP_DOWNGRADE_RISK = 25 # Nguy cơ tụt hạng VIP

# Priority Level Thresholds
PRIORITY_THRESHOLD_CRITICAL = 80
PRIORITY_THRESHOLD_HIGH = 60
PRIORITY_THRESHOLD_MEDIUM = 40

print("LIFECYCLE, VIP & PRIORITY CONFIG LOADED - CRM 3.0")

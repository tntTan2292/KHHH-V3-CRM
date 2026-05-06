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

print("LIFECYCLE & VIP CONFIG LOADED SUCCESSFULLY - CRM 3.0")

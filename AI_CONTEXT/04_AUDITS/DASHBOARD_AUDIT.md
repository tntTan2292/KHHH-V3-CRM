# 📊 TECHNICAL AUDIT: CRM 3.0 DASHBOARD
*Status: Phase 2 (Completed & Stabilized) — Dashboard Extraction Phase 2.*

## 1. TỔNG QUAN (DASHBOARD OVERVIEW)
- **Tên file:** `src/pages/Dashboard.jsx`
- **Kích thước trước đây:** Hơn 1800 lines of code.
- **Kích thước hiện tại:** Giảm xuống còn **1349 lines of code** (Giảm ~500 lines).
- **Vai trò:** Trái tim của hệ thống CRM, quản trị mọi biểu đồ, bộ lọc, và KPI điều hành.
- **Vấn đề cốt lõi:** Phình to (God Component), ôm đồm quá nhiều state, logic tính toán nằm inline trong JSX, độ phức tạp khi maintain cực kỳ cao.

---

## 2. KẾT QUẢ PHASE 2 EXTRACTION (COMPLETED)

Trong Phase 2, các thành phần "Dumb Components" (thuần hiển thị) đã được bóc tách và chuyển vào thư mục riêng biệt thành công mà không làm vỡ layout hay luồng dữ liệu:

**Cấu trúc Component hiện tại:**
- `src/components/dashboard/shared/AIAssistantInsights.jsx` (Đã extract)
- `src/components/dashboard/shared/EliteMorningPulse.jsx` (Đã extract)
- `src/components/dashboard/cards/PopulationKpiGroup.jsx` (Đã extract - Gom nhóm thẻ trạng thái Active/At Risk/New)
- `src/components/dashboard/cards/MovementIndicators.jsx` (Đã extract - Gom nhóm sự kiện biến động kỳ)
- `src/components/dashboard/cards/PotentialsGroup.jsx` (Đã extract - Khối thẻ hạng KH Kim Cương/Vàng/Bạc)
- `src/components/dashboard/charts/LifecyclePulseBar.jsx` (Đã extract - Thanh tiến trình cơ cấu vòng đời)

*Tất cả được truyền `stats`, `summaryData`, và các prop navigate để giữ nguyên toàn vẹn tính năng.*

---

## 3. CÁC PHÂN KHU LOGIC CÒN LẠI TRONG DASHBOARD.JSX

Sau khi extract Phase 2, Dashboard.jsx còn quản lý các phân khu chính yếu sau:

1. **Header, Alerts & FilterBar (Điều khiển trung tâm)**
2. **Revenue Trend Chart:** Biểu đồ Area biến động theo ngày.
3. **Địa Bàn Heatmap Table:** Bảng lưới phân tích Tăng trưởng/Quy mô (Star, Cow, v.v.).
4. **Movers Comparison:** Biểu đồ Cột ngang so sánh Doanh thu/Sản lượng (Kỳ này vs Kỳ trước).
5. **Top Stars & Risks Tables:** Bảng Top 20 Gainers & Losers.
6. **Intelligence Hub:** Danh sách Dự báo rời bỏ sớm (AI) & Điểm RFM tiềm năng.

---

## 4. MỨC ĐỘ NGUY HIỂM CHƯA ĐỤNG TỚI (DANGEROUS ZONES)

Tuyệt đối không chạm vội vào các vùng sau trong Phase 3 nếu chưa có kế hoạch test cẩn thận:

1. **Địa Bàn Heatmap Table (Section 9)**: 
   - Nó chứa logic đệ quy ngầm (Drill down), cơ chế Fullscreen, và tự tính toán tỷ trọng, quadrant ngay trong JSX. Nếu bóc ra sai cách sẽ vỡ toàn bộ luồng Navigation của app.
2. **Data Fetching Hooks (SWR)**: Nằm xen kẽ với logic đồng bộ URL. Không được chuyển đi đâu khi chưa có giải pháp State Management tổng thể.
3. **Charts & Bảng Phức Tạp (Trend, Movers)**: Vẫn còn nằm inline, chứa nhiều config tính toán Recharts phức tạp.

---

## 5. CHIẾN LƯỢC TÁI CẤU TRÚC (RECOMMENDED REFACTOR STRATEGY)
1. **Phase 1 (Done):** Audit & Map Structure.
2. **Phase 2 (Done):** Tạo folder `src/components/dashboard/`. Tách các thẻ KPI, Chart thành Dumb Components. Hoàn thiện và Stabilize.
3. **Phase 3 (Next):** Tách Heatmap Table và Intelligence Hub thành các Smart Components.
4. **Phase 4 (Context/State):** Gộp toàn bộ SWR và Filter State vào một Custom Hook `useDashboardData()` để dọn sạch logic ra khỏi `Dashboard.jsx`.

# 📊 TECHNICAL AUDIT: CRM 3.0 DASHBOARD
*Status: Phase 1 (Audit Only) — No code modified.*

## 1. TỔNG QUAN (DASHBOARD OVERVIEW)
- **Tên file:** `src/pages/Dashboard.jsx`
- **Kích thước:** Hơn 1800 lines of code.
- **Vai trò:** Trái tim của hệ thống CRM, quản trị mọi biểu đồ, bộ lọc, và KPI điều hành.
- **Vấn đề cốt lõi:** Phình to (God Component), ôm đồm quá nhiều state, logic tính toán nằm inline trong JSX, độ phức tạp khi maintain cực kỳ cao.

---

## 2. KIẾN TRÚC HIỆN TẠI (CURRENT STRUCTURE)

Dashboard hiện đang ôm đồm các lớp xử lý sau trong cùng một file:
1. **Data Fetching:** Hơn 7 hooks `useSWR` chạy song song (Coverage, Summary, Trend, Heatmap, Movers, Monthly, Churn, Scoring).
2. **State Management:** Navigation Stack (`navStack`), Hierarchy (`selectedNode`), Date context (`startDate`, `endDate`), Zoom State, v.v.
3. **Helper Components:** `CustomTooltip`, `AIAssistantInsights`, `EliteMorningPulse` được nhét chung lên đầu file thay vì tách riêng.
4. **Massive JSX:** Gần 1300 dòng chỉ dành cho việc render các khối div, table, chart.

---

## 3. CÁC PHÂN KHU LOGIC (LOGICAL SECTIONS)
Dashboard có thể chia thành **12 phân khu (logical sections)** chính:

1. **Header & Alerts:** Tên trang, Breadcrumb, Nút Export, Cảnh báo sức khỏe hệ thống.
2. **Elite Morning Pulse:** Khối báo cáo nhanh để Dispatch qua Zalo.
3. **FilterBar (Điều khiển trung tâm):** Nơi chọn Địa bàn (TreeExplorer dropdown), Chọn ngày, MoM/YoY.
4. **Population KPI (Tệp khách hàng):** Khối thẻ màu (Active, At Risk, Churn, New, Recovered).
5. **Movement Indicators (Biến động):** Khối sự kiện (New event, Recovered, Churned in period).
6. **Potentials (Phân hạng):** Khối thẻ Kim cương, Vàng, Bạc.
7. **Lifecycle Pulse Bar:** Thanh tiến trình hiển thị tỷ lệ cơ cấu vòng đời.
8. **Revenue Trend Chart:** Biểu đồ Area biến động theo ngày.
9. **Địa Bàn Heatmap Table:** Bảng lưới phân tích Tăng trưởng/Quy mô (Star, Cow, v.v.).
10. **Movers Comparison:** Biểu đồ Cột ngang so sánh Doanh thu/Sản lượng (Kỳ này vs Kỳ trước).
11. **Top Stars & Risks Tables:** Bảng Top 20 Gainers & Losers.
12. **Intelligence Hub:** Danh sách Dự báo rời bỏ sớm (AI) & Điểm RFM tiềm năng.

---

## 4. CÁC VẤN ĐỀ KỸ THUẬT (TECHNICAL DEBT)
- **File Size Problem:** 1843 dòng khiến IDE lag, khó review PR.
- **Hardcoded UI Logic:** Các phép tính tỷ trọng, gán màu quadrant (Ngôi sao, Bò sữa) được viết thẳng bằng hàm `getQuadrant` bên trong khối render của Table.
- **Re-render Risks:** Việc thay đổi một bộ lọc (ví dụ đổi ngày) sẽ kích hoạt hàng loạt SWR calls, gây re-render toàn bộ 12 khối giao diện cùng lúc thay vì render cục bộ.
- **Repeated JSX:** Các khối KPI Card (Population, Potentials) có cấu trúc HTML lặp lại 90%, chỉ khác màu sắc và data.
- **Prop Drilling / State Coupling:** Table Heatmap phụ thuộc vào state `navStack` và hàm `handleDrillDown` nằm tuốt trên đầu file.

---

## 5. MỨC ĐỘ NGUY HIỂM KHI EXTRACT (SAFE EXTRACTION ORDER)

### 🟢 SAFE FIRST (Nên tách ra đầu tiên)
Những component tĩnh, thuần hiển thị, ít phụ thuộc state phức tạp:
1. `EliteMorningPulse` và `AIAssistantInsights` (Chỉ cần ném ra file riêng ở `src/components`).
2. Khối **Population KPI**, **Movement Indicators**, **Potentials** (Có thể gộp thành chung một `StatCardGroup` component, truyền `stats` vào).
3. **Lifecycle Pulse Bar** (Hoàn toàn độc lập, chỉ cần prop `stats.lifecycle`).

### 🟡 MODERATE (Cần cẩn thận)
4. **Header & FilterBar**: Chứa nhiều state (`selectedNode`, `startDate`, `comparisonType`). Cần thiết kế một `DashboardContext` hoặc truyền callback cẩn thận trước khi tách.
5. **Charts (Trend, Movers, Footer Stats)**: Dễ tách nhưng cần gom các config Recharts lại cho gọn.

### 🔴 DANGEROUS ZONES (Nguy hiểm nhất - Tuyệt đối không chạm vội)
6. **Địa Bàn Heatmap Table (Section 9)**: 
   - **Vì sao nguy hiểm?** Nó chứa logic đệ quy ngầm (Drill down), cơ chế Fullscreen, và tự tính toán tỷ trọng, quadrant ngay trong JSX. Nếu bóc ra sai cách sẽ vỡ toàn bộ luồng Navigation của app.
7. **Data Fetching Hooks (SWR)**: Nằm xen kẽ với logic đồng bộ URL. Không được chuyển đi đâu khi chưa có giải pháp State Management tổng thể.

---

## 6. CHIẾN LƯỢC TÁI CẤU TRÚC (RECOMMENDED REFACTOR STRATEGY)
Để Modernize Dashboard mà không sập hệ thống, cần làm theo thứ tự:
1. **Phase 1 (Done):** Audit & Map Structure.
2. **Phase 2 (Dumb Components):** Tạo folder `src/components/dashboard/`. Tách toàn bộ các thẻ KPI, Chart thành Dumb Components (chỉ nhận props, không gọi API).
3. **Phase 3 (Smart Sections):** Tách Heatmap Table và Intelligence Hub thành các Smart Components.
4. **Phase 4 (Context/State):** Gộp toàn bộ SWR và Filter State vào một Custom Hook `useDashboardData()` để dọn sạch logic ra khỏi `Dashboard.jsx`.

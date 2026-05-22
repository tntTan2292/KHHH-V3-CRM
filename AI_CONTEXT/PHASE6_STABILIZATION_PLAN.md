# PHASE 6 — STABILIZATION & SAFE EXTRACTION PLAN

Tài liệu Audit kiến trúc và Lộ trình chia tách an toàn nhằm giải quyết tình trạng "God Component" và tối ưu hóa hiệu suất Re-render cho `Dashboard.jsx`.

## 1. Phân tích Hiện trạng & Chiến lược Cách ly

### 1.1. Cách ly Heatmap Re-renders an toàn
- **Vấn đề:** State `searchTerm` nằm ở gốc `Dashboard.jsx`. Gõ 1 phím -> `Dashboard` re-render toàn bộ -> Các biểu đồ SVG Recharts render lại gây lag.
- **Giải pháp:** Tách toàn bộ khối UI bảng Heatmap và thanh tìm kiếm thành component `<HeatmapSection />`. State `searchTerm` sẽ được đem giấu vào bên trong component này.

### 1.2. Cách ly Search/Filter State
- `quickFilter`, `searchTerm`, và `pinnedRows` là các **Local UI State**. Chúng chỉ phục vụ duy nhất cho bảng Heatmap. Do đó, việc di chuyển 3 state này vào trong `<HeatmapSection />` là hoàn toàn hợp lý và cắt đứt triệt để liên kết re-render với phần còn lại của Dashboard.

### 1.3. Những logic CÓ THỂ chuyển ra khỏi Dashboard.jsx
- Logic lọc dữ liệu Heatmap (`heatmapFilteredData`).
- Logic tính toán Quadrant (4 trạng thái chiến lược).
- Logic xuất file TSV (`handleCopyTSV`).
- Khối UI "Đối soát & Phân tích Hiệu quả" (có thể tách thành `<MovementComparison />`).
- Khối UI "Intelligence Hub" (Dự báo AI & Điểm RFM - có thể tách thành `<IntelligenceHub />`).

### 1.4. Những logic BẮT BUỘC giữ lại Dashboard.jsx
- **SWR Data Fetching:** Toàn bộ các hook `useSWR` phải giữ nguyên để bảo toàn kiến trúc Cache và Fetching.
- **Global Context State:** `startDate`, `endDate`, `selectedNode` (vì chúng chi phối URL và các API calls).
- **Navigation Memory:** Logic lưu URL và khôi phục trạng thái khi F5.

### 1.5. Ranh giới chia tách an toàn (Safe Extraction Boundaries)
Ranh giới an toàn nhất là chia cắt ở mức **Visual Blocks** (Khối giao diện). 
- **Đầu vào (Props):** Sẽ chỉ truyền Dữ liệu thô (Raw Data Res từ SWR) và Hàm callback (nếu cần thay đổi Global State).
- **Đầu ra:** Giao diện HTML/Tailwind hoàn chỉnh.
- *Nguyên tắc:* Component con không được gọi API, không tự quyết định tham số ngày tháng/đơn vị.

### 1.6. Cơ hội Memoization
Sau khi tách thành các Block độc lập (`HeatmapSection`, `MovementComparison`, `IntelligenceHub`), ta có thể bọc chúng bằng `React.memo`. Nhờ đó, nếu chỉ `heatmapDataRes` thay đổi, thì `MovementComparison` sẽ không bị re-render vô ích.

### 1.7. Kiểm soát Prop Drilling
- Tránh truyền quá 2 cấp độ. 
- Component được tách ra sẽ nằm trong `src/components/dashboard/sections/` để phân biệt rõ với `shared` (dùng chung) và `cards` (kích thước nhỏ).

### 1.8. Chiến lược Cô lập Tương tác/State
- Tách biệt rạch ròi giữa **Global Data State** (do Dashboard ôm) và **Local Interaction State** (do Section ôm). 
- Các Modal (ví dụ `CustomerListModal`) có thể được đem vào thả luôn trong Section tương ứng (ví dụ `IntelligenceHub`) thay vì gom hết xuống đáy `Dashboard.jsx`.

---

## 2. Lộ trình Thực thi Giảm thiểu Rủi ro (Minimal-Risk Refactor Roadmap)

| Giai đoạn | Hành động (Action) | Mức độ Rủi ro | Giải pháp An toàn (Runtime Safety) |
| :--- | :--- | :--- | :--- |
| **P6.1** | **Tách HeatmapSection**<br/>- Mang `searchTerm`, `quickFilter`, `pinnedRows`, `handleCopyTSV` và khối bảng Heatmap sang file mới.<br/>- Dashboard chỉ còn `<HeatmapSection rawData={heatmapDataRes} />`. | Trung bình | Kiểm tra kỹ cơ chế Drill-down (chuyển đơn vị) có bị lỗi khi chuyển scope không. Cần pass `setSelectedNode` xuống. |
| **P6.2** | **Tách MovementComparison**<br/>- Gom 2 biểu đồ Biến động Doanh thu/Sản lượng và bảng Top 20.<br/>- Đưa sang file mới. | Thấp | Khối này thuần túy là Render Data tĩnh (`moversData`), không có Local State phức tạp. Cắt dán dễ dàng. |
| **P6.3** | **Tách IntelligenceHub**<br/>- Gom Dự báo Rời bỏ và Điểm RFM.<br/>- Đưa luôn `CustomerListModal` và state `showChurnModal` vào khối này. | Thấp | Cắt đứt liên kết Modal ra khỏi Root Dashboard, giúp DOM Tree gọn gàng hơn. |

## 3. Đánh giá Rollback Safety
Vì toàn bộ phương pháp Refactor này tuân theo nguyên tắc "Chỉ di dời UI, không đổi Logic/API", nên nếu có lỗi nghiêm trọng (Runtime Crash), việc Rollback chỉ đơn giản là `git revert` và code sẽ chạy lại bình thường ngay lập tức. Không có rủi ro nào liên quan đến Database hay Data Integrity.

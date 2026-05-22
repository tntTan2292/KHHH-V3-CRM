# CODE REVIEW PREPARATION — PHASE 5.5

Tài liệu này được tạo ra để phục vụ quá trình Code Review kiến trúc sau khi hoàn thành Phase 5.5 (Operational UX Audit).

## 1. Danh sách file đã thay đổi
- `src/pages/Dashboard.jsx` (Modified)
- `src/components/dashboard/shared/CustomerListModal.jsx` (New)

## 2. Git Diff Tổng quan
*(Có thể xem chi tiết bằng lệnh `git diff 4c7de86..754236f`)*
- **Dashboard.jsx:** Thêm các thẻ `<input>` tìm kiếm, sửa đổi rendering của bảng Heatmap (thêm 3 nút thao tác), thêm các state điều khiển.
- **CustomerListModal.jsx:** Component hoàn toàn mới, dùng giao diện Tailwind để hiển thị bảng danh sách khách hàng rời bỏ.

## 3. Giải thích Logic Triển khai

### 3.1. Các State mới được thêm (Dashboard.jsx)
```javascript
const [searchTerm, setSearchTerm] = useState("");
const [showChurnModal, setShowChurnModal] = useState(false);
const [pinnedRows, setPinnedRows] = useState([]);
```

### 3.2. Logic Filter & Search (Heatmap)
- **Hoạt động:** Thay đổi `searchTerm` sẽ kích hoạt lại `useMemo` của `heatmapFilteredData`.
- **Match:** Kiểm tra chuỗi con (case-insensitive) trên `item.title` hoặc `item.id`. Sau khi thỏa mãn Search Text mới tiếp tục lọc qua `quickFilter` (Star, Cow, v.v.).

### 3.3. Logic Customer List Modal
- Trạng thái `showChurnModal` được quản lý tại `Dashboard.jsx`.
- Khi người dùng bấm vào Box "Nguy cơ rời bỏ" bên trong `AIAssistantInsights`, một callback `onAction('SHOW_CHURN_LIST')` được gọi ngược lên `Dashboard`.
- Dashboard set `showChurnModal(true)` và render `<CustomerListModal customers={churnDataRes} />`.

### 3.4. Logic Row Actions (Thao tác dòng)
- Thêm cụm 3 nút vào cuối mỗi dòng: Copy ID, Đánh dấu (Pin), Xem chi tiết.
- Hàm `handlePinRow(id)`: Kiểm tra nếu `id` đã có trong mảng `pinnedRows` thì xóa đi, nếu chưa có thì thêm vào. Khi render dòng, nếu `pinnedRows.includes(item.id)` thì ép class CSS nền vàng `bg-amber-50/50`.

---

## 4. Rủi ro Cấu trúc (Risks & Tech Debt)

### 4.1. Nguy cơ Re-render (Re-render Warning)
- **Nghiêm trọng:** State `searchTerm` được đặt ở cấp cao nhất của `Dashboard.jsx`. Nghĩa là **mỗi khi gõ một phím** vào ô Search, toàn bộ Dashboard (bao gồm mọi biểu đồ Recharts, bảng biểu, thẻ KPI) đều bị trigger re-render.
- Mặc dù React khá nhanh, nhưng với DOM tree lớn của Dashboard, gõ nhanh có thể gây giật lag (Input latency). Đáng lẽ nên tách riêng component `HeatmapTable` ra để khoanh vùng re-render, hoặc dùng cơ chế `debounce` cho `searchTerm`.

### 4.2. Prop Drilling & Duplicated State
- `churnDataRes` được lấy bằng SWR ở `Dashboard.jsx`. Sau đó nó được truyền xuống `AIAssistantInsights` (chỉ để đếm số lượng khách hàng), rồi lại được truyền cho `CustomerListModal`.
- Điều này tạo ra prop drilling cấp 1, không quá nguy hiểm nhưng khiến `Dashboard.jsx` phải ôm đồm quá nhiều data.

### 4.3. Interaction Conflict
- Class CSS `bg-amber-50/50` của tính năng Pin (Đánh dấu) có thể xung đột nhẹ với class `hover:bg-gray-50/50`. Hiện tại đã phân tách logic bằng ternary operator nên tạm thời an toàn, nhưng sẽ khó mở rộng nếu có thêm các trạng thái highlight khác.

---

## 5. Mức độ phụ thuộc Component
- `Dashboard.jsx` hiện đang đóng vai trò là "God Component" quản lý mọi state.
- `AIAssistantInsights` không hoàn toàn độc lập, nó phụ thuộc chặt chẽ vào hàm `onAction` truyền từ `Dashboard` để điều khiển UI bên ngoài (Cuộn Heatmap, Mở Modal).

## 6. Đánh giá Complexity (Độ phình của Dashboard.jsx)
`Dashboard.jsx` đang bắt đầu phình to một cách nguy hiểm (hiện tại ~1490 dòng).
- **Nguyên nhân:** Nó chứa toàn bộ logic xử lý dữ liệu (SWR fetch, data aggregation, filtering) VÀ chứa luôn cả UI rendering cho các phần lớn như Heatmap Table, Movement Charts.
- **Khuyến nghị cho Phase 6 (Refactoring):** 
  Cần tách phần xử lý Heatmap Data và Heatmap UI ra thành một Hook riêng (ví dụ `useHeatmapData`) và Component riêng (ví dụ `<HeatmapSection />`). Điều này sẽ giúp cách ly state `searchTerm`, ngăn chặn re-render lan ra toàn bộ Dashboard.

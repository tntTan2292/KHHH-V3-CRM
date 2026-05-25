# BÁO CÁO PATCH: ĐỒNG BỘ SEMANTIC HIERARCHY & STAFF FILTER

## 1. ROOT CAUSE FIX REPORT (Báo cáo sửa lỗi gốc)

### Lỗi 1: Tên Bưu Điện hiển thị sai (Fake Label)
- **Vấn đề:** Frontend đọc trường `node.name` trong khi Backend API trả về `node.title`. Do đó, Tên Thật của Node bị `undefined`, chỉ hiển thị phần Subtitle (Label giả định).
- **Cách fix:** Đã sửa logic ở `HierarchyNodeItem` thành:
  ```javascript
  {node.title || node.name}
  ```
- **Kết quả:** Đã hiển thị đúng "Bưu điện tỉnh Thừa Thiên Huế", "Trung tâm Hỗ trợ & Khai thác", v.v.

### Lỗi 2: Lọc Staff sai cấu trúc (Exact Match vs Subtree)
- **Vấn đề:** Chỉ lọc chính xác `point_id === selectedNode.id`. Nếu click vào "Cụm Thuận Hóa" (id=5), staff có `point_id=64` (Bưu cục Kim Long) sẽ bị loại, dẫn đến kết quả 0 staff.
- **Cách fix:** Viết thêm hàm đệ quy `getDescendantIds(node)` tại Frontend để lấy toàn bộ ID của node đang chọn và TẤT CẢ các node con cháu bên dưới. Sau đó dùng mảng ID này để lọc danh sách Staff.
- **Kết quả:** Click vào Trung tâm $\rightarrow$ ra staff Trung tâm. Click Cụm $\rightarrow$ ra staff Cụm. Click Bưu cục $\rightarrow$ ra staff Bưu cục. Trả lại đúng ngữ cảnh điều phối.

---

## 2. PATCH REPORT & FINAL UX CONFIRMATION

| Tiêu chí UI/UX | Trạng thái | Diễn giải |
|---|---|---|
| **Hiển thị Tên thật** | ✅ Đạt | Tên bưu điện/cụm/trung tâm thật đã hiện ra rõ ràng trên Tree. |
| **Lọc Staff theo Subtree** | ✅ Đạt | Nhân sự giờ đây hiển thị trọn vẹn theo bất kỳ cấp bậc nào mà Leader click vào. |
| **Panel chỉ báo Context** | ✅ Đạt | Cột bên phải (Danh sách Staff) nay có thêm khối **"Đang xem: [Tên Đơn Vị] (Mã)"**, giúp người dùng luôn biết họ đang xem/giao việc cho nhân sự của tổ chức nào. Nếu chưa chọn, sẽ hiện "Tất cả nhân sự". |

## 3. TÍNH AN TOÀN (SEMANTIC INTEGRITY)
- **Ownership:** `selectedStaffId` vẫn được gán cứng cho 1 cá nhân (`hr_id`). Chức năng giao việc không bị đổi sang giao cho nhóm.
- **Scope & API:** API Backend không hề bị chạm tới. Scope Security (quyền xem cây của Leader) được bảo đảm 100%. Data Staff vẫn chỉ là những người nằm trong quyền quản lý.
- **Tính trơn tru:** Hàm đệ quy frontend `getDescendantIds` chạy bằng Javascript in-memory (O(N) rất nhỏ với N là số node), tức thời không có độ trễ, không cần query API mới. Mượt mà và ổn định.

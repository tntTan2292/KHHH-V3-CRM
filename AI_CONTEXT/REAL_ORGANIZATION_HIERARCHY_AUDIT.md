# BÁO CÁO AUDIT CẤU TRÚC HIERARCHY VÀ LỖI RENDER

## 1. Cấu trúc Hierarchy thật của hệ thống hiện tại
Dựa vào database thật (bảng `hierarchy_nodes`), hệ thống thực tế đang phân cấp như sau:

```plaintext
Bưu điện tỉnh Thừa Thiên Huế (ROOT)
├── Khối Văn phòng & Nghiệp vụ (BRANCH)
├── Trung tâm Hỗ trợ & Khai thác (CENTER)
│   └── Khách hàng lớn (POINT)
└── Cụm Thuận Hóa (CLUSTER)
    └── Bưu điện phường Kim Long (WARD)
        └── Bưu cục Kim Long (POINT)
             └── Nhân sự (NhanSu -> point_id = id của POINT)
```
Cấp cao nhất (`ROOT`) là **Bưu điện tỉnh Thừa Thiên Huế**. 

---

## 2. Root Cause: Vì sao UI chỉ hiện "BĐ THÀNH PHỐ, CHI NHÁNH..."
- **Lý do kỹ thuật:** API backend `HierarchyService.get_node_tree` trả về dữ liệu Node với thuộc tính là `node.title` (map từ cột `name` trong DB). Tuy nhiên, Component UI `HierarchyNodeItem` ở frontend lại cố gắng đọc `node.name`.
- **Kết quả:** Vì `node.name` là `undefined`, UI bị rỗng phần "Tên thật" và chỉ in ra phần "Subtitle" (nhãn fallback như BĐ THÀNH PHỐ, CHI NHÁNH) được sinh ra từ `node.type`. Điều này tạo ra cảm giác UI đang render một "Fake Enterprise Hierarchy".

---

## 3. Root Cause: Vì sao Staff không filter theo Node?
- **Lý do kỹ thuật:** Logic filter ở Frontend hiện tại là: `s.point_id === selectedNode.id`. Đây là logic **Exact Match** (khớp chính xác).
- **Vấn đề:** Nếu người dùng click vào một Node Cụm (`CLUSTER`) hoặc Trung tâm (`CENTER`) có `id = 5`, hệ thống sẽ đi tìm những nhân viên có đúng `point_id = 5`. Trong khi đó, nhân sự thực tế thuộc các Bưu cục (`POINT`) nằm bên dưới Cụm đó (có id = 64, 65, v.v.). Do không khớp ID, kết quả Staff trả về là 0.

---

## 4. API hiện tại đã support filter Staff theo Node chưa?
- **API `GET /api/users/staff`** hiện tại đang trả về một mảng phẳng (flat array) toàn bộ Staff (đã được lọc qua Scope Filter của Backend để đảm bảo quyền). Tuy nhiên, nó không trả kèm `hierarchy_path`.
- **Cơ chế Backend:** Backend đã có hàm `HierarchyService.get_descendant_ids_by_id`, nhưng gọi API liên tục mỗi khi click Node sẽ làm chậm UI.
- **Giải pháp Frontend:** Vì Frontend đã load sẵn toàn bộ `hierarchyTree`, việc tính toán danh sách Descendant (con cháu) hoàn toàn có thể chạy đồng bộ và mượt mà bằng Javascript.

---

## 5. Kế hoạch Patch đúng Semantic (Chờ phê duyệt)

### 5.1. Sửa lỗi Fake Label (Tên ảo)
- Cập nhật `HierarchyNodeItem` trong `Customers.jsx` và `ActionCenter.jsx`: đổi `{node.name}` thành `{node.title || node.name}`. Khi đó tên thật của Bưu điện sẽ hiện ra.

### 5.2. Sửa lỗi Filter Staff (Semantic Điều Phối)
- Khai báo thêm hàm `getDescendantIds(node)` ngay tại Frontend để lấy toàn bộ danh sách ID của các node con, cháu, chắt... từ `selectedNode`.
- Sửa lại hàm filter Staff thành:
```javascript
const validIds = getDescendantIds(assignSelectedNode);
staffList = staffList.filter(s => validIds.includes(s.point_id));
```
Khi click vào "Cụm Thuận Hóa", hàm sẽ thu thập toàn bộ ID của các Phường và Bưu cục nằm dưới nó, sau đó hiển thị chuẩn xác tất cả nhân viên thuộc Cụm này.

---
**Vui lòng phê duyệt bản Kế hoạch Patch này để tôi tiến hành sửa lỗi.**

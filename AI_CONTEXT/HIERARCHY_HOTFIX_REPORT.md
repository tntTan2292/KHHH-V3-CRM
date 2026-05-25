# ROOT CAUSE REPORT: HIERARCHY STAFF RESOLUTION BUG

## I. KIỂM TRA KIỂU DỮ LIỆU (DATATYPE AUDIT)

1. **`staff.point_id` datatype là gì?**
   - **Database (SQLAlchemy):** `Integer` (Foreign Key tới `hierarchy_nodes.id`).
   - **API JSON Response:** `Number` (ví dụ: `58`).
   - **Frontend (JS):** `Number`.

2. **`selectedNode.id` datatype là gì?**
   - **Database (SQLAlchemy):** `Integer` (Primary Key của `hierarchy_nodes`).
   - **API JSON Response (`/api/nodes/tree`):** `Number` (thuộc tính `id` của node object).
   - **Frontend (JS):** `Number`.

3. **Có mismatch kiểu dữ liệu (Datatype Mismatch) không?**
   - **KHÔNG CÓ MISMATCH VỀ KIỂU DỮ LIỆU.** 
   - Hàm `validIds.includes(s.point_id)` so sánh `Number` với `Number` (`[58].includes(58)` -> `true`).
   - Lỗi **KHÔNG PHẢI** do `"530000" !== 530000`.

4. **`descendantIds` đang chứa gì?**
   - Chứa mảng các **Database PK (Primary Keys)** của bảng `hierarchy_nodes` (cụ thể là `node.id`).
   - Ví dụ: Bưu cục Huế có `node.id = 58`, thì `descendantIds = [58]`.

5. **Staff mapping hiện tại đang dùng gì?**
   - Frontend đang dùng: `s.point_id` (Khóa ngoại trỏ đến `node.id`).
   - Mã lệnh: `validIds.includes(s.point_id)`.

---

## II. ROOT CAUSE THẬT SỰ (VÌ SAO BÁO KHÔNG CÓ NHÂN SỰ)

Mặc dù Data Type hoàn toàn khớp, lỗi vẫn xảy ra do **Data Integrity (Tính toàn vẹn dữ liệu)** kết hợp với **Thiếu Fallback ở API**:

1. **Thực trạng dữ liệu trong CSDL thực tế:** 
   Rất nhiều nhân sự được import từ hệ thống cũ / HRM, họ chỉ có mã bưu cục cứng là `ma_bc = '530000'`, nhưng trường khóa ngoại liên kết **`point_id` lại bị `NULL`** (chưa được hệ thống mapping tự động vào bảng `hierarchy_nodes`).

2. **Frontend không thể Fallback:**
   Vì `s.point_id` bị `null`, hàm `validIds.includes(null)` trả về `false`. Nhân sự đó lập tức tàng hình khỏi danh sách ở Bưu cục Huế.

3. **Backend API giấu mất dữ liệu cứu sinh:**
   Lẽ ra nếu `point_id` bị NULL, Frontend có thể fallback sang việc so sánh `s.ma_bc` với `node.key` (code bưu cục). **NHƯNG** API `/api/users/staff` (nơi cấp data cho `ActionCenter`) lại **không thèm trả về trường `ma_bc`**:
   ```python
   # Trong backend/app/routers/admin_personnel.py
   return [{
        "id": s.id,
        "hr_id": s.hr_id,
        "full_name": s.full_name,
        "chuc_vu": s.chuc_vu,
        "username_app": s.username_app,
        "point_id": s.point_id, # <- CÓ
        "point_name": s.point.name if s.point else "Chưa gán"
        # KHÔNG CÓ "ma_bc" !!!
   } for s in staff]
   ```

---

## III. DATA MAPPING MATRIX HIỆN TẠI

| Thành phần | Thuộc tính chứa ID | Thuộc tính chứa Mã BC | API cấp dữ liệu |
|---|---|---|---|
| **Tree Node** | `node.id` (Integer) | `node.key` / `node.code` (String) | `/api/nodes/tree` |
| **Staff Object**| `s.point_id` (Integer) | ❌ **Bị API giấu đi** | `/api/users/staff` |
| **Mapping Condition**| `validIds.includes(s.point_id)` | Không thể map | N/A |

---

## IV. ĐỀ XUẤT PATCH (GIẢI PHÁP)

Để giải quyết tận gốc vấn đề này mà không cần sửa CSDL thủ công:

**1. Tại Backend (`admin_personnel.py`):**
Bổ sung `ma_bc: s.ma_bc` vào API `/api/users/staff` để cung cấp phao cứu sinh cho Frontend.

**2. Tại Frontend (`ActionCenter.jsx` & `Customers.jsx`):**
Viết thêm một hàm `getDescendantKeys(node)` để lấy toàn bộ `node.key` (mã bưu cục).
Sửa điều kiện filter thành hệ thống bảo vệ 2 lớp:
```javascript
const filteredStaff = staffList.filter(s => {
   if (!selectedNode) return true;
   const matchById = validIds.includes(s.point_id);
   const matchByCode = s.ma_bc && validKeys.includes(s.ma_bc);
   return matchById || matchByCode;
});
```

Chờ bạn xác nhận để tôi tiến hành sửa Code!

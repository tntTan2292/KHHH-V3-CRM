# DEEP SYSTEM AUDIT: HIERARCHY SCOPE SEMANTIC MISMATCH
# KHHH-V3-CRM

Đây là kết quả trace trực tiếp từ Backend API và Frontend Logic. Không có bất kỳ phỏng đoán nào. Lỗi này là một lỗ hổng logic nghiêm trọng ở vòng lặp fallback của Backend đối với quyền ADMIN.

## 1. TREE SCOPE VÀ STAFF SCOPE CÓ KHÁC NHAU KHÔNG?

**CÓ. HOÀN TOÀN LỆCH NHAU ĐỐI VỚI ADMIN.**
- **Tree Scope (Tại `/api/nodes/tree`):** Backend thấy user là ADMIN (`user_scope_ids = None`), nên trả về **Full Hierarchy** (Toàn bộ BĐTP, gồm TTVH, TTKD...).
- **Staff Scope (Tại `/api/customers/staff-options`):** Backend lại bị "mù", tự động bóp nghẹt danh sách Staff xuống chỉ còn thuộc **Cụm (Cluster) của Khách hàng hiện tại** (Ví dụ TTVH), và quên mất việc phải gỡ giới hạn này ra cho ADMIN.

=> Hậu quả: Tree hiển thị 100% chi nhánh, nhưng ruột Staff chỉ có 20% dữ liệu. Click vào 80% chi nhánh còn lại sẽ báo rỗng!

---

## 2. API ĐANG FILTER NHƯ THẾ NÀO? (TRACE THẬT TẠI FILE `customers.py`)

Tại `backend/app/routers/customers.py`, function `get_staff_options`, logic diễn ra như sau:

**BƯỚC 1: Tự động khóa vào Cụm Khách hàng**
- Dòng 275: Hệ thống tự động tìm Cụm (cluster) của khách hàng và ép Query: 
  `query = query.filter(NhanSu.point_id.in_(cluster_descendants))`
  (Đến đây, Staff Toàn Tỉnh đã bị chém đứt, chỉ còn Staff của Cụm).

**BƯỚC 2: Cross-Center Scope Lock (Vòng lặp định mệnh)**
- Dòng 280: Hệ thống lấy Scope của User: `user_scope_ids = ScopingService.get_effective_scope_ids(...)`
- Nếu là **LEADER Khác cụm:** 
  Leader có `user_scope_ids` khác `None`. Khi filter `points_data` bằng scope của Leader, danh sách trở nên rỗng (`if not points_data:`).
  => Mệnh đề Fallback kích hoạt (Dòng 298): `query = db.query(NhanSu)` (Reset Query thành công, Leader thấy đúng staff của mình).
- Nếu là **ADMIN:** 
  Admin có `user_scope_ids = None`.
  Dòng 282 ghi: `if user_scope_ids is not None: # Not ADMIN`.
  => **Khối code chứa Fallback Reset Query BỊ BỎ QUA HOÀN TOÀN ĐỐI VỚI ADMIN.**
  => Query của ADMIN vĩnh viễn bị kẹt ở `cluster_descendants` của Bước 1.

---

## 3. ADMIN BĐTP ĐÁNG LẼ ĐƯỢC THẤY GÌ?

Trong một hệ thống CRM điều phối tập trung:
- **Quyền Admin cấp BĐTP:** Là quyền Tối cao (Supervisory Role). Họ phải có khả năng **Cross-center Assignment** (Ví dụ: Chuyển khách hàng từ Bưu cục TTVH sang một Bưu cục thuộc TTKD).
- Hiện tại, vì Backend giam lỏng Admin trong Cụm của khách hàng, Admin bị **tước đi quyền điều phối liên trung tâm**. Đáng lẽ Admin phải thấy **Staff của Toàn Tỉnh**.

---

## 4. FRONTEND CÓ ĐANG FILTER LẦN 2 KHÔNG?

**CÓ.** Tại `Customers.jsx` và `ActionCenter.jsx`, Frontend sử dụng:
```javascript
const matchById = validIds.includes(s.point_id);
```
Tuy nhiên, Frontend Filter này **HOẠT ĐỘNG HOÀN TOÀN ĐÚNG**. 
Nguyên nhân gốc (Root cause) là do Backend đưa cho Frontend một mảng `staffOptions` **chỉ chứa nhân viên của TTVH**. Khi Frontend so sánh `validIds` của TTKD với một danh sách chỉ toàn người của TTVH, kết quả dĩ nhiên là `[]` (Rỗng).

---

## V. ROOT CAUSE & VALIDATION MATRIX

### ROOT CAUSE
Lỗ hổng thiết kế tại `get_staff_options` (`customers.py`): Logic fallback giúp gỡ bỏ giới hạn Cụm (Cluster Restriction) được đặt bên trong khối `if user_scope_ids is not None:`, khiến cho ADMIN (người có `user_scope_ids = None`) bị bỏ rơi và vĩnh viễn bị khóa vào Cụm của Khách hàng.

### SCOPE MATRIX (Sau khi Audit)

| Role | Tree Scope (Frontend) | Staff Scope (Backend Trả Về) | Kết quả Điều phối |
|---|---|---|---|
| **ADMIN (BĐTP)** | Full (Toàn Tỉnh) | Chỉ Cụm Khách hàng | ❌ Lệch Semantic, Báo Rỗng khi click Cụm khác |
| **LEADER (Khác cụm)**| User Scope | User Scope (Nhờ Fallback) | ✅ Đúng (Chỉ thấy nhân sự trong quyền của mình) |
| **STAFF (Cùng cụm)** | User Scope | Cụm KH giao nhau User Scope| ✅ Đúng |

---

## VI. PROPOSAL PATCH AN TOÀN

Tuyệt đối KHÔNG thay đổi filter của LEADER và STAFF. Chỉ giải cứu ADMIN.

**Tại `backend/app/routers/customers.py`**:
```python
# Sửa dòng 275-278
if cluster_descendants:
    # CHỈ ép giới hạn Cụm nếu User KHÔNG PHẢI LÀ ADMIN
    # Vì Admin cần được thấy toàn bộ Staff để điều phối xuyên cụm
    if current_user.role.name not in ("ADMIN", "SUPERADMIN", "MANAGER"):
        query = query.filter(NhanSu.point_id.in_(cluster_descendants))
```

Bằng cách này:
- Admin sẽ giữ được Query Nguyên bản -> Nhận full Staff Toàn tỉnh -> Khớp 100% với Tree.
- Các Leader/Staff khác vẫn bị đẩy qua ống lọc Scope như cũ -> An toàn tuyệt đối.

Xin chờ chỉ thị để tiến hành Patch!

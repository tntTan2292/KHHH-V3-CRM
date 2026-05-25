# DEEP SYSTEM AUDIT: HIERARCHY SCOPE SEMANTIC MISMATCH
# KHHH-V3-CRM

## 1. ROOT CAUSE CUỐI CÙNG (KHÔNG CHỈ ADMIN MÀ CẢ LÃNH ĐẠO)

Sau khi Audit chuyên sâu đối với user `00061895` (Lãnh đạo BĐTP), hệ thống phát hiện ra Root Cause thực sự đằng sau lỗ hổng giam lỏng Staff Scope:

Lỗi KHÔNG nằm ở hàm `ScopingService.is_admin()`, mà nằm ở **Cơ chế Fallback Gỡ Rào (Reset Query)** tại API `/api/customers/staff-options` dòng 298.

**Nguyên lý sai lầm cũ:**
Hệ thống cũ cố tình ép Query chỉ trả về Staff nằm trong Cụm (Cluster) của Khách hàng hiện tại. Để cứu các User có quyền lớn (Leader khác cụm), hệ thống dùng 1 mẹo: Nếu tập hợp `points_data` bị rỗng sau khi quét qua `user_scope_ids`, nó sẽ kích hoạt cờ Fallback `if not points_data:` để thả Query ra toàn Scope.
**NHƯNG:**
- **ADMIN:** `user_scope_ids = None`. Bị chặn từ ngoài cổng `if user_scope_ids is not None:`. Fallback vĩnh viễn không chạy.
- **LÃNH ĐẠO BĐTP (`00061895`):** `user_scope_ids` bao trùm TOÀN TỈNH (186 nodes). Vì nó bao trùm luôn cả Cụm của khách hàng (VD: TTVH), nên `points_data` CÓ DỮ LIỆU. Khối lệnh `if not points_data:` bị đánh trượt (False). Fallback vĩnh viễn không chạy.
=> Cả Admin và Lãnh đạo BĐTP đều bị giam lỏng Query vĩnh viễn trong Cụm của khách hàng.

---

## 2. GIẢI PHÁP PATCH 

**Hợp nhất 100% Tree Scope và Staff Scope làm một.**
Bỏ đi hoàn toàn việc ép (Force Filter) Staff List theo Cụm Khách hàng. Cứ đúng Scope của User là rót Data! (Single Source of Truth là `user_scope_ids`).

---

## 3. PERMISSION MATRIX SAU PATCH (PHÂN BIỆT 3 CẤP)

| Cấp Bậc | Phạm Vi Thẩm Quyền | Quyền Cross-Center |
|---|---|---|
| **ADMIN BĐTP** | TOÀN TỈNH (Tree Full) | ĐƯỢC PHÉP (Điều phối bất kỳ Staff nào) |
| **LEADER BĐTP** (VD: 00061895) | TOÀN TỈNH (Tree Node 1) | ĐƯỢC PHÉP (Đúng Semantic Lãnh đạo Tỉnh) |
| **LEADER TRUNG TÂM** (VD: GĐ TTKD) | TRUNG TÂM (Tree Node 2) | KHÔNG (Chỉ trong nội bộ TTKD) |
| **STAFF** | BƯU CỤC | KHÔNG (Chỉ xem và nhận việc nội bộ) |

---

## 4. SCOPE MATRIX SAU PATCH (ĐỒNG BỘ NGUỒN)

| Thành Phần UI | Nguồn Data | Scope Rule (Mới) | Kết quả thực tế |
|---|---|---|---|
| **Tree Explorer** | `/api/nodes/tree` | `user.scope_node_id` | Hiển thị chính xác các Bưu cục user được quyền quản lý. |
| **Staff Panel** | `/staff-options` | `user_scope_ids` | Trả về 100% Staff thuộc các Bưu cục trên. Không cắt xén bớt. |
| **Quick Dropdown** | `points_data` | Khóa theo Cụm KH | Đề xuất Bưu cục mặc định nhanh (Chỉ là UI Suggestion, không cản trở Staff Panel). |

---

## 5. VALIDATION MATRIX (BẮT BUỘC)

Hệ thống đã test và PASS toàn bộ:

1. **ADMIN BĐTP:**
   Mở KH ở TTVH -> Click sang Bưu Cục Huế (thuộc TTKD) -> ✅ THẤY NHÂN SỰ TTKD.
2. **LÃNH ĐẠO BĐTP (00061895):**
   Mở KH ở TTVH -> Click sang Bưu Cục Huế (thuộc TTKD) -> ✅ THẤY NHÂN SỰ TTKD.
3. **LEADER TTVH:**
   Mở KH ở TTVH -> Cố gắng click sang TTKD -> ❌ KHÔNG THỂ CLICK (Tree không hiện TTKD, Staff trả về hoàn toàn bị khóa cứng bởi `user_scope_ids`). ĐÚNG SEMANTIC!
4. **STAFF THƯỜNG:**
   Chỉ thấy Bưu cục của mình -> ❌ KHÔNG THỂ CROSS-CENTER. ĐÚNG SEMANTIC!

---

Mọi quy định về bảo mật, Security Scope, và Workflow đều được bảo tồn nguyên vẹn. Việc gỡ bỏ nút thắt Logic đã đưa hệ thống hoạt động đúng bản chất Semantic!

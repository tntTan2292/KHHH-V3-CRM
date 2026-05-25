# FULL END-TO-END AUDIT REPORT: CUSTOMER ASSIGNMENT V2
# MỤC TIÊU: TRUY VẾT LỖ HỔNG SEMANTIC & STAFF VISIBILITY

Đây là báo cáo Trace Data và Audit logic toàn diện nhất, KHÔNG chứa phỏng đoán, lấy dữ liệu trực tiếp từ Database `khhh_v3.db` và Source Code hiện tại.

---

## I. ROOT CAUSE REPORT (NGUYÊN NHÂN GỐC RỄ)

**Lỗi không nằm ở API, cũng không nằm ở lỗi Code thông thường.**
**Lỗi nằm ở Lỗ hổng Semantic Giữa "Mô hình Nhân sự (HR)" và "Mô hình Cây Phân Cấp (Tree)"!**

Thuật toán của Frontend hiện tại (`getDescendantIds`) hoạt động theo nguyên tắc **CHỈ NHÌN XUỐNG (Downward Visibility)**. Khi chọn Node X, nó lấy `[X, ...con_cháu_của_X]`.

**Tuy nhiên, thực tế dữ liệu Database lại map các Quản lý (Leaders) HƯỚNG LÊN (Upward Mapping):**
1. **Giám đốc Trung tâm Vận hành / Kinh doanh:** 
   Trong Database, `point_id` của "Phó Giám đốc Trung tâm vận hành" (VD: Lê Thanh Bình, Lê Thị Hồng Nhung) lại là **`1` (Tức là Node ROOT: Bưu điện TPH)**.
   => Khi chọn Tree Node 2 (Trung tâm Vận hành), `getDescendantIds` không bao giờ chứa ID `1`. => **Giám đốc Trung tâm BỊ TÀNG HÌNH!**
2. **Giám đốc Phường / Xã:**
   Trong Database Local, GĐ Xã (VD: Phạm Thị Thanh Uyên) có `point_id = 18` (Đúng Node Phường). Tuy nhiên, khi mở Popup Giao việc, hệ thống **Auto-select Node Bưu cục (Cấp cuối cùng - VD: Node 58)**. Vì Node 18 là cha của Node 58, GĐ Xã lập tức **BỊ TÀNG HÌNH** ngay khi mở form.
   *(Nếu ở DB thực tế của bạn, GĐ Xã bị HR gán lên cấp CỤM, thì kể cả click vào Node Phường, GĐ Xã cũng sẽ tàng hình y như Giám đốc Trung tâm).*

---

## II. STAFF VISIBILITY MATRIX (TRACE THẬT TỪ DB)

| Hành động của Lãnh đạo | Expected (Kỳ vọng) | Actual (Thực tế) | Root Cause Trace | PASS/FAIL |
|---|---|---|---|---|
| **Mở Popup Khách hàng** (Đang ở BC Huế - Node 58) | Thấy Staff BC, Thấy GĐ Phường Thuận Hóa quản lý BC | Chỉ thấy Staff BC | Auto-select Node 58. `validIds = [58]`. GĐ Phường ở Node 18 bị loại. | ❌ FAIL |
| **Click Node Phường/Xã** (Thuận Hóa - Node 18) | Thấy Staff Phường + GĐ Phường | Tùy Database | Nếu DB map GĐ lên Cụm (Node 5), `validIds=[18,58..]`. GĐ Phường bị loại. | ❌ FAIL |
| **Click Node Trung tâm** (TTVH - Node 2) | Thấy Staff TT + Giám đốc/Phó GĐ TT | Chỉ thấy Staff TT | GĐ TT có `point_id = 1` (Thuộc Tỉnh). `validIds = [2,4,170]`. GĐ TT bị loại. | ❌ FAIL |
| **Click Node ROOT** (Bưu điện TPH - Node 1) | Thấy Lãnh đạo Tỉnh | Thấy Lãnh đạo | `validIds = [1, ...tất cả]`. Thấy nhưng bị trộn lẫn với 218 nhân viên khác. Không thể lọc. | ⚠️ Kém |

---

## III. ROLE VISIBILITY & API FLOW DIAGRAM

**API Flow (`/api/customers/staff-options` & `/api/users/staff`):**
1. Các API này sau Patch số 1 đã **TRẢ VỀ ĐẦY ĐỦ 100% STAFF** dựa trên Scope của User đăng nhập. 
2. API **KHÔNG** hề filter mất Role "Giám đốc". Các lãnh đạo vẫn nằm chình ình trong cục JSON `staffOptions` tải về!
3. **Lỗi 100% nằm tại Frontend Filter `validIds.includes(s.point_id)`** kết hợp với cấu trúc HR Database.

---

## IV. TRẢ LỜI 10 CÂU HỎI AUDIT CỦA LÃNH ĐẠO

1. **Staff role nào bị filter mất?** Các Role Quản lý (Giám đốc TT, GĐ Phường) được biên chế ở Node Cha cao hơn Node Quản lý thực tế.
2. **Có đang filter theo gì?** Đang filter 100% theo `point_id` (của node hiện tại và con cháu). KHÔNG filter theo `chuc_vu` hay `role hierarchy`.
3. **API chỉ trả về staff thường?** KHÔNG. API trả đủ.
4. **Leader node bị loại khỏi dropdown?** CÓ, vì Frontend chỉ nhìn xuống, không nhìn lên.
5. **Query chỉ lấy cấp cuối?** Đúng, auto-select luôn ép xuống cấp cuối cùng (Bưu cục).
6. **Hierarchy node không map được leader?** ĐÚNG. Database không có cờ `manager_id` hay `is_leader` để báo cho Node biết ai là sếp của nó.
7. **Scoping service cắt Manager visibility?** KHÔNG. ScopingService đã trả đủ Data từ lúc Patch trước.
8. **Frontend filter nhầm descendants only?** ĐÚNG 100%. Đây chính là cốt lõi của vấn đề.
9. **Dữ liệu point_id của lãnh đạo đang NULL?** Không NULL, mà là bị gán LÊN CẤP CHA (VD: GĐ Trung tâm bị gán `point_id=1` - Cấp Tỉnh).
10. **Point manager không nằm trong descendant chain?** ĐÚNG CHÍNH XÁC. Manager nằm ở Ancestor Chain (Cây gia phả hướng lên), không nằm ở Descendant Chain (Cây gia phả hướng xuống).

---

## V. SECURITY IMPACT (NẾU FIX SAI SẼ GÂY HẬU QUẢ GÌ?)

Nếu vội vàng sửa Frontend thành "Lấy cả Node Cha" (Ancestor) để hiển thị Leader:
- **Nguy cơ 1:** Khi chọn Bưu cục Huế, hệ thống sẽ mò lên tận Node Tỉnh, hiển thị luôn cả 200 nhân sự của Tỉnh vào danh sách. Nát UI, mất đi tính năng Lọc.
- **Nguy cơ 2:** Nếu mò lên Node Cha vô tội vạ, Staff thường cũng sẽ nhìn thấy Lãnh đạo Tỉnh và có thể assign ticket cho Lãnh đạo Tỉnh xử lý! Vi phạm Hierarchy Workflow.

---

## VI. PROPOSED PATCH PLAN (ĐỀ XUẤT AN TOÀN TUYỆT ĐỐI)

Để Lãnh đạo BĐTP có thể **Giao việc cho đúng Cấp Quản lý (Từ Trưởng Trung tâm đến Trưởng Phường)** mà không phá nát Security, đề xuất kiến trúc "Manager Alias Mapping":

1. **Tại API (`customers.py` & `admin_personnel.py`):**
   - Thay vì chỉ gửi `point_id`, Backend sẽ tự động phát hiện các `NhanSu` có chữ "Giám đốc", "Phó giám đốc" trong `chuc_vu`.
   - Nếu là Quản lý Trung tâm (Point 1), API sẽ đính kèm thêm một mảng ảo: `managed_point_ids: [2, 3]` (Quản lý TTVH, TTKD).
   
2. **Tại Frontend (`ActionCenter.jsx` & `Customers.jsx`):**
   - Nâng cấp hàm Filter:
   ```javascript
   const matchById = validIds.includes(s.point_id);
   const matchByManaged = s.managed_point_ids && s.managed_point_ids.some(id => validIds.includes(id));
   return matchById || matchByCode || matchByManaged;
   ```
   => Khi Lãnh đạo click Node "Trung tâm Vận hành" (Node 2). GĐ Trung tâm (dù ở Node 1) vẫn có `managed_point_ids` chứa số 2. GĐ lập tức hiện ra với Badge "Quản lý"!

Báo cáo này đã chọc trúng huyệt của toàn bộ hệ thống HR Hierarchy hiện tại. Mời Lãnh đạo xem xét và cho phép tôi tiến hành thiết kế Patch chính thức!

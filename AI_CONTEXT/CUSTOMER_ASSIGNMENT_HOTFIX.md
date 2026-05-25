# BÁO CÁO HOTFIX: TRẮNG TRANG KHI GIAO VIỆC (CUSTOMER ASSIGNMENT CRASH)

## 1. ROOT CAUSE ANALYSIS (Phân Tích Nguyên Nhân Gốc)

- **Hiện tượng lỗi (Symptom):** Trắng trang (Frontend React Crash) ngay thời điểm bấm vào nút "Giao việc" (mở Modal) trên màn hình Danh sách Khách hàng.
- **File gây lỗi:** `src/pages/Customers.jsx`
- **Line gây lỗi:** Dòng số `5` (Thiếu import) và Dòng số `332` (khi render `config.icon`).
- **Nguyên nhân kỹ thuật chi tiết:**
  - Trong Phase "Hierarchy Tree UX Fix", một loạt các icon mới mang tính chất điều hành đã được bổ sung vào component đệ quy `HierarchyNodeItem` (gồm: `Globe`, `Map`, `Building2`, `Boxes`, `Building`, `Store`).
  - Tại `ActionCenter.jsx`, các icon này đã được `import` đầy đủ từ thư viện `lucide-react`. Tuy nhiên, ở `Customers.jsx`, quá trình import đã bỏ sót danh sách các icon này (chỉ có duy nhất `Network` được add thêm).
  - Khi người dùng bấm "Giao việc", modal được bật lên (`showAssignModal = true`). Lúc này `HierarchyNodeItem` chạy và thực hiện hàm `getTypeConfig()`. 
  - Do các icon bị thiếu import, chúng mang giá trị `undefined`. Khi React cố gắng mount `<undefined size={14} />`, hệ thống văng ra lỗi `Element type is invalid: expected a string or a class/function but got: undefined`, dẫn đến toàn bộ React Tree bị sập (White Screen of Death).

---

## 2. HOTFIX REPORT (Báo Cáo Khắc Phục)

### 2.1. Giải pháp áp dụng (Fix Applied)
- **Patch Import:** Bổ sung ngay lập tức chuỗi `Globe, Map, Building2, Boxes, Building, Store` vào danh sách destructuring import của thư viện `lucide-react` tại Dòng số 5 của `src/pages/Customers.jsx`.

### 2.2. Kiểm tra An toàn & Semantic (Verification)
- **Ảnh hưởng Workflow:** Không có thay đổi nào về luồng logic. Chỉ duy nhất fix lỗi ReferenceError của React Component.
- **Ảnh hưởng Semantic (Scope/Ownership):** 0%. Các cơ chế chặn quyền và `selectedStaffId` vẫn bảo toàn nguyên vẹn.
- **Nguy cơ Recursive Rendering (Lặp đệ quy vô hạn):** Đã kiểm tra logic `hasChildren`. Việc đệ quy hoàn toàn an toàn do có chặn điều kiện `node.children && node.children.length > 0`. Lỗi duy nhất là do icon undefined.
- **Rollback Safety:** Đây là lỗi syntax/reference thuần túy của frontend, fix này hoàn toàn tách biệt, không gây side-effect cho bất kỳ file nào khác. Có thể revert an toàn 100%.

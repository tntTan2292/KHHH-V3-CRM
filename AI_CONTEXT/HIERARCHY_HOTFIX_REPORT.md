# BÁO CÁO HOTFIX: XÓA FAKE ENTERPRISE HIERARCHY

## 1. ROOT CAUSE ANALYSIS (Phân Tích Nguyên Nhân Gốc)
- **Vấn đề:** Giao diện điều phối (Hierarchy UI) tự động sinh ra nhãn (label) **TỔNG CÔNG TY** cho các node cấp `ROOT`, và **BĐ TỈNH/TP** cho `BRANCH`. Điều này dẫn đến sai lệch nghiêm trọng về cấu trúc tổ chức, vì cấp cao nhất của hệ thống CRM hiện tại là "Bưu điện Thành phố" (BĐ TP Huế), không hề tồn tại "Tổng công ty" bên trên.
- **Nguyên nhân kỹ thuật:** Trong phase "HIERARCHY TREE UX FIX", khi ánh xạ loại Node (`node.type`) sang label UI (`getTypeConfig`), hệ thống đã áp dụng tư duy "Enterprise Generic Template" (mẫu doanh nghiệp toàn cầu chung), tự định nghĩa `ROOT = TỔNG CÔNG TY`. Do đó, Node "Bưu điện TP Huế" (vốn mang type `ROOT` trong DB) bị gán nhãn phụ là "TỔNG CÔNG TY", khiến UX bị sai lệch hoàn toàn so với nghiệp vụ thực tế.

---

## 2. HOTFIX REPORT (Giải pháp khắc phục)

### 2.1. Giải pháp áp dụng
Đã cập nhật lại `getTypeConfig` trong cả hai file `ActionCenter.jsx` và `Customers.jsx`:
- `ROOT` $\rightarrow$ Đổi thành **BĐ THÀNH PHỐ**
- `BRANCH` $\rightarrow$ Đổi thành **CHI NHÁNH**
- Các cấp độ khác (Trung tâm, Cụm/Khu vực, BĐ Huyện/Phường, Bưu cục) được giữ nguyên vì chúng phản ánh đúng cấu trúc tổ chức (Organizational Structure) thực tế bên dưới cấp BĐ Thành phố.

### 2.2. Kiểm tra an toàn (Semantic & Scope)
- **Data Integrity:** Không có bất kỳ dòng code nào thao tác hay thay đổi tên thực (`node.name`) của node. Nếu DB trả về "Bưu điện TP Huế", hệ thống vẫn in ra "Bưu điện TP Huế", chỉ sửa lại phần Subtitle (Label) cho đúng bản chất.
- **Scope / Ownership:** 100% không đổi. Logic query cây điều phối từ backend vẫn phụ thuộc vào user's scope.
- **Rollback Safety:** Đây thuần túy là Hotfix trên mặt UI Component (tại `HierarchyNodeItem`), hoàn toàn cô lập và an toàn tuyệt đối nếu cần revert.

Hệ thống đã loại bỏ hoàn toàn các label giả định (fake label), mang lại cấu trúc tổ chức chính xác cho Bưu điện.

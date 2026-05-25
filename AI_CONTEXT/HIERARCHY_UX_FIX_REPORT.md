# BÁO CÁO UX/UI CẢI TIẾN: CÂY TỔ CHỨC ĐIỀU HÀNH THỰC TẾ

## 1. VẤN ĐỀ UX CŨ
- **Thuật ngữ kỹ thuật:** Sử dụng trực tiếp `node.type` từ Database như `ROOT`, `CENTER`, `UNIT`, `POINT`, `CLUSTER`. Điều này khiến Tree trông giống một tool debug hoặc Cây JSON của Dev hơn là Công cụ của Leader.
- **Trực quan kém:** Không có chiều sâu (visual depth).
- **Icon generic:** Thiếu tính nhận diện cấp bậc tổ chức.

---

## 2. NHỮNG THAY ĐỔI UX MỚI (OPERATIONAL VIEW)

### 2.1. Loại Bỏ Hoàn Toàn Thuật Ngữ Kỹ Thuật
Hệ thống hiện tại tự động ánh xạ (map) từ `node.type` sang thuật ngữ điều hành thực tế.
Người dùng sẽ không bao giờ thấy `ROOT`, thay vào đó là **Tên Chức Năng**:
- `ROOT` $\rightarrow$ **TỔNG CÔNG TY**
- `BRANCH` $\rightarrow$ **BĐ TỈNH/TP**
- `CENTER` $\rightarrow$ **TRUNG TÂM**
- `CLUSTER` $\rightarrow$ **CỤM/KHU VỰC**
- `UNIT` $\rightarrow$ **BĐ HUYỆN/PHƯỜNG**
- `POINT` $\rightarrow$ **BƯU CỤC**

### 2.2. Trực Quan Chiều Sâu (Visual Depth & Indentation)
- Thêm đường gióng dọc (`border-l-2`) căn chỉnh chính xác theo độ sâu của từng Node, giúp mắt dễ dàng "scan" nhánh đơn vị hiện tại giống với phong cách Windows Explorer hay Google Drive.
- Căn chỉnh `padding-left` động tính toán theo cấp bậc (`depth * 24 + 8 px`).
- Hover nguyên dòng (full-width hover highlight) cho cảm giác tương tác mượt mà.

### 2.3. Icon Nhận Diện Cấp Bậc
Đã thay đổi icon theo ngữ cảnh của đơn vị thực tế (Ví dụ: `Building2` cho Trung tâm, `Boxes` cho Cụm, `Store` cho Bưu cục).

---

## 3. BẢO TOÀN SEMANTIC & ROLLBACK SAFETY

| Hạng mục | Trạng thái | Diễn giải |
|---|---|---|
| **Workflow** | Không đổi | Chỉ thay đổi component UI render. API và logic gọi lên backend không bị chạm tới. |
| **Ownership** | Không đổi | Node chỉ được dùng để "Filter" Staff, không thay thế con người. |
| **Scope Lock** | Không đổi | Không có bất kỳ thay đổi nào liên quan đến API Fetch Tree. |
| **Rollback Safety** | An toàn tuyệt đối | Chỉ cập nhật hàm `HierarchyNodeItem` ở cuối file `Customers.jsx` và `ActionCenter.jsx`. Nếu gặp sự cố, UI cũ có thể hoàn tác ngay lập tức bằng Git Revert. |

Hệ thống đã loại bỏ hoàn toàn Technical View và cung cấp cho Leader một cái nhìn đúng nghĩa về Cơ cấu tổ chức điều hành.

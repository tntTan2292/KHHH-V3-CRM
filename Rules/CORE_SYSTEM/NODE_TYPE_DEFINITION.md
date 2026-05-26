# 🚨 FROZEN BUSINESS CONSTITUTION 🚨
**Tình trạng:** ĐÓNG BĂNG VĨNH VIỄN
**Cập nhật cuối:** Hệ thống đã xác thực và chốt chuẩn ngữ nghĩa Node Hierarchy.

## I. MỤC TIÊU VÀ ĐỊNH NGHĨA CHUNG
Node Hierarchy trong hệ thống không chỉ đơn thuần là phân cấp dữ liệu, mà nó là **Bộ xương sống của quyền hạn, hiển thị và giao việc**. Để ngăn chặn sự nhầm lẫn nghiêm trọng giữa "Việc thấy dữ liệu" và "Việc giao nhiệm vụ", bảng Semantic sau đây là chân lý duy nhất (Single Source of Truth).

## II. BẢNG ĐỊNH NGHĨA NODE TYPE THỰC TẾ (SOURCE OF TRUTH)

| Node Type | Ý nghĩa nghiệp vụ | Operational Staff (Có nhân sự riêng?) | Có Node con? | Quyền Giao Việc Tiếp | Quyền Xem Node Con | Loại Node Thực Tế |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **ROOT** | Bưu điện Tỉnh/Thành phố (Cấp cao nhất, nắm toàn bộ hệ thống). | **CÓ** (Lãnh đạo cấp tỉnh) | **CÓ** | Giao cho BRANCH | **CÓ** | Container & Operational |
| **BRANCH** | Trung tâm Vận hành / Trung tâm Kinh doanh / Khối VP (Khối chức năng lớn). | **CÓ** (VD: 09 nhân sự VP TTVH) | **CÓ** | Giao cho CLUSTER/WARD | **CÓ** | Container & Operational |
| **CLUSTER** | Cụm / Khu vực (Nhóm các Bưu điện Phường/Xã lại theo địa lý). | **CÓ** (Tổ trưởng khu vực) | **CÓ** | Giao cho WARD | **CÓ** | Container & Operational |
| **WARD** | Bưu điện Phường/Xã (Đơn vị hành chính kinh doanh/vận hành cơ sở). | **CÓ** (Nhân sự trực thuộc BĐ Phường) | **CÓ** | Giao cho POINT | **CÓ** | Container & Operational |
| **POINT** | Bưu cục / Điểm BĐVHX (Điểm chạm cuối cùng với khách hàng). | **CÓ** (Giao dịch viên, Bưu tá...) | **KHÔNG** | Giao cho STAFF | **KHÔNG** | Pure Operational |

---

## III. 3 KHÁI NIỆM CỐT LÕI (BẮT BUỘC PHÂN BIỆT RÕ)

> [!WARNING]
> Tuyệt đối không được nhầm lẫn giữa Visibility Tree và Assignment Tree.

### A. Visibility Tree (Quyền Xem Dữ Liệu)
*   **Mục đích:** Dùng để xem báo cáo, xem danh sách khách hàng, xem danh sách nhân sự cấp dưới.
*   **Được phép:** `recursive descendant` (đệ quy sâu xuống tất cả các node con, cháu, chắt).
*   **Hành vi:** Lãnh đạo ROOT thấy toàn bộ dữ liệu của POINT.
*   **KHÔNG LIÊN QUAN:** Visibility Tree tuyệt đối không được dùng trực tiếp cho luồng Giao Việc (Assignment Dropdown).

### B. Assignment Tree (Quyền Giao Việc)
*   **Mục đích:** Xác định chính xác nhân sự nào được nhận việc tại một điểm nút.
*   **Được phép:** Dropdown assignment CHỈ hiển thị operational staff trực thuộc EXACT node đang chọn.
*   **CẤM:** 
    *   KHÔNG flatten descendant staff (Không đè phẳng staff của node con lên node cha).
    *   KHÔNG auto inherit staff node con (Node cha không tự động sở hữu staff của node con trong luồng giao việc).
*   **Ví dụ chuẩn:**
    *   Chọn Node **Trung tâm Vận hành** → Dropdown CHỈ thấy 09 staff của TTVH.
    *   Chọn Node **Bưu cục Khách hàng lớn** → Dropdown CHỈ thấy 12 staff của KHL.

### C. Delegation Flow (Luồng Ủy Quyền)
*   **Mục đích:** Tuân thủ chuỗi quản lý, không nhảy cóc vượt cấp để đảm bảo tính chịu trách nhiệm (Accountability).
*   **Luồng chuẩn:** `ROOT → BRANCH → CLUSTER/WARD → POINT → STAFF`
*   **Hành vi đúng:** ROOT muốn giao việc cho POINT thì phải ủy quyền xuống BRANCH, BRANCH ủy quyền xuống WARD, WARD ủy quyền xuống POINT.

---

## IV. NGUYÊN TẮC TỐI THƯỢNG
1. **Visibility Tree ≠ Assignment Tree:** Xem được không có nghĩa là Giao được trực tiếp.
2. **Operational Staff ≠ Descendant Staff:** Nhân sự trực thuộc một Node cha KHÁC với tổng nhân sự của tất cả các Node con.
3. **Node trung gian (Container) vẫn có operational staff riêng:** Ví dụ BRANCH (TTVH) vừa chứa các node con, vừa có nhân viên văn phòng của riêng nó. Việc chọn TTVH để giao việc tức là giao cho NV Văn phòng TTVH, chứ không phải giao cho NV của Bưu cục con.

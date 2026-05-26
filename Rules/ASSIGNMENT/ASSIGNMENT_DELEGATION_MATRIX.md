# 🚨 FROZEN BUSINESS CONSTITUTION 🚨
**Tình trạng:** ĐÓNG BĂNG VĨNH VIỄN
**Cập nhật cuối:** Hệ thống đã xác thực và chốt chuẩn ngữ nghĩa Delegation Matrix.

## I. MỤC TIÊU
Quy định chặt chẽ luồng Giao việc (Assignment) và Ủy quyền (Delegation) giữa các cấp Node trong cây Hierarchy. Đảm bảo mọi luồng giao việc không được phép nhảy cóc (bypass) để giữ tính toàn vẹn của chuỗi chịu trách nhiệm (Chain of Accountability).

## II. MA TRẬN GIAO VIỆC VÀ ỦY QUYỀN (DELEGATION MATRIX)

### 1. Luồng Giao Việc Dọc (Vertical Delegation Flow)

Chuỗi ủy quyền chuẩn bắt buộc phải tuân theo thứ tự:
`ROOT → BRANCH → CLUSTER/WARD → POINT → STAFF`

**Quy tắc:**
*   Một Node cha (VD: BRANCH) **chỉ được phép** giao việc (assign) hoặc ủy quyền (delegate) xuống Node con trực tiếp (VD: CLUSTER/WARD).
*   **CẤM TUYỆT ĐỐI BYPASS:** Node cha (VD: ROOT hoặc BRANCH) **không được phép** giao thẳng việc cho nhân viên của Node cháu/chắt (VD: STAFF của POINT). Nếu cần giao, phải ủy quyền cho người đứng đầu Node con, và để Node con tự phân bổ tiếp.

### 2. Assignment Matrix Cụ Thể

| Cấp Giao Việc (Actor) | Đối Tượng Được Phép Nhận Việc (Target) | Giải thích (Semantic) |
| :--- | :--- | :--- |
| **BĐ Tỉnh (ROOT)** | Lãnh đạo các TTVH, TTKD, Khối VP (BRANCH) | Ủy quyền khối lượng công việc vĩ mô. |
| | **Staff trực thuộc ROOT** | Giao việc cá nhân cho NV trực tiếp. |
| **Lãnh đạo TT (BRANCH)** | Tổ trưởng khu vực (CLUSTER) hoặc Trưởng BĐ Phường (WARD) | Ủy quyền xuống khu vực/địa bàn quản lý. |
| | **Staff trực thuộc BRANCH** | VD: Giao việc cho 09 NV Khối VP TTVH. |
| **BĐ Phường/Xã (WARD)**| Trưởng Bưu cục/Điểm BĐVHX (POINT) | Ủy quyền xuống điểm vận hành cuối. |
| | **Staff trực thuộc WARD** | VD: Giao việc cho NV hành chính BĐ Phường. |
| **Bưu cục (POINT)** | Giao dịch viên, Bưu tá (STAFF) trực thuộc Bưu cục. | Giao việc xử lý cuối cùng (End-point execution). |

## III. QUY TẮC ĐIỀU CHỈNH GIAO VIỆC (RECALL & ESCALATE)

### 1. Quyền Recall (Thu hồi Task)
*   **Chỉ Lãnh đạo cấp cao hơn Node hiện đang giữ Task mới được phép Recall.**
*   Người giao việc (Assigner) có quyền Recall nếu Task chưa hoàn thành.
*   Không được phép Recall nếu Task đã chuyển trạng thái `Đã hoàn thành` (Khóa chỉnh sửa).

### 2. Quyền Escalate (Leo thang)
*   Nhân sự/Node đang giữ Task chỉ được phép Escalate lên **cấp trên trực tiếp** của mình trong cây Hierarchy.
*   **CẤM:** Escalate ngang cấp hoặc Escalate nhảy cóc lên lãnh đạo cấp quá cao.

### 3. Quy tắc Transfer Cross-Center (Chuyển giao chéo Trung tâm)
*   **Không được** giao trực tiếp cho một nhân sự thực hiện khác Trung tâm (Ví dụ từ TTKD giao thẳng cho NV Bưu tá của TTVH).
*   **Chỉ được** chuyển giao (Transfer) cho **Lãnh đạo Trung tâm đích** (Ví dụ: Chuyển task sang Giám đốc TTVH).
*   Trung tâm nhận Task sẽ tự chịu trách nhiệm phân bổ (Delegate) xuống nhân viên nội bộ của họ theo luồng chuẩn của Trung tâm đó.

## IV. TỔNG KẾT
Ma trận này là cơ sở duy nhất để Backend thiết kế luồng Validation, và Frontend thiết kế Dropdown Assignment. Bất kỳ UI hoặc API nào vi phạm luồng Delegation này đều được coi là **CRITICAL SEMANTIC BUG**.

# IMPLEMENTATION PLAN: PHASE 3.5 — REAL DELEGATION FLOW (CORRECTED)

**Mục tiêu:** Xây dựng luồng thực thi Điều phối (Delegation) an toàn, tuân thủ chặt chẽ nguyên tắc Ownership (Người giữ Task) và không làm vỡ các kiến trúc UI/UX đang ổn định.

---

## 1. OWNERSHIP INTEGRITY (BẢO VỆ ACCOUNTABILITY)

**Quy tắc Cốt lõi:** Chỉ có **Current Owner** (Người đang được giao Task) mới có quyền thao tác trên Task đó. Người khác dù là cấp trên hay ngang hàng cũng không được phép thao tác thay.

**Bổ sung Hard Check tại API (Backend):**
Tất cả các API sau đây:
- `POST /tasks/{task_id}/accept`
- `POST /tasks/{task_id}/forward`
- `POST /tasks/{task_id}/report` (Báo cáo kết quả)
- `POST /tasks/{task_id}/escalate` (nếu có)

Sẽ đều bị khóa bởi dòng code:
```python
if current_user.nhan_su_id != task.staff_id:
    raise HTTPException(status_code=403, detail="Chỉ người đang chịu trách nhiệm nhiệm vụ này mới được thao tác.")
```

---

## 2. SEMANTIC FORWARD STATUS (KHÔNG RESET 'NEW')

**Quy tắc:** Khi Forward (Điều phối tiếp), Task đã nằm trong tuyến xử lý, vì vậy tuyệt đối không reset về trạng thái nguyên thủy (`Mới`).

| Hành động | Cập nhật Status | Semantic Log (`action_type`) |
|---|---|---|
| **DELEGATE** (Giao lần đầu) | `Mới` | `DELEGATED` |
| **ACCEPT** (Nhận xử lý) | `Mới` $\rightarrow$ `Đang xử lý` | `ACCEPTED` |
| **FORWARD** (Điều phối xuống) | Giữ nguyên trạng thái hiện tại (VD: `Đang xử lý`) | `FORWARDED` |
| **REASSIGN** (Đổi ngang) | Giữ nguyên trạng thái hiện hành | `REASSIGNED` |

---

## 3. TIMELINE PAYLOAD CHUẨN MỚI

Khi thực hiện Forward, JSON Payload lưu vào `evidence_snapshot_json` sẽ bám sát chuẩn sau:

```json
{
  "event_type": "FORWARDED",
  "from_staff_id": "1001",
  "from_staff_name": "Nguyễn Văn A (Trưởng Cụm)",
  "to_staff_id": "1002",
  "to_staff_name": "Trần Thị B (Trưởng Bưu Cục)",
  "previous_status": "Đang xử lý",
  "new_status": "Đang xử lý",
  "forward_reason": "Giao lại cho BC gần nhất",
  "created_at": "2026-05-24T09:00:00Z"
}
```

---

## 4. UI/UX: GIỮ ỔN ĐỊNH MODAL, KHÔNG REFACTOR LỚN

Để tránh complexity overkill và regression bug:
1. **KHÔNG** tách `AssignTaskModal` thành Shared Component.
2. Tại `ActionCenter.jsx`, Modal Forward sẽ được xây dựng theo hướng **Tối giản (Minimal Forward Modal)** chuyên dụng cho việc Điều phối tiếp, chỉ render Dropdown Node & Staff $\rightarrow$ An toàn 100% không ảnh hưởng Modal Assign Gốc của Customers.
3. Trong `ActionCenter.jsx` Task Detail, chỉ hiển thị 2 nút [ Nhận xử lý ] và [ Điều phối tiếp ] **nếu** Current User chính là `staff_id` của Task.

---

## 5. THỨ TỰ THỰC THI (IMPLEMENTATION PRIORITY)

1. Viết bộ `Ownership Checker` bảo vệ tất cả API của `actions.py`.
2. Bổ sung endpoint `/accept` và `/forward`.
3. Xây dựng hàm `build_timeline_payload` để chuẩn hóa JSON.
4. Triển khai UI Action Center: Chặn nút action nếu không phải Owner.
5. Triển khai Modal Forward tối giản tại Action Center.
6. Cập nhật `TaskTimeline` UI để render ra chuỗi Delegation trực quan.

# AUDIT & IMPLEMENTATION PLAN: FULL TIMELINE CHAIN

**Mục tiêu:** Xây dựng cấu trúc dữ liệu lưu vết toàn bộ chuỗi điều phối của Task (Timeline Chain) đảm bảo tính minh bạch, hỗ trợ truy xuất trách nhiệm (Accountability) và Roll-up KPI sau này.

---

## 1. AUDIT HIỆN TRẠNG `TaskStateLog`

Bảng `TaskStateLog` hiện tại có cấu trúc:
- Cột `action_type`: Đang chứa các String rời rạc (`ASSIGN`, `REASSIGN`).
- Cột `evidence_snapshot_json`: Đã được thiết kế để lưu chuỗi JSON, tuy nhiên **schema chưa đồng nhất** và **đang thiếu thông tin Định tuyến (Node/Hierarchy)**.

**Đánh giá:** Model DB `TaskStateLog` đã ĐỦ NĂNG LỰC lưu trữ chuỗi Timeline. Không cần phải Migrate hay tạo thêm cột mới trên DB. Chúng ta chỉ cần **Chuẩn hóa JSON Schema** ghi vào cột `evidence_snapshot_json` và bổ sung đầy đủ bộ `action_type`.

---

## 2. CHUẨN HÓA JSON SCHEMA (TIMELINE PAYLOAD)

Tất cả mọi thao tác liên quan đến Ownership và Status của Task đều phải generate ra một block JSON chuẩn lưu vào `evidence_snapshot_json`:

```json
{
  "event_type": "DELEGATED | ACCEPTED | FORWARDED | REASSIGNED | ESCALATED | COMPLETED",
  "action_by": "Nguyễn Văn A", // Tên user thực hiện thao tác
  
  // DÒNG CHẢY CON NGƯỜI (Accountability)
  "from_staff_id": "1001",
  "from_staff_name": "Nguyễn Văn A",
  "to_staff_id": "1005",
  "to_staff_name": "Trần Thị B",
  
  // DÒNG CHẢY TỔ CHỨC (Hierarchy Routing)
  "from_node": "Trung tâm Kinh doanh", 
  "to_node": "Cụm ABC",
  
  // TRẠNG THÁI VÀ LÝ DO
  "previous_status": "Mới",
  "new_status": "Mới",
  "reason": "Điều phối xuống Cụm xử lý theo chỉ đạo",
  "evidence_text": "Chi tiết công việc...",
  "created_at": "2026-05-24T08:00:00Z"
}
```

> ⚠️ **Backward Compatibility:** Các record cũ thiếu field (như `from_node`, `to_node`) vẫn parse được bình thường trên UI Frontend vì Component Timeline sẽ dùng toán tử `?.` (Optional Chaining) khi render. Không làm vỡ Timeline cũ.

---

## 3. DELEGATION CHAIN & ROUTING HISTORY

**Lưu Full Routing Chain ở đâu?**
- Toàn bộ chuỗi (Chain) chính là **kết quả query theo thứ tự thời gian (`ORDER BY timestamp ASC`)** của bảng `TaskStateLog` cho một `task_id` cụ thể.
- **Không cần overwrite:** Bảng log bản chất là Insert-only (Append-only). Mỗi thao tác FORWARD hay DELEGATE sẽ sinh ra 1 row mới. Row cũ không bao giờ bị mất $\rightarrow$ Đảm bảo tính Toàn vẹn (Integrity) tuyệt đối.
- *Ví dụ chuỗi:* Row 1 (DELEGATED: BĐTP $\rightarrow$ Cụm) $\rightarrow$ Row 2 (FORWARDED: Cụm $\rightarrow$ Bưu cục) $\rightarrow$ Row 3 (ACCEPTED: Bưu cục).

---

## 4. BỘ ACTION TYPE CHUẨN

| Cột `action_type` trong DB | Ý nghĩa Timeline | Schema Required Fields |
|---|---|---|
| `DELEGATED` | Giao việc lần đầu từ Lãnh đạo | Có `from_node`, `to_node`, `from_staff`, `to_staff` |
| `FORWARDED` | Nhận việc xong nhưng đẩy tiếp xuống | Có `from_node`, `to_node`, `from_staff`, `to_staff` |
| `REASSIGNED` | Chuyển ngang sửa sai | Có `from_staff`, `to_staff` (cùng cấp node) |
| `ESCALATED` | Trả ngược lên trên | Đảo chiều `from` và `to` |
| `ACCEPTED` | Nhận xử lý | `from` và `to` là chính mình (Tự khóa Owner) |
| `COMPLETED` | Báo cáo hoàn thành | Chỉ cần `action_by`, `evidence_text` |

---

## 5. UI/UX FUTURE-PROOF (ĐỊNH HƯỚNG HIỂN THỊ)

Với cấu trúc JSON chuẩn ở trên, UI Timeline tương lai sẽ dễ dàng map ra giao diện thác nước (Waterfall) cực kỳ trực quan:

```html
[24/05 08:00] 🏢 BĐTP
  ↳ ⬇️ DELEGATED cho Trưởng Cụm 1 (Nguyễn Văn A)
  
[24/05 09:30] 🏢 Cụm 1
  ↳ ⬇️ FORWARDED cho Trưởng Bưu cục X (Trần Thị B)
  
[24/05 10:00] 🏢 Bưu cục X
  ↳ ✅ ACCEPTED bởi Trần Thị B
  
[24/05 15:00] 🏢 Bưu cục X
  ↳ 🏁 COMPLETED bởi Trần Thị B (Kết quả: Khách đồng ý)
```

**Kết luận Kỹ thuật:**
Chúng ta không cần tạo file hay table DB mới. Bước tiếp theo của Phase 3.4 (Implement Logic) chỉ cần **viết 1 hàm tiện ích (Utility Function)** để tự động generate JSON Schema chuẩn này trước khi chèn vào `TaskStateLog` cho các Endpoint: `/assign`, `/reassign`, `/accept`, `/forward`.

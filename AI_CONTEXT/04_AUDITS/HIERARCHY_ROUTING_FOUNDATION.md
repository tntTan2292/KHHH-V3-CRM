# HIERARCHY ROUTING FOUNDATION (PHASE 3.3)

**Mục tiêu:** Audit hệ thống hiện tại và đề xuất nền tảng kiến trúc (Foundation) để chuyển đổi từ mô hình "Giao thẳng Nhân viên" sang "Điều phối theo Cây tổ chức" (Organizational Routing) trong tương lai. 

> ⚠️ Đây là tài liệu thiết kế định hướng (Semantic Design). Không làm xáo trộn luồng hiện tại.

---

## 1. PHÂN BIỆT 2 KHÁI NIỆM LÕI

| Khái niệm | Direct Assignment (Đang dùng) | Hierarchy Routing (Tương lai) |
|---|---|---|
| **Bản chất** | Giao thẳng (Bắn tia laser) | Điều phối phân tầng (Thác nước) |
| **Đối tượng nhận** | `staff_id` (Nhân viên cụ thể) | `node_id` (Đơn vị/Tổ chức) |
| **Người thực hiện** | User có quyền $\rightarrow$ Nhân viên | Lãnh đạo cấp trên $\rightarrow$ Lãnh đạo cấp dưới |
| **Khả năng uỷ quyền** | Không (Người nhận phải trực tiếp làm) | Có (Người nhận tiếp tục chia việc cho cấp dưới) |

---

## 2. AUDIT: CURRENT TASK OWNER MODEL

Hiện trạng Database `ActionTask` và `TaskStateLog` (tại `models.py`):

| Thành phần | Hiện trạng | Đánh giá / Thiếu sót |
|---|---|---|
| **Task Ownership** | Chỉ lưu đúng 1 field `staff_id`. | ❌ Không hỗ trợ giao cho Node (Ví dụ: Giao cho Bưu cục). <br> ❌ Mất dấu vết ai là người chịu trách nhiệm ở cấp Cụm/Phường. |
| **Routing History** | Không có field lưu chuỗi điều phối. | ❌ Nếu BĐTP giao TTKD $\rightarrow$ TTKD giao Cụm $\rightarrow$ Không có chỗ lưu vết chuỗi này trên bảng `ActionTask`. |
| **State Log** | Lưu ở `TaskStateLog` (action_type: ASSIGN). | ⚠️ Dùng `evidence_snapshot_json` để ép kiểu lưu `from_user_id`, `to_user_id` nhưng không có khái niệm Node. |

---

## 3. THIẾT KẾ ORGANIZATIONAL ROUTING MODEL

Đây là cấu trúc thiết kế luồng điều phối theo đúng nghiệp vụ bưu điện:

| Cấp độ (Level) | Cấp giao việc (Source) | Nhận việc (Target Node) | Vai trò tiếp nhận |
|---|---|---|---|
| **Level 1** | BĐTP (Lãnh đạo Tỉnh) | **Trung tâm** (TTKD, TTVH) | Giám đốc Trung tâm |
| **Level 2** | Trung tâm | **Cụm** (Cluster) | Trưởng cụm |
| **Level 3** | Cụm | **Phường/Xã** hoặc **Bưu cục** | Trưởng Bưu điện / Cửa hàng trưởng |
| **Level 4** | Bưu cục | **Nhân viên** (Staff) | Nhân viên hiện trường / CSKH |

---

## 4. TASK OWNERSHIP CHAIN (PROPOSAL)

Để nâng cấp, model `ActionTask` trong tương lai cần bổ sung các trường sau (Chưa Migrate DB):

```python
# ĐỀ XUẤT MỞ RỘNG (FUTURE FOUNDATION)
current_owner_node_id = Column(Integer, ForeignKey("hierarchy_nodes.id")) # Đang nằm ở Node nào
current_owner_user_id = Column(Integer, ForeignKey("users.id"))           # Ai đang cầm (Trưởng node hay Nhân viên)

# Tracking the flow
routing_path_json = Column(Text) # Ví dụ: ["NODE_1 (BĐTP)", "NODE_3 (TTKD)", "NODE_12 (BC Kim Long)"]
assignment_mode = Column(String) # 'DIRECT' hoặc 'ROUTED'
```

---

## 5. TIMELINE PREPARATION (TASK_STATE_LOG)

Để Timeline UI hiển thị được dòng chảy thác nước, `TaskStateLog` cần bổ sung chuẩn Semantic mới cho `action_type`:

| Action Type Mới | Ngữ cảnh sử dụng |
|---|---|
| `ROUTED_DOWN` | Khi cấp trên đẩy việc xuống cấp dưới (VD: Cụm $\rightarrow$ Bưu cục). |
| `ROUTED_UP` | Khi cấp dưới trả việc lên (Escalate). |
| `ASSIGN_STAFF`| Hành động cuối cùng: Bưu cục giao cho Nhân viên cụ thể. |

*JSON Evidence tương lai cần bổ sung:*
```json
{
  "from_node_id": 1,
  "to_node_id": 3,
  "action_by_role": "CENTER_LEADER"
}
```

---

## 6. ROADMAP NÂNG CẤP (SAFE EVOLUTION)

Để không phá vỡ luồng "Giao trực tiếp" hiện tại (KH $\rightarrow$ POINT $\rightarrow$ STAFF), việc nâng cấp phải được chia Phase:

1. **Phase 1 (Đã xong):** Chuẩn hóa Scoping và Lock ranh giới Trung tâm.
2. **Phase 2 (Hiện tại - Docs):** Audit và thiết kế Semantic Foundation.
3. **Phase 3 (DB Migration):** Bổ sung `current_owner_node_id` vào `ActionTask` (cho phép `nullable`).
4. **Phase 4 (API Upgrade):** Mở thêm API `POST /tasks/route` (Điều phối) chạy song song với `POST /assign` (Giao trực tiếp).
5. **Phase 5 (UI Upgrade):** Thêm nút "Điều phối" bên cạnh nút "Giao việc" trên Action Center cho cấp Leader.

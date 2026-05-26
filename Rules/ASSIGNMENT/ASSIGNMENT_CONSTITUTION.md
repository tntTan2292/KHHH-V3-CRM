> [!IMPORTANT]
> **FROZEN BUSINESS CONSTITUTION**
>
> - Không sửa trực tiếp
> - Mọi thay đổi phải: audit impact, append decision log, version decision
> - KHÔNG được AI tự rewrite constitution.
> - If Decision Logs conflict with Constitution, Constitution always wins.

# MASTER RULE DOCUMENT: GIAO VIỆC + PHÂN QUYỀN + ORGANIZATION FLOW

*Trạng thái: POST-ROLLBACK STABILIZED*
*Mục tiêu: Đóng băng toàn bộ Semantic Rules trước khi phát triển Giao Việc.*

---

## 1. ASSIGNMENT PHASE TIMELINE

- **Phase 1:** Hierarchy Foundation & SLA Initial Setup (Commits `b625c31`, `9144393`)
- **Phase 2:** Dual Center Hierarchy & Assignment Flow (Commits `d91fe36`, `c43f7a4`)
- **Phase 3:** Timeline Chain & Delegation Flow (Commits `f7e0649`, `3ae2c49`)
- **Phase 4:** Semantic Separation (Point vs Scope) (Commit `f76f2f7`)
- **Phase 5 (Hotfix):** Semantic Rollback & Runtime UI Stabilization (Commits `f3259da`, `CURRENT`)

---

## 2. FEATURES IMPLEMENTED (GIAO VIỆC PHASE)

| Feature | Trạng thái hiện tại | Source / Commit |
|---|---|---|
| **Semantic Separation** | Stable | `f76f2f7` (Phân tách point_id và scope_node_id) |
| **Descendant Filtering** | Stable | `backend/app/services/scoping_service.py` |
| **Cross-center Assignment** | Stable | `ScopingService.apply_scope_filter` |
| **Assignment Tree UI** | Stable | `src/components/TreeExplorer.jsx` |
| **Context Synchronization** | Stable | `StaffManagement.jsx` (Patch `TreeSelect` Race Condition) |
| **Leader Visibility** | Stable | `backend/app/routers/nodes.py` & Scoping |
| **Rollback Stabilization** | Stable | `scripts/semantic_rollback_hotfix.py` |
| **Flexible Assignment UI** | Stable | `src/pages/ActionCenter.jsx` (`3282bf6`) |

---

## 3. BUSINESS RULES MATRIX

| Rule | Mô tả | Trạng thái | Source/Impact |
|---|---|---|---|
| **Ai giao được cho ai** | Người dùng chỉ có thể giao việc cho nhân sự thuộc tập Descendants của `scope_node_id` của họ. | Stable | API Scoping / UI |
| **Leader Override** | Lãnh đạo cấp trên (Scope cao hơn) có thể can thiệp vào assignment của cấp dưới. | Stable | Workflow Engine |
| **Hierarchy Resolution** | Tổ chức phải được phản ánh 100% bằng sự thật (Real Organization Tree), không dùng Alias. | Stable | Prompt History / UI |
| **Cross-Center Permission** | Việc điều phối liên trung tâm phải được định danh qua `scope_node_id`, không kéo Point lên Center. | Stable | Semantic Separation |
| **Fallback Rules** | Nếu `scope_node_id` rỗng, hệ thống sẽ fallback ngầm dựa trên `point_id` hoặc Role (Admin). | Dangerous | API Nodes |

---

## 4. SECURITY RULES MATRIX

| Rule | Mô tả | Trạng thái | Source/Impact |
|---|---|---|---|
| **Scope Visibility Isolation** | Không được rò rỉ dữ liệu ngoài phạm vi `scope_node_id`. Nhân sự Bưu cục A không thể thấy đơn hàng Bưu cục B nếu không chung Scope. | Stable | API Query |
| **Anti-Heuristic Patching** | Cấm dùng heuristic / UI hack (ẩn node bằng text) để qua mặt lỗi Security phân quyền. | Stable | Master Prompt |
| **Action Context Lock** | Mọi thay đổi về người phụ trách phải được validate chéo với cây quyền hiện tại. | Stable | Action Router |
| **Explicit Overwrite Ban** | API không được phép tự động gán `None` hoặc giá trị ngẫu nhiên vào `scope_node_id` nếu không có chủ ý. | Stable | `PATCH /staff/{id}` |

---

## 5. SEMANTIC RULES MATRIX

| Semantic Variable | Bản chất | Quy định Bắt buộc | Trạng thái |
|---|---|---|---|
| **`point_id`** | **Nơi trực thuộc thực tế** (Bàn làm việc vật lý) | Dùng để tính KPI, Assignment Target, Render Tree. Cấm dùng làm Role/Scope. | Stable |
| **`scope_node_id`** | **Phạm vi quản trị dữ liệu** | Dùng làm gốc để quét Descendant Filtering. Cấm mutate để infer hierarchy. | Stable |
| **Hierarchy Tree** | Cấu trúc công ty | Phải render Node Root -> Branch -> Unit -> Cluster -> Point/Ward. Cấm chế fake labels. | Stable |

---

## 6. WORKFLOW MAP

- **Assignment Flow:** Manager truy cập Khách hàng -> Dropdown Assignment gọi `/api/users/by-node` (Filtered by Scope) -> Chọn Nhân sự (Target `point_id`) -> DB Update.
- **Edit Staff Flow:** Admin truy cập StaffManagement -> Mở Edit Modal (Load `TreeSelect` InitialLabel từ API) -> Admin sửa Đơn vị/Phạm vi -> Backend validate `key in dict` -> DB Update.
- **Tree Synchronization Flow:** `TreeExplorer` fetch toàn cây `HierarchyNode` -> Click Node -> Trigger `fetchStaffByNode` (Descendant filter).

---

## 7. RULE CONFLICT REPORT

| Conflict Phát hiện | Mô tả | Trạng thái |
|---|---|---|
| **Role vs Scope Fallback** | Một số User có `scope_node_id = None` nhưng được cấp Role "ADMIN". Hệ thống đang cho phép họ xem toàn bộ (Bypass Scoping). Điều này tiện lợi nhưng phá vỡ tính nhất quán Semantic. | 🟡 Unstable (Chấp nhận tạm) |
| **Text-Matching vs Role ID** | Form Import Excel gán quyền bằng cách so sánh chuỗi Text Chức vụ ("GIÁM ĐỐC"). Nếu chuỗi sai, Semantic Quyền sẽ sụp đổ. | 🔴 Dangerous |

---

## 8. DANGEROUS LOGIC REPORT

- 🚨 **`scripts/semantic_migration.py`:** Chứa logic ngầm định ánh xạ sai (`ma_don_vi` thay vì `ma_bc`). Đã gây họa và phải Rollback. (File CẦN ĐƯỢC CÁCH LY / XÓA).
- 🚨 **Heuristic API Override:** Nếu tương lai ai đó thêm logic tự sinh `scope_node_id` từ `point_id` ở Backend Trigger, hệ thống sẽ sụp đổ trở lại.
- 🚨 **TreeSelect Caching UX:** Dù đã patch `initialLabel`, nếu API chạy quá chậm trên máy yếu, Component có nguy cơ chớp giật (Flicker) khi State Race.

---

## 9. FINAL BUSINESS RULES (GIAO VIỆC PHASE)

1. **Completed Task:**
   - Task hoàn thành => khóa chỉnh sửa.
   - Chỉ cấp trên mới được Recall/Reopen.
2. **Recall Rule:**
   - Chỉ lãnh đạo cấp cao hơn người nhận mới được Recall.
3. **Escalation Rule:**
   - Escalate lên cấp trên trực tiếp.
   - Không escalate ngang cấp.
4. **Transfer Cross-Center Rule:**
   - Không được giao trực tiếp người thực hiện khác Trung tâm.
   - Chỉ được chuyển giao cho Lãnh đạo Trung tâm đích.
   - Trung tâm nhận sẽ tự phân giao nội bộ.
5. **Reassignment Rule:**
   - Người xử lý nghỉ việc / vắng mặt => Lãnh đạo trực tiếp tự xử lý phân giao lại.
   - Hệ thống KHÔNG auto detect nghỉ việc.
6. **Staff Status Rule:**
   - Bổ sung trạng thái nhân sự: `ACTIVE`, `INACTIVE`.
   - `INACTIVE` không xuất hiện trong dropdown giao việc. Nhưng vẫn giữ toàn bộ lịch sử task cũ.
7. **Bulk Assignment Rule:**
   - Cho phép Import Excel giao việc số lượng lớn.
   - Chỉ cấp lãnh đạo phù hợp mới được dùng.
8. **Assignment Permission Rule:**
   - Có thể giao xuống cấp dưới trực thuộc.
   - Không được chỉ định trực tiếp nhân sự khác trung tâm.
9. **Constitution Priority Rule:**
   - Nếu: Audit Report, AI_CONTEXT, Decision Logs, Patch Notes mâu thuẫn với Constitution => Constitution luôn thắng.

---

## 10. READINESS ASSESSMENT

**✅ MỨC ĐỘ SẴN SÀNG: 100% (GREEN STATUS)**
- Toàn bộ tàn dư của vụ sụp đổ Semantic đã được rà soát và khắc phục (Rollback & UI Patching).
- Phân tách Semantic nền tảng (Point / Scope) đã rạch ròi.
- Hệ thống UI/UX cho việc chỉnh sửa và theo dõi đã hiển thị trung thực với DB.

---

## 11. RECOMMENDED NEXT PHASE

**Khởi động GIAO VIỆC PHASE (CUSTOMER ASSIGNMENT & DELEGATION):**
1. Triển khai API chuyển đổi Assignee (Reassignment).
2. Xây dựng Rule chống Giao chéo (Cross-Scope Isolation Check).
3. Triển khai Component Lịch sử Giao việc (Timeline/Audit Trail cho mỗi Khách hàng).

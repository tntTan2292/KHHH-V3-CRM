# ASSIGNMENT DECISION LOG

> [!IMPORTANT]
> Đây là nhật ký các quyết định Business Rules đã được Lãnh đạo chốt. Mọi thay đổi ở đây mang tính chất **Append-only** (Chỉ ghi nối tiếp, không ghi đè lịch sử).
> Nếu nội dung ở đây mâu thuẫn với `ASSIGNMENT_CONSTITUTION.md`, **Hiến pháp (Constitution) luôn thắng**.

---

## [2026-05-26] CHỐT QUY TẮC NGHIỆP VỤ GIAO VIỆC (ASSIGNMENT PHASE)

**1. Vấn đề: Trạng thái Khóa của Task đã hoàn thành (Completed Task)**
- **Quyết định:** Task đã hoàn thành sẽ bị khóa chỉnh sửa. Chỉ cấp trên mới được quyền Recall/Reopen.
- **Lý do:** Đảm bảo tính toàn vẹn dữ liệu, chống nhân viên tự sửa lịch sử công việc đã báo cáo.

**2. Vấn đề: Quyền Thu hồi (Recall Rule)**
- **Quyết định:** Chỉ lãnh đạo cấp cao hơn người nhận mới được quyền Recall task.
- **Lý do:** Tránh tình trạng tranh giành khách hàng ngang cấp hoặc nhân viên tự ý thu hồi việc đã được giao cho người khác.

**3. Vấn đề: Quy tắc Báo cáo vượt cấp (Escalation Rule)**
- **Quyết định:** Bắt buộc Escalate lên cấp trên trực tiếp. Không được escalate ngang cấp.
- **Lý do:** Đảm bảo luồng thông tin đi theo đúng Hierarchy Tree, cấp quản lý trực tiếp phải chịu trách nhiệm đầu tiên.

**4. Vấn đề: Giao việc liên Trung tâm (Transfer Cross-Center Rule)**
- **Quyết định:** Không được giao việc trực tiếp cho nhân sự thực thi ở Trung tâm khác. Chỉ được chuyển giao cho Lãnh đạo Trung tâm đích. Trung tâm đích sẽ tự phân giao nội bộ.
- **Lý do:** Tôn trọng chủ quyền phân cấp của từng Trung tâm, ngăn chặn việc can thiệp chéo vào KPI của đơn vị khác.

**5. Vấn đề: Phân giao lại (Reassignment) khi nhân sự vắng mặt**
- **Quyết định:** Lãnh đạo trực tiếp tự xử lý phân giao lại. Hệ thống KHÔNG tự động phát hiện nhân viên nghỉ việc.
- **Lý do:** Các trường hợp nghỉ phép, vắng mặt mang yếu tố con người phức tạp, cần ý chí của Lãnh đạo để quyết định ai gánh việc thay.

**6. Vấn đề: Trạng thái Nhân sự (Staff Status Rule)**
- **Quyết định:** Bổ sung cờ trạng thái `ACTIVE` / `INACTIVE`. Trạng thái `INACTIVE` không xuất hiện trong dropdown giao việc, nhưng vẫn giữ nguyên toàn bộ lịch sử task cũ.
- **Lý do:** Dọn dẹp giao diện chọn nhân viên, tránh giao nhầm cho người đã nghỉ việc, nhưng vẫn bảo tồn được chuỗi dữ liệu (Audit Trail).

**7. Vấn đề: Giao việc hàng loạt (Bulk Assignment Rule)**
- **Quyết định:** Cho phép Import Excel để giao việc số lượng lớn, nhưng chỉ cấp Lãnh đạo phù hợp mới được sử dụng.
- **Lý do:** Tăng tốc độ phân bổ chiến dịch, nhưng phải giới hạn quyền để tránh spam/phân sai dữ liệu ồ ạt.

**8. Vấn đề: Phạm vi Quyền giao việc (Assignment Permission Rule)**
- **Quyết định:** Chỉ có thể giao xuống cấp dưới trực thuộc nhánh của mình. Tuyệt đối không được chỉ định trực tiếp nhân sự thuộc Trung tâm khác.
- **Lý do:** Thắt chặt Security Scope Isolation (Nhìn xuống, Cô lập ngang).

**9. Vấn đề: Giải quyết xung đột Tài liệu (Constitution Priority Rule)**
- **Quyết định:** Nếu có bất kỳ mâu thuẫn nào giữa Audit Report, AI_CONTEXT, Decision Logs, hay Patch Notes với Constitution, thì Constitution (Hiến pháp) LUÔN THẮNG.
- **Lý do:** Single Source of Truth tuyệt đối. Khóa chặt nguy cơ AI Agent bị Hallucinate (ảo giác) do đọc nhầm Forensic Report cũ.

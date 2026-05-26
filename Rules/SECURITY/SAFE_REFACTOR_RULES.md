> [!IMPORTANT]
> **System Protection Rules (Not Permission Security Rules)**

# 🛡️ Safe Refactor Rules

Để đảm bảo hệ thống vận hành ổn định, AI và Developer phải tuân thủ các quy tắc sau khi refactor:

1. **Không thay đổi Business Logic**: Tuyệt đối không thay đổi các định nghĩa về Lifecycle (30/90 days boundary) hay công thức tính KPI.
2. **Không phá API Contract**: Tránh thay đổi cấu trúc response JSON trừ khi đã đồng bộ hoàn toàn với Frontend.
3. **Refactor Incremental (Vi phẫu)**: Chia nhỏ PR, không đập đi xây lại toàn bộ file lớn (như `Dashboard.jsx`) cùng một lúc.
4. **Ưu tiên Reusable Components**: Tách các khối UI lặp lại thành các component độc lập (Ví dụ: `KPI_Card.jsx`, `ChartWidget.jsx`).
5. **Giữ nguyên Scoping**: Không được phép bypass hệ thống phân quyền 5 cấp (Scoping Service).

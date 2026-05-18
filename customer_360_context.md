# Context Hướng Dẫn Tối Ưu Hóa (Polish UI & Wording) Customer 360 & Lifecycle Timeline

Tài liệu này tổng hợp toàn bộ hiện trạng kỹ thuật, cấu trúc giao diện và định hướng thiết kế của tính năng **Customer 360** và **Lifecycle Timeline** trên hệ thống **CRM V3.0** (Commit `78b0ae0`). 

---

## I. MÃ NGUỒN CỐT LÕI (CUSTOMER 360 & TIMELINE)

### 1. File Thành Phần Chính
* **Component Modal Lịch Sử**: [CustomerHistoryModal.jsx](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/src/components/CustomerHistoryModal.jsx) (Bao gồm 3 tab: Chăm sóc, Giao dịch, Vòng đời).
* **Trang Tích Hợp Giao Việc**: [Customers.jsx](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/src/pages/Customers.jsx) (Tích hợp nút bấm "Xem lịch sử 360°" kích hoạt Modal).

### 2. Cấu Trúc Khai Báo Dòng Thời Gian Vòng Đời (Lifecycle Tab)
Mã nguồn hiển thị tiến trình Vòng đời Khách hàng được định nghĩa tại các dòng [L423-L460](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/src/components/CustomerHistoryModal.jsx#L423-L460):
```javascript
{/* Vertical Timeline */}
<div className="relative">
  <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-vnpost-blue/20 via-gray-200 to-gray-200/0"></div>
  
  <div className="space-y-8">
    {tlCache[tlPage].map((item, idx) => (
      <div key={idx} className="relative pl-12 group">
        {/* Node */}
        <div className="absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center z-10 bg-white">
          <div className={`w-3.5 h-3.5 rounded-full ${
            item.new_state === 'NEW' ? 'bg-emerald-500 shadow-emerald-200' :
            item.new_state === 'ACTIVE' ? 'bg-blue-500 shadow-blue-200' :
            item.new_state === 'AT_RISK' ? 'bg-orange-500 shadow-orange-200' :
            item.new_state === 'CHURNED' ? 'bg-red-500 shadow-red-200' :
            item.new_state === 'RECOVERED' ? 'bg-purple-500 shadow-purple-200' : 'bg-gray-400'
          } shadow-md`}></div>
        </div>
        
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-gray-100 group-hover:shadow-md transition-all group-hover:border-vnpost-blue/10">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-[10px] font-black text-vnpost-blue">{item.timestamp}</span>
              <div className="flex items-center gap-2 mt-2">
                {getLifecycleStateBadge(item.previous_state)}
                <ChevronRight size={12} className="text-gray-300" />
                {getLifecycleStateBadge(item.new_state)}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 mt-2">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Lý do thay đổi</p>
            <p className="text-xs font-bold text-gray-700 leading-relaxed">{item.trigger_reason}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

---

## II. HỆ THỐNG THEME & CSS TOKENS (CSS/TAILWIND CONFIG)

### 1. Cấu Hình Tailwind (Colors & Fonts Extended)
Hệ thống sử dụng các mã màu nhận diện thương hiệu VNPost tại [tailwind.config.js](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/tailwind.config.js):
* `vnpost-orange`: `#F9A51A` (Cam năng động)
* `vnpost-yellow`: `#FFB900` (Vàng Bưu điện)
* `vnpost-blue`: `#0054A6` (Xanh thương hiệu)
* `vnpost-blue-dark`: `#003E7E` (Xanh đậm hoàng gia)
* `vnpost-gray`: `#E5E7EB`
* `vnpost-bg`: `#F3F4F6` (Xám nhạt nền)
* Font chữ mặc định: `Inter, sans-serif`

### 2. Executive Theme CSS Tokens
Các lớp tiện ích tùy biến cho giao diện Executive cao cấp được định nghĩa tại [executive_theme.css](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/src/styles/executive_theme.css):
* Thẻ Card cao cấp: `.executive-card`
* KPI text đậm: `.kpi-number`, `.kpi-label`
* Cuộn tùy biến siêu mượt: `.custom-scrollbar` (định nghĩa trong [index.css](file:///d:/Antigravity%20-%20Project/KHHH%20-%20Antigravity%20-%20V3.0/src/index.css#L49-L64) có dải màu gradient `vnpost-blue` sang `vnpost-orange`).

---

## III. THÔNG TIN PHÂN TÍCH & ĐỊNH HƯỚNG TỐI ƯU CHI TIẾT

### 1. ICON SYSTEM
* **Hệ thống Icon**: Đang sử dụng **Lucide React** (`lucide-react`) làm thư viện biểu tượng chuẩn.
* **Các Icon liên quan**: `X`, `Clock`, `User`, `CheckCircle2`, `AlertCircle`, `Calendar`, `MessageSquare`, `History`, `ChevronRight`.
* **Định hướng**: Hạn chế sử dụng emoji thô cứng (ví dụ: `🚨`, `💎`, `🎯`) trong các badge nhãn. Thay vào đó, sử dụng các icon tinh gọn từ `lucide-react` kết hợp với màu sắc tinh tế để giữ vẻ thanh lịch, cao cấp.

### 2. LIFECYCLE STATUS SYSTEM
Hệ thống phân chia trạng thái vòng đời khách hàng gồm 5 nhóm chuẩn hóa:
* **NEW (Mới)**:
  * *Nhãn (Label)*: `MỚI`
  * *Màu Badge*: Nền `bg-emerald-50`, chữ `text-emerald-600`, viền `border-emerald-100`
  * *Màu Node*: `bg-emerald-500 shadow-emerald-200`
* **ACTIVE (Hoạt động)**:
  * *Nhãn (Label)*: `HOẠT ĐỘNG`
  * *Màu Badge*: Nền `bg-blue-50`, chữ `text-blue-600`, viền `border-blue-100`
  * *Màu Node*: `bg-blue-500 shadow-blue-200`
* **AT_RISK (Suy giảm/Có nguy cơ)**:
  * *Nhãn (Label)*: `SUY GIẢM` (Đề xuất đổi thành: `CÓ NGUY CƠ`)
  * *Màu Badge*: Nền `bg-orange-50`, chữ `text-orange-600`, viền `border-orange-100`
  * *Màu Node*: `bg-orange-500 shadow-orange-200`
* **CHURNED (Ngừng gửi/Rời bỏ)**:
  * *Nhãn (Label)*: `NGỪNG GỬI` (Đề xuất đổi thành: `NGỪNG HOẠT ĐỘNG`)
  * *Màu Badge*: Nền `bg-red-50`, chữ `text-red-600`, viền `border-red-100`
  * *Màu Node*: `bg-red-500 shadow-red-200`
* **RECOVERED (Khôi phục)**:
  * *Nhãn (Label)*: `KHÔI PHỤC`
  * *Màu Badge*: Nền `bg-purple-50`, chữ `text-purple-600`, viền `border-purple-100`
  * *Màu Node*: `bg-purple-500 shadow-purple-200`

### 3. MODAL CONSTRAINT (GIỚI HẠN CHỈNH SỬA)
* **ĐƯỢC phép thay đổi**: 
  * Cấu trúc thẻ CSS/Tailwind của Modal, khoảng cách padding, margin, kích thước thẻ, kiểu bo góc, hiệu ứng gradient, shadow.
  * Hệ thống biểu tượng (Lucide icons), hiệu ứng kính mờ (glassmorphism), đường nối timeline.
  * Các từ ngữ hiển thị (Wording) trên giao diện tiếng Việt.
* **KHÔNG ĐƯỢC phép thay đổi**:
  * Không thay đổi API endpoint hoặc phương thức truyền tham số (`page`, `page_size`, `loai_doi_tuong`).
  * Không thay đổi cấu trúc dữ liệu trả về từ backend (các key dữ liệu như `shbg`, `doanh_thu`, `dich_vu_chinh`, `trigger_reason`, `new_state`, `previous_state`, `timestamp` bắt buộc giữ nguyên).
  * Không sửa đổi logic React State hoặc cơ chế phân trang phía client (client pagination).

### 4. RESPONSIVE TARGET
* **Độ phân giải mục tiêu (Main Resolution)**: Tối ưu hoàn hảo cho các độ phân giải laptop doanh nghiệp tiêu chuẩn: **1366x768px** và **1920x1080px**.
* **Xử lý tràn viền (Overflow issues)**: Thiết kế modal sử dụng chiều cao giới hạn tối đa `max-h-[85vh]` cùng thanh cuộn mượt mà `.custom-scrollbar` để đảm bảo không bị tràn trục dọc (vertical overflow) trên màn hình nhỏ. 

### 5. VISUAL DIRECTION (PHONG CÁCH HƯỚNG TỚI)
Dự án CRM V3.0 hướng tới phong cách: **Executive, Enterprise, Premium, Sleek, mang đậm nhận diện thương hiệu VNPost (VNPost Identity) kết hợp với Glassmorphism nhẹ** ở phần header và các panel tóm tắt chỉ số.

### 6. THỨ TỰ ƯU TIÊN POLISH
Quá trình nâng cấp giao diện sẽ bám sát lộ trình ưu tiên sau:
1. **Timeline visual** (Làm đẹp đường nối, màu sắc các Node, banner biến động trạng thái).
2. **Modal header** (Việt hóa chuẩn doanh nghiệp, nâng cấp nền gradient kính mờ, bỏ nhãn tiếng Anh boilerplate).
3. **Badge system** (Chuẩn hóa màu sắc nhãn trạng thái, lược bỏ emoji rác, đồng bộ icon SVG).
4. **Typography & Tab navigation** (Tăng độ rõ nét của font chữ, căn chỉnh viền dưới tab mượt mà).
5. **Empty state & Scroll behavior** (Giao diện rỗng sang trọng hơn, cuộn trang trơn tru).

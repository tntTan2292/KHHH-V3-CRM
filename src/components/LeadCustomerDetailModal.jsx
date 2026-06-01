import React from 'react';
import { Target, X, BarChart3, Users, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LeadCustomerDetailModal({
  selectedCustomer,
  setSelectedCustomer,
  formatCurrency
}) {
  if (!selectedCustomer) return null;

  const isSuccess = selectedCustomer.completion_rate >= 100;
  const isWarning = selectedCustomer.completion_rate >= 50 && selectedCustomer.completion_rate < 100;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
        
        {/* Header Section */}
        <div className="relative p-8 bg-gradient-to-br from-[#003E7E] to-[#002a54] text-white overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Target size={120} /></div>
          <button 
            onClick={() => setSelectedCustomer(null)} 
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="relative z-10">
             <div className="flex items-center gap-2 flex-wrap mb-3">
               <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                 Khách Hàng Đối Soát
               </span>
               <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                 isSuccess ? 'bg-emerald-500' : isWarning ? 'bg-orange-500' : 'bg-red-500'
               }`}>
                 {isSuccess ? 'Hoàn thành mục tiêu' : 'Cần theo dõi'}
               </span>
             </div>
             <h2 className="text-2xl font-black uppercase leading-tight">{selectedCustomer.ten_kh}</h2>
             <p className="text-blue-200 font-bold mt-1 tracking-widest flex items-center gap-2">
                <Users size={14} /> Mã CMS: {selectedCustomer.ma_cms || 'N/A'}
             </p>
             <p className="text-[11px] mt-3 bg-white/10 px-3 py-1.5 rounded-xl text-blue-100 font-bold inline-block">
                Nhân viên phụ trách: {selectedCustomer.owner_hrm || 'Chưa gán'}
             </p>
          </div>
        </div>
        
        {/* Body Section */}
        <div className="p-8 space-y-6 bg-gray-50/50">
           <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                 <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Doanh thu Cam kết</p>
                 <p className="text-xl font-black text-gray-600">{formatCurrency(selectedCustomer.expected_revenue)} <span className="text-sm font-bold text-gray-400">đ</span></p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm border-b-4 border-b-[#003E7E]">
                 <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Doanh thu Thực tế</p>
                 <p className="text-xl font-black text-[#003E7E]">{formatCurrency(selectedCustomer.actual_revenue)} <span className="text-sm font-bold text-blue-300">đ</span></p>
              </div>
              <div className={`bg-white p-5 rounded-2xl border border-gray-200 shadow-sm border-b-4 ${
                isSuccess ? 'border-b-emerald-500' : isWarning ? 'border-b-orange-500' : 'border-b-red-500'
              }`}>
                 <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Tỷ lệ Thực hiện</p>
                 <p className={`text-xl font-black ${
                   isSuccess ? 'text-emerald-600' : isWarning ? 'text-orange-600' : 'text-red-600'
                 }`}>
                   {selectedCustomer.completion_rate.toFixed(1)}%
                 </p>
              </div>
           </div>

           <div className={`p-5 rounded-2xl border ${
             isSuccess ? 'bg-emerald-50 border-emerald-100' : 
             isWarning ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100'
           }`}>
              <h5 className={`text-[11px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${
                isSuccess ? 'text-emerald-700' : isWarning ? 'text-orange-700' : 'text-red-700'
              }`}>
                 {isSuccess ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                 Đánh giá hiệu suất
              </h5>
              <p className={`text-sm font-medium ${
                isSuccess ? 'text-emerald-900' : isWarning ? 'text-orange-900' : 'text-red-900'
              }`}>
                 {isSuccess 
                   ? `Khách hàng này đã vượt kỳ vọng cam kết. Doanh thu thực tế mang về là ${formatCurrency(selectedCustomer.actual_revenue)}đ, đạt ${selectedCustomer.completion_rate.toFixed(1)}% so với kế hoạch ban đầu.` 
                   : `Khách hàng này chưa đạt mức cam kết đề ra. Đang bị hụt mất ${formatCurrency(selectedCustomer.expected_revenue - selectedCustomer.actual_revenue)}đ. Cần đôn đốc nhân viên liên hệ khách hàng ngay lập tức để đẩy mạnh tiến độ gửi hàng.`
                 }
              </p>
           </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3">
           <button 
             onClick={() => setSelectedCustomer(null)} 
             className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold uppercase text-xs hover:bg-gray-200 transition-all"
           >
             Đóng
           </button>
           {!isSuccess && (
             <button className="px-6 py-2.5 bg-vnpost-orange text-white rounded-xl font-black uppercase text-xs shadow-lg hover:scale-105 active:scale-95 transition-all">
                Đôn đốc Nhân viên
             </button>
           )}
        </div>
      </div>
    </div>
  );
}

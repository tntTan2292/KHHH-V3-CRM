import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { X, Clock, User, CheckCircle2, AlertCircle, Calendar, MessageSquare, History, ChevronRight } from 'lucide-react';

const CustomerHistoryModal = ({ isOpen, onClose, targetId, loaiDoiTuong, customerName }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (targetId) {
        fetchHistory();
      } else {
        setLoading(false);
        setHistory([]);
      }
    }
  }, [isOpen, targetId, loaiDoiTuong]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/actions/history/${targetId}`, {
        params: { loai_doi_tuong: loaiDoiTuong }
      });
      setHistory(res.data || []);
    } catch (err) {
      console.error("Lỗi khi tải lịch sử:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'Hoàn thành': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Đang xử lý': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'Thất bại': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  const getFlowBadge = (type) => {
    if (type === 'Giao Cảnh báo') return <span className="text-[8px] font-black uppercase tracking-widest text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">🚨 Cảnh báo</span>;
    if (type === 'Giao VIP') return <span className="text-[8px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">💎 VIP</span>;
    return <span className="text-[8px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">🎯 Lead</span>;
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 border-8 border-white/50">
        
        {/* Header Section */}
        <div className="p-8 bg-gradient-to-br from-vnpost-blue to-[#003E7E] text-white relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-vnpost-orange/10 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                  <History size={20} className="text-vnpost-orange" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Elite Interaction History</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight">{customerName || targetId}</h3>
              <p className="text-white/60 text-xs font-bold mt-1 uppercase tracking-widest">Mã định danh: {targetId}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-white/10 rounded-full transition-all text-white/80 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          <div className="mt-8 flex gap-6">
             <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Tổng lượt tiếp cận</p>
                <div className="flex items-baseline gap-2">
                   <span className="text-3xl font-black text-vnpost-orange">{history.length}</span>
                   <span className="text-[10px] font-bold opacity-60">Lần tương tác</span>
                </div>
             </div>
             <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Trạng thái cuối</p>
                <div className="flex items-center gap-2 mt-1">
                   {history.length > 0 ? (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${getStatusColor(history[0].trang_thai).replace('bg-', 'bg-white/').replace('text-', 'text-')}`}>
                        {history[0].trang_thai}
                      </span>
                   ) : (
                      <span className="text-[10px] font-black uppercase opacity-40">Chưa có tương tác</span>
                   )}
                </div>
             </div>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
               <div className="w-12 h-12 border-4 border-vnpost-blue border-t-transparent rounded-full animate-spin"></div>
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Đang trích xuất dữ liệu lịch sử...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20">
               <div className="w-16 h-16 bg-gray-100 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} />
               </div>
               <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Chưa ghi nhận lịch sử tương tác</h4>
               <p className="text-xs text-gray-400 mt-2">Mọi hoạt động giao việc và báo cáo sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-vnpost-blue/20 via-gray-200 to-gray-200/0"></div>

              <div className="space-y-8">
                {history.map((item, idx) => (
                  <div key={item.id} className="relative pl-12 group">
                    {/* Dot on line */}
                    <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${idx === 0 ? 'bg-vnpost-blue text-white ring-4 ring-blue-50' : 'bg-gray-100 text-gray-400'}`}>
                       {item.trang_thai === 'Hoàn thành' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    </div>

                    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-gray-100 group-hover:shadow-md transition-all group-hover:border-vnpost-blue/10">
                       <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black text-vnpost-blue">{item.created_at}</span>
                                <div className="flex items-center gap-2 mt-1">
                                   {getFlowBadge(item.phan_loai)}
                                   <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusColor(item.trang_thai)}`}>
                                      {item.trang_thai}
                                   </span>
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Nhân sự phụ trách</p>
                             <p className="text-xs font-black text-gray-700 flex items-center justify-end gap-1.5">
                                <User size={12} className="text-vnpost-blue" /> {item.staff_name}
                             </p>
                          </div>
                       </div>

                       <div className="space-y-3">
                          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-50">
                             <p className="text-[9px] font-black text-vnpost-blue uppercase tracking-widest mb-1">Nội dung chỉ đạo / Kịch bản</p>
                             <p className="text-xs font-bold text-gray-700 leading-relaxed">{item.tieu_de}: {item.noi_dung}</p>
                          </div>

                          {item.bao_cao && (
                             <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-5">
                                   <MessageSquare size={32} className="text-emerald-600" />
                                </div>
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                   <CheckCircle2 size={10} /> Kết quả báo cáo {item.ngay_hoan_thanh && `(${item.ngay_hoan_thanh})`}
                                </p>
                                <p className="text-xs font-medium text-emerald-900 italic leading-relaxed">
                                   "{item.bao_cao}"
                                </p>
                             </div>
                          )}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-gray-100 flex justify-center">
           <button 
             onClick={onClose}
             className="px-10 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
           >
             Đóng cửa sổ
           </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerHistoryModal;

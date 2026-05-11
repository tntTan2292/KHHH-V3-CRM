import React, { useState, useEffect } from 'react';
import { X, Calendar, Package, DollarSign, Download, RefreshCw, BarChart2, List } from 'lucide-react';
import api from '../utils/api';
import { toast } from 'react-toastify';

const PotentialTransactionModal = ({ isOpen, onClose, customerName, startDate, endDate, nodeCode }) => {
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'list'
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ monthly: [], transactions: [] });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (isOpen && customerName) {
      fetchData();
    } else {
      setData({ monthly: [], transactions: [], total_count: 0 });
      setActiveTab('monthly');
      setPage(1);
    }
  }, [isOpen, customerName, startDate, endDate, nodeCode, page]); // ✅ Thêm page vào dependency

  const fetchData = async () => {
    const { ten_kh, dia_chi_full, ma_bc } = typeof customerName === 'object' ? customerName : { ten_kh: customerName, dia_chi_full: null, ma_bc: null };
    setLoading(true);
    try {
      const res = await api.get('/api/potential/transactions', {
        params: {
          ten_kh: ten_kh,
          dia_chi_full: dia_chi_full || undefined,
          ma_bc: ma_bc || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          node_code: nodeCode || undefined,
          page: page, // ✅ Gửi page lên Backend
          page_size: pageSize
        }
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải chi tiết giao dịch");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const { ten_kh, dia_chi_full, ma_bc } = typeof customerName === 'object' ? customerName : { ten_kh: customerName, dia_chi_full: null, ma_bc: null };
    try {
      toast.info("Đang chuẩn bị dữ liệu giao dịch...");
      const res = await api.get('/api/export/potential/transactions', {
        params: {
          ten_kh: ten_kh,
          dia_chi_full: dia_chi_full || undefined,
          ma_bc: ma_bc || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          node_code: nodeCode || undefined
        },
        responseType: 'blob',
        timeout: 120000 // 2 minutes
      });

      if (res.data.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = () => {
          const errorData = JSON.parse(reader.result);
          toast.error(`Lỗi: ${errorData.detail || 'Không xác định'}`);
        };
        reader.readAsText(res.data);
        return;
      }

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `LichSu_TiemNang_${ten_kh.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success("Xuất Excel thành công!");
    } catch (err) {
      console.error("EXPORT ERROR:", err);
      toast.error("Lỗi khi xuất Excel");
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  // ✅ ĐIỂM 2 & 3: Phân trang tại Backend
  const totalPages = Math.ceil((data.total_count || 0) / pageSize) || 1;
  const paginatedTxs = data.transactions || []; // Backend đã slice sẵn

  // Tính đỉnh cao và chạm đáy để highlight
  const maxOrders = Math.max(...data.monthly.map(m => m.total_orders), 0);
  const maxRevenue = Math.max(...data.monthly.map(m => m.revenue), 0);

  return (
    <div className="fixed inset-0 bg-[#003E7E]/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#003E7E] to-blue-800 p-6 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                Customer Drill-down
              </span>
            </div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              {typeof customerName === 'object' ? customerName.ten_kh : customerName}
            </h2>
            {typeof customerName === 'object' && customerName.dia_chi_full && (
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                {customerName.dia_chi_full}
              </p>
            )}
            <p className="text-blue-200 text-sm font-medium mt-1 flex items-center gap-2">
              <Calendar size={14} /> Ký lọc: {startDate || "Tất cả"} ➔ {endDate || "Tất cả"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleExport}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg transition-all"
            >
              <Download size={16} /> Xuất Excel
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 border-b border-gray-100 shrink-0 gap-4">
          <button 
            onClick={() => setActiveTab('monthly')}
            className={`pb-4 px-4 font-black text-sm uppercase tracking-wider transition-all border-b-4 flex items-center gap-2 ${
              activeTab === 'monthly' ? 'border-vnpost-orange text-vnpost-blue' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <BarChart2 size={18} /> Tần suất theo tháng
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`pb-4 px-4 font-black text-sm uppercase tracking-wider transition-all border-b-4 flex items-center gap-2 ${
              activeTab === 'list' ? 'border-vnpost-orange text-vnpost-blue' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <List size={18} /> Danh sách Bưu gửi ({data.transactions.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-vnpost-blue">
              <RefreshCw className="animate-spin mb-4" size={32} />
              <p className="font-black uppercase tracking-widest text-sm text-gray-500">Đang quét dữ liệu giao dịch...</p>
            </div>
          ) : activeTab === 'monthly' ? (
            <div className="space-y-4">
              {data.monthly.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic">Không có dữ liệu trong khoảng thời gian này</div>
              ) : (
                <div className="grid gap-4">
                  {data.monthly.map((m, idx) => {
                    const isTopRevenue = m.revenue === maxRevenue && maxRevenue > 0;
                    const isTopOrders = m.total_orders === maxOrders && maxOrders > 0;
                    
                    return (
                      <div key={idx} className={`bg-white p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${isTopRevenue ? 'border-amber-200 shadow-md bg-amber-50/20' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-lg ${isTopRevenue ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-vnpost-blue'}`}>
                            {m.month.split('/')[0]}
                          </div>
                          <div>
                            <p className="font-bold text-gray-400 text-xs uppercase tracking-widest">Năm {m.month.split('/')[1]}</p>
                            <p className="font-black text-xl text-gray-800">Tháng {m.month}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-10">
                          <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                              <Package size={12} /> Sản lượng
                            </p>
                            <p className={`text-xl font-black ${isTopOrders ? 'text-indigo-600' : 'text-gray-700'}`}>
                              {m.total_orders.toLocaleString()} <span className="text-xs font-bold text-gray-400">đơn</span>
                            </p>
                          </div>
                          <div className="text-right w-40">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                              <DollarSign size={12} /> Doanh thu
                            </p>
                            <p className={`text-xl font-black ${isTopRevenue ? 'text-amber-600' : 'text-vnpost-blue'}`}>
                              {formatCurrency(m.revenue)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="p-4 font-black uppercase text-[10px]">STT</th>
                    <th className="p-4 font-black uppercase text-[10px]">Ngày gửi</th>
                    <th className="p-4 font-black uppercase text-[10px]">Mã bưu gửi</th>
                    <th className="p-4 font-black uppercase text-[10px]">Dịch vụ</th>
                    <th className="p-4 font-black uppercase text-[10px]">Bưu cục nhận</th>
                    <th className="p-4 font-black uppercase text-[10px] text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedTxs.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-gray-400 italic">Không có giao dịch</td></tr>
                  ) : (
                    paginatedTxs.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                        <td className="p-4 text-xs font-bold text-gray-400">{(page - 1) * pageSize + idx + 1}</td>
                        <td className="p-4 font-bold text-gray-600">{tx.ngay_chap_nhan}</td>
                        <td className="p-4 font-black text-indigo-600">{tx.shbg}</td>
                        <td className="p-4 text-xs font-bold">{tx.dich_vu_chinh}</td>
                        <td className="p-4 text-xs font-bold text-gray-500">{tx.point_name} ({tx.ma_dv_chap_nhan})</td>
                        <td className="p-4 font-black text-vnpost-blue text-right">{formatCurrency(tx.doanh_thu)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                  <span className="text-xs font-bold text-gray-400">Trang {page} / {totalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 bg-white border border-gray-200 rounded font-bold text-xs hover:bg-gray-100 disabled:opacity-50">Trước</button>
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 bg-white border border-gray-200 rounded font-bold text-xs hover:bg-gray-100 disabled:opacity-50">Sau</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PotentialTransactionModal;

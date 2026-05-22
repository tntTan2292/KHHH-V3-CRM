import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

const CustomerListModal = ({ isOpen, onClose, customers, title = "Khách hàng nguy cơ rời bỏ" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl shadow-sm">
              <AlertCircle size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">{title}</h2>
              <p className="text-[10px] font-medium text-gray-400 mt-0.5">Tổng số: <span className="font-bold text-gray-600">{customers?.length || 0}</span> khách hàng</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/95 backdrop-blur z-10 border-b border-gray-100 shadow-sm">
              <tr>
                <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-4">Khách hàng</th>
                <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Mức độ rủi ro</th>
                <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Sụt giảm</th>
                <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right pr-4">Vắng mặt</th>
              </tr>
            </thead>
            <tbody>
              {customers && customers.length > 0 ? customers.map((c, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors group">
                  <td className="p-3 pl-4">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-gray-800 truncate group-hover:text-red-700 transition-colors">{c.ten_kh}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{c.ma_kh}</span>
                        <span className="text-[8px] font-bold px-1.5 bg-gray-100 text-gray-500 rounded uppercase">{c.segment}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${c.risk_level?.includes('CAO') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.risk_level}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-[11px] font-black text-red-600">-{c.drop_pct}%</span>
                  </td>
                  <td className="p-3 text-right pr-4">
                    <span className="text-[11px] font-bold text-gray-700">{c.days_inactive} ngày</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400 text-xs italic font-medium">
                    Không có dữ liệu nguy cơ rời bỏ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerListModal;

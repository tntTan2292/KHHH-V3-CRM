import React from 'react';
import { toast } from 'react-toastify';
import { ArrowUpRight, TrendingUp, Sparkles, Zap, Send } from 'lucide-react';

const EliteMorningPulse = ({ report, loading }) => {
  if (loading) return (
    <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-100 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-gray-200 rounded-2xl"></div>
        <div className="space-y-2">
          <div className="w-32 h-4 bg-gray-200 rounded"></div>
          <div className="w-48 h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
  
  if (!report) return null;

  const { stats, alerts, formatted_message } = report;
  const growthColor = stats.is_up ? 'text-emerald-500' : 'text-rose-500';

  const handleDispatch = () => {
    navigator.clipboard.writeText(formatted_message);
    toast.success("🚀 Đã sao chép báo cáo! Đang mở Zalo Group...");
    window.open("https://zalo.me", "_blank");
  };

  return (
    <div className="bg-white rounded-2xl p-3 shadow-xl border border-blue-50 relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
        <Sparkles size={120} className="text-vnpost-blue" />
      </div>
      
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-gradient-to-br from-vnpost-blue to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 animate-bounce-slow">
            <Zap size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Bot Báo Cáo Sáng</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stats.date}</span>
            </div>
            <h3 className="text-xl font-black text-gray-800 tracking-tight">NHỊP ĐẬP ELITE <span className="text-vnpost-blue">T-1</span></h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-8 px-8 border-x border-gray-100">
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Doanh thu</p>
            <p className="text-lg font-black text-gray-800">{new Intl.NumberFormat('vi-VN').format(stats.revenue)}đ</p>
            <p className={`text-[10px] font-black ${growthColor} mt-1 flex items-center justify-center gap-0.5`}>
              {stats.is_up ? <ArrowUpRight size={12} /> : <TrendingUp size={12} className="rotate-180" />}
              {stats.is_up ? '+' : ''}{stats.growth.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sản lượng</p>
            <p className="text-lg font-black text-gray-800">{stats.orders.toLocaleString()} <span className="text-xs text-gray-400">đơn</span></p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">⚠️ Nguy cơ</p>
            <p className="text-lg font-black text-red-600">{alerts.at_risk_count.toLocaleString()} <span className="text-xs text-red-400">KH</span></p>
          </div>
        </div>

        <button 
          onClick={handleDispatch}
          className="bg-vnpost-blue hover:bg-[#003E7E] text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-200 transition-all flex items-center gap-3 group/btn hover:scale-105 active:scale-95"
        >
          <Send size={20} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
          Dispatch to Zalo
        </button>
      </div>
    </div>
  );
};

export default EliteMorningPulse;

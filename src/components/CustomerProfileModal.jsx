import React from 'react';
import { Users, X, MapPin, TrendingUp, BarChart3, Sparkles } from 'lucide-react';
import ClassificationDonutChart from './ClassificationDonutChart';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function CustomerProfileModal({
  selectedCustomer,
  setSelectedCustomer,
  fullCustomerDetail,
  loadingDetail,
  formatCurrency
}) {
  if (!selectedCustomer) return null;

  const renderTooltipContent = (o) => {
    if(o.active && o.payload && o.payload.length){
        const data = o.payload[0].payload;
        const total = (fullCustomerDetail?.customer?.doanh_thu_luy_ke) || 1;
        const pct = ((data.value / total) * 100).toFixed(1);
        return (
            <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-xs">
                <p className="font-bold">{data.name}</p>
                <p>{formatCurrency(data.value)} ({pct}%)</p>
            </div>
        );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="relative p-8 bg-vnpost-blue text-white overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Users size={120} /></div>
          <button onClick={() => setSelectedCustomer(null)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
          <div className="relative z-10">
             <div className="flex items-center gap-2 flex-wrap">
               <span className="text-[11px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">{selectedCustomer.rank || selectedCustomer.segment || 'Customer'}</span>
               {selectedCustomer.risk_level && (<span className="text-[11px] font-black uppercase bg-red-600 text-white px-4 py-1.5 rounded-full shadow-lg border-2 border-white/20 animate-pulse">{selectedCustomer.risk_level.includes("CAO") ? "⚠️ NGUY CƠ CAO" : "🔔 THEO DÕI"}</span>)}
               {selectedCustomer.score && !selectedCustomer.risk_level && (<span className="text-[11px] font-black uppercase bg-emerald-600 text-white px-4 py-1.5 rounded-full shadow-lg border-2 border-white/20">✅ KH ACTIVE</span>)}
             </div>
             <h2 className="text-2xl font-black mt-2 uppercase">{selectedCustomer.ten_kh}</h2>
             <p className="text-blue-200 font-bold mt-1 tracking-widest">{selectedCustomer.ma_kh || selectedCustomer.ma_crm_cms}</p>
             {selectedCustomer.risk_level ? (<p className="text-[11px] mt-2 bg-white/10 px-3 py-1.5 rounded-xl text-red-100 font-bold inline-block">Gợi ý: Ưu tiên giữ chân - {selectedCustomer.risk_level.includes("CAO") ? "trong 24h" : "tuần này"}</p>) : selectedCustomer.score ? (<p className="text-[11px] mt-2 bg-white/10 px-3 py-1.5 rounded-xl text-blue-100 font-bold inline-block">Gợi ý: Ưu tiên upsell EMS</p>) : null}
          </div>
        </div>
        
        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Metrics & Trend */}
          <div className="lg:col-span-2 space-y-6">
             <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <p className="text-[11px] text-gray-400 font-black uppercase mb-1">Doanh thu kỳ này</p>
                   <p className="text-xl font-black text-gray-800">{formatCurrency(selectedCustomer.curr_rev || selectedCustomer.revenue)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <p className="text-[11px] text-gray-400 font-black uppercase mb-1">Tần suất gửi</p>
                   <p className="text-xl font-black text-gray-800">{selectedCustomer.frequency || selectedCustomer.transaction_count || 'N/A'} đơn</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                   <p className="text-[11px] text-indigo-400 font-black uppercase mb-1">Điểm RFM</p>
                   <p className="text-xl font-black text-indigo-600">{selectedCustomer.score || 0}</p>
                </div>
             </div>

             <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <TrendingUp size={14} className="text-vnpost-blue" /> Xu hướng 12 tháng gần nhất
                </h5>
                <div className="h-48 w-full">
                   {loadingDetail ? (
                     <div className="h-full flex items-center justify-center text-gray-300 italic text-[13px] animate-pulse">Đang tải thông tin chi tiết...</div>
                   ) : fullCustomerDetail?.trend ? (
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={fullCustomerDetail.trend}>
                           <defs>
                              <linearGradient id="colorCustomer" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#0054A6" stopOpacity={0.1}/>
                                 <stop offset="95%" stopColor="#0054A6" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                           <XAxis dataKey="month" hide />
                           <YAxis hide />
                           <RechartsTooltip formatter={(v) => formatCurrency(v)} />
                           <Area type="monotone" dataKey="revenue" stroke="#0054A6" fill="url(#colorCustomer)" strokeWidth={3} dot={{r: 3}} />
                        </AreaChart>
                     </ResponsiveContainer>
                   ) : <div className="h-full flex items-center justify-center text-gray-300 italic text-[13px]">Không có dữ liệu xu hướng</div>}
                </div>
             </div>
          </div>

           {/* Right Column: Service Mix & AI Insights */}
           <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                 <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-vnpost-orange" /> Cơ cấu Dịch vụ
                 </h5>
                 <div className="h-48">
                    {loadingDetail ? (
                      <div className="flex justify-center items-center h-full text-gray-300 italic text-xs animate-pulse">Đang nạp cơ cấu dịch vụ...</div>
                    ) : fullCustomerDetail?.services?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={fullCustomerDetail.services} innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                               {fullCustomerDetail.services.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <RechartsTooltip content={renderTooltipContent} />
                            <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                         </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="flex justify-center items-center h-full text-gray-300 text-xs">Không có dữ liệu</div>}
                 </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                 <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-blue-500" /> Tỉ trọng Trong nước / Quốc tế
                 </h5>
                 <div className="h-48">
                    {loadingDetail ? (
                      <div className="flex justify-center items-center h-full text-gray-300 italic text-xs animate-pulse">Đang nạp dữ liệu...</div>
                    ) : fullCustomerDetail?.scope?.filter(s => s.value > 0).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={fullCustomerDetail.scope.filter(s => s.value > 0)} innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                               {fullCustomerDetail.scope.filter(s => s.value > 0).map((_, i) => <Cell key={i} fill={['#0054A6', '#F9A51A'][i % 2]} />)}
                            </Pie>
                            <RechartsTooltip content={renderTooltipContent} />
                            <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                         </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="flex justify-center items-center h-full text-gray-300 text-xs">Không có dữ liệu</div>}
                 </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                 <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-indigo-500" /> Cơ cấu Nhóm Dịch vụ
                 </h5>
                 <div className="h-48">
                    <ClassificationDonutChart 
                      data={fullCustomerDetail?.classifications}
                      loading={loadingDetail}
                      totalRevenue={fullCustomerDetail?.customer?.doanh_thu_luy_ke}
                      formatCurrency={formatCurrency}
                    />
                 </div>
              </div>

             <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                <h5 className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <Sparkles size={14} className="animate-pulse" /> AI Strategic Insights
                </h5>
                <p className="text-[13px] text-amber-900 font-medium leading-relaxed">
                   {selectedCustomer.detailed_reason ? (
                     <>Cảnh báo: <b>{selectedCustomer.detailed_reason}</b>. {selectedCustomer.risk_level.includes('CAO') ? 'Khách hàng có nguy cơ rời bỏ cao, cần liên hệ trực tiếp trong 24h tới.' : 'Cần theo dõi sát sao và gửi chương trình khuyến mãi mục tiêu.'}</>
                   ) : (
                     `Khách hàng ${selectedCustomer.ten_kh} đang là đối tác chiến lược với điểm RFM ấn tượng (${selectedCustomer.score}). Khuyến nghị: Duy trì chăm sóc VIP và đề xuất mở rộng dịch vụ Quốc tế.`
                   )}
                </p>
                <div className="mt-4 pt-4 border-t border-amber-200/50 flex justify-between items-center text-[11px] font-black text-amber-700 uppercase">
                   <span>Last Active:</span>
                   <span>{loadingDetail ? '...' : (fullCustomerDetail?.last_active || 'N/A')}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="p-8 pt-0 flex justify-end gap-3">
           <button onClick={() => setSelectedCustomer(null)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold uppercase text-xs hover:bg-gray-200 transition-all">Đóng</button>
           <button className="px-6 py-3 bg-vnpost-blue text-white rounded-xl font-black uppercase text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
              <MapPin size={14} /> Giao việc cho Nhân sự
           </button>
        </div>
      </div>
    </div>
  );
}

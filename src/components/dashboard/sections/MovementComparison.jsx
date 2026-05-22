import React from 'react';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, Line, BarChart, Legend } from 'recharts';
import { Activity, Loader2, RefreshCw, TrendingUp, BarChart3 } from 'lucide-react';
import Skeleton from '../../Skeleton';
import AIAssistantInsights from '../shared/AIAssistantInsights';

const CustomTooltip = ({ active, payload, label, unit, formatCurrency }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
    return (
      <div className="bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[200px]">
        <p className="text-sm font-black text-gray-800 mb-2 border-b border-gray-100 pb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={`${entry.name}-${index}`} className="flex justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }}></div>
                <span className="text-xs font-bold text-gray-500">{entry.name}:</span>
              </div>
              <span className="text-xs font-black text-gray-700">
                {unit === 'VND' ? formatCurrency(entry.value) : (entry.value || 0).toLocaleString() + ' đơn'}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center gap-6 pt-2 mt-2 border-t border-dashed border-gray-200">
            <span className="text-xs font-black text-vnpost-blue uppercase tracking-wider">Tổng cộng:</span>
            <span className="text-sm font-black text-vnpost-blue">
              {unit === 'VND' ? formatCurrency(total) : total.toLocaleString() + ' đơn'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const MovementComparison = ({
  monthlyDataRes,
  moversData,
  loadingMovers,
  stats,
  churnDataRes,
  heatmapDataRes,
  onInsightAction,
  formatCurrency
}) => {


  return (
    <>
      {/* Biến Động Doanh Thu & Tăng Trưởng MoM */}
      <div className="card p-4 !col-span-full">
        <div className="h-[400px] w-full">
          {(() => {
            if (!monthlyDataRes || monthlyDataRes.length === 0) {
              return (
                <div className="flex flex-col h-full items-center justify-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <Loader2 className="w-8 h-8 text-vnpost-blue/20 animate-spin" />
                  <p className="text-[10px] font-black text-gray-400 uppercase mt-4">Đang phân tích xu hướng...</p>
                </div>
              );
            }
            
            const chartData = monthlyDataRes.map(m => ({
              month: m.month,
              total: m.total_revenue || m.total || 0,
              growth: m.growth_rate || m.growth || 0
            })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

            return (
              <div className="flex flex-col h-full">
                <h3 className="text-[10px] font-black text-vnpost-blue uppercase tracking-widest flex items-center justify-between mb-4 border-b border-gray-50 pb-2">
                  <span className="flex items-center gap-2">
                    <Activity size={14} /> 
                    Hiệu Suất & Tốc Độ Tăng Trưởng 
                  </span>
                  <div className="flex gap-3">
                     <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#0054A6] rounded-sm"></div> <span className="text-[11px] font-bold text-gray-500 uppercase">Doanh thu</span></div>
                     <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-[#F9A51A]"></div> <span className="text-[11px] font-bold text-gray-500 uppercase">Tăng trưởng (%)</span></div>
                  </div>
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} 
                        tickFormatter={(val) => {
                          if (!val) return "";
                          const [y, m] = val.split('-');
                          return `T${m}/${y.slice(2)}`;
                        }}
                      />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => val === 0 ? "0" : `${((val || 0) / 1000000).toFixed(0)}M`} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#F9A51A', fontWeight: 'bold' }} tickFormatter={(val) => `${val}%`} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '11px' }}
                        formatter={(val, name) => [name === 'growth' ? `${val}%` : formatCurrency(val), name === 'growth' ? 'Tăng trưởng' : 'Doanh thu']} 
                      />
                      <Bar yAxisId="left" dataKey="total" name="revenue" fill="#0054A6" radius={[6, 6, 0, 0]} barSize={45} />
                      <Line yAxisId="right" type="monotone" dataKey="growth" stroke="#F9A51A" strokeWidth={4} dot={{ r: 5, fill: '#F9A51A', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Đối soát & Phân tích Hiệu quả (MoM/YoY Charts) */}
      {loadingMovers && !moversData.summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Skeleton.Card height="h-96" />
          <Skeleton.Card height="h-96" />
        </div>
      ) : moversData && moversData.summary ? (() => {
        const SERVICE_COLORS = { 'EMS': '#0054A6', 'Bưu kiện': '#F9A51A', 'KT1': '#10b981', 'BĐBD': '#f43f5e', 'Quốc tế': '#8b5cf6', 'Khác': '#94a3b8' };
        const services = moversData.summary?.services || [];
        const activeServices = services.map(s => s.service);
        
        const revData = [
          { name: 'Kỳ này', ...services.reduce((acc, s) => ({ ...acc, [s.service]: s.current_rev }), {}) },
          { name: 'Kỳ trước', ...services.reduce((acc, s) => ({ ...acc, [s.service]: s.previous_rev }), {}) }
        ];
        
        const volData = [
          { name: 'Kỳ này', ...services.reduce((acc, s) => ({ ...acc, [s.service]: s.current_vol }), {}) },
          { name: 'Kỳ trước', ...services.reduce((acc, s) => ({ ...acc, [s.service]: s.previous_vol }), {}) }
        ];

        return (
          <div className="space-y-4 !col-span-full">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mt-4 border-b border-gray-100 pb-2">
              <h3 className="text-[11px] font-black text-vnpost-blue uppercase tracking-widest flex items-center gap-2">
                <RefreshCw className="w-3 h-3" /> Đối soát & Phân tích Hiệu quả
              </h3>
              {(() => {
                if (moversData?.period) {
                  const p = moversData.period;
                  return (
                    <div className="px-4 py-1.5 bg-gray-50 rounded-full border border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-tight flex items-center gap-3 shadow-inner">
                      <span className="text-vnpost-blue/60">{(p.type || '').toUpperCase()}:</span>
                      <span className="text-gray-400 italic">Kỳ trước:</span> <span className="text-gray-700">{p.previous?.start} - {p.previous?.end}</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-400 italic">Kỳ này:</span> <span className="text-vnpost-blue">{p.current?.start} - {p.current?.end}</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <AIAssistantInsights 
              summary={moversData.summary} 
              stats={stats} 
              churnPrediction={churnDataRes} 
              heatmapData={heatmapDataRes} 
              onAction={onInsightAction}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Revenue Comparison */}
              <div className="card p-4 bg-white border-l-4 border-l-vnpost-blue shadow-lg">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-blue-50 rounded-lg text-vnpost-blue"><TrendingUp size={16} /></div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Biến động Doanh thu</h3>
                      </div>
                    </div>
                    {moversData?.period && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                        <span className="px-2.5 py-1 bg-vnpost-blue/10 text-vnpost-blue rounded-full border border-vnpost-blue/20 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-vnpost-blue inline-block"></span>
                          Kỳ này: {moversData.period.current.start} – {moversData.period.current.end}
                        </span>
                        <span className="text-gray-300">vs</span>
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                          Kỳ trước: {moversData.period.previous.start} – {moversData.period.previous.end}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100 uppercase tracking-widest">{moversData.period.type?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 relative group overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tổng Doanh Thu Kỳ Này</p>
                    <p className="text-2xl font-black text-vnpost-blue mb-1">{formatCurrency(moversData.summary.revenue.current)}</p>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${(moversData?.summary?.revenue?.current || 0) >= (moversData?.summary?.revenue?.previous || 0) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {(moversData?.summary?.revenue?.current || 0) >= (moversData?.summary?.revenue?.previous || 0) ? '↑' : '↓'}
                      {Math.abs((((moversData?.summary?.revenue?.current || 0) - (moversData?.summary?.revenue?.previous || 0)) / (moversData?.summary?.revenue?.previous || 1) * 100)).toFixed(1)}%
                    </div>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barGap={5}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#1e293b' }} width={80} />
                          <RechartsTooltip content={<CustomTooltip unit="VND" formatCurrency={formatCurrency} />} cursor={{ fill: '#f8fafc', opacity: 0.4 }} />
                        <Legend verticalAlign="top" align="right" iconType="circle" />
                        {activeServices.map((svc, idx) => (
                          <Bar key={idx} dataKey={svc} name={svc} stackId="a" fill={SERVICE_COLORS[svc] || '#cbd5e1'} barSize={35} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Volume Comparison */}
              <div className="card p-4 bg-white border-l-4 border-l-vnpost-orange shadow-lg">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5 mb-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-orange-50 rounded-lg text-vnpost-orange"><BarChart3 size={16} /></div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Biến động Sản lượng</h3>
                      </div>
                    </div>
                    {moversData?.period && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                        <span className="px-2.5 py-1 bg-vnpost-orange/10 text-vnpost-orange rounded-full border border-vnpost-orange/20 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-vnpost-orange inline-block"></span>
                          Kỳ này: {moversData.period.current.start} – {moversData.period.current.end}
                        </span>
                        <span className="text-gray-300">vs</span>
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                          Kỳ trước: {moversData.period.previous.start} – {moversData.period.previous.end}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100 uppercase tracking-widest">{moversData.period.type?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 relative group overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tổng Sản Lượng Kỳ Này</p>
                    <p className="text-2xl font-black text-vnpost-orange mb-1">{(moversData.summary.volume.current || 0).toLocaleString()} <span className="text-sm font-bold opacity-60">đơn</span></p>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${(moversData?.summary?.volume?.current || 0) >= (moversData?.summary?.volume?.previous || 0) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {(moversData?.summary?.volume?.current || 0) >= (moversData?.summary?.volume?.previous || 0) ? '↑' : '↓'}
                      {Math.abs((((moversData?.summary?.volume?.current || 0) - (moversData?.summary?.volume?.previous || 0)) / (moversData?.summary?.volume?.previous || 1) * 100)).toFixed(1)}%
                    </div>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={volData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barGap={5}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#1e293b' }} width={80} />
                          <RechartsTooltip content={<CustomTooltip unit="UNIT" formatCurrency={formatCurrency} />} cursor={{ fill: '#f8fafc', opacity: 0.4 }} />
                        <Legend verticalAlign="top" align="right" iconType="circle" />
                        {activeServices.map((svc, idx) => (
                          <Bar key={idx} dataKey={svc} name={svc} stackId="a" fill={SERVICE_COLORS[svc] || '#cbd5e1'} barSize={35} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}

      {/* Top 20 Stars & Risks */}
      {loadingMovers && !moversData.summary ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Skeleton.Table rows={10} />
            <Skeleton.Table rows={10} />
          </div>
      ) : moversData.movers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="card !p-0 overflow-hidden border-t-4 border-t-green-500 shadow-xl bg-white group/card">
            <div className="p-3 border-b border-gray-100 bg-green-50/30 flex justify-between items-center relative overflow-hidden">
              <div className="absolute -right-2 -top-2 text-green-100 opacity-20 transform rotate-12 select-none group-hover/card:scale-110 transition-transform duration-700">
                <TrendingUp size={80} />
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-black text-green-800 flex items-center gap-2 uppercase tracking-widest">
                  <TrendingUp size={18} /> TOP 20 TĂNG TRƯỞNG (STARS)
                </h3>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/80 backdrop-blur-sm text-gray-500 text-[9px] uppercase sticky top-0 z-10 shadow-sm border-b border-gray-100 font-black">
                  <tr>
                    <th className="px-4 py-2 text-left">Khách hàng</th>
                    <th className="px-4 py-2 text-right">Biến động (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {moversData.movers.gainers?.slice(0, 20).map((kh, idx) => (
                    <tr key={idx} className="hover:bg-green-50/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded-lg text-[9px] font-black shadow-sm">{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 leading-none truncate max-w-[150px]">{kh.ten_kh}</p>
                            <p className="text-[8px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">{kh.ma_kh}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-black text-green-600">+{formatCurrency(kh.diff)}</p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter italic">Kỳ trước: {formatCurrency(kh.previous)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card !p-0 overflow-hidden border-t-4 border-t-red-500 shadow-xl bg-white group/card">
            <div className="p-4 border-b border-gray-100 bg-red-50/30 flex justify-between items-center relative overflow-hidden">
              <div className="absolute -right-2 -top-2 text-red-100 opacity-20 transform rotate-12 select-none group-hover/card:scale-110 transition-transform duration-700">
                <TrendingUp size={80} className="rotate-180" />
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-black text-red-800 flex items-center gap-2 uppercase tracking-widest">
                  <TrendingUp size={18} className="rotate-180" /> TOP 20 SỤT GIẢM (RISKS)
                </h3>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/80 backdrop-blur-sm text-gray-500 text-[9px] uppercase sticky top-0 z-10 shadow-sm border-b border-gray-100 font-black">
                  <tr>
                    <th className="px-4 py-2 text-left">Khách hàng</th>
                    <th className="px-4 py-2 text-right">Biến động (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {moversData.movers.losers?.slice(0, 20).map((kh, idx) => (
                    <tr key={idx} className="hover:bg-red-50/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded-lg text-[9px] font-black shadow-sm">{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 leading-none truncate max-w-[150px]">{kh.ten_kh}</p>
                            <p className="text-[8px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">{kh.ma_kh}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-black text-red-600">{formatCurrency(kh.diff)}</p>
                        <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter italic">Kỳ trước: {formatCurrency(kh.previous)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(MovementComparison);

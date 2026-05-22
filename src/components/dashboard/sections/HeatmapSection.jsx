import React, { useState, useMemo, forwardRef, useImperativeHandle, useDeferredValue } from 'react';
import { Target, Search, DownloadCloud, Maximize2, Minimize2, ArrowLeft, ChevronRight, TrendingUp, ArrowUpRight, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import Skeleton from '../../Skeleton';

const HeatmapSection = forwardRef(({ 
  heatmapDataRes, 
  loadingHeatmap, 
  navStack, 
  setNavStack, 
  setSelectedNode, 
  handleGoBack, 
  handleDrillDown,
  formatCurrency
}, ref) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [quickFilter, setQuickFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [pinnedRows, setPinnedRows] = useState([]);

  useImperativeHandle(ref, () => ({
    applyQuickFilter: (filterType) => {
      setQuickFilter(filterType);
    }
  }));

  const processedHeatmapData = useMemo(() => {
    if (!heatmapDataRes || !heatmapDataRes.length) return [];
    const rawData = Array.isArray(heatmapDataRes) ? heatmapDataRes : [];
    return rawData.map(h => ({
      ...h,
      id: h.ma_don_vi,
      title: h.don_vi,
      revenue: Number(h?.revenue) || 0,
      growth: Number(h?.growth) || 0,
      previous_revenue: Number(h?.previous_revenue) || 0
    }));
  }, [heatmapDataRes]);

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const heatmapFilteredData = useMemo(() => {
    if (!processedHeatmapData.length) return [];
    const totalRev = processedHeatmapData.reduce((acc, curr) => acc + curr.revenue, 0);
    const avgRev = totalRev / processedHeatmapData.length;
    
    return processedHeatmapData.filter(item => {
      const matchSearch = !deferredSearchTerm || item.title?.toLowerCase().includes(deferredSearchTerm.toLowerCase()) || String(item.id).toLowerCase().includes(deferredSearchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (quickFilter === 'ALL') return true;
      if (quickFilter === 'STAR') return item.growth >= 0 && item.revenue >= avgRev;
      if (quickFilter === 'POTENTIAL') return item.growth >= 0 && item.revenue < avgRev;
      if (quickFilter === 'COW') return item.growth < 0 && item.revenue >= avgRev;
      if (quickFilter === 'DANGER') return item.growth < 0 && item.revenue < avgRev;
      return true;
    });
  }, [processedHeatmapData, quickFilter, deferredSearchTerm]);

  const handleCopyTSV = () => {
    if (!heatmapFilteredData.length) return;
    const totalRev = processedHeatmapData.reduce((acc, curr) => acc + curr.revenue, 0);
    const avgRev = totalRev / processedHeatmapData.length;

    const getQuadrant = (rev, growth) => {
        if (rev >= avgRev && growth >= 0) return { label: "NGÔI SAO", color: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-50", icon: <Sparkles size={12}/> };
        if (rev >= avgRev && growth < 0) return { label: "BÒ SỮA", color: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-50", icon: <Target size={12}/> };
        if (rev < avgRev && growth >= 0) return { label: "TRIỂN VỌNG", color: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-50", icon: <TrendingUp size={12}/> };
        return { label: "YẾU KÉM", color: "bg-red-500", text: "text-red-500", bg: "bg-red-50", icon: <AlertCircle size={12}/> };
    };

    const header = "Đơn vị\tID\tDoanh thu\tTăng trưởng\tChiến lược\n";
    const rows = [...heatmapFilteredData].sort((a, b) => b.revenue - a.revenue).map(item => {
        const q = getQuadrant(item.revenue, item.growth);
        return `${item.title}\t${item.id}\t${item.revenue}\t${item.growth}%\t${q.label}`;
    }).join('\n');
    const copyText = header + rows;
    if (navigator.clipboard && window.isSecureContext) {
        try {
            navigator.clipboard.writeText(copyText);
            toast.success("Đã sao chép bảng Heatmap (TSV)");
        } catch (err) {
            toast.error("Lỗi khi sao chép");
        }
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = copyText;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            toast.success("Đã copy dữ liệu bảng Heatmap!");
        } catch (error) {
            console.error(error);
            toast.error("Trình duyệt không hỗ trợ copy.");
        } finally {
            textArea.remove();
        }
    }
  };

  const handlePinRow = (id) => {
    setPinnedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };
  
  const handleCopyRowId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success(`Đã sao chép ID: ${id}`);
  };

  return (
    <div className="card p-4 overflow-hidden relative z-20 min-w-0">
      <div className="flex flex-col gap-2 mb-4 border-b border-gray-50 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Target size={18} className="text-vnpost-orange" /> 
            Bảng Quản trị Hiệu quả & Tăng trưởng Địa bàn
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className="relative flex items-center">
              <Search size={12} className="absolute left-2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm ID / Đơn vị..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-6 pr-2 py-1 rounded-full text-[10px] border border-gray-200 bg-white shadow-sm focus:outline-none focus:border-vnpost-blue focus:ring-1 focus:ring-vnpost-blue transition-all w-36"
              />
            </div>
            <button onClick={() => setQuickFilter('ALL')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'ALL' ? 'bg-vnpost-blue text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Tất cả</button>
            <button onClick={() => setQuickFilter('STAR')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'STAR' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>⭐ Ngôi sao</button>
            <button onClick={() => setQuickFilter('POTENTIAL')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'POTENTIAL' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>🚀 Triển vọng</button>
            <button onClick={() => setQuickFilter('COW')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'COW' ? 'bg-orange-500 text-white shadow-sm' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>🐄 Bò sữa</button>
            <button onClick={() => setQuickFilter('DANGER')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'DANGER' ? 'bg-red-500 text-white shadow-sm' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>⚠️ Yếu kém</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleCopyTSV} className="text-[10px] font-bold bg-vnpost-blue/10 text-vnpost-blue hover:bg-vnpost-blue/20 px-2 py-1 rounded-full uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm">
              <DownloadCloud size={12} /> Sao chép TSV
            </button>
            <span className="text-[10px] font-bold bg-vnpost-orange/10 text-vnpost-orange px-2 py-1 rounded-full uppercase tracking-wider">
              PHÂN LOẠI CHIẾN LƯỢC 4 NHÓM
            </span>
            <button 
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue shadow-sm transition-all"
              title={isFullScreen ? "Thu nhỏ" : "Toàn màn hình"}
            >
              {isFullScreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
            </button>
          </div>
        </div>

        {navStack.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 bg-gray-50/50 rounded-xl border border-gray-100/50 w-fit animate-in fade-in slide-in-from-left-2">
            <button 
              onClick={handleGoBack}
              className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue shadow-sm transition-all flex items-center gap-1 group"
            >
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Quay lại</span>
            </button>
            
            <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
            
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[400px]">
              {navStack.map((step, idx) => (
                <React.Fragment key={step.key}>
                  {idx > 0 && <ChevronRight size={10} className="text-gray-300 flex-shrink-0" />}
                  <button
                    onClick={() => {
                      const newStack = navStack.slice(0, idx + 1);
                      setNavStack(newStack);
                      setSelectedNode(step);
                    }}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                      idx === navStack.length - 1 
                        ? 'bg-vnpost-blue text-white shadow-sm' 
                        : 'text-gray-400 hover:bg-white hover:text-vnpost-blue'
                    }`}
                  >
                    {step.title}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
        <div className="flex-1 w-full relative">
          {loadingHeatmap && (!heatmapDataRes || !heatmapDataRes.length) ? (
            <Skeleton.Table rows={8} />
          ) : heatmapDataRes && heatmapDataRes.length > 0 ? (() => {
              try {
                const data = processedHeatmapData;
                const totalRev = data.reduce((acc, curr) => acc + curr.revenue, 0);
                const avgRev = totalRev / data.length;

                const getQuadrant = (rev, growth) => {
                  if (rev >= avgRev && growth >= 0) return { label: "NGÔI SAO", color: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-50", icon: <Sparkles size={12}/> };
                  if (rev >= avgRev && growth < 0) return { label: "BÒ SỮA", color: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-50", icon: <Target size={12}/> };
                  if (rev < avgRev && growth >= 0) return { label: "TRIỂN VỌNG", color: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-50", icon: <TrendingUp size={12}/> };
                  return { label: "YẾU KÉM", color: "bg-red-500", text: "text-red-500", bg: "bg-red-50", icon: <AlertCircle size={12}/> };
                };

                const filteredData = heatmapFilteredData;

                return (
                  <div className={`h-full flex flex-col ${isFullScreen ? 'fixed inset-0 z-[9999] bg-white p-10 w-screen h-screen left-0 top-0 overflow-y-auto' : ''}`}>
                    <div className="flex-1 overflow-y-auto no-scrollbar rounded-2xl border border-gray-100 bg-gray-50/30 backdrop-blur-sm">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10">
                          <tr className="border-b border-gray-100">
                            <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đơn vị địa bàn</th>
                            <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Doanh thu</th>
                            <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Tỷ trọng</th>
                            <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Tăng trưởng</th>
                            <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Chiến lược</th>
                            <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                            {filteredData.sort((a, b) => b.revenue - a.revenue).map((item, idx) => {
                              const q = getQuadrant(item.revenue, item.growth);
                              const _isWeak = q.label.includes("YEU") || q.label.includes("YẾU");
                              const contribution = totalRev > 0 ? ((item.revenue / totalRev) * 100).toFixed(1) + '%' : '0%';
                              
                              return (
                                <tr key={item.id || idx} className={`border-b transition-colors group ${pinnedRows.includes(item.id) ? 'bg-amber-50/80 border-amber-200 shadow-sm relative z-10' : 'border-gray-50 hover:bg-gray-50/50'}`}>
                                  <td className="p-1.5 pl-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1 h-8 rounded-full ${_isWeak ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-[11px] font-semibold text-gray-800 truncate leading-tight group-hover:text-vnpost-blue">{item.title}</span>
                                        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">ID: {item.id}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-1.5 text-right font-semibold text-gray-700 text-[11px]">
                                    {formatCurrency(item.revenue)} <span className="text-gray-300 font-normal ml-0.5">₫</span>
                                  </td>
                                  <td className="p-1.5 text-right">
                                      <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Tỷ trọng</span>
                                        <span className="text-[11px] font-semibold text-gray-600">{contribution}</span>
                                      </div>
                                  </td>
                                  <td className="p-1.5 text-center">
                                    <div className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[10px] ${item.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                      {item.growth >= 0 ? <ArrowUpRight size={10}/> : <TrendingUp size={10} className="rotate-180"/>}
                                      {item.growth > 0 ? '+' : ''}{item.growth}%
                                    </div>
                                  </td>
                                  <td className="p-1.5 text-center">
                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${q.bg} ${q.text} border-transparent group-hover:border-current transition-all shadow-sm`}>
                                      {q.icon}
                                      <span className="text-[9px] font-bold uppercase tracking-wider tracking-tighter">{q.label}</span>
                                    </div>
                                  </td>
                                  <td className="p-1.5 text-right pr-3">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button 
                                        onClick={() => handleCopyRowId(item.id)}
                                        title="Sao chép ID"
                                        className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-all shadow-sm"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                      </button>
                                      <button 
                                        onClick={() => handlePinRow(item.id)}
                                        title="Đánh dấu"
                                        className={`p-1.5 rounded-lg transition-all shadow-sm ${pinnedRows.includes(item.id) ? 'bg-amber-100 text-amber-600' : 'bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-500'}`}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill={pinnedRows.includes(item.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                      </button>
                                      <button 
                                        onClick={() => handleDrillDown(item)}
                                        title="Xem chi tiết"
                                        className="p-1.5 bg-vnpost-blue/10 text-vnpost-blue rounded-lg hover:bg-vnpost-blue hover:text-white transition-all shadow-sm"
                                      >
                                        <ChevronRight size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="sticky bottom-0 bg-gray-50/90 backdrop-blur-md z-10 border-t border-gray-200">
                            {(() => {
                              const totalRev = data.reduce((acc, curr) => acc + curr.revenue, 0);
                              const totalPrevRev = data.reduce((acc, curr) => acc + (curr.previous_revenue || 0), 0);
                              const totalGrowth = totalPrevRev > 0 ? ((totalRev - totalPrevRev) / totalPrevRev * 100) : 0;
                              
                              return (
                                <tr className="bg-vnpost-blue/5">
                                  <td className="p-1.5 pl-3">
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black text-vnpost-blue uppercase tracking-tight">TỔNG CỘNG ĐỊA BÀN</span>
                                      <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">{data.length} đơn vị con</span>
                                    </div>
                                  </td>
                                  <td className="p-1.5 text-right">
                                    <span className="text-[13px] font-black text-vnpost-blue">{formatCurrency(totalRev)} <span className="text-[9px] font-normal">₫</span></span>
                                  </td>
                                  <td className="p-1.5 text-right">
                                      <span className="text-[11px] font-black text-vnpost-blue/40 uppercase tracking-widest">100.0%</span>
                                  </td>
                                  <td className="p-1.5">
                                    <div className={`flex items-center justify-center gap-0.5 font-black text-[11px] ${totalGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {totalGrowth >= 0 ? <ArrowUpRight size={12}/> : <TrendingUp size={12} className="rotate-180"/>}
                                      {totalGrowth > 0 ? '+' : ''}{totalGrowth.toFixed(1)}%
                                    </div>
                                  </td>
                                  <td colSpan="2" className="p-2 text-center">
                                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest bg-white/50 py-1 rounded-lg border border-gray-100 italic">
                                      Hiệu quả tổng hợp của phạm vi đang soi
                                    </div>
                                  </td>
                                </tr>
                              );
                            })()}
                          </tfoot>
                      </table>
                    </div>
                </div>
                );
              } catch (e) {
                console.error("Board Render Error:", e);
                return <div className="h-full flex items-center justify-center text-red-500 font-bold">Lỗi hiển thị bảng quản trị.</div>;
              }
          })() : <div className="h-full flex items-center justify-center text-gray-300 italic text-xs uppercase font-black tracking-widest animate-pulse">Đang nạp dữ liệu điều hành...</div>}
        </div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 transition-all duration-300 transform hover:scale-105 hover:shadow-xl cursor-default group">
               <p className="text-[13px] font-black text-emerald-700 uppercase mb-1 flex items-center gap-2">⭐ NGÔI SAO</p>
               <p className="text-[10px] text-emerald-800 leading-tight font-bold opacity-70 group-hover:opacity-100">Quy mô lớn & Tăng trưởng tốt.</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 transition-all duration-300 transform hover:scale-105 hover:shadow-xl cursor-default group">
               <p className="text-[13px] font-black text-blue-700 uppercase mb-1 flex items-center gap-2">🚀 TRIỂN VỌNG</p>
               <p className="text-[10px] text-blue-800 leading-tight font-bold opacity-70 group-hover:opacity-100">Quy mô nhỏ nhưng tăng trưởng nhanh.</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 transition-all duration-300 transform hover:scale-105 hover:shadow-xl cursor-default group">
               <p className="text-[13px] font-black text-orange-700 uppercase mb-1 flex items-center gap-2">🐄 BÒ SỮA</p>
               <p className="text-[10px] text-orange-800 leading-tight font-bold opacity-70 group-hover:opacity-100">Quy mô lớn nhưng tăng trưởng âm.</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 transition-all duration-300 transform hover:scale-105 hover:shadow-xl cursor-default group">
               <p className="text-[13px] font-black text-red-700 uppercase mb-1 flex items-center gap-2">⚠️ YẾU KÉM</p>
               <p className="text-[10px] text-red-800 leading-tight font-bold opacity-70 group-hover:opacity-100">Cả quy mô và tăng trưởng đều thấp.</p>
            </div>
          </div>
        </div>
  );
});
// Memoize to prevent re-render unless inputs change
export default React.memo(HeatmapSection);

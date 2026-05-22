import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';

const AIAssistantInsights = ({ summary, stats, churnPrediction, heatmapData, onAction }) => {
  if (!summary || !summary.revenue || !summary.volume) return null;
  const { revenue } = summary;
  const currentRev = revenue.current || 0;
  const previousRev = revenue.previous || 0;
  const revGrowth = previousRev > 0 ? ((currentRev - previousRev) / previousRev) * 100 : 0;

  // [UI OPTIMIZATION] Compact Mode Styling
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-indigo-500 text-white rounded-lg shadow-sm">
          <Zap size={14} className="animate-pulse" />
        </div>
        <h4 className="text-[12px] font-bold text-indigo-900 uppercase tracking-wider">
          Biệt đội Antigravity - Strategic Insights
        </h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-normal">Lưu ý biến động cơ cấu</p>
          <div className="space-y-1">
            <div className="flex items-start gap-2 bg-white/60 p-1.5 rounded-lg border border-indigo-50/50">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-[11px] text-gray-700 leading-tight">
                  <span className="font-bold text-indigo-600">Trọng điểm vận hành:</span> Doanh thu {revGrowth >= 0 ? 'tăng' : 'giảm'} {Math.abs(revGrowth).toFixed(1)}% — {revGrowth < 0 ? 'Ưu tiên rà soát cụm yếu kém.' : 'Đà tăng trưởng ổn định.'}
                </p>
                {revGrowth < 0 && (
                  <button 
                    onClick={() => onAction && onAction('FILTER_WEAK')}
                    className="mt-1.5 text-[9px] font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    Rà soát ngay <ArrowRight size={10} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/60 p-1.5 rounded-lg border border-indigo-50/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0"></div>
              <p className="text-[11px] text-gray-700 leading-tight">
                <span className="font-bold text-emerald-600">Động lực chính:</span> <span className="font-bold">Elite Performance</span> đang duy trì tỷ trọng cao.
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-normal">Điều hành nhanh</p>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onAction && onAction('SHOW_CHURN_LIST')}
              className="w-full text-left bg-white/80 p-2 rounded-lg border border-indigo-50 shadow-sm cursor-pointer hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all group focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-indigo-600 group-hover:scale-105 transition-transform origin-left">{churnPrediction?.length || 0} KH</p>
                <ArrowRight size={12} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
              </div>
              <p className="text-[9px] font-bold text-gray-500 uppercase group-hover:text-indigo-600 transition-colors">Nguy cơ rời bỏ</p>
            </button>
            <button 
              onClick={() => onAction && onAction('FILTER_STAR')}
              className="w-full text-left bg-white/80 p-2 rounded-lg border border-indigo-50 shadow-sm cursor-pointer hover:bg-white hover:shadow-md transition-all group focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-emerald-600 group-hover:scale-105 transition-transform origin-left">{heatmapData?.filter(h => Number(h.growth) > 10).length || 0} Đ.Bàn</p>
                <ArrowRight size={12} className="text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
              </div>
              <p className="text-[9px] font-bold text-gray-500 uppercase">Tăng trưởng mạnh</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantInsights;

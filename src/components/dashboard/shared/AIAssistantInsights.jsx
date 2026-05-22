import React from 'react';
import { Zap } from 'lucide-react';

const AIAssistantInsights = ({ summary, stats, churnPrediction, heatmapData }) => {
  if (!summary || !summary.revenue || !summary.volume) return null;
  const { revenue } = summary;
  const currentRev = revenue.current || 0;
  const previousRev = revenue.previous || 0;
  const revGrowth = previousRev > 0 ? ((currentRev - previousRev) / previousRev) * 100 : 0;

  // [UI OPTIMIZATION] Compact Mode Styling
  return (
    <div className="bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50 rounded-2xl border border-indigo-100/50 p-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
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
              <p className="text-[11px] text-gray-700 leading-tight">
                <span className="font-bold text-indigo-600">Trọng điểm vận hành:</span> Doanh thu {revGrowth >= 0 ? 'tăng' : 'giảm'} {Math.abs(revGrowth).toFixed(1)}% — {revGrowth < 0 ? 'Ưu tiên rà soát cụm yếu kém.' : 'Đà tăng trưởng ổn định.'}
              </p>
            </div>
            <div className="flex items-start gap-2 bg-white/60 p-1.5 rounded-lg border border-indigo-50/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0"></div>
              <p className="text-[11px] text-gray-700 leading-tight">
                <span className="font-bold text-emerald-600">Động lực chính:</span> <span className="font-black">Elite Performance</span> đang duy trì tỷ trọng cao.
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-normal">Điều hành nhanh</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/80 p-1.5 rounded-lg border border-indigo-50 shadow-sm">
              <p className="text-[14px] font-bold text-indigo-600">{churnPrediction?.length || 0} KH</p>
              <p className="text-[9px] font-bold text-gray-500 uppercase">Nguy cơ rời bỏ</p>
            </div>
            <div className="bg-white/80 p-1.5 rounded-lg border border-indigo-50 shadow-sm">
              <p className="text-[14px] font-bold text-emerald-600">{heatmapData?.filter(h => Number(h.growth) > 10).length || 0} Đ.Bàn</p>
              <p className="text-[9px] font-bold text-gray-500 uppercase">Tăng trưởng mạnh</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantInsights;

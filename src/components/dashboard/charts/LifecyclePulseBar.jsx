import React from 'react';
import { Activity } from 'lucide-react';

const LifecyclePulseBar = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="card flex flex-col p-6 bg-white/40 shadow-sm border border-white/60 group">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Activity size={14} className="text-vnpost-blue" /> Cơ cấu Vòng đời
        </h4>
        <div className="px-3 py-1 bg-blue-50 rounded-full text-[10px] font-bold text-blue-600 border border-blue-100 shadow-sm">
          {(() => {
            const total = (stats?.lifecycle?.["active"] || 0) + 
                          (stats?.lifecycle?.["new_pop"] || 0) + 
                          (stats?.lifecycle?.["recovered_pop"] || 0) + 
                          (stats?.lifecycle?.["at_risk"] || 0) + 
                          (stats?.lifecycle?.["churn_pop"] || 0);
            return `Tổng: ${total.toLocaleString()} KH`;
          })()}
        </div>
      </div>
      
      {/* Premium Segment Pulse Bar */}
      <div className="w-full h-5 bg-gray-100/50 rounded-full overflow-hidden flex shadow-inner mb-6 border border-gray-200/50">
        {(() => {
          const active = stats?.lifecycle?.["active"] || 0;
          const new_p = stats?.lifecycle?.["new_pop"] || 0;
          const recovered = stats?.lifecycle?.["recovered_pop"] || 0;
          const at_risk = stats?.lifecycle?.["at_risk"] || 0;
          const churn = stats?.lifecycle?.["churn_pop"] || 0;
          const total = active + new_p + recovered + at_risk + churn || 1;

          return (
            <>
              <div style={{ width: `${(active/total)*100}%` }} className="bg-gradient-to-r from-blue-600 to-blue-500 h-full transition-all duration-1000 ease-out" title="Active"></div>
              <div style={{ width: `${(new_p/total)*100}%` }} className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full transition-all duration-1000 delay-100 ease-out" title="New"></div>
              <div style={{ width: `${(recovered/total)*100}%` }} className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-1000 delay-200 ease-out" title="Recovered"></div>
              <div style={{ width: `${(at_risk/total)*100}%` }} className="bg-gradient-to-r from-vnpost-orange to-orange-400 h-full transition-all duration-1000 delay-300 ease-out" title="At Risk"></div>
              <div style={{ width: `${(churn/total)*100}%` }} className="bg-gradient-to-r from-gray-400 to-gray-300 h-full transition-all duration-1000 delay-400 ease-out" title="Churned"></div>
            </>
          );
        })()}
      </div>

      {/* Stat Capsules Grid */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {(() => {
          const active = stats?.lifecycle?.["active"] || 0;
          const at_risk = stats?.lifecycle?.["at_risk"] || 0;
          const total = active + at_risk + (stats?.lifecycle?.["new_pop"] || 0) + (stats?.lifecycle?.["recovered_pop"] || 0) + (stats?.lifecycle?.["churn_pop"] || 0) || 1;
          
          return (
            <>
              <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group/cap">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)] animate-pulse"></div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xl font-black text-vnpost-blue">{active.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md">{((active/total)*100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group/cap">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-vnpost-orange shadow-[0_0_8px_rgba(249,165,26,0.5)]"></div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">At Risk</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xl font-black text-orange-700">{at_risk.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md">{((at_risk/total)*100).toFixed(1)}%</span>
                </div>
              </div>
            </>
          );
        })()}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic">Live Lifecycle Pulse</span>
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="New"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Recovered"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400" title="Churned"></div>
        </div>
      </div>
    </div>
  );
};

export default LifecyclePulseBar;

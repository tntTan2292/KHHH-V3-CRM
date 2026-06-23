import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, Label } from 'recharts';

const COLORS = ['#0054A6', '#F9A51A'];

export default function ScopeDonutChart({ data, loading, totalRevenue, formatCurrency }) {
  const total = totalRevenue || 1;

  const renderTooltipContent = (o) => {
    if (o.active && o.payload && o.payload.length) {
      const payloadData = o.payload[0].payload;
      const pct = ((payloadData.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-xs">
          <p className="font-bold">{payloadData.name}</p>
          <p>{formatCurrency ? formatCurrency(payloadData.value) : payloadData.value.toLocaleString()} ({pct}%)</p>
        </div>
      );
    }
    return null;
  };

  const validData = data?.filter(s => s.value > 0) || [];

  if (validData.length === 0) {
    return <div className="flex justify-center items-center h-full text-gray-300 text-xs">Không có dữ liệu</div>;
  }

  if (loading) {
    return <div className="flex justify-center items-center h-full text-gray-300 italic text-xs animate-pulse">Đang nạp dữ liệu...</div>;
  }


  return (
    <div className="flex w-full h-full items-center">
      <div className="w-1/2 h-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={validData} cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" paddingAngle={2} dataKey="value" stroke="none">
              {validData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <RechartsTooltip content={renderTooltipContent} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
           <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Tổng DT</span>
           <span className="text-[11px] text-gray-800 font-black">{formatCurrency ? formatCurrency(totalRevenue) : (totalRevenue || 0).toLocaleString()}</span>
        </div>
      </div>
      <div className="w-1/2 h-full flex flex-col justify-center space-y-3 pr-2">
        {validData.sort((a, b) => b.value - a.value).map((item, i) => {
          const pct = ((item.value / total) * 100).toFixed(1);
          const formattedVal = formatCurrency ? formatCurrency(item.value) : item.value.toLocaleString();
          return (
            <div key={i} className="flex flex-col text-[10px]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                <span className="font-semibold text-gray-600 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-1 pl-3.5">
                <span className="font-bold text-gray-800">{formattedVal}</span>
                <span className="text-gray-500">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

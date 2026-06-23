import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

const CLASSIFICATION_COLORS = {
  "TMĐT": "#10b981",       // Green
  "HCC": "#3b82f6",        // Blue
  "Truyền thống": "#f59e0b", // Orange
  "Quốc tế": "#a855f7",      // Purple
  "Khác": "#6b7280"        // Gray
};

export default function ClassificationDonutChart({ data, totalRevenue, formatCurrency }) {
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

  const validData = data?.filter(c => c.value > 0) || [];

  if (validData.length === 0) {
    return <div className="flex justify-center items-center h-full text-gray-300 text-xs">Không có dữ liệu</div>;
  }

  return (
    <div className="flex w-full h-full items-center">
      <div className="w-1/2 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={validData} cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" paddingAngle={2} dataKey="value" stroke="none">
              {validData.map((entry, i) => <Cell key={i} fill={CLASSIFICATION_COLORS[entry.name] || '#6b7280'} />)}
            </Pie>
            <RechartsTooltip content={renderTooltipContent} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-1/2 h-full flex flex-col justify-center space-y-2 pr-2">
        {validData.sort((a, b) => b.value - a.value).map((item, i) => {
          const pct = ((item.value / total) * 100).toFixed(1);
          const formattedVal = formatCurrency ? formatCurrency(item.value) : item.value.toLocaleString();
          return (
            <div key={i} className="flex justify-between items-center text-[10px]">
              <div className="flex items-center gap-1.5 truncate pr-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: CLASSIFICATION_COLORS[item.name] || '#6b7280'}}></div>
                <span className="font-semibold text-gray-600 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="font-bold text-gray-800">{formattedVal}</span>
                <span className="text-gray-500 w-8 text-right">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

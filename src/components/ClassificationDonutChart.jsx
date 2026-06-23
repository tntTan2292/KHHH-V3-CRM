import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

const CLASSIFICATION_COLORS = {
  "TMĐT": "#10b981",       // Green
  "HCC": "#3b82f6",        // Blue
  "Truyền thống": "#f59e0b", // Orange
  "Quốc tế": "#a855f7",      // Purple
  "Khác": "#6b7280"        // Gray
};

export default function ClassificationDonutChart({ data, loading, totalRevenue, formatCurrency }) {
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

  const renderLegend = (value, entry) => {
    const dataVal = entry.payload.value;
    const pct = ((dataVal / total) * 100).toFixed(1);
    const formattedVal = formatCurrency ? formatCurrency(dataVal) : dataVal.toLocaleString();
    return <span className="text-[10px] text-gray-700 font-medium" title={`${value} - ${formattedVal}`}>{value} - {formattedVal} ({pct}%)</span>;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full text-gray-300 italic text-xs animate-pulse">Đang nạp phân loại...</div>;
  }

  const validData = data?.filter(c => c.value > 0) || [];

  if (validData.length === 0) {
    return <div className="flex justify-center items-center h-full text-gray-300 text-xs">Không có dữ liệu</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={validData} innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
          {validData.map((entry, i) => <Cell key={i} fill={CLASSIFICATION_COLORS[entry.name] || '#6b7280'} />)}
        </Pie>
        <RechartsTooltip content={renderTooltipContent} />
        <Legend iconType="circle" formatter={renderLegend} verticalAlign="bottom" />
      </PieChart>
    </ResponsiveContainer>
  );
}

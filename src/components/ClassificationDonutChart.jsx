import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export default function ClassificationDonutChart({ data, loading, totalRevenue, formatCurrency }) {
  const renderTooltipContent = (o) => {
    if (o.active && o.payload && o.payload.length) {
      const payloadData = o.payload[0].payload;
      const total = totalRevenue || 1;
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
        <Pie data={validData} innerRadius="60%" outerRadius="90%" paddingAngle={2} dataKey="value">
          {validData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <RechartsTooltip content={renderTooltipContent} />
        <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
      </PieChart>
    </ResponsiveContainer>
  );
}

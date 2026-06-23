import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, LabelList } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16'];

export default function ServiceDistributionChart({ data, loading, totalRevenue, formatCurrency }) {
  if (loading) {
    return <div className="flex justify-center items-center h-full text-gray-300 italic text-xs animate-pulse">Đang nạp dữ liệu...</div>;
  }

  const validData = data?.filter(s => s.value > 0) || [];

  if (validData.length === 0) {
    return <div className="flex justify-center items-center h-full text-gray-300 text-xs">Không có dữ liệu</div>;
  }

  const total = totalRevenue || 1;
  const enrichedData = validData
    .sort((a, b) => b.value - a.value)
    .map(item => ({
      ...item,
      percent: ((item.value / total) * 100).toFixed(1),
      displayValue: `${formatCurrency ? formatCurrency(item.value) : item.value.toLocaleString()} (${((item.value / total) * 100).toFixed(1)}%)`
    }));

  const renderTooltipContent = (o) => {
    if (o.active && o.payload && o.payload.length) {
      const payloadData = o.payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-sm text-xs">
          <p className="font-bold">{payloadData.name}</p>
          <p>{formatCurrency ? formatCurrency(payloadData.value) : payloadData.value.toLocaleString()} ({payloadData.percent}%)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={enrichedData}
        margin={{ top: 10, right: 120, left: 10, bottom: 10 }}
      >
        <XAxis type="number" hide />
        <YAxis 
          dataKey="name" 
          type="category" 
          axisLine={false} 
          tickLine={false} 
          width={100} 
          tick={{ fontSize: 10, fill: '#4b5563', fontWeight: 600 }} 
        />
        <RechartsTooltip content={renderTooltipContent} cursor={{fill: '#f3f4f6'}} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
          {enrichedData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
          <LabelList 
            dataKey="displayValue" 
            position="right" 
            fill="#4b5563" 
            fontSize={10} 
            fontWeight={500} 
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

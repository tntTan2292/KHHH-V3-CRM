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

  const renderLegend = (value, entry) => {
    const dataVal = entry.payload.value;
    const pct = ((dataVal / total) * 100).toFixed(1);
    const formattedVal = formatCurrency ? formatCurrency(dataVal) : dataVal.toLocaleString();
    return <span className="text-[10px] text-gray-700 font-medium" title={`${value} - ${formattedVal}`}>{value} - {formattedVal} ({pct}%)</span>;
  };

  const renderCenterLabel = ({ viewBox }) => {
    const { cx, cy } = viewBox;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
        <tspan x={cx} dy="-0.6em" fontSize="10" fill="#9ca3af" fontWeight="bold">TỔNG DT</tspan>
        <tspan x={cx} dy="1.4em" fontSize="12" fill="#1f2937" fontWeight="900">
          {formatCurrency ? formatCurrency(totalRevenue) : (totalRevenue || 0).toLocaleString()}
        </tspan>
      </text>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full text-gray-300 italic text-xs animate-pulse">Đang nạp dữ liệu...</div>;
  }

  const validData = data?.filter(s => s.value > 0) || [];

  if (validData.length === 0) {
    return <div className="flex justify-center items-center h-full text-gray-300 text-xs">Không có dữ liệu</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={validData} cx="35%" innerRadius="60%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
          {validData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          <Label content={renderCenterLabel} />
        </Pie>
        <RechartsTooltip content={renderTooltipContent} />
        <Legend iconType="circle" formatter={renderLegend} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ width: '55%' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

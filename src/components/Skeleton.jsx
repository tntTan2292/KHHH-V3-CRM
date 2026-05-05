import React from 'react';

export const SkeletonBase = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`}></div>
);

export const SkeletonCard = () => (
  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
    <div className="flex justify-between items-start">
      <SkeletonBase className="w-10 h-10 rounded-xl" />
      <SkeletonBase className="w-16 h-4" />
    </div>
    <div className="space-y-2">
      <SkeletonBase className="w-3/4 h-8" />
      <SkeletonBase className="w-1/2 h-4" />
    </div>
  </div>
);

export const SkeletonChart = ({ height = "h-64" }) => (
  <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <SkeletonBase className="w-48 h-6" />
        <SkeletonBase className="w-32 h-4" />
      </div>
      <SkeletonBase className="w-24 h-8 rounded-full" />
    </div>
    <SkeletonBase className={`w-full ${height}`} />
  </div>
);

export const SkeletonTable = ({ rows = 5 }) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="p-6 border-b border-gray-50 flex justify-between items-center">
      <SkeletonBase className="w-48 h-6" />
      <div className="flex gap-2">
        <SkeletonBase className="w-24 h-8 rounded-full" />
        <SkeletonBase className="w-24 h-8 rounded-full" />
      </div>
    </div>
    <div className="p-6 space-y-4">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <SkeletonBase className="w-12 h-12 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <SkeletonBase className="w-1/3 h-4" />
            <SkeletonBase className="w-1/4 h-3" />
          </div>
          <SkeletonBase className="w-24 h-8 self-center" />
        </div>
      ))}
    </div>
  </div>
);

export default {
  Base: SkeletonBase,
  Card: SkeletonCard,
  Chart: SkeletonChart,
  Table: SkeletonTable
};

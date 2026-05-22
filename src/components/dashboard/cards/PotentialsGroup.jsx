import React from 'react';
import { ArrowUpRight, DollarSign } from 'lucide-react';
import Skeleton from '../../Skeleton';

const PotentialsGroup = ({ stats, summaryData, selectedNode, navigate, saveNavigationContext }) => {
  return (
    <>
      <h3 className="text-[11px] font-bold text-vnpost-orange uppercase tracking-wider flex items-center gap-2 mt-2 mb-2">
        <ArrowUpRight size={14} /> 03. PHÂN HẠNG KHÁCH HÀNG TIỀM NĂNG (POTENTIALS)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity duration-300">
        {(!summaryData && !stats?.potential_ranks?.["Kim Cương"]) ? (
          <>
            <Skeleton.Card /><Skeleton.Card /><Skeleton.Card />
          </>
        ) : (
          <>
            <div 
              className="executive-card p-4 border-t-4 border-t-blue-600 relative overflow-hidden group cursor-pointer"
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?rfm_segment=Kim Cương${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="absolute -right-4 -top-4 text-blue-100 group-hover:scale-110 transition-transform opacity-20">
                <DollarSign size={100} />
              </div>
              <p className="kpi-label mb-2 text-blue-700">💎 Kim Cương (Diamond)</p>
              <h3 className="kpi-number text-4xl text-blue-900">{(stats?.potential_ranks?.["Kim Cương"] || 0).toLocaleString()}</h3>
              <p className="text-[10px] text-blue-500 font-bold mt-4 uppercase tracking-wider opacity-60">DT &gt; 5M & &gt; 20 đơn/tháng</p>
            </div>

            <div 
              className="executive-card p-6 border-t-[6px] border-t-vnpost-orange relative overflow-hidden group cursor-pointer"
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?rfm_segment=Vàng${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="absolute -right-4 -top-4 text-orange-100 group-hover:scale-110 transition-transform opacity-20">
                <DollarSign size={100} />
              </div>
              <p className="kpi-label mb-2 text-vnpost-orange">🥇 Vàng (Gold)</p>
              <h3 className="kpi-number text-4xl text-vnpost-orange">{(stats?.potential_ranks?.["Vàng"] || 0).toLocaleString()}</h3>
              <p className="text-[10px] text-vnpost-orange font-bold mt-4 uppercase tracking-wider opacity-60">DT &gt; 1M & &gt; 10 đơn/tháng</p>
            </div>

            <div 
              className="executive-card p-6 border-t-[6px] border-t-orange-800 relative overflow-hidden group cursor-pointer"
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?rfm_segment=Bạc${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="absolute -right-4 -top-4 text-orange-200 group-hover:scale-110 transition-transform opacity-20">
                <DollarSign size={100} />
              </div>
              <p className="kpi-label mb-2 text-orange-900">🥉 Bạc (Silver)</p>
              <h3 className="kpi-number text-4xl text-orange-950">{(stats?.potential_ranks?.["Bạc"] || 0).toLocaleString()}</h3>
              <p className="text-[10px] text-orange-900 font-bold mt-4 uppercase tracking-wider opacity-60">DT &gt; 500K & &gt; 5 đơn/tháng</p>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default PotentialsGroup;

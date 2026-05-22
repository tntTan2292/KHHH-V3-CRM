import React from 'react';
import { Link } from 'react-router-dom';
import { Users, AlertCircle, UserMinus, Sparkles, RefreshCw } from 'lucide-react';
import Skeleton from '../../Skeleton';

const PopulationKpiGroup = ({ stats, summaryData, selectedNode, navigate, saveNavigationContext }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-vnpost-blue uppercase tracking-wider flex items-center gap-2">
          <Users size={14} /> 01. HIỆN TRẠNG TỆP KHÁCH HÀNG (POPULATION)
        </h3>
        <Link to="/guidelines#lifecycle" className="text-[9px] font-bold text-vnpost-orange uppercase hover:underline">Định nghĩa</Link>
      </div>
      
      {/* Row 1: Priority States */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(!summaryData && !stats?.lifecycle?.["active"]) ? (
          Array(3).fill(0).map((_, i) => <Skeleton.KPIMini key={i} />)
        ) : (
          <>
            {/* ACTIVE - CENTRAL KPI */}
            <div 
              className="executive-card pop-card border-l-[6px]" 
              style={{ borderLeftColor: 'var(--crm-active-base)', background: 'linear-gradient(135deg, var(--crm-active-light) 0%, #ffffff 100%)' }}
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?lifecycle_status=active${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="kpi-label" style={{ color: 'var(--crm-active-base)' }}>HIỆN HỮU (ACTIVE)</span>
                    <Users size={18} style={{ color: 'var(--crm-active-base)', opacity: 0.15 }} />
                  </div>
                  <div className="kpi-number text-3xl" style={{ color: 'var(--crm-active-base)' }}>{(stats?.lifecycle?.["active"] || 0).toLocaleString()}</div>
                </div>
                {stats?.lifecycle_growth?.active !== undefined && (
                  <div className={`text-xs font-bold flex items-center gap-1 mt-2 ${stats.lifecycle_growth.active >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stats.lifecycle_growth.active >= 0 ? "▲" : "▼"} {Math.abs(stats.lifecycle_growth.active)}%
                    <span className="text-gray-500 opacity-60 ml-0.5 uppercase font-bold text-[10px]">vs T-1</span>
                  </div>
                )}
              </div>
            </div>

            {/* AT RISK */}
            <div 
              className="executive-card pop-card border-l-[6px]" 
              style={{ borderLeftColor: 'var(--crm-warning-base)', background: 'linear-gradient(135deg, var(--crm-warning-light) 0%, #ffffff 100%)' }}
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?lifecycle_status=at_risk${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="kpi-label" style={{ color: 'var(--crm-active-base)' }}>NGUY CƠ (AT RISK)</span>
                    <AlertCircle size={18} style={{ color: 'var(--crm-warning-base)', opacity: 0.15 }} />
                  </div>
                  <div className="kpi-number text-3xl" style={{ color: 'var(--crm-warning-base)' }}>{(stats?.lifecycle?.["at_risk"] || 0).toLocaleString()}</div>
                </div>
                {stats?.lifecycle_growth?.at_risk !== undefined && (
                  <div className={`text-xs font-bold flex items-center gap-1 mt-2 ${stats.lifecycle_growth.at_risk <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stats.lifecycle_growth.at_risk >= 0 ? "▲" : "▼"} {Math.abs(stats.lifecycle_growth.at_risk)}%
                    <span className="text-gray-500 opacity-60 ml-0.5 uppercase font-bold text-[10px]">vs T-1</span>
                  </div>
                )}
              </div>
            </div>

            {/* CHURN POP */}
            <div 
              className="executive-card pop-card border-l-[6px]" 
              style={{ borderLeftColor: 'var(--crm-danger-base)', background: 'linear-gradient(135deg, var(--crm-danger-light) 0%, #ffffff 100%)' }}
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?lifecycle_status=churn_pop${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="kpi-label" style={{ color: 'var(--crm-active-base)' }}>RỜI BỎ (CHURNED POP)</span>
                    <UserMinus size={18} style={{ color: 'var(--crm-danger-base)', opacity: 0.15 }} />
                  </div>
                  <div className="kpi-number text-3xl" style={{ color: 'var(--crm-danger-base)' }}>{(stats?.lifecycle?.["churn_pop"] || 0).toLocaleString()}</div>
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-normal mt-2 italic">Dừng giao dịch &gt; 60 ngày</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Row 2: Challenge/Onboarding States */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full lg:w-2/3">
        {(!summaryData && !stats?.lifecycle?.["new_pop"]) ? (
          Array(2).fill(0).map((_, i) => <Skeleton.KPIMini key={i} />)
        ) : (
          <>
            {/* NEW POP */}
            <div 
              className="executive-card pop-card border-l-[6px]" 
              style={{ borderLeftColor: 'var(--crm-onboarding-base)', background: 'linear-gradient(135deg, var(--crm-onboarding-light) 0%, #ffffff 100%)' }}
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?lifecycle_status=new_pop${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="kpi-label" style={{ color: 'var(--crm-onboarding-base)' }}>MỚI (NEW POP)</span>
                    <Sparkles size={18} style={{ color: 'var(--crm-onboarding-base)', opacity: 0.15 }} />
                  </div>
                  <div className="kpi-number text-2xl" style={{ color: 'var(--crm-onboarding-base)' }}>{(stats?.lifecycle?.["new_pop"] || 0).toLocaleString()}</div>
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-normal mt-2 italic">Tệp đang thử thách (30d)</div>
              </div>
            </div>

            {/* RECOVERED POP */}
            <div 
              className="executive-card pop-card border-l-[6px]" 
              style={{ borderLeftColor: 'var(--crm-recovery-base)', background: 'linear-gradient(135deg, var(--crm-recovery-light) 0%, #ffffff 100%)' }}
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?lifecycle_status=recovered_pop${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="kpi-label" style={{ color: 'var(--crm-recovery-base)' }}>TÁI BẢN (RECOVERED POP)</span>
                    <RefreshCw size={18} style={{ color: 'var(--crm-recovery-base)', opacity: 0.15 }} />
                  </div>
                  <div className="kpi-number text-2xl" style={{ color: 'var(--crm-recovery-base)' }}>{(stats?.lifecycle?.["recovered_pop"] || 0).toLocaleString()}</div>
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-normal mt-2 italic">Tệp quay lại đang thử thách</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PopulationKpiGroup;

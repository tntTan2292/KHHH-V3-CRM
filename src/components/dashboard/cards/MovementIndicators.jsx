import React from 'react';
import { Zap, Sparkles, ChevronRight, RefreshCw, UserMinus } from 'lucide-react';
import Skeleton from '../../Skeleton';

const MovementIndicators = ({ stats, summaryData, selectedNode, navigate, saveNavigationContext }) => {
  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
        <Zap size={14} /> 02. BIẾN ĐỘNG TRONG KỲ (MOVEMENT INDICATORS)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(!summaryData && !stats?.lifecycle?.["new_event"]) ? (
          Array(3).fill(0).map((_, i) => <Skeleton.KPIMini key={i} />)
        ) : (
          <>
            {/* NEW EVENT */}
            <div 
              className="executive-card event-card border-l-4"
              style={{ borderLeftColor: 'var(--crm-onboarding-base)' }}
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?lifecycle_status=new_event${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--crm-onboarding-light)', color: 'var(--crm-onboarding-base)' }}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <span className="kpi-label block" style={{ color: 'var(--crm-onboarding-base)' }}>Mới phát sinh</span>
                    <span className="kpi-number text-xl" style={{ color: 'var(--crm-onboarding-base)' }}>{(stats?.lifecycle?.["new_event"] || 0).toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-200" />
              </div>
            </div>

            {/* RECOVERED EVENT */}
            <div 
              className="executive-card event-card border-l-4"
              style={{ borderLeftColor: 'var(--crm-recovery-base)' }}
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?lifecycle_status=recovered_event${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--crm-recovery-light)', color: 'var(--crm-recovery-base)' }}>
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <span className="kpi-label block" style={{ color: 'var(--crm-recovery-base)' }}>Tái bản trong kỳ</span>
                    <span className="kpi-number text-xl" style={{ color: 'var(--crm-recovery-base)' }}>{(stats?.lifecycle?.["recovered_event"] || 0).toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-200" />
              </div>
            </div>

            {/* CHURN EVENT */}
            <div 
              className="executive-card event-card border-l-4"
              style={{ borderLeftColor: 'var(--crm-danger-base)' }}
              onClick={() => {
                const node = selectedNode;
                if (node) saveNavigationContext(node);
                navigate(`/customers?lifecycle_status=churn_event${node ? `&node_code=${node.key}&node_type=${node.type || ''}&node_title=${encodeURIComponent(node.title)}` : ''}`);
              }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--crm-danger-light)', color: 'var(--crm-danger-base)' }}>
                    <UserMinus size={20} />
                  </div>
                  <div>
                    <span className="kpi-label block" style={{ color: 'var(--crm-danger-base)' }}>Rời bỏ trong kỳ</span>
                    <span className="kpi-number text-xl" style={{ color: 'var(--crm-danger-base)' }}>{(stats?.lifecycle?.["churn_event"] || 0).toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-200" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MovementIndicators;

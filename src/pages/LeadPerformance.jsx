import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import api from '../utils/api';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell
} from 'recharts';
import { 
  Users, Target, RefreshCw, BarChart3, List, ChevronRight, DownloadCloud, AlertCircle, Loader2
} from 'lucide-react';
import TreeExplorer from '../components/TreeExplorer';
import { useAuth } from '../context/AuthContext';
import Skeleton from '../components/Skeleton';
import LeadCustomerDetailModal from '../components/LeadCustomerDetailModal';

const fetcher = url => api.get(url).then(res => res.data);
const fetcherWithParams = ([url, params]) => api.get(url, { params }).then(res => res.data);

const COLORS = ['#9CA3AF', '#F9A51A', '#0054A6', '#10B981']; // Gray, Orange, Blue, Green

export default function LeadPerformance() {
  const { user } = useAuth();
  const [selectedNode, setSelectedNode] = useState(null);
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [navStack, setNavStack] = useState([{ key: "", title: user?.scope || "Toàn tỉnh" }]);
  const [activeTab, setActiveTab] = useState('funnel'); // funnel, ranking, details
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Filters
  const queryParams = useMemo(() => (
    selectedNode ? { scope_id: selectedNode } : {}
  ), [selectedNode]);

  // Data Fetching
  const { data: funnelData, error: funnelError, mutate: mutateFunnel } = useSWR(['/api/leads/funnel', queryParams], fetcherWithParams);
  const { data: rankingData, error: rankingError, mutate: mutateRanking } = useSWR(activeTab === 'ranking' ? ['/api/leads/ranking', queryParams] : null, fetcherWithParams);
  const { data: detailsData, error: detailsError, mutate: mutateDetails } = useSWR(activeTab === 'details' ? ['/api/leads/details', queryParams] : null, fetcherWithParams);

  const handleNodeSelect = (nodeId, nodeName) => {
    setSelectedNode(nodeId);
    setNavStack([{ key: "", title: user?.scope || "Toàn tỉnh" }, { key: nodeId, title: nodeName }]);
    setIsTreeOpen(false);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await api.post('/api/leads/sync');
      toast.success(`Đồng bộ thành công ${res.data.inserted + res.data.updated} khách hàng.`);
      mutateFunnel();
      mutateRanking();
      mutateDetails();
    } catch (err) {
      toast.error('Đồng bộ thất bại: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSyncing(false);
    }
  };

  // Funnel Formatting for Recharts
  const formattedFunnel = useMemo(() => {
    if (!funnelData?.funnel) return [];
    return funnelData.funnel.map((item, index) => ({
      ...item,
      fill: COLORS[index % COLORS.length]
    }));
  }, [funnelData]);

  // Lấy tổng để hiển thị KPI Card
  const kpiTotals = useMemo(() => {
    if (!funnelData?.funnel) return { leads: 0, ops: 0, cms: 0, rev: 0 };
    const f = funnelData.funnel;
    return {
      leads: f.find(x => x.stage === 1)?.count || 0,
      ops: f.find(x => x.stage === 2)?.count || 0,
      cms: f.find(x => x.stage === 3)?.count || 0,
      rev: f.find(x => x.stage === 4)?.count || 0
    };
  }, [funnelData]);

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN').format(Math.round(val || 0));

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/30 overflow-y-auto">
      {/* Header & Controls */}
      <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-100 flex flex-col gap-4 sticky top-0 z-30">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Target size={24} className="text-vnpost-orange" />
            <h1 className="text-xl font-black text-[#003E7E] uppercase tracking-tight">Bảng Điều Hành Khách Hàng Lead</h1>
          </div>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-[#003E7E] text-white rounded-lg font-bold text-xs hover:bg-[#002a54] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Đang đồng bộ..." : "Làm mới dữ liệu từ nguồn"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold bg-gray-100 rounded-lg p-1">
            {navStack.map((nav, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight size={14} className="text-gray-400" />}
                <button
                  onClick={() => {
                    const newStack = navStack.slice(0, idx + 1);
                    setNavStack(newStack);
                    setSelectedNode(nav.key || null);
                  }}
                  className={`px-3 py-1.5 rounded-md transition-colors ${idx === navStack.length - 1 ? 'bg-white text-[#003E7E] shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                  {nav.title}
                </button>
              </React.Fragment>
            ))}
          </div>
          <button 
            onClick={() => setIsTreeOpen(true)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-2"
          >
            <Users size={14} className="text-vnpost-blue" />
            Chọn đơn vị (Cụm/Bưu cục)
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 mt-2">
          {[
            { id: 'funnel', label: 'Bảng Điều Hành Tổng Thể', icon: <BarChart3 size={16} /> },
            { id: 'ranking', label: 'Hiệu Quả Đơn Vị', icon: <Target size={16} /> },
            { id: 'details', label: 'Danh Sách Khách Hàng', icon: <List size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'border-b-2 border-vnpost-orange text-vnpost-orange bg-orange-50/50' 
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <TreeExplorer 
        isOpen={isTreeOpen} 
        onClose={() => setIsTreeOpen(false)} 
        onSelect={handleNodeSelect} 
      />

      <div className="p-6 max-w-[1600px] w-full mx-auto flex-1">
        
        {/* TAB 1: FUNNEL */}
        {activeTab === 'funnel' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 border-l-4 border-l-gray-400">
                <div className="p-3 bg-gray-100 text-gray-600 rounded-xl"><Users size={24} /></div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tổng Tiếp Nhận</p>
                  <p className="text-2xl font-black text-gray-800">{formatCurrency(kpiTotals.leads)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 border-l-4 border-l-vnpost-orange">
                <div className="p-3 bg-orange-50 text-vnpost-orange rounded-xl"><Target size={24} /></div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Đã Khai Thác (Cam kết)</p>
                  <p className="text-2xl font-black text-gray-800">{formatCurrency(kpiTotals.ops)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 border-l-4 border-l-vnpost-blue">
                <div className="p-3 bg-blue-50 text-vnpost-blue rounded-xl"><List size={24} /></div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Đã Chuyển Đổi (Có Mã CMS)</p>
                  <p className="text-2xl font-black text-[#003E7E]">{formatCurrency(kpiTotals.cms)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 border-l-4 border-l-emerald-500">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><BarChart3 size={24} /></div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Khách Hàng Ra Số</p>
                  <p className="text-2xl font-black text-emerald-600">{formatCurrency(kpiTotals.rev)}</p>
                </div>
              </div>
            </div>

            {/* Funnel Chart Area */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-black uppercase text-[#003E7E] mb-6 flex items-center gap-2">
                <BarChart3 size={16} /> Phễu Hành Trình Chuyển Đổi Khách Hàng
              </h2>
              
              {!funnelData && !funnelError ? (
                <div className="h-[400px] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-vnpost-orange" /></div>
              ) : formattedFunnel.length > 0 ? (
                <div className="flex flex-col md:flex-row gap-8 items-center h-[500px]">
                  {/* Cột số liệu text bên trái hiển thị rớt phễu */}
                  <div className="w-full md:w-1/3 space-y-6">
                    {formattedFunnel.map((item, i) => (
                      <React.Fragment key={i}>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 relative">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-black text-gray-600 uppercase">{item.name}</span>
                            <span className="text-lg font-black" style={{color: item.fill}}>{formatCurrency(item.count)} KH</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                            <span>Chiếm: {item.percent_of_total}% tổng đầu vào</span>
                          </div>
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl" style={{backgroundColor: item.fill}}></div>
                        </div>
                        {i < formattedFunnel.length - 1 && (
                          <div className="flex flex-col items-center justify-center h-8 relative">
                            <div className="absolute h-full w-px bg-gray-200"></div>
                            <div className="z-10 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-1 text-[11px] font-black text-red-500">
                              ↓ {formattedFunnel[i+1].conversion_from_previous}% 
                              <span className="text-gray-400 font-bold text-[9px]">(Chuyển đổi từ bước trước)</span>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Biểu đồ Recharts bên phải */}
                  <div className="w-full md:w-2/3 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <RechartsTooltip 
                          formatter={(value, name, props) => [`${formatCurrency(value)} Khách hàng`, props.payload.name]}
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'}}
                          itemStyle={{fontWeight: '900'}}
                        />
                        <Funnel
                          dataKey="count"
                          data={formattedFunnel}
                          isAnimationActive
                        >
                          <LabelList position="right" fill="#000" stroke="none" dataKey="name" className="text-xs font-bold" />
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-gray-400 font-bold">Không có dữ liệu phễu</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: RANKING */}
        {activeTab === 'ranking' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-black uppercase text-[#003E7E] flex items-center gap-2">
                <Target size={16} /> Bảng Xếp Hạng Đơn Vị (Theo Doanh Thu Thực Tế)
              </h2>
            </div>
            
            {!rankingData && !rankingError ? (
              <div className="p-12 flex justify-center"><Loader2 size={32} className="animate-spin text-vnpost-orange" /></div>
            ) : rankingData && rankingData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">
                      <th className="px-6 py-4">#</th>
                      <th className="px-6 py-4">Đơn Vị</th>
                      <th className="px-6 py-4 text-right">Khách Hàng</th>
                      <th className="px-6 py-4 text-right">Doanh Thu Cam Kết</th>
                      <th className="px-6 py-4 text-right text-[#003E7E]">Doanh Thu Thực Tế</th>
                      <th className="px-6 py-4 text-right">Tỷ Lệ Thực Hiện</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium text-gray-700">
                    {rankingData.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => handleNodeSelect(row.point_id, row.point_name)}>
                        <td className="px-6 py-4 font-black text-gray-400">{idx + 1}</td>
                        <td className="px-6 py-4 font-bold text-[#003E7E] group-hover:text-vnpost-orange transition-colors flex items-center gap-2">
                          {row.point_name}
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                        <td className="px-6 py-4 text-right font-black">{formatCurrency(row.total_leads)}</td>
                        <td className="px-6 py-4 text-right text-gray-500">{formatCurrency(row.total_expected)} đ</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-600">{formatCurrency(row.total_actual)} đ</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-3 py-1.5 rounded-full font-black ${
                            row.completion_rate >= 100 ? 'bg-emerald-100 text-emerald-700' :
                            row.completion_rate >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {row.completion_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-400 font-bold">Không có dữ liệu đơn vị trực thuộc. Vui lòng chọn cấp cao hơn.</div>
            )}
          </div>
        )}

        {/* TAB 3: DETAILS */}
        {activeTab === 'details' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-sm font-black uppercase text-[#003E7E] flex items-center gap-2">
                <List size={16} /> Danh Sách Khách Hàng Chi Tiết
              </h2>
            </div>
            
            {!detailsData && !detailsError ? (
              <div className="p-12 flex justify-center"><Loader2 size={32} className="animate-spin text-vnpost-orange" /></div>
            ) : detailsData && detailsData.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">
                      <th className="px-6 py-4">Mã CMS</th>
                      <th className="px-6 py-4">Tên Khách Hàng</th>
                      <th className="px-6 py-4">Nhân Viên PT</th>
                      <th className="px-6 py-4 text-right">Cam Kết</th>
                      <th className="px-6 py-4 text-right">Thực Tế</th>
                      <th className="px-6 py-4 text-right">Tỷ Lệ Thực Hiện</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium text-gray-700">
                    {detailsData.items.map((row, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedCustomer(row)}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-black text-gray-400">{row.ma_cms || 'N/A'}</td>
                        <td className="px-6 py-4 font-bold text-[#003E7E]">{row.ten_kh}</td>
                        <td className="px-6 py-4 text-gray-500">{row.owner_hrm || 'Chưa gán'}</td>
                        <td className="px-6 py-4 text-right text-gray-500">{formatCurrency(row.expected_revenue)} đ</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-600">{formatCurrency(row.actual_revenue)} đ</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-2 py-1 rounded font-black text-[10px] ${
                            row.completion_rate >= 100 ? 'bg-emerald-100 text-emerald-700' :
                            row.completion_rate >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {row.completion_rate.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-400 font-bold">Không có dữ liệu khách hàng</div>
            )}
          </div>
        )}

      </div>

      {/* Modal Chi Tiết Khách Hàng */}
      {selectedCustomer && (
        <LeadCustomerDetailModal 
          selectedCustomer={selectedCustomer} 
          setSelectedCustomer={setSelectedCustomer} 
          formatCurrency={formatCurrency} 
        />
      )}
    </div>
  );
}

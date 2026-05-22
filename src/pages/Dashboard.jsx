import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import api from '../utils/api';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { saveNavigationContext, getNavigationContext, syncUrlWithContext, getContextFromUrl, saveDateContext, getDateContext } from '../utils/navigationMemory';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, Line, ComposedChart
} from 'recharts';
import {
  ArrowUpRight, Users, UserMinus, DollarSign, DownloadCloud, Loader2,
  Calendar, MapPin, TrendingUp, Info, X, BarChart3, Target, Sparkles, AlertCircle, RefreshCw, ArrowLeft, ChevronRight, Zap, Send, Activity, Maximize2, Minimize2, Search
} from 'lucide-react';
const TreeExplorer = lazy(() => import('../components/TreeExplorer'));
const CustomerProfileModal = lazy(() => import('../components/CustomerProfileModal'));
import useSWR from 'swr';
import Skeleton from '../components/Skeleton';
import AIAssistantInsights from '../components/dashboard/shared/AIAssistantInsights';
import EliteMorningPulse from '../components/dashboard/shared/EliteMorningPulse';
import PopulationKpiGroup from '../components/dashboard/cards/PopulationKpiGroup';
import MovementIndicators from '../components/dashboard/cards/MovementIndicators';
import PotentialsGroup from '../components/dashboard/cards/PotentialsGroup';
import LifecyclePulseBar from '../components/dashboard/charts/LifecyclePulseBar';
import CustomerListModal from '../components/dashboard/shared/CustomerListModal';
import HeatmapSection from '../components/dashboard/sections/HeatmapSection';
import MovementComparison from '../components/dashboard/sections/MovementComparison';
import { useAuth } from '../context/AuthContext';
// Fetcher function cho SWR với Diagnostics
const fetcher = url => {
  console.log(`[API START] ${url}`);
  return api.get(url)
    .then(res => {
      console.log(`[API SUCCESS] ${url}`);
      return res.data;
    })
    .catch(err => {
      if (api.isCancel?.(err) || (err?.name === 'AbortError')) {
        console.warn(`[API ABORTED] ${url}`);
      } else {
        console.error(`[API ERROR] ${url}`, err);
      }
      throw err;
    });
};

const fetcherWithParams = ([url, params]) => {
  console.log(`[API START] ${url}`, params);
  return api.get(url, { params })
    .then(res => {
      console.log(`[API SUCCESS] ${url}`);
      return res.data;
    })
    .catch(err => {
      if (api.isCancel?.(err) || (err?.name === 'AbortError')) {
        console.warn(`[API ABORTED] ${url}`);
      } else {
        console.error(`[API ERROR] ${url}`, err);
      }
      throw err;
    });
};

const COLORS = ['#F9A51A', '#0054A6', '#003E7E', '#4B5563', '#9CA3AF'];


class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("ErrorBoundary caught an error", error, errorInfo); this.setState({ errorInfo }); }
  render() { 
    if (this.state.hasError) return <div className="p-10 text-red-500 bg-white min-h-screen">
      <h1 className="font-bold text-2xl mb-4">Dashboard Render Error</h1>
      <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">{this.state.error && this.state.error.toString()}</pre>
      <pre className="text-xs bg-gray-50 p-4 mt-2 rounded overflow-auto">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
    </div>; 
    return this.props.children; 
  }
}

export default function DashboardWrapper() {
  return <ErrorBoundary><Dashboard /></ErrorBoundary>;
}

function Dashboard() {
  const { user } = useAuth();
  const [selectedNode, setSelectedNode] = useState(null);
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [stats, setStats] = useState({ tong_doanh_thu: 0, tong_kh: 0, kh_moi: 0, kh_roi_bo: 0, kh_tiem_nang: 0, latest_date: null, lifecycle: {} });
  const [revService, setRevService] = useState([]);
  const [revRegion, setRevRegion] = useState([]);
  const [moversData, setTopMovers] = useState({ summary: null, movers: { gainers: [], losers: [] }, period: null });
  
  const [comparisonType, setComparisonType] = useState('mom');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [waitingForDefaultDate, setWaitingForDefaultDate] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [showChurnModal, setShowChurnModal] = useState(false);

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth) return selectedMonth;
    if (startDate) return startDate.substring(0, 7);
    return "";
  }, [selectedMonth, startDate]);

  const prevMonthLabel = useMemo(() => {
    if (!selectedMonthLabel) return "";
    try {
      const [y, m] = selectedMonthLabel.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } catch(e) { return ""; }
  }, [selectedMonthLabel]);

  // RF4D: Date Persistence
  useEffect(() => {
    if (startDate || endDate) {
      saveDateContext(startDate, endDate);
    }
  }, [startDate, endDate]);

  const [isExporting, setIsExporting] = useState(false);
  const [zoomState, setZoomState] = useState({
    refAreaLeft: '', refAreaRight: '', refAreaTop: '', refAreaBottom: '',
    left: 'auto', right: 'auto', top: 'auto', bottom: 'auto'
  });
  const [fullCustomerDetail, setFullCustomerDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [botReport, setBotReport] = useState(null);
  const [loadingBot, setLoadingBot] = useState(false);
  const [navStack, setNavStack] = useState([{ key: "", title: user?.scope || "Toàn tỉnh" }]);
  const dashboardRef = useRef();
  const heatmapSectionRef = useRef();

  const handleInsightAction = (action) => {
    if (action === 'SHOW_CHURN_LIST') {
      setShowChurnModal(true);
    } else {
      if (action === 'FILTER_WEAK' && heatmapSectionRef.current) heatmapSectionRef.current.applyQuickFilter('DANGER');
      if (action === 'FILTER_STAR' && heatmapSectionRef.current) heatmapSectionRef.current.applyQuickFilter('STAR');
      const heatmapSection = document.getElementById('heatmap-section');
      if (heatmapSection) heatmapSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // --- SWR DATA FETCHING (Giai đoạn 3: Elite UX) ---
  const queryParams = useMemo(() => ({ 
    start_date: startDate, 
    end_date: endDate, 
    node_code: selectedNode?.key || "",
    comparison_type: comparisonType
  }), [startDate, endDate, selectedNode, comparisonType]);

  // 1. Coverage
  const { data: coverageData, error: coverageError } = useSWR('/api/analytics/data-coverage', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60000,
    onSuccess: (data) => {
      // [RF5C] Governance: Only apply latest month as default if user hasn't selected anything
      if (data && data.latest_month && (!startDate || startDate === "") && (!endDate || endDate === "")) {
        setStartDate(data.latest_month.start);
        setEndDate(data.latest_month.end);
        setSelectedMonth(data.latest_month.value);
      }
      // RF5B-HOTFIX: Luôn giải phóng trạng thái chờ ngày mặc định
      setWaitingForDefaultDate(false);
      console.log("[DIAGNOSTIC] Dashboard waitingForDefaultDate released via onSuccess");
    },
    onError: (err) => {
      setWaitingForDefaultDate(false);
      console.error("[DIAGNOSTIC] Dashboard waitingForDefaultDate released via onError", err);
    }
  });

  // 2. Summary & Stats
  const { data: summaryData, isValidating: loadingStats } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/summary', queryParams] : null,
    fetcherWithParams,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  // 6. Monthly Trend Data (New)
  // 3. Trend Data
  const { data: trendDataRes, isValidating: loadingTrend } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/revenue-trend', queryParams] : null,
    fetcherWithParams,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  // 4. Heatmap Data
  const { data: heatmapDataRes, isValidating: loadingHeatmap } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/heatmap-units', queryParams] : null,
    fetcherWithParams,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  // 5. Movers Data
  const { data: moversDataRes, isValidating: loadingMovers } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/top-movers', queryParams] : null,
    fetcherWithParams,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  // 6. Monthly Trend Data (New) - DEFERRED: Only load after primary summaryData is ready
  const { data: monthlyDataRes, isValidating: loadingMonthly } = useSWR(
    (!waitingForDefaultDate && !!summaryData) ? ['/api/analytics/revenue-monthly', queryParams] : null,
    fetcherWithParams,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  // 7. Scoring & Prediction (Transitioned to SWR for Race Condition Protection) - DEFERRED: Only load after primary summaryData is ready
  const { data: scoringDataRes, isValidating: loadingScoring } = useSWR(
    (!waitingForDefaultDate && !!summaryData) ? ['/api/analytics/customer-scoring', queryParams] : null,
    fetcherWithParams,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );
  
  const { data: churnDataRes, isValidating: loadingChurn } = useSWR(
    (!waitingForDefaultDate && !!summaryData) ? ['/api/analytics/churn-prediction', queryParams] : null,
    fetcherWithParams,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );
  
  const { data: healthDataRes } = useSWR(
    !waitingForDefaultDate ? '/api/analytics/system-health' : null,
    fetcher,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );



  // Sync state with SWR results
  useEffect(() => {
    if (summaryData) {
      setStats(summaryData.stats || {});
      setRevService(summaryData.services || []);
      setRevRegion(summaryData.regions || []);
    }
    if (moversDataRes) setTopMovers(moversDataRes);
  }, [summaryData, moversDataRes]);

  // AI Assistant Refresh (Simplified since others are on SWR)
  const analyticAbortRef = useRef(null);
  useEffect(() => {
    if (!waitingForDefaultDate) {
      if (analyticAbortRef.current) analyticAbortRef.current.abort();
      const controller = new AbortController();
      analyticAbortRef.current = controller;
    }
  }, [waitingForDefaultDate, queryParams]);

  useEffect(() => {
    const fetchBot = async () => {
      setLoadingBot(true);
      try {
        const res = await api.get('/api/bot/latest-report');
        setBotReport(res.data);
      } catch (err) {
        console.error("Bot Report Load Error:", err);
      } finally {
        setLoadingBot(false);
      }
    };
    fetchBot();
  }, []);
  
  // Đồng bộ navStack khi user load xong
  useEffect(() => {
    if (user?.scope && navStack.length > 0 && navStack[0].title !== user.scope && navStack[0].title === "Toàn tỉnh") {
      setNavStack([{ key: "", title: user.scope }]);
    }
  }, [user?.scope, navStack]);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- PERSISTENCE & NAVIGATION MEMORY (RF3A & RF4D) ---
  useEffect(() => {
    // 1. Restore Hierarchy Context
    const urlContext = getContextFromUrl(searchParams);
    if (urlContext) {
      setSelectedNode(urlContext);
      setNavStack([{ key: "", title: user?.scope || "Toàn tỉnh" }, urlContext]);
    } else {
      const savedContext = getNavigationContext();
      if (savedContext && savedContext.key) {
        setSelectedNode(savedContext);
        setNavStack([{ key: "", title: user?.scope || "Toàn tỉnh" }, savedContext]);
        syncUrlWithContext(savedContext, searchParams, setSearchParams);
      }
    }

    // 2. Restore Date Context
    const dateCtx = getDateContext();
    if (dateCtx && dateCtx.startDate && dateCtx.endDate) {
      if (!startDate && !endDate) { // Only if not already set by defaults
        setStartDate(dateCtx.startDate);
        setEndDate(dateCtx.endDate);
      }
    }
  }, [user]);

  const handleNodeSelect = (node) => {
    saveNavigationContext(node);
    syncUrlWithContext(node, searchParams, setSearchParams);
    
    if (!node) {
      setSelectedNode(null);
      setNavStack([{ key: "", title: user?.scope || "Toàn tỉnh" }]);
    } else {
      setSelectedNode(node);
      setNavStack([{ key: "", title: user?.scope || "Toàn tỉnh" }, node]);
    }
  };

  const handleDrillDown = (node) => {
    const newNode = { key: node.ma_don_vi, title: node.don_vi, type: node.type };
    saveNavigationContext(newNode);
    syncUrlWithContext(newNode, searchParams, setSearchParams);
    setSelectedNode(newNode);
    setNavStack(prev => [...prev, newNode]);
  };

  const handleGoBack = () => {
    if (navStack.length > 1) {
      const newStack = [...navStack];
      newStack.pop();
      setNavStack(newStack);
      const parent = newStack[newStack.length - 1];
      const newNode = parent.key === "" ? null : parent;
      setSelectedNode(newNode);
      saveNavigationContext(newNode);
      syncUrlWithContext(newNode, searchParams, setSearchParams);
    }
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const handleQuickMonth = (monthStr) => {
    if (!monthStr) { setSelectedMonth(""); return; }
    setSelectedMonth(monthStr);
    const [year, month] = monthStr.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    
    let end;
    // [GOVERNANCE] If selecting latest data month, auto-lock to latest transaction date
    if (coverageData?.latest_month?.value === monthStr) {
      end = coverageData.latest_month.end;
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    
    setStartDate(start);
    setEndDate(end);
  };

  const handleExportPDF = () => {
    const element = dashboardRef.current;
    setIsExporting(true);
    setTimeout(() => {
      import('html2pdf.js')
        .then((module) => {
          const html2pdf = module.default;
          const opt = { margin: [0.3, 0.3], filename: `Bao-Cao-KHHH.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' } };
          html2pdf().set(opt).from(element).save().then(() => setIsExporting(false));
        })
        .catch((err) => {
          console.error("Failed to load html2pdf.js dynamically:", err);
          setIsExporting(false);
        });
    }, 500);
  };

  // Dọn dẹp logic cũ, SWR đã tự quản lý việc fetch dữ liệu

  // --- ELITE AUTO-SYNC LOGIC ---
  useEffect(() => {
    const triggerAutoSync = async () => {
      try {
        const res = await api.post('/api/import/smart-auto-sync');
        if (res.data.need_sync) {
          toast.info(res.data.message, { autoClose: 5000, icon: <RefreshCw className="animate-spin" /> });
        }
      } catch (err) {
        console.error("Auto-Sync Error:", err);
      }
    };
    triggerAutoSync();
  }, []);

  // --- FETCH FULL CUSTOMER DETAIL ---
  useEffect(() => {
    if (selectedCustomer) {
      const fetchDetail = async () => {
        setLoadingDetail(true);
        try {
          const ma_kh = selectedCustomer.ma_kh || selectedCustomer.ma_crm_cms;
          const res = await api.get(`/api/customers/${ma_kh}/details`);
          setFullCustomerDetail(res.data);
        } catch (err) {
          console.error("Detail Load Error:", err);
          setFullCustomerDetail(null);
        } finally {
          setLoadingDetail(false);
        }
      };
      fetchDetail();
    } else {
      setFullCustomerDetail(null);
    }
  }, [selectedCustomer]);

  const handleZoom = () => {
    let { refAreaLeft, refAreaRight, refAreaTop, refAreaBottom } = zoomState;

    if (refAreaLeft === refAreaRight || refAreaRight === '') {
      setZoomState(s => ({ ...s, refAreaLeft: '', refAreaRight: '', refAreaTop: '', refAreaBottom: '' }));
      return;
    }

    // Đảm bảo Left luôn nhỏ hơn Right
    if (refAreaLeft > refAreaRight) [refAreaLeft, refAreaRight] = [refAreaRight, refAreaLeft];
    if (refAreaBottom > refAreaTop) [refAreaBottom, refAreaTop] = [refAreaTop, refAreaBottom];

    setZoomState(s => ({
      ...s,
      refAreaLeft: '',
      refAreaRight: '',
      refAreaTop: '',
      refAreaBottom: '',
      left: refAreaLeft,
      right: refAreaRight,
      top: refAreaTop,
      bottom: refAreaBottom
    }));
  };

  const resetZoom = () => {
    setZoomState({
      refAreaLeft: '', refAreaRight: '', refAreaTop: '', refAreaBottom: '',
      left: 'auto', right: 'auto', top: 'auto', bottom: 'auto'
    });
  };

  return (
    <div className="flex bg-gray-50/50 min-h-screen">
      <div className={`flex-1 p-4 md:p-6 space-y-3 ${isExporting ? 'is-exporting' : ''}`} ref={dashboardRef}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 relative z-50">
          <div>
            <h2 className="text-xl font-bold text-vnpost-blue uppercase tracking-wider">CRM 3.0 Dashboard</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {selectedNode ? (
                <span className="text-[10px] bg-vnpost-orange text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">Đang soi: {selectedNode.title}</span>
              ) : (
                <span className="text-[10px] bg-vnpost-blue/10 text-vnpost-blue px-2 py-0.5 rounded-full font-bold uppercase border border-vnpost-blue/10">
                  {user?.scope || "Toàn tỉnh"}
                </span>
              )}
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">Elite</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <div className={`logic-mode-badge ${selectedMonth ? 'mode-snapshot' : 'mode-realtime'}`}>
               <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${selectedMonth ? 'bg-slate-400' : 'bg-blue-500'}`}></div>
               {selectedMonth ? `SN: ${selectedMonth}` : 'REALTIME'}
             </div>
             <button onClick={() => window.location.reload()} className="p-2 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-vnpost-blue transition-all shadow-sm"><RefreshCw size={14} /></button>
             <button onClick={handleExportPDF} className="bg-vnpost-blue text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"><DownloadCloud size={14} /> Xuất Báo Cáo</button>
          </div>
        </div>
        {/* System Health Alert Banner */}
        {healthDataRes?.has_alert && (
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center justify-between animate-pulse-slow border border-white/20">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/30"><AlertCircle size={24} /></div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80 mb-0.5">Cảnh báo Sức khỏe Hệ thống (QA Detected)</p>
                <p className="text-sm font-bold leading-tight">{healthDataRes.message}</p>
              </div>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-5 py-2 rounded-xl font-bold text-[11px] transition-all uppercase tracking-wider backdrop-blur-md">Kiểm tra Master File</button>
          </div>
        )}

        {/* Elite Morning Pulse Widget */}
        <EliteMorningPulse report={botReport} loading={loadingBot} />

        {/* Filters Section */}
        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-4 border border-white/50 shadow-sm flex flex-col lg:flex-row items-end gap-4 no-pdf relative z-50">
          <div className="flex-1 w-full space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1"><MapPin size={12} /> Phạm vi dữ liệu</label>
            <div className="relative">
                <button 
                  onClick={() => setIsTreeOpen(!isTreeOpen)}
                  className={`w-full bg-gray-50 border rounded-xl px-4 py-2.5 text-xs font-bold text-vnpost-blue flex justify-between items-center transition-all shadow-inner ${isTreeOpen ? 'ring-2 ring-vnpost-blue/20 border-vnpost-blue/30 bg-white' : 'border-gray-100 hover:bg-white'}`}
                >
                  <span className="truncate">{selectedNode ? selectedNode.title : (user?.scope || "Toàn tỉnh")}</span>
                  <ArrowUpRight size={14} className={`transition-transform duration-300 ${isTreeOpen ? 'rotate-180 opacity-100' : 'rotate-90 opacity-40'}`} />
                </button>

               {/* RF2B-A1: Filter Context Hint */}
               {selectedNode && (
                 <p className="mt-1.5 text-[11px] text-gray-400 font-bold px-1 flex items-center gap-1">
                   <MapPin size={10} className="text-vnpost-blue/50" />
                   {selectedNode.title}
                   {selectedNode.type === "cum" ? " — Cum dia ban dang soi" : selectedNode.type === "buu_cuc" ? " — Buu cuc truc thuoc" : " — Diem giao dich"}
                 </p>
               )}

               {isTreeOpen && (
                 <>
                  {/* Backdrop to close when click outside */}
                  <div className="fixed inset-0 z-10" onClick={() => setIsTreeOpen(false)}></div>
                  
                  {/* Tree Explorer as Dropdown Overlay */}
                  <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 z-20 max-h-[450px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-4">
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Chọn Cụm / Bưu cục / Điểm</span>
                        <button onClick={() => setIsTreeOpen(false)} className="text-[11px] font-black text-vnpost-blue uppercase hover:underline">Đóng</button>
                      </div>
                      <Suspense fallback={<div className="p-4 text-center text-xs font-black text-gray-400 uppercase animate-pulse">Đang tải cây đơn vị...</div>}>
                        <TreeExplorer 
                          onSelect={(node) => {
                            handleNodeSelect(node);
                            setIsTreeOpen(false); // Close after selection
                          }} 
                          selectedNode={selectedNode} 
                        />
                      </Suspense>
                  </div>
                 </>
               )}
            </div>
          </div>
          <div className="flex-1 w-full space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1"><Calendar size={12} /> Thời điểm Tùy chọn</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setSelectedMonth(""); }} className="bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs font-bold text-vnpost-blue focus:ring-2 focus:ring-vnpost-blue/10 transition-all" />
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setSelectedMonth(""); }} className="bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs font-bold text-vnpost-blue focus:ring-2 focus:ring-vnpost-blue/10 transition-all" />
            </div>
          </div>
          <div className="flex-1 w-full space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1"><TrendingUp size={12} /> Chọn Nhanh Tháng</label>
            <select className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs font-bold text-vnpost-blue cursor-pointer focus:ring-2 focus:ring-vnpost-blue/10 transition-all" value={selectedMonth} onChange={(e) => handleQuickMonth(e.target.value)}>
              <option value="">-- Chọn tháng --</option>
              {coverageData?.months?.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100">
            <button onClick={() => setComparisonType('mom')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap ${comparisonType === 'mom' ? 'bg-vnpost-blue text-white shadow-lg' : 'text-gray-400 hover:bg-gray-200'}`}>MoM</button>
            <button onClick={() => setComparisonType('yoy')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap ${comparisonType === 'yoy' ? 'bg-vnpost-blue text-white shadow-lg' : 'text-gray-400 hover:bg-gray-200'}`}>YoY</button>
          </div>
        </div>

        {/* SECTION: POPULATION (HIỆN TRẠNG) - TOP PRIORITY */}
        <PopulationKpiGroup stats={stats} summaryData={summaryData} selectedNode={selectedNode} navigate={navigate} saveNavigationContext={saveNavigationContext} />

        {/* SECTION: EVENTS (BIẾN ĐỘNG TRONG KỲ) - SECONDARY PRIORITY */}
        <MovementIndicators stats={stats} summaryData={summaryData} selectedNode={selectedNode} navigate={navigate} saveNavigationContext={saveNavigationContext} />
            
        {/* ELITE TIERS (Potentials) */}
        <PotentialsGroup stats={stats} summaryData={summaryData} selectedNode={selectedNode} navigate={navigate} saveNavigationContext={saveNavigationContext} />
          
        <LifecyclePulseBar stats={stats} />



      {/* Heatmap & Trends */}
        <div className="grid grid-cols-1 gap-6" id="heatmap-section">
          <div className="card p-6 overflow-hidden relative z-10 min-w-0">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-50 pb-3">
              <TrendingUp size={18} className="text-vnpost-blue" /> Biến Động Doanh Thu Theo Ngày
            </h3>
            <div className="h-[300px] w-full">
              {loadingTrend && (!trendDataRes || !trendDataRes.length) ? (
                <Skeleton.Chart height="h-80" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendDataRes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0054A6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0054A6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                      minTickGap={40}
                      tickFormatter={(str) => {
                        try { return new Date(str).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'}); }
                        catch(e) { return str; }
                      }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                      tickFormatter={(val) => `${(Number(val) / 1000000).toFixed(0)}M`}
                    />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '11px' }}
                      wrapperStyle={{ pointerEvents: 'none', zIndex: 1000 }}
                      formatter={(v) => [formatCurrency(v), "Doanh thu"]} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="var(--crm-active-base)" 
                      fill="url(#colorRev)" 
                      strokeWidth={3} 
                      dot={{ r: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#F9A51A' }}
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div id="heatmap-section">
            <HeatmapSection
              ref={heatmapSectionRef}
              heatmapDataRes={heatmapDataRes}
              loadingHeatmap={loadingHeatmap}
              navStack={navStack}
              setNavStack={setNavStack}
              setSelectedNode={setSelectedNode}
              handleGoBack={handleGoBack}
              handleDrillDown={handleDrillDown}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>

        <MovementComparison
          monthlyDataRes={monthlyDataRes}
          moversData={moversData}
          loadingMovers={loadingMovers}
          stats={stats}
          churnDataRes={churnDataRes}
          heatmapDataRes={heatmapDataRes}
          onInsightAction={handleInsightAction}
          formatCurrency={formatCurrency}
        />

        {/* Intelligence Hub */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2 mt-8">
            <Sparkles className="w-4 h-4" /> Nhóm 03: Phân tích Chuyên sâu & Dự báo AI (Intelligence Hub)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DỰ BÁO RỜI BỎ SỚM */}
            <div className="card bg-white border-t-4 border-t-red-600 shadow-xl !p-0 overflow-hidden group">
              <div className="p-4 bg-red-900 text-white flex justify-between items-center">
                <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle size={18} className="animate-pulse" /> 
                  Dự báo Rời bỏ sớm
                  <Link to="/guidelines#ai-prediction">
                    <Info size={12} className="text-red-300 cursor-pointer hover:text-white" />
                  </Link>
                </h4>
                <span className="text-[8px] bg-red-700 px-2 py-1 rounded-full font-bold uppercase tracking-widest">Predictive AI</span>
              </div>
              <div className="p-0 max-h-[600px] overflow-y-auto">
                {(loadingChurn || !summaryData) ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-4 py-3 animate-pulse border-b border-gray-50 last:border-0">
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                          <div className="h-2 bg-gray-150 rounded w-1/3"></div>
                        </div>
                        <div className="w-16 h-8 bg-gray-200 rounded-lg self-center"></div>
                      </div>
                    ))}
                  </div>
                ) : churnDataRes?.length > 0 ? churnDataRes.slice(0, 20).map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-2 px-4 border-b border-gray-50 last:border-0 hover:bg-red-50 transition-all cursor-pointer group" onClick={() => setSelectedCustomer(p)}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex flex-col min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 truncate uppercase group-hover:text-red-700">{p.ten_kh}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">{p.ma_kh}</span>
                           <span className="text-[8px] px-1 bg-red-100 text-red-600 rounded font-black uppercase tracking-tighter">{p.segment}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden sm:flex flex-col items-end">
                         <p className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">Vắng mặt</p>
                         <p className="text-[11px] font-black text-gray-700">{p.days_inactive} ngày</p>
                      </div>
                      
                      <div className="hidden md:flex flex-col items-end min-w-[80px]">
                         <p className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">Đơn cuối</p>
                         <p className="text-[10px] font-bold text-gray-600">{p.last_active}</p>
                      </div>

                      <div className="text-right min-w-[60px]">
                        <span className="text-[11px] font-black text-red-600 block">-{p.drop_pct}%</span>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${p.risk_level.includes('CAO') ? 'text-red-600' : 'text-amber-600'}`}>
                           {p.risk_level.includes('CAO') ? 'RỦI RO CAO' : 'THEO DÕI'}
                        </span>
                      </div>
                    </div>
                  </div>
                )) : <div className="p-12 text-center text-gray-300 italic text-xs font-bold uppercase">Chưa phát hiện rủi ro rời bỏ</div>}
              </div>
            </div>
            
            {/* ĐIỂM TIỀM NĂNG RFM */}
            <div className="card bg-white border-t-4 border-t-indigo-600 shadow-xl !p-0 overflow-hidden group">
              <div className="p-4 bg-indigo-900 text-white flex justify-between items-center">
                <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-300" /> 
                  Điểm Tiềm Năng RFM
                  <Link to="/guidelines#rfm-scoring">
                    <Info size={12} className="text-indigo-300 cursor-pointer hover:text-white" />
                  </Link>
                </h4>
                <span className="text-[8px] bg-indigo-700 px-2 py-1 rounded-full font-bold uppercase tracking-widest">Elite Scoring</span>
              </div>
              <div className="p-0 max-h-[600px] overflow-y-auto">
                {(loadingScoring || !summaryData) ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-4 py-3 animate-pulse border-b border-gray-50 last:border-0">
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                          <div className="h-2 bg-gray-150 rounded w-1/3"></div>
                        </div>
                        <div className="w-16 h-8 bg-gray-200 rounded-lg self-center"></div>
                      </div>
                    ))}
                  </div>
                ) : scoringDataRes?.length > 0 ? scoringDataRes.slice(0, 20).map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-2 px-4 border-b border-gray-50 last:border-0 hover:bg-indigo-50 transition-all cursor-pointer group" onClick={() => setSelectedCustomer(s)}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex flex-shrink-0 items-center justify-center border border-indigo-100 font-black text-indigo-700 text-[11px] shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {s.score}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 truncate uppercase group-hover:text-indigo-700">{s.ten_kh}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">{s.ma_kh}</span>
                           <span className="text-[8px] px-1 bg-indigo-100 text-indigo-600 rounded font-black uppercase tracking-tighter">{s.rank}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                       <div className="hidden sm:flex flex-col items-end">
                          <p className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">Doanh thu</p>
                          <p className="text-[11px] font-black text-gray-700">{formatCurrency(s.revenue)}</p>
                       </div>
                       <div className="hidden md:flex flex-col items-end min-w-[60px]">
                          <p className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">Tần suất</p>
                          <p className="text-[10px] font-bold text-gray-600">{s.frequency} đơn</p>
                       </div>
                       <div className="flex items-center justify-center w-6">
                          <TrendingUp size={14} className="text-emerald-500" />
                       </div>
                    </div>
                  </div>
                )) : <div className="p-12 text-center text-gray-300 italic text-xs font-bold uppercase">Đang đồng bộ điểm số...</div>}
              </div>
            </div>
          </div>
        </div>



        {/* Global Footer Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
           <div className="card p-6 bg-vnpost-blue text-white shadow-vnpost-blue/20">
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 opacity-70">Phân Phối Theo Dịch Vụ</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revService} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: '#fff', fontWeight: 'bold' }} axisLine={false} />
                    <RechartsTooltip contentStyle={{color: '#0054A6'}} />
                    <Bar dataKey="value" fill="#F9A51A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>
           <div className="card p-6">
              <h3 className="text-sm font-black uppercase tracking-widest mb-4 text-gray-400">Tỉ trọng Thị trường</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revRegion} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {revRegion.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
      </div>


      {/* ELITE CUSTOMER PROFILE MODAL */}
      {selectedCustomer && (
        <Suspense fallback={null}>
          <CustomerProfileModal
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            fullCustomerDetail={fullCustomerDetail}
            loadingDetail={loadingDetail}
            formatCurrency={formatCurrency}
          />
        </Suspense>
      )}

      <CustomerListModal 
        isOpen={showChurnModal} 
        onClose={() => setShowChurnModal(false)} 
        customers={churnDataRes} 
      />
    </div>
  );
}
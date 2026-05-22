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
  Calendar, MapPin, TrendingUp, Info, X, BarChart3, Target, Sparkles, AlertCircle, RefreshCw, ArrowLeft, ChevronRight, Zap, Send, Activity, Maximize2, Minimize2
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

// --- Helper Components ---
const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
    const formatCurrency = (val) => {
      if (val === undefined || val === null || isNaN(val)) return '0 ₫';
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    };
    return (
      <div className="bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[200px]">
        <p className="text-sm font-black text-gray-800 mb-2 border-b border-gray-100 pb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={`${entry.name}-${index}`} className="flex justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }}></div>
                <span className="text-xs font-bold text-gray-500">{entry.name}:</span>
              </div>
              <span className="text-xs font-black text-gray-700">
                {unit === 'VND' ? formatCurrency(entry.value) : (entry.value || 0).toLocaleString() + ' đơn'}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center gap-6 pt-2 mt-2 border-t border-dashed border-gray-200">
            <span className="text-xs font-black text-vnpost-blue uppercase tracking-wider">Tổng cộng:</span>
            <span className="text-sm font-black text-vnpost-blue">
              {unit === 'VND' ? formatCurrency(total) : total.toLocaleString() + ' đơn'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

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
  const [quickFilter, setQuickFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

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
  const [isFullScreen, setIsFullScreen] = useState(false);
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

  const processedHeatmapData = useMemo(() => {
    if (!heatmapDataRes || !heatmapDataRes.length) return [];
    const rawData = Array.isArray(heatmapDataRes) ? heatmapDataRes : [];
    return rawData.map(h => ({
      ...h,
      id: h.ma_don_vi,
      title: h.don_vi,
      revenue: Number(h?.revenue) || 0,
      growth: Number(h?.growth) || 0
    }));
  }, [heatmapDataRes]);

  const heatmapFilteredData = useMemo(() => {
    if (!processedHeatmapData.length) return [];
    const totalRev = processedHeatmapData.reduce((acc, curr) => acc + curr.revenue, 0);
    const avgRev = totalRev / processedHeatmapData.length;
    
    return processedHeatmapData.filter(item => {
      const matchSearch = !searchTerm || item.title?.toLowerCase().includes(searchTerm.toLowerCase()) || String(item.id).toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (quickFilter === 'ALL') return true;
      if (quickFilter === 'STAR') return item.growth >= 0 && item.revenue >= avgRev;
      if (quickFilter === 'POTENTIAL') return item.growth >= 0 && item.revenue < avgRev;
      if (quickFilter === 'COW') return item.growth < 0 && item.revenue >= avgRev;
      if (quickFilter === 'DANGER') return item.growth < 0 && item.revenue < avgRev;
      return true;
    });
  }, [processedHeatmapData, quickFilter, searchTerm]);

  const handleCopyTSV = () => {
    if (!heatmapFilteredData.length) return;
    const totalRev = processedHeatmapData.reduce((acc, curr) => acc + curr.revenue, 0);
    const avgRev = totalRev / processedHeatmapData.length;

    const getQuadrant = (rev, growth) => {
        if (rev >= avgRev && growth >= 0) return { label: "NGÔI SAO", color: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-50", icon: <Sparkles size={12}/> };
        if (rev >= avgRev && growth < 0) return { label: "BÒ SỮA", color: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-50", icon: <Target size={12}/> };
        if (rev < avgRev && growth >= 0) return { label: "TRIỂN VỌNG", color: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-50", icon: <TrendingUp size={12}/> };
        return { label: "YẾU KÉM", color: "bg-red-500", text: "text-red-500", bg: "bg-red-50", icon: <AlertCircle size={12}/> };
    };

    const header = "Đơn vị\tID\tDoanh thu\tTăng trưởng\tChiến lược\n";
    const rows = [...heatmapFilteredData].sort((a, b) => b.revenue - a.revenue).map(item => {
        const q = getQuadrant(item.revenue, item.growth);
        return `${item.title}\t${item.id}\t${item.revenue}\t${item.growth}%\t${q.label}`;
    }).join('\n');
    const copyText = header + rows;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(copyText).then(() => {
            toast.success("Đã copy dữ liệu bảng Heatmap!");
        }).catch(err => {
            console.error(err);
            toast.error("Lỗi khi copy. Vui lòng thử lại!");
        });
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = copyText;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            toast.success("Đã copy dữ liệu bảng Heatmap!");
        } catch (error) {
            console.error(error);
            toast.error("Trình duyệt không hỗ trợ copy.");
        } finally {
            textArea.remove();
        }
    }
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
          
          <div className="card p-4 overflow-hidden relative z-20 min-w-0">
            <div className="flex flex-col gap-2 mb-4 border-b border-gray-50 pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Target size={18} className="text-vnpost-orange" /> 
                  Bảng Quản trị Hiệu quả & Tăng trưởng Địa bàn
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="relative flex items-center">
                    <Search size={12} className="absolute left-2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Tìm ID / Đơn vị..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-6 pr-2 py-1 rounded-full text-[10px] border border-gray-200 bg-white shadow-sm focus:outline-none focus:border-vnpost-blue focus:ring-1 focus:ring-vnpost-blue transition-all w-36"
                    />
                  </div>
                  <button onClick={() => setQuickFilter('ALL')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'ALL' ? 'bg-vnpost-blue text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Tất cả</button>
                  <button onClick={() => setQuickFilter('STAR')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'STAR' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>⭐ Ngôi sao</button>
                  <button onClick={() => setQuickFilter('POTENTIAL')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'POTENTIAL' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>🚀 Triển vọng</button>
                  <button onClick={() => setQuickFilter('COW')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'COW' ? 'bg-orange-500 text-white shadow-sm' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>🐄 Bò sữa</button>
                  <button onClick={() => setQuickFilter('DANGER')} className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${quickFilter === 'DANGER' ? 'bg-red-500 text-white shadow-sm' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>⚠️ Yếu kém</button>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleCopyTSV} className="text-[10px] font-bold bg-vnpost-blue/10 text-vnpost-blue hover:bg-vnpost-blue/20 px-2 py-1 rounded-full uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm">
                    <DownloadCloud size={12} /> Sao chép TSV
                  </button>
                  <span className="text-[10px] font-bold bg-vnpost-orange/10 text-vnpost-orange px-2 py-1 rounded-full uppercase tracking-wider">
                    PHÂN LOẠI CHIẾN LƯỢC 4 NHÓM
                  </span>
                  <button 
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue shadow-sm transition-all"
                    title={isFullScreen ? "Thu nhỏ" : "Toàn màn hình"}
                  >
                    {isFullScreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
                  </button>
                </div>
              </div>

              {/* [SAFE HEADER] Integrated Breadcrumb with zero absolute positioning */}
              {navStack.length > 1 && (
                <div className="flex items-center gap-1.5 p-1 bg-gray-50/50 rounded-xl border border-gray-100/50 w-fit animate-in fade-in slide-in-from-left-2">
                  <button 
                    onClick={handleGoBack}
                    className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue shadow-sm transition-all flex items-center gap-1 group"
                  >
                    <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Quay lại</span>
                  </button>
                  
                  <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                  
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[400px]">
                    {navStack.map((step, idx) => (
                      <React.Fragment key={step.key}>
                        {idx > 0 && <ChevronRight size={10} className="text-gray-300 flex-shrink-0" />}
                        <button
                          onClick={() => {
                            const newStack = navStack.slice(0, idx + 1);
                            setNavStack(newStack);
                            setSelectedNode(step);
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                            idx === navStack.length - 1 
                              ? 'bg-vnpost-blue text-white shadow-sm' 
                              : 'text-gray-400 hover:bg-white hover:text-vnpost-blue'
                          }`}
                        >
                          {step.title}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
              <div className="flex-1 w-full relative">
                {loadingHeatmap && (!heatmapDataRes || !heatmapDataRes.length) ? (
                  <Skeleton.Table rows={8} />
                ) : heatmapDataRes && heatmapDataRes.length > 0 ? (() => {
                   try {
                     const data = processedHeatmapData;
                     const totalRev = data.reduce((acc, curr) => acc + curr.revenue, 0);
                     const avgRev = totalRev / data.length;

                     const getQuadrant = (rev, growth) => {
                        if (rev >= avgRev && growth >= 0) return { label: "NGÔI SAO", color: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-50", icon: <Sparkles size={12}/> };
                        if (rev >= avgRev && growth < 0) return { label: "BÒ SỮA", color: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-50", icon: <Target size={12}/> };
                        if (rev < avgRev && growth >= 0) return { label: "TRIỂN VỌNG", color: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-50", icon: <TrendingUp size={12}/> };
                        return { label: "YẾU KÉM", color: "bg-red-500", text: "text-red-500", bg: "bg-red-50", icon: <AlertCircle size={12}/> };
                     };

                     const filteredData = heatmapFilteredData;

                     return (
                        <div className={`h-full flex flex-col ${isFullScreen ? 'fixed inset-0 z-[9999] bg-white p-10 w-screen h-screen left-0 top-0 overflow-y-auto' : ''}`}>
                          <div className="flex-1 overflow-y-auto no-scrollbar rounded-2xl border border-gray-100 bg-gray-50/30 backdrop-blur-sm">
                            <table className="w-full text-left border-collapse">
                              <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10">
                                <tr className="border-b border-gray-100">
                                  <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đơn vị địa bàn</th>
                                  <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Doanh thu</th>
                                  <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Tỷ trọng</th>
                                  <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Tăng trưởng</th>
                                  <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Chiến lược</th>
                                  <th className="p-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody>
                                  {filteredData.sort((a, b) => b.revenue - a.revenue).map((item, idx) => {
                                    const q = getQuadrant(item.revenue, item.growth);
                                    // [FIX-02] Higher contrast severity highlight
                                    const _isWeak = q.label.includes("YEU") || q.label.includes("YẾU");
                                    const _isRisk = item.growth < -10;
                                    
                                    // [SAFE-CALC] Contribution with safety guard
                                    const contribution = totalRev > 0 ? ((item.revenue / totalRev) * 100).toFixed(1) + '%' : '0%';
                                    
                                    return (
                                      <tr key={item.id || idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                                        <td className="p-1.5 pl-3">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-1 h-8 rounded-full ${_isWeak ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                                            <div className="flex flex-col min-w-0">
                                              <span className="text-[11px] font-semibold text-gray-800 truncate leading-tight group-hover:text-vnpost-blue">{item.title}</span>
                                              <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">ID: {item.id}</span>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-1.5 text-right font-semibold text-gray-700 text-[11px]">
                                          {formatCurrency(item.revenue)} <span className="text-gray-300 font-normal ml-0.5">₫</span>
                                        </td>
                                        <td className="p-1.5 text-right">
                                           <div className="flex flex-col items-end">
                                              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Tỷ trọng</span>
                                              <span className="text-[11px] font-semibold text-gray-600">{contribution}</span>
                                           </div>
                                        </td>
                                        <td className="p-1.5 text-center">
                                          <div className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[10px] ${item.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                            {item.growth >= 0 ? <ArrowUpRight size={10}/> : <TrendingUp size={10} className="rotate-180"/>}
                                            {item.growth > 0 ? '+' : ''}{item.growth}%
                                          </div>
                                        </td>
                                        <td className="p-1.5 text-center">
                                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${q.bg} ${q.text} border-transparent group-hover:border-current transition-all shadow-sm`}>
                                            {q.icon}
                                            <span className="text-[9px] font-bold uppercase tracking-wider tracking-tighter">{q.label}</span>
                                          </div>
                                        </td>
                                        <td className="p-1.5 text-right pr-3">
                                          <button 
                                            onClick={() => handleDrillDown(item)}
                                            className="p-1.5 bg-gray-100 text-gray-400 rounded-lg hover:bg-vnpost-blue hover:text-white transition-all shadow-sm"
                                          >
                                            <ChevronRight size={14} />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="sticky bottom-0 bg-gray-50/90 backdrop-blur-md z-10 border-t border-gray-200">
                                  {(() => {
                                    const totalRev = data.reduce((acc, curr) => acc + curr.revenue, 0);
                                    const totalPrevRev = data.reduce((acc, curr) => acc + (curr.previous_revenue || 0), 0);
                                    const totalGrowth = totalPrevRev > 0 ? ((totalRev - totalPrevRev) / totalPrevRev * 100) : 0;
                                    
                                    return (
                                      <tr className="bg-vnpost-blue/5">
                                        <td className="p-1.5 pl-3">
                                          <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-vnpost-blue uppercase tracking-tight">TỔNG CỘNG ĐỊA BÀN</span>
                                            <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">{data.length} đơn vị con</span>
                                          </div>
                                        </td>
                                        <td className="p-1.5 text-right">
                                          <span className="text-[13px] font-black text-vnpost-blue">{formatCurrency(totalRev)} <span className="text-[9px] font-normal">₫</span></span>
                                        </td>
                                        <td className="p-1.5 text-right">
                                           <span className="text-[11px] font-black text-vnpost-blue/40 uppercase tracking-widest">100.0%</span>
                                        </td>
                                        <td className="p-1.5">
                                          <div className={`flex items-center justify-center gap-0.5 font-black text-[11px] ${totalGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {totalGrowth >= 0 ? <ArrowUpRight size={12}/> : <TrendingUp size={12} className="rotate-180"/>}
                                            {totalGrowth > 0 ? '+' : ''}{totalGrowth.toFixed(1)}%
                                          </div>
                                        </td>
                                        <td colSpan="2" className="p-2 text-center">
                                          <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest bg-white/50 py-1 rounded-lg border border-gray-100 italic">
                                            Hiệu quả tổng hợp của phạm vi đang soi
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </tfoot>
                            </table>
                          </div>
                       </div>
                     );
                   } catch (e) {
                     console.error("Board Render Error:", e);
                     return <div className="h-full flex items-center justify-center text-red-500 font-bold">Lỗi hiển thị bảng quản trị.</div>;
                   }
                })() : <div className="h-full flex items-center justify-center text-gray-300 italic text-xs uppercase font-black tracking-widest animate-pulse">Đang nạp dữ liệu điều hành...</div>}
             </div>
             <div className="grid grid-cols-4 gap-3 mt-4">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 transition-all duration-300 transform hover:scale-105 hover:shadow-xl cursor-default group">
                   <p className="text-[13px] font-black text-emerald-700 uppercase mb-1 flex items-center gap-2">⭐ NGÔI SAO</p>
                   <p className="text-[10px] text-emerald-800 leading-tight font-bold opacity-70 group-hover:opacity-100">Quy mô lớn & Tăng trưởng tốt.</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 transition-all duration-300 transform hover:scale-105 hover:shadow-xl cursor-default group">
                   <p className="text-[13px] font-black text-blue-700 uppercase mb-1 flex items-center gap-2">🚀 TRIỂN VỌNG</p>
                   <p className="text-[10px] text-blue-800 leading-tight font-bold opacity-70 group-hover:opacity-100">Quy mô nhỏ nhưng tăng trưởng nhanh.</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 transition-all duration-300 transform hover:scale-105 hover:shadow-xl cursor-default group">
                   <p className="text-[13px] font-black text-orange-700 uppercase mb-1 flex items-center gap-2">🐄 BÒ SỮA</p>
                   <p className="text-[10px] text-orange-800 leading-tight font-bold opacity-70 group-hover:opacity-100">Quy mô lớn nhưng tăng trưởng âm.</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 transition-all duration-300 transform hover:scale-105 hover:shadow-xl cursor-default group">
                   <p className="text-[13px] font-black text-red-700 uppercase mb-1 flex items-center gap-2">⚠️ YẾU KÉM</p>
                   <p className="text-[10px] text-red-800 leading-tight font-bold opacity-70 group-hover:opacity-100">Cả quy mô và tăng trưởng đều thấp.</p>
                </div>
             </div>
          </div>
        </div>

        {/* Biến Động Doanh Thu & Tăng Trưởng MoM */}
        <div className="card p-4 !col-span-full">
                  <div className="h-[400px] w-full">
                    {(() => {
                      if (!monthlyDataRes || monthlyDataRes.length === 0) {
                        return (
                          <div className="flex flex-col h-full items-center justify-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                            <Loader2 className="w-8 h-8 text-vnpost-blue/20 animate-spin" />
                            <p className="text-[10px] font-black text-gray-400 uppercase mt-4">Đang phân tích xu hướng...</p>
                          </div>
                        );
                      }
                      
                      const chartData = monthlyDataRes.map(m => ({
                        month: m.month,
                        total: m.total_revenue || m.total || 0,
                        growth: m.growth_rate || m.growth || 0
                      })).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

                      return (
                        <div className="flex flex-col h-full">
                          <h3 className="text-[10px] font-black text-vnpost-blue uppercase tracking-widest flex items-center justify-between mb-4 border-b border-gray-50 pb-2">
                            <span className="flex items-center gap-2">
                              <Activity size={14} /> 
                              Hiệu Suất & Tốc Độ Tăng Trưởng 
                            </span>
                            <div className="flex gap-3">
                               <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#0054A6] rounded-sm"></div> <span className="text-[11px] font-bold text-gray-500 uppercase">Doanh thu</span></div>
                               <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-[#F9A51A]"></div> <span className="text-[11px] font-bold text-gray-500 uppercase">Tăng trưởng (%)</span></div>
                            </div>
                          </h3>
                          <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis 
                                  dataKey="month" 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} 
                                  tickFormatter={(val) => {
                                    if (!val) return "";
                                    const [y, m] = val.split('-');
                                    return `T${m}/${y.slice(2)}`;
                                  }}
                                />
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => val === 0 ? "0" : `${((val || 0) / 1000000).toFixed(0)}M`} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#F9A51A', fontWeight: 'bold' }} tickFormatter={(val) => `${val}%`} />
                                <RechartsTooltip 
                                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '11px' }}
                                  formatter={(val, name) => [name === 'growth' ? `${val}%` : formatCurrency(val), name === 'growth' ? 'Tăng trưởng' : 'Doanh thu']} 
                                />
                                <Bar yAxisId="left" dataKey="total" name="revenue" fill="#0054A6" radius={[6, 6, 0, 0]} barSize={45} />
                                <Line yAxisId="right" type="monotone" dataKey="growth" stroke="#F9A51A" strokeWidth={4} dot={{ r: 5, fill: '#F9A51A', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
        </div>

        {/* Đối soát & Phân tích Hiệu quả (MoM/YoY Charts) */}
        {loadingMovers && !moversData.summary ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <Skeleton.Card height="h-96" />
            <Skeleton.Card height="h-96" />
          </div>
        ) : moversData && moversData.summary ? (() => {
          const SERVICE_COLORS = { 'EMS': '#0054A6', 'Bưu kiện': '#F9A51A', 'KT1': '#10b981', 'BĐBD': '#f43f5e', 'Quốc tế': '#8b5cf6', 'Khác': '#94a3b8' };
          const services = moversData.summary?.services || [];
          const activeServices = services.map(s => s.service);
          
          const revData = [
            { name: 'Kỳ này', ...services.reduce((acc, s) => ({ ...acc, [s.service]: s.current_rev }), {}) },
            { name: 'Kỳ trước', ...services.reduce((acc, s) => ({ ...acc, [s.service]: s.previous_rev }), {}) }
          ];
          
          const volData = [
            { name: 'Kỳ này', ...services.reduce((acc, s) => ({ ...acc, [s.service]: s.current_vol }), {}) },
            { name: 'Kỳ trước', ...services.reduce((acc, s) => ({ ...acc, [s.service]: s.previous_vol }), {}) }
          ];

          return (
            <div className="space-y-4 !col-span-full">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mt-4 border-b border-gray-100 pb-2">
                <h3 className="text-[11px] font-black text-vnpost-blue uppercase tracking-widest flex items-center gap-2">
                  <RefreshCw className="w-3 h-3" /> Đối soát & Phân tích Hiệu quả
                </h3>
                {(() => {
                  if (moversData?.period) {
                    const p = moversData.period;
                    return (
                      <div className="px-4 py-1.5 bg-gray-50 rounded-full border border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-tight flex items-center gap-3 shadow-inner">
                        <span className="text-vnpost-blue/60">{(p.type || '').toUpperCase()}:</span>
                        <span className="text-gray-400 italic">Kỳ trước:</span> <span className="text-gray-700">{p.previous?.start} - {p.previous?.end}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-400 italic">Kỳ này:</span> <span className="text-vnpost-blue">{p.current?.start} - {p.current?.end}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <AIAssistantInsights 
                summary={moversData.summary} 
                stats={stats} 
                churnPrediction={churnDataRes} 
                heatmapData={heatmapDataRes} 
                onAction={(action) => {
                  if (action === 'FILTER_WEAK') setQuickFilter('DANGER');
                  if (action === 'FILTER_STAR') setQuickFilter('STAR');
                  const heatmapSection = document.getElementById('heatmap-section');
                  if (heatmapSection) heatmapSection.scrollIntoView({ behavior: 'smooth' });
                }}
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Revenue Comparison */}
                <div className="card p-4 bg-white border-l-4 border-l-vnpost-blue shadow-lg">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 mb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-blue-50 rounded-lg text-vnpost-blue"><TrendingUp size={16} /></div>
                          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Biến động Doanh thu</h3>
                        </div>
                      </div>
                      {moversData?.period && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                          <span className="px-2.5 py-1 bg-vnpost-blue/10 text-vnpost-blue rounded-full border border-vnpost-blue/20 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-vnpost-blue inline-block"></span>
                            Kỳ này: {moversData.period.current.start} – {moversData.period.current.end}
                          </span>
                          <span className="text-gray-300">vs</span>
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                            Kỳ trước: {moversData.period.previous.start} – {moversData.period.previous.end}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100 uppercase tracking-widest">{moversData.period.type?.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 relative group overflow-hidden">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tổng Doanh Thu Kỳ Này</p>
                      <p className="text-2xl font-black text-vnpost-blue mb-1">{formatCurrency(moversData.summary.revenue.current)}</p>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${(moversData?.summary?.revenue?.current || 0) >= (moversData?.summary?.revenue?.previous || 0) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {(moversData?.summary?.revenue?.current || 0) >= (moversData?.summary?.revenue?.previous || 0) ? '↑' : '↓'}
                        {Math.abs((((moversData?.summary?.revenue?.current || 0) - (moversData?.summary?.revenue?.previous || 0)) / (moversData?.summary?.revenue?.previous || 1) * 100)).toFixed(1)}%
                      </div>
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barGap={5}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#1e293b' }} width={80} />
                          <RechartsTooltip content={<CustomTooltip unit="VND" />} cursor={{ fill: '#f8fafc', opacity: 0.4 }} />
                          <Legend verticalAlign="top" align="right" iconType="circle" />
                          {activeServices.map((svc, idx) => (
                            <Bar key={idx} dataKey={svc} name={svc} stackId="a" fill={SERVICE_COLORS[svc] || '#cbd5e1'} barSize={35} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Volume Comparison */}
                <div className="card p-4 bg-white border-l-4 border-l-vnpost-orange shadow-lg">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5 mb-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-orange-50 rounded-lg text-vnpost-orange"><BarChart3 size={16} /></div>
                          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Biến động Sản lượng</h3>
                        </div>
                      </div>
                      {moversData?.period && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                          <span className="px-2.5 py-1 bg-vnpost-orange/10 text-vnpost-orange rounded-full border border-vnpost-orange/20 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-vnpost-orange inline-block"></span>
                            Kỳ này: {moversData.period.current.start} – {moversData.period.current.end}
                          </span>
                          <span className="text-gray-300">vs</span>
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>
                            Kỳ trước: {moversData.period.previous.start} – {moversData.period.previous.end}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100 uppercase tracking-widest">{moversData.period.type?.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 relative group overflow-hidden">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tổng Sản Lượng Kỳ Này</p>
                      <p className="text-2xl font-black text-vnpost-orange mb-1">{(moversData.summary.volume.current || 0).toLocaleString()} <span className="text-sm font-bold opacity-60">đơn</span></p>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${(moversData?.summary?.volume?.current || 0) >= (moversData?.summary?.volume?.previous || 0) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {(moversData?.summary?.volume?.current || 0) >= (moversData?.summary?.volume?.previous || 0) ? '↑' : '↓'}
                        {Math.abs((((moversData?.summary?.volume?.current || 0) - (moversData?.summary?.volume?.previous || 0)) / (moversData?.summary?.volume?.previous || 1) * 100)).toFixed(1)}%
                      </div>
                    </div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={volData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }} barGap={5}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#1e293b' }} width={80} />
                          <RechartsTooltip content={<CustomTooltip unit="UNIT" />} cursor={{ fill: '#f8fafc', opacity: 0.4 }} />
                          <Legend verticalAlign="top" align="right" iconType="circle" />
                          {activeServices.map((svc, idx) => (
                            <Bar key={idx} dataKey={svc} name={svc} stackId="a" fill={SERVICE_COLORS[svc] || '#cbd5e1'} barSize={35} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })() : null}

        {/* Top 20 Stars & Risks */}
        {loadingMovers && !moversData.summary ? (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
             <Skeleton.Table rows={10} />
             <Skeleton.Table rows={10} />
           </div>
        ) : moversData.movers && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="card !p-0 overflow-hidden border-t-4 border-t-green-500 shadow-xl bg-white group/card">
              <div className="p-3 border-b border-gray-100 bg-green-50/30 flex justify-between items-center relative overflow-hidden">
                <div className="absolute -right-2 -top-2 text-green-100 opacity-20 transform rotate-12 select-none group-hover/card:scale-110 transition-transform duration-700">
                  <TrendingUp size={80} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-black text-green-800 flex items-center gap-2 uppercase tracking-widest">
                    <TrendingUp size={18} /> TOP 20 TĂNG TRƯỞNG (STARS)
                  </h3>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50/80 backdrop-blur-sm text-gray-500 text-[9px] uppercase sticky top-0 z-10 shadow-sm border-b border-gray-100 font-black">
                    <tr>
                      <th className="px-4 py-2 text-left">Khách hàng</th>
                      <th className="px-4 py-2 text-right">Biến động (VND)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {moversData.movers.gainers?.slice(0, 20).map((kh, idx) => (
                      <tr key={idx} className="hover:bg-green-50/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded-lg text-[9px] font-black shadow-sm">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 leading-none truncate max-w-[150px]">{kh.ten_kh}</p>
                              <p className="text-[8px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">{kh.ma_kh}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-black text-green-600">+{formatCurrency(kh.diff)}</p>
                          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter italic">Kỳ trước: {formatCurrency(kh.previous)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card !p-0 overflow-hidden border-t-4 border-t-red-500 shadow-xl bg-white group/card">
              <div className="p-4 border-b border-gray-100 bg-red-50/30 flex justify-between items-center relative overflow-hidden">
                <div className="absolute -right-2 -top-2 text-red-100 opacity-20 transform rotate-12 select-none group-hover/card:scale-110 transition-transform duration-700">
                  <TrendingUp size={80} className="rotate-180" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-black text-red-800 flex items-center gap-2 uppercase tracking-widest">
                    <TrendingUp size={18} className="rotate-180" /> TOP 20 SỤT GIẢM (RISKS)
                  </h3>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50/80 backdrop-blur-sm text-gray-500 text-[9px] uppercase sticky top-0 z-10 shadow-sm border-b border-gray-100 font-black">
                    <tr>
                      <th className="px-4 py-2 text-left">Khách hàng</th>
                      <th className="px-4 py-2 text-right">Biến động (VND)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {moversData.movers.losers?.slice(0, 20).map((kh, idx) => (
                      <tr key={idx} className="hover:bg-red-50/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded-lg text-[9px] font-black shadow-sm">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 leading-none truncate max-w-[150px]">{kh.ten_kh}</p>
                              <p className="text-[8px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">{kh.ma_kh}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-black text-red-600">{formatCurrency(kh.diff)}</p>
                          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter italic">Kỳ trước: {formatCurrency(kh.previous)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
}
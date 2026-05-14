import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../utils/api';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { saveNavigationContext, getNavigationContext, syncUrlWithContext, getContextFromUrl, saveDateContext, getDateContext } from '../utils/navigationMemory';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, Line, ScatterChart, Scatter, ZAxis, ReferenceLine, ReferenceArea, Label, LabelList, ComposedChart
} from 'recharts';
import {
  ArrowUpRight, Users, UserMinus, DollarSign, UploadCloud, DownloadCloud, Loader2,
  Calendar, MapPin, TrendingUp, Info, UserPlus, X, BarChart3, Target, Sparkles, AlertCircle, RefreshCw, ArrowLeft, ChevronRight, Zap, Send, Shield, Star
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import TreeExplorer from '../components/TreeExplorer';
import useSWR from 'swr';
import Skeleton from '../components/Skeleton';
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

const AIAssistantInsights = ({ summary, stats, churnPrediction, heatmapData }) => {
  if (!summary || !summary.revenue || !summary.volume) return null;
  const { revenue, volume, services = [] } = summary;
  
  const currentRev = revenue.current || 0;
  const previousRev = revenue.previous || 0;
  const revGrowth = ((currentRev - previousRev) / (previousRev || 1)) * 100;
  
  const serviceInsights = services.map(s => {
    const currRev = s.current_rev || 0;
    const prevRev = s.previous_rev || 0;
    const currVol = s.current_vol || 0;
    const prevVol = s.previous_vol || 0;
    
    const arpuCurr = currVol > 0 ? currRev / currVol : 0;
    const arpuPrev = prevVol > 0 ? prevRev / prevVol : 0;
    const arpuChange = arpuPrev > 0 ? ((arpuCurr - arpuPrev) / arpuPrev) * 100 : 0;
    const revChange = prevRev > 0 ? ((currRev - prevRev) / prevRev) * 100 : 0;
    return { ...s, arpuChange, revChange };
  });

  const mainDriver = [...serviceInsights].sort((a, b) => (b.current_rev - b.previous_rev) - (a.current_rev - a.previous_rev))[0];
  const erosionServices = serviceInsights.filter(s => s.current_vol > s.previous_vol && s.revChange < 0);

  let type = "neutral";
  if (revGrowth < -5) type = "negative";
  else if (revGrowth < 0 || erosionServices.length > 0) type = "warning";
  else if (revGrowth > 5) type = "positive";

  return (
    <div className={`relative overflow-hidden p-4 rounded-2xl border transition-all duration-500 shadow-xl backdrop-blur-xl ${
      type === 'positive' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 shadow-emerald-100' :
      type === 'warning' ? 'bg-amber-50/80 border-amber-200 text-amber-900 shadow-amber-100' :
      type === 'negative' ? 'bg-red-50/80 border-red-200 text-red-900 shadow-red-100' :
      'bg-indigo-50/80 border-indigo-200 text-indigo-900 shadow-indigo-100'
    }`}>
      <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-[80px] opacity-20 ${
        type === 'positive' ? 'bg-emerald-500' : type === 'warning' ? 'bg-amber-500' : type === 'negative' ? 'bg-red-500' : 'bg-indigo-500'
      }`}></div>

      <div className="executive-card relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white p-8 border-0 shadow-2xl">
      {/* Decorative BG elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      
      <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-start">
        <div className="p-4 bg-white/10 rounded-[1.25rem] border border-white/10 backdrop-blur-md shadow-inner self-start">
          <Sparkles className="text-vnpost-orange animate-pulse" size={32} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold tracking-tight">AI Strategic Insights</h2>
            <div className="px-3 py-1 bg-vnpost-orange/20 text-vnpost-orange rounded-full text-[10px] font-black uppercase border border-vnpost-orange/30">ELITE PROTOCOL</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
              <p className="text-[11px] font-bold text-blue-300 uppercase tracking-widest mb-3">Tăng trưởng Doanh thu</p>
              <p className="text-sm leading-relaxed text-gray-100">{summary.revenue_insight || "Đang phân tích xu hướng doanh thu..."}</p>
            </div>
            <div className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
              <p className="text-[11px] font-bold text-orange-300 uppercase tracking-widest mb-3">Biến động Vòng đời</p>
              <p className="text-sm leading-relaxed text-gray-100">{summary.lifecycle_insight || "Đang phân tích hành vi khách hàng..."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

const EliteMorningPulse = ({ report, loading }) => {
  if (loading) return (
    <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-100 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-gray-200 rounded-2xl"></div>
        <div className="space-y-2">
          <div className="w-32 h-4 bg-gray-200 rounded"></div>
          <div className="w-48 h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
  
  if (!report) return null;

  const { stats, alerts, formatted_message } = report;
  const growthColor = stats.is_up ? 'text-emerald-500' : 'text-rose-500';

  const handleDispatch = () => {
    navigator.clipboard.writeText(formatted_message);
    toast.success("🚀 Đã sao chép báo cáo! Đang mở Zalo Group...");
    window.open("https://zalo.me", "_blank");
  };

  return (
    <div className="bg-white rounded-2xl p-3 shadow-xl border border-blue-50 relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
        <Sparkles size={120} className="text-vnpost-blue" />
      </div>
      
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-gradient-to-br from-vnpost-blue to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 animate-bounce-slow">
            <Zap size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Bot Báo Cáo Sáng</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stats.date}</span>
            </div>
            <h3 className="text-xl font-black text-gray-800 tracking-tight">NHỊP ĐẬP ELITE <span className="text-vnpost-blue">T-1</span></h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-8 px-8 border-x border-gray-100">
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Doanh thu</p>
            <p className="text-lg font-black text-gray-800">{new Intl.NumberFormat('vi-VN').format(stats.revenue)}đ</p>
            <p className={`text-[10px] font-black ${growthColor} mt-1 flex items-center justify-center gap-0.5`}>
              {stats.is_up ? <ArrowUpRight size={12} /> : <TrendingUp size={12} className="rotate-180" />}
              {stats.is_up ? '+' : ''}{stats.growth.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sản lượng</p>
            <p className="text-lg font-black text-gray-800">{stats.orders.toLocaleString()} <span className="text-xs text-gray-400">đơn</span></p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">⚠️ Nguy cơ</p>
            <p className="text-lg font-black text-red-600">{alerts.at_risk_count.toLocaleString()} <span className="text-xs text-red-400">KH</span></p>
          </div>
        </div>

        <button 
          onClick={handleDispatch}
          className="bg-vnpost-blue hover:bg-[#003E7E] text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-200 transition-all flex items-center gap-3 group/btn hover:scale-105 active:scale-95"
        >
          <Send size={20} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
          Dispatch to Zalo
        </button>
      </div>
    </div>
  );
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
  const [trendData, setTrendData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [moversData, setTopMovers] = useState({ summary: null, movers: { gainers: [], losers: [] }, period: null });
  const [coverage, setCoverage] = useState({ start: null, end: null, months: [] });
  
  const [comparisonType, setComparisonType] = useState('mom');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [waitingForDefaultDate, setWaitingForDefaultDate] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");

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
  const [customerScoring, setCustomerScoring] = useState([]);
  const [churnPrediction, setChurnPrediction] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
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
    fetcherWithParams
  );

  // 6. Monthly Trend Data (New)
  // 3. Trend Data
  const { data: trendDataRes, isValidating: loadingTrend } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/revenue-trend', queryParams] : null,
    fetcherWithParams
  );

  // 4. Heatmap Data
  const { data: heatmapDataRes, isValidating: loadingHeatmap } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/heatmap-units', queryParams] : null,
    fetcherWithParams
  );

  // 5. Movers Data
  const { data: moversDataRes, isValidating: loadingMovers } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/top-movers', queryParams] : null,
    fetcherWithParams
  );

  // 6. Monthly Trend Data (New)
  const { data: monthlyDataRes, isValidating: loadingMonthly } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/revenue-monthly', queryParams] : null,
    fetcherWithParams,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  // 7. Scoring & Prediction (Transitioned to SWR for Race Condition Protection)
  const { data: scoringDataRes } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/customer-scoring', queryParams] : null,
    fetcherWithParams
  );
  
  const { data: churnDataRes } = useSWR(
    !waitingForDefaultDate ? ['/api/analytics/churn-prediction', queryParams] : null,
    fetcherWithParams
  );
  
  const { data: healthDataRes } = useSWR(
    !waitingForDefaultDate ? '/api/analytics/system-health' : null,
    fetcher
  );

  // Sync state with SWR results
  useEffect(() => {
    if (summaryData) {
      setStats(summaryData.stats || {});
      setRevService(summaryData.services || []);
      setRevRegion(summaryData.regions || []);
    }
    if (trendDataRes) setTrendData(trendDataRes);
    if (heatmapDataRes) setHeatmapData(heatmapDataRes);
    if (moversDataRes) setTopMovers(moversDataRes);
    if (coverageData) setCoverage(coverageData);
    if (scoringDataRes) setCustomerScoring(scoringDataRes);
    if (churnDataRes) setChurnPrediction(churnDataRes);
    if (healthDataRes) setSystemHealth(healthDataRes);
  }, [summaryData, trendDataRes, heatmapDataRes, moversDataRes, coverageData, scoringDataRes, churnDataRes, healthDataRes, monthlyDataRes]);

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
    if (user?.scope && navStack[0].title === "Toàn tỉnh" && user.scope !== "Toàn tỉnh") {
      setNavStack([{ key: "", title: user.scope }]);
    }
  }, [user, navStack]);

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
    if (coverage?.latest_month?.value === monthStr) {
      end = coverage.latest_month.end;
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
      const opt = { margin: [0.3, 0.3], filename: `Bao-Cao-KHHH.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' } };
      html2pdf().set(opt).from(element).save().then(() => setIsExporting(false));
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
    <div className="flex bg-[#f1f5f9] min-h-screen">
      <div className={`flex-1 p-8 space-y-8 ${isExporting ? 'is-exporting' : ''} min-w-0 overflow-hidden`} ref={dashboardRef}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white px-8 py-6 rounded-[1.5rem] shadow-sm border border-gray-100 relative z-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-vnpost-blue rounded-lg flex items-center justify-center text-white shadow-lg">
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight leading-none">Command Center Analytics</h2>
              <div className="flex items-center gap-2 mt-1">
                {selectedNode ? (
                  <span className="text-[9px] bg-vnpost-orange text-white px-2 py-0.5 rounded-full font-black uppercase shadow-sm">VIEW: {selectedNode.title}</span>
                ) : (
                  <span className="text-[9px] bg-vnpost-blue/10 text-vnpost-blue px-2 py-0.5 rounded-full font-bold uppercase border border-vnpost-blue/10">
                    {user?.scope || "Toàn tỉnh"}
                  </span>
                )}
                <span className="text-[9px] text-gray-300 font-black uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">CRM 3.0 ELITE</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <div className={`logic-mode-badge ${selectedMonth ? 'mode-snapshot' : 'mode-realtime'} border shadow-sm`}>
               <div className={`w-1.5 h-1.5 rounded-full ${selectedMonth ? 'bg-slate-400' : 'bg-blue-500 animate-pulse'}`}></div>
               <span className="font-black">{selectedMonth ? `SN: ${selectedMonth}` : 'REALTIME'}</span>
             </div>
             <div className="h-6 w-[1px] bg-gray-100 mx-1"></div>
             <button onClick={() => window.location.reload()} className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue transition-all shadow-sm"><RefreshCw size={14} /></button>
             <button onClick={handleExportPDF} className="bg-vnpost-blue text-white px-4 py-1.5 rounded-lg font-black text-[10px] uppercase shadow-md flex items-center gap-2 hover:bg-[#003E7E] transition-all hover:scale-105 active:scale-95"><DownloadCloud size={14} /> EXPORT REPORT</button>
          </div>
        </div>
        {/* System Health Alert Banner */}
        {systemHealth?.has_alert && (
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center justify-between animate-pulse-slow border border-white/20">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/30"><AlertCircle size={24} /></div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest opacity-80 mb-0.5">Cảnh báo Sức khỏe Hệ thống (QA Detected)</p>
                <p className="text-sm font-bold leading-tight">{systemHealth.message}</p>
              </div>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-5 py-2 rounded-xl font-black text-[11px] transition-all uppercase backdrop-blur-md">Kiểm tra Master File</button>
          </div>
        )}

        {/* Elite Morning Pulse Widget */}
        <EliteMorningPulse report={botReport} loading={loadingBot} />

        {/* Compact Filters Section */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-2.5 border border-gray-100 shadow-sm flex flex-col lg:flex-row items-center gap-3 no-pdf relative z-50">
          <div className="flex-1 w-full flex items-center gap-3">
            <div className="relative flex-1">
                <button 
                  onClick={() => setIsTreeOpen(!isTreeOpen)}
                  className={`w-full bg-gray-50/50 border rounded-lg px-3 py-1.5 text-[11px] font-bold text-vnpost-blue flex justify-between items-center transition-all ${isTreeOpen ? 'ring-2 ring-vnpost-blue/20 border-vnpost-blue/30 bg-white' : 'border-gray-100 hover:bg-white'}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-vnpost-blue/50" />
                    <span className="truncate max-w-[150px]">{selectedNode ? selectedNode.title : (user?.scope || "Toàn tỉnh")}</span>
                  </div>
                  <ChevronRight size={14} className={`transition-transform duration-300 ${isTreeOpen ? 'rotate-90' : ''}`} />
                </button>

               {isTreeOpen && (
                 <>
                   <div className="fixed inset-0 z-10" onClick={() => setIsTreeOpen(false)}></div>
                   <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 z-20 max-h-[400px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                       <TreeExplorer onSelect={(node) => { handleNodeSelect(node); setIsTreeOpen(false); }} selectedNode={selectedNode} />
                   </div>
                 </>
               )}
            </div>

            <div className="flex items-center gap-2 bg-gray-50/50 border border-gray-100 rounded-lg px-2 py-1">
              <Calendar size={12} className="text-gray-400" />
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setSelectedMonth(""); }} className="bg-transparent border-none p-0 text-[11px] font-black text-vnpost-blue focus:ring-0 w-28" />
              <span className="text-gray-300 text-[10px]">→</span>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setSelectedMonth(""); }} className="bg-transparent border-none p-0 text-[11px] font-black text-vnpost-blue focus:ring-0 w-28" />
            </div>
          </div>

          <div className="w-full lg:w-auto flex items-center gap-2">
            <select className="bg-gray-50/50 border border-gray-100 rounded-lg px-3 py-1.5 text-[11px] font-black text-vnpost-blue cursor-pointer focus:ring-2 focus:ring-vnpost-blue/10 transition-all outline-none" value={selectedMonth} onChange={(e) => handleQuickMonth(e.target.value)}>
              <option value="">QUICK SELECT MONTH</option>
              {coverage.months?.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
            
            <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-lg border border-gray-100">
              <button onClick={() => setComparisonType('mom')} className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${comparisonType === 'mom' ? 'bg-vnpost-blue text-white shadow-sm' : 'text-gray-400 hover:bg-gray-200'}`}>MoM</button>
              <button onClick={() => setComparisonType('yoy')} className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${comparisonType === 'yoy' ? 'bg-vnpost-blue text-white shadow-sm' : 'text-gray-400 hover:bg-gray-200'}`}>YoY</button>
            </div>
          </div>
        </div>

        {/* SECTION: POPULATION (HIỆN TRẠNG) */}
        <div className="pop-grid">
          {/* Main Population Stats */}
          <div className="executive-card pop-card border-l-[6px] cursor-pointer" style={{ borderLeftColor: 'var(--crm-active-base)' }} onClick={() => navigate('/customers?lifecycle_status=active')}>
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <span className="kpi-label">ACTIVE CUSTOMERS</span>
                <Users size={24} className="opacity-10 text-slate-900" />
              </div>
              <div className="flex items-end justify-between">
                <span className="kpi-number text-slate-800">{(stats?.lifecycle?.["active"] || 0).toLocaleString()}</span>
                {stats.lifecycle_growth?.active !== undefined && (
                  <span className={`text-sm font-bold ${stats.lifecycle_growth.active >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stats.lifecycle_growth.active >= 0 ? "▲" : "▼"}{Math.abs(stats.lifecycle_growth.active)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="executive-card pop-card border-l-[6px] cursor-pointer" style={{ borderLeftColor: 'var(--crm-warning-base)' }} onClick={() => navigate('/customers?lifecycle_status=at_risk')}>
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <span className="kpi-label">AT RISK POPULATION</span>
                <AlertCircle size={24} className="opacity-10 text-slate-900" />
              </div>
              <div className="flex items-end justify-between">
                <span className="kpi-number text-slate-800">{(stats?.lifecycle?.["at_risk"] || 0).toLocaleString()}</span>
                {stats.lifecycle_growth?.at_risk !== undefined && (
                  <span className={`text-sm font-bold ${stats.lifecycle_growth.at_risk <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stats.lifecycle_growth.at_risk >= 0 ? "▲" : "▼"}{Math.abs(stats.lifecycle_growth.at_risk)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="executive-card pop-card border-l-[6px] cursor-pointer" style={{ borderLeftColor: 'var(--crm-danger-base)' }} onClick={() => navigate('/customers?lifecycle_status=churn_pop')}>
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <span className="kpi-label">CHURNED (60D+)</span>
                <UserMinus size={24} className="opacity-10 text-slate-900" />
              </div>
              <div className="flex items-end justify-between">
                <span className="kpi-number text-slate-800">{(stats?.lifecycle?.["churn_pop"] || 0).toLocaleString()}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase italic tracking-wider">&gt; 60D Inactive</span>
              </div>
            </div>
          </div>

          <div className="executive-card pop-card border-l-[6px] border-l-blue-600 bg-blue-50/5" onClick={() => navigate('/customers?rfm_segment=Kim Cương')}>
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <span className="kpi-label text-blue-700">DIAMOND ELITE</span>
                <Sparkles size={24} className="text-blue-400 opacity-20" />
              </div>
              <div className="flex items-end justify-between">
                <span className="kpi-number text-slate-900">{(stats.potential_ranks?.["Kim Cương"] || 0).toLocaleString()}</span>
                <span className="text-[10px] text-blue-500 font-bold uppercase">Elite Tier 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Movement & Sub-States Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 no-pdf executive-section-gap">
           {[
             { label: 'New Pop', key: 'new_pop', color: 'var(--crm-onboarding-base)', icon: Sparkles, path: 'new_pop' },
             { label: 'Recovered', key: 'recovered_pop', color: 'var(--crm-recovery-base)', icon: RefreshCw, path: 'recovered_pop' },
             { label: 'New Events', key: 'new_event', color: 'var(--crm-onboarding-base)', icon: Zap, path: 'new_event' },
             { label: 'Diamond', key: 'Gold', val: stats.potential_ranks?.["Vàng"], color: 'var(--crm-vnpost-orange)', icon: Target, path: 'Vàng' },
             { label: 'Silver', key: 'Silver', val: stats.potential_ranks?.["Bạc"], color: 'var(--crm-vnpost-blue)', icon: Shield, path: 'Bạc' }
           ].map((item, idx) => (
             <div key={idx} className="executive-card p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-all border-b-2" style={{ borderBottomColor: item.color }} onClick={() => navigate(`/customers?lifecycle_status=${item.path}`)}>
                <div className="flex items-center gap-3">
                   <item.icon size={16} style={{ color: item.color }} />
                   <div>
                     <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                     <p className="text-xl font-bold text-gray-800 leading-none">{(item.val !== undefined ? item.val : (stats?.lifecycle?.[item.key] || 0)).toLocaleString()}</p>
                   </div>
                </div>
                <ChevronRight size={14} className="text-gray-300" />
             </div>
           ))}
        </div>
        
        {/* STRATEGIC AI INSIGHTS (INTEGRATED) */}
        <AIAssistantInsights summary={moversData.summary} stats={stats} churnPrediction={churnPrediction} heatmapData={heatmapData} />

        {/* Global Footer Stats (Tables Zone) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-12 pb-20">
          {/* CUSTOMER CHURN LIST (LEFT) */}
          <div className="executive-card p-0 overflow-hidden min-w-0">
             <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h3 className="section-title flex items-center gap-3">
                   <Users size={20} className="text-rose-500" /> Cảnh báo Rời bỏ (At Risk)
                </h3>
                <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-bold border border-rose-100">QUAN TRỌNG</div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 text-[9px] uppercase font-black">
                    <tr>
                      <th className="px-6 py-3 text-left">Khách hàng</th>
                      <th className="px-6 py-3 text-right">Rủi ro</th>
                      <th className="px-6 py-3 text-right">Đơn cuối</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {churnPrediction?.slice(0, 8).map((p, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/30 transition-all cursor-pointer" onClick={() => setSelectedCustomer(p)}>
                        <td className="px-6 py-4">
                           <div className="font-bold text-gray-800 uppercase">{p.ten_kh}</div>
                           <div className="text-[9px] text-gray-400 font-bold">{p.ma_kh}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <span className="px-2 py-1 bg-red-100 text-red-600 rounded font-black text-[9px] uppercase">{p.risk_level}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-600">{p.last_active}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
          
          {/* CUSTOMER SCORING (RIGHT PANEL) */}
          <div className="executive-card p-0 overflow-hidden w-[320px] min-w-[320px]">
              <div className="p-8 border-b border-gray-100 bg-indigo-50/20">
                <h3 className="section-title flex items-center gap-3">
                   <Star size={20} className="text-indigo-600" /> Khách hàng Diamond
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {customerScoring?.length > 0 ? customerScoring.slice(0, 5).map((s, idx) => (
                  <div key={idx} className="flex flex-col p-5 border-b border-gray-50 last:border-0 hover:bg-indigo-50/50 transition-all rounded-2xl gap-3 cursor-pointer border border-transparent hover:border-indigo-100" onClick={() => setSelectedCustomer(s)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-lg shadow-indigo-200">
                          {s.score}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-gray-800 truncate uppercase">{s.ten_kh}</p>
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg font-bold uppercase">{s.rank}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                       <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Doanh thu</p>
                          <p className="text-sm font-bold text-gray-800">{formatCurrency(s.revenue)}</p>
                       </div>
                       <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tần suất</p>
                          <p className="text-sm font-bold text-gray-800">{s.frequency} đơn</p>
                       </div>
                    </div>
                  </div>
                )) : <div className="p-12 text-center text-gray-300 italic text-sm">Đang đồng bộ điểm số...</div>}
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




      {/* ELITE CUSTOMER PROFILE MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="relative p-8 bg-vnpost-blue text-white overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Users size={120} /></div>
              <button onClick={() => setSelectedCustomer(null)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              <div className="relative z-10">
                 <div className="flex items-center gap-2 flex-wrap">
                   <span className="text-[11px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">{selectedCustomer.rank || selectedCustomer.segment || 'Customer'}</span>
                   {/* [FIX-07] Enhanced Lifecycle badge */}
                   {selectedCustomer.risk_level && (<span className="text-[11px] font-black uppercase bg-red-600 text-white px-4 py-1.5 rounded-full shadow-lg border-2 border-white/20 animate-pulse">{selectedCustomer.risk_level.includes("CAO") ? "⚠️ NGUY CƠ CAO" : "🔔 THEO DÕI"}</span>)}
                   {selectedCustomer.score && !selectedCustomer.risk_level && (<span className="text-[11px] font-black uppercase bg-emerald-600 text-white px-4 py-1.5 rounded-full shadow-lg border-2 border-white/20">✅ KH ACTIVE</span>)}
                 </div>
                 <h2 className="text-2xl font-black mt-2 uppercase">{selectedCustomer.ten_kh}</h2>
                 <p className="text-blue-200 font-bold mt-1 tracking-widest">{selectedCustomer.ma_kh || selectedCustomer.ma_crm_cms}</p>
                 {/* RF2B-A2: Goi y tiep can */}
                 {selectedCustomer.risk_level ? (<p className="text-[11px] mt-2 bg-white/10 px-3 py-1.5 rounded-xl text-red-100 font-bold inline-block">Gợi ý: Ưu tiên giữ chân - {selectedCustomer.risk_level.includes("CAO") ? "trong 24h" : "tuần này"}</p>) : selectedCustomer.score ? (<p className="text-[11px] mt-2 bg-white/10 px-3 py-1.5 rounded-xl text-blue-100 font-bold inline-block">Gợi ý: Ưu tiên upsell EMS</p>) : null}
              </div>
            </div>
            
            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Metrics & Trend */}
              <div className="lg:col-span-2 space-y-6">
                 <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                       <p className="text-[11px] text-gray-400 font-black uppercase mb-1">Doanh thu kỳ này</p>
                       <p className="text-xl font-black text-gray-800">{formatCurrency(selectedCustomer.curr_rev || selectedCustomer.revenue)}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                       <p className="text-[11px] text-gray-400 font-black uppercase mb-1">Tần suất gửi</p>
                       <p className="text-xl font-black text-gray-800">{selectedCustomer.frequency || selectedCustomer.transaction_count || 'N/A'} đơn</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                       <p className="text-[11px] text-indigo-400 font-black uppercase mb-1">Điểm RFM</p>
                       <p className="text-xl font-black text-indigo-600">{selectedCustomer.score || 0}</p>
                    </div>
                 </div>

                 <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <TrendingUp size={14} className="text-vnpost-blue" /> Xu hướng 12 tháng gần nhất
                    </h5>
                    <div className="h-48 w-full">
                       {fullCustomerDetail?.trend ? (
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={fullCustomerDetail.trend}>
                               <defs>
                                  <linearGradient id="colorCustomer" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor="#0054A6" stopOpacity={0.1}/>
                                     <stop offset="95%" stopColor="#0054A6" stopOpacity={0}/>
                                  </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                               <XAxis dataKey="month" hide />
                               <YAxis hide />
                               <RechartsTooltip formatter={(v) => formatCurrency(v)} />
                               <Area type="monotone" dataKey="revenue" stroke="#0054A6" fill="url(#colorCustomer)" strokeWidth={3} dot={{r: 3}} />
                            </AreaChart>
                         </ResponsiveContainer>
                       ) : <div className="h-full flex items-center justify-center text-gray-300 italic text-[13px]">Đang tải xu hướng...</div>}
                    </div>
                 </div>
              </div>

              {/* Right Column: Service Mix & AI Insights */}
              <div className="space-y-6">
                 <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <BarChart3 size={14} className="text-vnpost-orange" /> Cơ cấu Dịch vụ
                    </h5>
                    <div className="space-y-3">
                       {fullCustomerDetail?.services?.slice(0, 4).map((s, i) => (
                         <div key={i}>
                            <div className="flex justify-between text-[11px] font-bold mb-1">
                               <span className="truncate">{s.name}</span>
                               <span>{((s.value / (fullCustomerDetail.customer.doanh_thu_luy_ke || 1)) * 100).toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                               <div className="bg-vnpost-orange h-full" style={{ width: `${(s.value / (fullCustomerDetail.customer.doanh_thu_luy_ke || 1)) * 100}%` }}></div>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                    <h5 className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Sparkles size={14} className="animate-pulse" /> AI Strategic Insights
                    </h5>
                    <p className="text-[13px] text-amber-900 font-medium leading-relaxed">
                       {selectedCustomer.detailed_reason ? (
                         <>Cảnh báo: <b>{selectedCustomer.detailed_reason}</b>. {selectedCustomer.risk_level.includes('CAO') ? 'Khách hàng có nguy cơ rời bỏ cao, cần liên hệ trực tiếp trong 24h tới.' : 'Cần theo dõi sát sao và gửi chương trình khuyến mãi mục tiêu.'}</>
                       ) : (
                         `Khách hàng ${selectedCustomer.ten_kh} đang là đối tác chiến lược với điểm RFM ấn tượng (${selectedCustomer.score}). Khuyến nghị: Duy trì chăm sóc VIP và đề xuất mở rộng dịch vụ Quốc tế.`
                       )}
                    </p>
                    <div className="mt-4 pt-4 border-t border-amber-200/50 flex justify-between items-center text-[11px] font-black text-amber-700 uppercase">
                       <span>Last Active:</span>
                       <span>{fullCustomerDetail?.last_active || '...'}</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-8 pt-0 flex justify-end gap-3">
               <button onClick={() => setSelectedCustomer(null)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold uppercase text-xs hover:bg-gray-200 transition-all">Đóng</button>
               <button className="px-6 py-3 bg-vnpost-blue text-white rounded-xl font-black uppercase text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                  <MapPin size={14} /> Giao việc cho Nhân sự
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
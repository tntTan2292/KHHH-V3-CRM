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
  Calendar, MapPin, TrendingUp, Info, UserPlus, X, BarChart3, Target, Sparkles, AlertCircle, RefreshCw, ArrowLeft, ChevronRight, Zap, Send
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

      <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-start">
        <div className={`p-2 rounded-xl shadow-inner ${
          type === 'positive' ? 'bg-emerald-100 text-emerald-600' :
          type === 'warning' ? 'bg-amber-100 text-amber-600 animate-pulse' :
          type === 'negative' ? 'bg-red-100 text-red-600 animate-bounce-slow' : 'bg-indigo-100 text-indigo-600'
        }`}>
          <Sparkles size={20} />
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <div className="text-[15px] font-black uppercase tracking-[0.2em] mb-2 opacity-60 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${type === 'negative' ? 'bg-red-500' : 'bg-current'}`}></div>
              Biệt đội Antigravity - Strategic Insights
            </div>
            <h4 className="text-xl font-black italic tracking-tight uppercase">
              {type === 'negative' ? 'CẢNH BÁO RỦI RO HỆ THỐNG' : 
               type === 'warning' ? 'LƯU Ý BIẾN ĐỘNG CƠ CẤU' : 
               type === 'positive' ? 'TÍN HIỆU TĂNG TRƯỞNG ELITE' : 'PHÂN TÍCH DIỄN BIẾN THỊ TRƯỜNG'}
            </h4>
          </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* [FIX-03] Actionable Operational Intelligence */}
            <div className="space-y-2 p-4 bg-white/50 rounded-2xl border border-white/60 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase border-b border-gray-200/40 pb-2 mb-2">
                <Target size={12} className="text-vnpost-blue" /> Trọng điểm vận hành
              </div>
              <ul className="space-y-1.5 text-[12px] font-bold text-gray-800 leading-tight">
                <li className="flex items-start gap-2">
                  <span className={`mt-0.5 ${revGrowth >= 0 ? "text-emerald-500" : "text-red-500"}`}>{revGrowth >= 0 ? "▲" : "▼"}</span>
                  <span>Doanh thu {revGrowth >= 0 ? "tăng" : "giảm"} <b>{Math.abs(revGrowth).toFixed(1)}%</b> — {revGrowth < 0 ? "Ưu tiên rà soát cụm yếu" : "Đà tăng trưởng ổn định"}</span>
                </li>
                {mainDriver && mainDriver.revChange > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-vnpost-blue">●</span>
                    <span>Động lực chính: <b className="text-vnpost-blue">{mainDriver.service}</b> (+{mainDriver.revChange.toFixed(1)}%)</span>
                  </li>
                )}
                {erosionServices.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-amber-500">⚠</span>
                    <span>Cảnh báo xói mòn: <b>{erosionServices.map(s => s.service).join(", ")}</b></span>
                  </li>
                )}
              </ul>
            </div>
            {/* [FIX-05] Executive Mini Widget Integrated */}
            <div className="space-y-2 p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black text-indigo-700 uppercase border-b border-indigo-200/40 pb-2 mb-2">
                <Sparkles size={12} /> Điều hành Nhanh
              </div>
              <ul className="space-y-1.5 text-[12px] font-bold text-gray-800 leading-tight">
                <li className="flex items-center gap-2"><span className="text-red-500">●</span><span><b>{churnPrediction?.filter(p => p.risk_level?.includes("CAO")).length || churnPrediction?.length || 0}</b> KH nguy cơ cao cần xử lý</span></li>
                <li className="flex items-center gap-2"><span className="text-amber-500">●</span><span><b>{heatmapData?.filter(h => Number(h.growth) < -10).length || 0}</b> địa bàn tăng trưởng âm mạnh</span></li>
                <li className="flex items-center gap-2"><span className="text-emerald-500">●</span><span>Tệp KH hiện hữu: <b>{(stats?.lifecycle?.active || 0).toLocaleString()}</b> KH active</span></li>
              </ul>
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
    <div className="flex bg-gray-50/50 min-h-screen">
      <div className={`flex-1 p-4 md:p-6 space-y-3 ${isExporting ? 'is-exporting' : ''}`} ref={dashboardRef}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 relative z-50">
          <div>
            <h2 className="text-xl font-black text-vnpost-blue uppercase tracking-tight">CRM 3.0 Dashboard</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {selectedNode ? (
                <span className="text-[10px] bg-vnpost-orange text-white px-2 py-0.5 rounded-full font-black uppercase shadow-sm">Đang soi: {selectedNode.title}</span>
              ) : (
                <span className="text-[10px] bg-vnpost-blue/10 text-vnpost-blue px-2 py-0.5 rounded-full font-bold uppercase border border-vnpost-blue/10">
                  {user?.scope || "Toàn tỉnh"}
                </span>
              )}
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-100 px-1.5 py-0.5 rounded">Elite</span>
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
                      <TreeExplorer 
                        onSelect={(node) => {
                          handleNodeSelect(node);
                          setIsTreeOpen(false); // Close after selection
                        }} 
                        selectedNode={selectedNode} 
                      />
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
              {coverage.months?.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100">
            <button onClick={() => setComparisonType('mom')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap ${comparisonType === 'mom' ? 'bg-vnpost-blue text-white shadow-lg' : 'text-gray-400 hover:bg-gray-200'}`}>MoM</button>
            <button onClick={() => setComparisonType('yoy')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap ${comparisonType === 'yoy' ? 'bg-vnpost-blue text-white shadow-lg' : 'text-gray-400 hover:bg-gray-200'}`}>YoY</button>
          </div>
        </div>

        {/* SECTION: POPULATION (HIỆN TRẠNG) - TOP PRIORITY */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-vnpost-blue uppercase tracking-[0.2em] flex items-center gap-2">
              <Users size={14} /> 01. HIỆN TRẠNG TỆP KHÁCH HÀNG (POPULATION)
            </h3>
            <Link to="/guidelines#lifecycle" className="text-[9px] font-black text-vnpost-orange uppercase hover:underline">Định nghĩa</Link>
          </div>
          
          {/* Row 1: Priority States */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(!summaryData && !stats.lifecycle?.["active"]) ? (
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
                    {stats.lifecycle_growth?.active !== undefined && (
                      <div className={`text-xs font-black flex items-center gap-1 mt-2 ${stats.lifecycle_growth.active >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stats.lifecycle_growth.active >= 0 ? "▲" : "▼"} {Math.abs(stats.lifecycle_growth.active)}%
                        <span className="text-gray-400 opacity-60 ml-0.5 uppercase font-bold text-[10px]">vs T-1</span>
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
                    {stats.lifecycle_growth?.at_risk !== undefined && (
                      <div className={`text-xs font-black flex items-center gap-1 mt-2 ${stats.lifecycle_growth.at_risk <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stats.lifecycle_growth.at_risk >= 0 ? "▲" : "▼"} {Math.abs(stats.lifecycle_growth.at_risk)}%
                        <span className="text-gray-400 opacity-60 ml-0.5 uppercase font-bold text-[10px]">vs T-1</span>
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
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-2 italic">Dừng giao dịch &gt; 60 ngày</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Row 2: Challenge/Onboarding States */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full lg:w-2/3">
            {(!summaryData && !stats.lifecycle?.["new_pop"]) ? (
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
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-2 italic">Tệp đang thử thách (30d)</div>
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
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-2 italic">Tệp quay lại đang thử thách</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SECTION: EVENTS (BIẾN ĐỘNG TRONG KỲ) - SECONDARY PRIORITY */}
        <div className="space-y-3 pt-2">
          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
            <Zap size={14} /> 02. BIẾN ĐỘNG TRONG KỲ (MOVEMENT INDICATORS)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(!summaryData && !stats.lifecycle?.["new_event"]) ? (
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
            
            {/* ELITE TIERS (Potentials) */}
            <h3 className="text-[11px] font-black text-vnpost-orange uppercase tracking-widest flex items-center gap-2 mt-2 mb-2">
              <ArrowUpRight size={14} /> 03. PHÂN HẠNG KHÁCH HÀNG TIỀM NĂNG (POTENTIALS)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity duration-300">
              {(!summaryData && !stats.potential_ranks?.["Kim Cương"]) ? (
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
                    <h3 className="kpi-number text-4xl text-blue-900">{(stats.potential_ranks?.["Kim Cương"] || 0).toLocaleString()}</h3>
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
                    <h3 className="kpi-number text-4xl text-vnpost-orange">{(stats.potential_ranks?.["Vàng"] || 0).toLocaleString()}</h3>
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
                    <h3 className="kpi-number text-4xl text-orange-950">{(stats.potential_ranks?.["Bạc"] || 0).toLocaleString()}</h3>
                    <p className="text-[10px] text-orange-900 font-bold mt-4 uppercase tracking-wider opacity-60">DT &gt; 500K & &gt; 5 đơn/tháng</p>
                  </div>
                </>
              )}
            </div>
          
            <div className="card flex flex-col items-center justify-center p-6 bg-white/40 shadow-sm border border-white/60">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Cơ cấu Vòng đời</h4>
              <div className="h-48 w-full flex items-center justify-center">
                {stats.lifecycle && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: 'Active', value: stats.lifecycle?.["active"] || 0 }, 
                        { name: 'New', value: stats.lifecycle?.["new_pop"] || 0 }, 
                        { name: 'Recovered', value: stats.lifecycle?.["recovered_pop"] || 0 }, 
                        { name: 'At Risk', value: stats.lifecycle?.["at_risk"] || 0 }, 
                        { name: 'Churned', value: stats.lifecycle?.["churn_pop"] || 0 }
                      ]} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                        <Cell fill="#0054A6" /><Cell fill="#6366f1" /><Cell fill="#10b981" /><Cell fill="#F9A51A" /><Cell fill="#9ca3af" />
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-4 space-y-1 w-full text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
                <div className="flex justify-between"><span>Active:</span> <span>{(stats.lifecycle?.["active"] || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>At Risk:</span> <span className="text-vnpost-orange">{(stats.lifecycle?.["at_risk"] || 0).toLocaleString()}</span></div>
              </div>
            </div>

      {/* Heatmap & Trends */}
        <div className="grid grid-cols-1 gap-6">
          <div className="card p-6 overflow-hidden relative z-10 min-w-0">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-50 pb-3">
              <TrendingUp size={18} className="text-vnpost-blue" /> Biến Động Doanh Thu Theo Ngày
            </h3>
            <div className="h-[300px] w-full">
              {loadingTrend && !trendData.length ? (
                <Skeleton.Chart height="h-80" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
             <h3 className="text-sm font-bold text-gray-800 mb-2 flex justify-between items-center border-b border-gray-50 pb-2">
               <span className="flex items-center gap-2"><Target size={18} className="text-vnpost-orange" /> Bảng Quản trị Hiệu quả & Tăng trưởng Địa bàn ({comparisonType.toUpperCase()})</span> {selectedNode && <span className="text-[11px] font-bold text-gray-400 ml-2 normal-case tracking-normal">(Đang xem: {selectedNode.title})</span>}
               <span className="text-[11px] font-black bg-vnpost-orange/10 text-vnpost-orange px-2 py-1 rounded-full uppercase tracking-widest">PHÂN LOẠI CHIẾN LƯỢC 4 NHÓM</span>
             </h3>
              <div className="flex-1 w-full relative">
                {loadingHeatmap && !heatmapData.length ? (
                  <Skeleton.Table rows={8} />
                ) : heatmapData && heatmapData.length > 0 ? (() => {
                   try {
                     const rawData = Array.isArray(heatmapData) ? heatmapData : [];
                     const data = rawData.map(h => ({
                       ...h,
                       revenue: Number(h?.revenue) || 0,
                       growth: Number(h?.growth) || 0
                     }));
                     
                     const avgRev = data.reduce((acc, curr) => acc + curr.revenue, 0) / data.length;

                     const getQuadrant = (rev, growth) => {
                        if (rev >= avgRev && growth >= 0) return { label: "NGÔI SAO", color: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-50", icon: <Sparkles size={12}/> };
                        if (rev >= avgRev && growth < 0) return { label: "BÒ SỮA", color: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-50", icon: <Target size={12}/> };
                        if (rev < avgRev && growth >= 0) return { label: "TRIỂN VỌNG", color: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-50", icon: <TrendingUp size={12}/> };
                        return { label: "YẾU KÉM", color: "bg-red-500", text: "text-red-500", bg: "bg-red-50", icon: <AlertCircle size={12}/> };
                     };

                     return (
                        <div className={`h-full flex flex-col ${isFullScreen ? 'fixed inset-0 z-[9999] bg-white p-10 w-screen h-screen left-0 top-0 overflow-y-auto' : ''}`}>
                          <div className="absolute top-[-45px] left-0 z-50 flex items-center gap-2 max-w-[70%]">
                             {navStack.length > 1 && (
                               <button 
                                 onClick={handleGoBack}
                                 className="p-1.5 bg-vnpost-blue text-white rounded-xl shadow-lg hover:scale-110 transition-all flex-shrink-0"
                               >
                                 <ArrowLeft size={14}/>
                               </button>
                             )}
                             <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
                               {navStack.map((step, idx) => (
                                 <React.Fragment key={step.key || 'root'}>
                                   {idx > 0 && <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />}
                                   <button 
                                      onClick={() => {
                                        const newStack = navStack.slice(0, idx + 1);
                                        setNavStack(newStack);
                                        setSelectedNode(step.key === "" ? null : step);
                                      }}
                                      className={`text-[10px] font-black uppercase whitespace-nowrap px-2 py-1 rounded-lg transition-all ${
                                        idx === navStack.length - 1 
                                        ? 'bg-vnpost-orange/10 text-vnpost-orange' 
                                        : 'text-gray-400 hover:text-vnpost-blue hover:bg-gray-50'
                                      }`}
                                   >
                                     {step.title}
                                   </button>
                                 </React.Fragment>
                               ))}
                             </div>
                          </div>

                          <div className="absolute top-[-45px] right-0 z-50 flex gap-2">
                             <button 
                               onClick={() => setIsFullScreen(!isFullScreen)}
                               className="p-1.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-vnpost-blue shadow-sm transition-all"
                             >
                               {isFullScreen ? <X size={16} /> : <ArrowUpRight size={16} />}
                             </button>
                          </div>

                          <div className="flex-1 overflow-y-auto no-scrollbar rounded-2xl border border-gray-100 bg-gray-50/30 backdrop-blur-sm">
                            <table className="w-full text-left border-collapse">
                              <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10">
                                <tr className="border-b border-gray-100">
                                  <th className="p-2.5 text-[11px] font-black text-gray-500 uppercase tracking-widest">Đơn vị địa bàn</th>
                                  <th className="p-2.5 text-[11px] font-black text-gray-500 uppercase tracking-widest text-right">Doanh thu</th>
                                  <th className="p-2.5 text-[11px] font-black text-gray-500 uppercase tracking-widest text-center">Tăng trưởng</th>
                                  <th className="p-2.5 text-[11px] font-black text-gray-500 uppercase tracking-widest text-center">Chiến lược</th>
                                  <th className="p-2.5 text-[11px] font-black text-gray-500 uppercase tracking-widest text-right">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.sort((a, b) => b.revenue - a.revenue).map((item, idx) => {
                                  const q = getQuadrant(item.revenue, item.growth);
                                  // [FIX-02] Higher contrast severity highlight
                                  const _isWeak = q.label.includes("YEU") || q.label.includes("YẾU");
                                  const _isRisk = item.growth < -10;
                                  return (
                                    <tr key={idx} className={`group hover:bg-white transition-all border-b border-gray-50/50 ${_isWeak ? "border-l-4 border-l-red-600 bg-red-50/40" : _isRisk ? "border-l-4 border-l-amber-500 bg-amber-50/20" : ""}`}>
                                      <td className="p-2.5">
                                        <div 
                                          className="flex flex-col cursor-pointer hover:opacity-80 transition-all group/item"
                                          onClick={() => {
                                            const q = getQuadrant(item.revenue, item.growth);
                                            const _isWeak = q.label.includes("YEU") || q.label.includes("YẾU");
                                            const _isRisk = item.growth < -10;
                                            
                                            const node = { key: item.ma_don_vi, title: item.don_vi, type: item.type };
                                            saveNavigationContext(node);
                                            
                                            let url = `/customers?node_code=${item.ma_don_vi}&node_type=${item.type || ''}&node_title=${encodeURIComponent(item.don_vi)}`;
                                            if (_isWeak || _isRisk) {
                                              url += `&lifecycle_status=at_risk`;
                                            }
                                            navigate(url);
                                          }}
                                          title="Mở danh sách khách hàng của địa bàn này"
                                        >
                                          <span className="text-[14px] font-black text-gray-800 group-hover:text-vnpost-blue transition-colors uppercase tracking-tight flex items-center gap-2">
                                            {item.don_vi}
                                            <ArrowUpRight size={12} className="opacity-0 group-hover/item:opacity-100 transition-all text-vnpost-blue" />
                                          </span>
                                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">ID: {item.ma_don_vi}</span>
                                        </div>
                                      </td>
                                      <td className="p-2.5 text-right">
                                        <span className="text-[14px] font-black text-gray-800">{formatCurrency(item.revenue)}</span>
                                      </td>
                                      <td className="p-2.5">
                                        <div className={`flex items-center justify-center gap-1 font-black text-[12px] ${item.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                          {item.growth >= 0 ? <ArrowUpRight size={12}/> : <TrendingUp size={12} className="rotate-180"/>}
                                          {item.growth > 0 ? '+' : ''}{item.growth}%
                                        </div>
                                      </td>
                                      <td className="p-2.5">
                                        <div className="flex justify-center">
                                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${q.bg} ${q.text} text-[9px] font-black border ${q.color.replace('bg-', 'border-')}/20 shadow-sm uppercase tracking-widest`}>
                                            {q.icon} {q.label}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-2.5 text-right">
                                        <button 
                                          onClick={() => handleDrillDown(item)}
                                          className="p-1.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue hover:bg-vnpost-blue/5 shadow-sm transition-all inline-flex items-center gap-2 group/btn"
                                        >
                                          <span className="text-[8px] font-black uppercase opacity-0 group-hover/btn:opacity-100 transition-all">Chi tiết</span>
                                          <TrendingUp size={12} className="rotate-90"/>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="sticky bottom-0 bg-gray-50/90 backdrop-blur-md z-10 border-t-2 border-vnpost-blue/10">
                                {(() => {
                                  const totalRev = data.reduce((acc, curr) => acc + curr.revenue, 0);
                                  const totalPrevRev = data.reduce((acc, curr) => acc + (curr.previous_revenue || 0), 0);
                                  const totalGrowth = totalPrevRev > 0 ? ((totalRev - totalPrevRev) / totalPrevRev * 100) : 0;
                                  
                                  return (
                                    <tr className="bg-vnpost-blue/5">
                                      <td className="p-2.5">
                                        <div className="flex flex-col">
                                          <span className="text-[14px] font-black text-vnpost-blue uppercase tracking-tight">TỔNG CỘNG ĐỊA BÀN</span>
                                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{data.length} đơn vị con</span>
                                        </div>
                                      </td>
                                      <td className="p-2.5 text-right">
                                        <span className="text-[16px] font-black text-vnpost-blue">{formatCurrency(totalRev)}</span>
                                      </td>
                                      <td className="p-2.5">
                                        <div className={`flex items-center justify-center gap-1 font-black text-[14px] ${totalGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                          {totalGrowth >= 0 ? <ArrowUpRight size={14}/> : <TrendingUp size={14} className="rotate-180"/>}
                                          {totalGrowth > 0 ? '+' : ''}{totalGrowth.toFixed(1)}%
                                        </div>
                                      </td>
                                      <td colSpan="2" className="p-4 text-center">
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/50 py-2 rounded-xl border border-gray-100 italic">
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
             <div className="grid grid-cols-4 gap-4 mt-6">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 transition-all duration-300 transform hover:scale-110 hover:shadow-2xl hover:z-50 cursor-default group">
                   <p className="text-[16px] font-black text-emerald-700 uppercase mb-2 flex items-center gap-2">⭐ NGÔI SAO</p>
                   <p className="text-[13px] text-emerald-800 leading-relaxed font-bold opacity-80 group-hover:opacity-100">Quy mô lớn & Tăng trưởng tốt. Cần duy trì & khen thưởng.</p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 transition-all duration-300 transform hover:scale-110 hover:shadow-2xl hover:z-50 cursor-default group">
                   <p className="text-[16px] font-black text-blue-700 uppercase mb-2 flex items-center gap-2">🚀 TRIỂN VỌNG</p>
                   <p className="text-[13px] text-blue-800 leading-relaxed font-bold opacity-80 group-hover:opacity-100">Quy mô nhỏ nhưng tăng trưởng nhanh. Cần đầu tư thêm.</p>
                </div>
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-100 transition-all duration-300 transform hover:scale-110 hover:shadow-2xl hover:z-50 cursor-default group">
                   <p className="text-[16px] font-black text-orange-700 uppercase mb-2 flex items-center gap-2">🐄 BÒ SỮA</p>
                   <p className="text-[13px] text-orange-800 leading-relaxed font-bold opacity-80 group-hover:opacity-100">Quy mô lớn nhưng tăng trưởng âm. Cần cải tổ quy trình.</p>
                </div>
                <div className="p-4 rounded-2xl bg-red-50 border border-red-100 transition-all duration-300 transform hover:scale-110 hover:shadow-2xl hover:z-50 cursor-default group">
                   <p className="text-[16px] font-black text-red-700 uppercase mb-2 flex items-center gap-2">⚠️ YẾU KÉM</p>
                   <p className="text-[13px] text-red-800 leading-relaxed font-bold opacity-80 group-hover:opacity-100">Cả quy mô và tăng trưởng đều thấp. Cần thay đổi quản lý.</p>
                </div>
             </div>
          </div>
        </div>

        {/* Biến Động Doanh Thu & Tăng Trưởng MoM */}
        <div className="card p-4 !col-span-full">
          <div className="h-[200px] w-full">
            {(() => {
              if (!monthlyDataRes || monthlyDataRes.length === 0) {
                return (
                  <div className="flex flex-col h-full">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 flex justify-between items-center border-b border-gray-50 pb-2">
                      <span className="flex items-center gap-2"><BarChart3 size={14} className="text-vnpost-orange" /> Hiệu Suất & Tốc Độ Tăng Trưởng</span>
                    </h3>
                    <div className="flex-1 flex items-center justify-center text-gray-300 italic text-xs uppercase font-black tracking-widest animate-pulse">Đang nạp dữ liệu xu hướng tháng...</div>
                  </div>
                );
              }
              
              console.log("[DEBUG CHART] API raw data:", monthlyDataRes);
              console.log("[DEBUG CHART] API months:", monthlyDataRes.map(x => x.month));
              console.log("[DEBUG CHART] API length:", monthlyDataRes.length);

              const chartDataRaw = monthlyDataRes.slice(-14).map((d, i, arr) => {
                const curr = d.total || d.value || 0;
                if (i === 0) return { ...d, total: curr, growth: 0 };
                const prev = arr[i-1].total || arr[i-1].value || 1;
                
                // [GOVERNANCE] Use backend-calculated LfL growth for partial months if available
                const growth = (d.growth_lfl !== null && d.growth_lfl !== undefined && d.growth_lfl !== 0) 
                  ? d.growth_lfl 
                  : ((curr - prev) / prev) * 100;
                  
                return { ...d, total: curr, growth: isFinite(growth) ? parseFloat(growth.toFixed(1)) : 0 };
              });
              
              const chartData = chartDataRaw.length > 1 ? chartDataRaw.slice(1) : chartDataRaw;
              
              console.log("[DEBUG CHART] Chart months rendered:", chartData.map(x => x.month));
              console.log("[DEBUG CHART] Chart length rendered:", chartData.length);

              return (
                <div className="flex flex-col h-full">
                  <h3 className="text-xs font-bold text-gray-800 mb-2 flex justify-between items-center border-b border-gray-50 pb-2">
                    <span className="flex items-center gap-2">
                      <BarChart3 size={14} className="text-vnpost-orange" /> 
                      Hiệu Suất & Tốc Độ Tăng Trưởng 
                    </span>
                    <div className="flex gap-3">
                       <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-vnpost-orange rounded-sm"></div> <span className="text-[11px] font-bold text-gray-500 uppercase">Doanh thu</span></div>
                       <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-blue-500"></div> <span className="text-[11px] font-bold text-gray-500 uppercase">Tăng trưởng (%)</span></div>
                    </div>
                  </h3>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
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
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#3b82f6', fontWeight: 'bold' }} tickFormatter={(val) => `${val}%`} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                          formatter={(val, name) => [name === 'growth' ? `${val}%` : formatCurrency(val), name === 'growth' ? 'Tăng trưởng' : 'Doanh thu']} 
                        />
                        <Bar yAxisId="left" dataKey="total" name="revenue" fill="#F9A51A" radius={[4, 4, 0, 0]} barSize={40} />
                        <Line yAxisId="right" type="monotone" dataKey="growth" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
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
              <AIAssistantInsights summary={moversData.summary} stats={stats} churnPrediction={churnPrediction} heatmapData={heatmapData} />
              
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
              <div className="p-4 space-y-3">
                {churnPrediction?.length > 0 ? churnPrediction.slice(0, 5).map((p, idx) => (
                  <div key={idx} className="flex flex-col p-4 border-b border-gray-50 last:border-0 hover:bg-red-50 transition-all rounded-xl gap-2 cursor-pointer" onClick={() => setSelectedCustomer(p)}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[12px] font-black text-gray-800 truncate uppercase">{p.ten_kh}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[8px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold uppercase">{p.ma_kh}</span>
                           <span className="text-[8px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">{p.segment}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-red-600 block">-{p.drop_pct}%</span>
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${p.risk_level.includes('CAO') ? 'text-red-600' : 'text-amber-600'}`}>
                           {p.risk_level}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                       <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                          <p className="text-[8px] text-gray-400 font-bold uppercase mb-1">Vắng mặt</p>
                          <p className="text-xs font-black text-gray-700">{p.days_inactive} ngày</p>
                       </div>
                       <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                          <p className="text-[8px] text-gray-400 font-bold uppercase mb-1">Đơn cuối</p>
                          <p className="text-xs font-black text-gray-700">{p.last_active}</p>
                       </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] mt-1 text-gray-500 font-bold italic">
                       <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1">
                          <AlertCircle size={10} /> {p.detailed_reason}
                       </span>
                    </div>
                    <div className="flex items-center justify-between text-[8px] mt-1 text-gray-400 font-bold">
                       <span>Kỳ này: {formatCurrency(p.curr_rev)}</span>
                       <span>Kỳ trước: {formatCurrency(p.prev_rev)}</span>
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
              <div className="p-4 space-y-3">
                {customerScoring?.length > 0 ? customerScoring.slice(0, 5).map((s, idx) => (
                  <div key={idx} className="flex flex-col p-4 border-b border-gray-50 last:border-0 hover:bg-indigo-50 transition-all rounded-xl gap-2 cursor-pointer" onClick={() => setSelectedCustomer(s)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 font-black text-indigo-700 text-sm shadow-inner">
                          {s.score}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-black text-gray-800 truncate uppercase">{s.ten_kh}</p>
                          <span className="text-[8px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded font-bold uppercase">{s.rank}</span>
                        </div>
                      </div>
                      <div className="text-right">
                         <TrendingUp size={14} className="text-green-500 ml-auto" />
                      </div>
                    </div>
                    
                    {/* Bố trí dạng Box để khớp chiều cao với bảng Churn */}
                    <div className="grid grid-cols-2 gap-2 mt-1">
                       <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                          <p className="text-[8px] text-gray-400 font-bold uppercase mb-1">Doanh thu</p>
                          <p className="text-xs font-black text-gray-700">{formatCurrency(s.revenue)}</p>
                       </div>
                       <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                          <p className="text-[8px] text-gray-400 font-bold uppercase mb-1">Tần suất</p>
                          <p className="text-xs font-black text-gray-700">{s.frequency} đơn</p>
                       </div>
                    </div>

                    <div className="flex items-center justify-between text-[9px] mt-1 text-indigo-600 font-bold italic">
                       <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                          <Target size={10} /> Chiến lược: Duy trì & Upsell
                       </span>
                    </div>
                    <div className="flex items-center justify-between text-[8px] mt-1 text-gray-400 font-bold">
                       <span>Mã KH: {s.ma_kh}</span>
                       <span>Cập nhật: {s.last_active}</span>
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
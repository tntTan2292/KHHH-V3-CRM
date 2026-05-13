import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveNavigationContext, getNavigationContext, syncUrlWithContext, getContextFromUrl, getDateContext, saveDateContext } from '../utils/navigationMemory';
import api from '../utils/api';
import { Search, Filter, Download, Download as DownloadX, TableProperties, AlertCircle, X, ChevronRight, ChevronLeft, Calendar, TrendingUp, ArrowUpDown, ChevronUp, ChevronDown, RefreshCw, CloudDownload, CheckCircle2, History, Star, Users, Briefcase, Zap, LogOut, UserPlus, UserMinus, Award, Activity, MapPin, ArrowUpRight, Save, AlertTriangle, Phone, FileText, Edit, Check, UploadCloud, Send, Settings, MessageCircle, Sparkles, Info } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import TreeExplorer from '../components/TreeExplorer';
import CustomerHistoryModal from '../components/CustomerHistoryModal';
import Skeleton from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const COLORS = ['#F9A51A', '#0054A6', '#003E7E', '#22C55E', '#9CA3AF'];

// RF5B-HOTFIX-2: Global Helper Functions for Safety & Performance
const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
};

const getRankBadge = (segment) => {
  if (!segment) return <span className="px-2 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-black uppercase border border-gray-100">Chưa xếp hạng</span>;
  
  const ranks = {
    'Kim Cương': { color: 'text-blue-700 bg-blue-50 border-blue-200', icon: '💎' },
    'Vàng': { color: 'text-amber-700 bg-amber-50 border-amber-200', icon: '🏆' },
    'Bạc': { color: 'text-slate-600 bg-slate-100 border-slate-200', icon: '🥈' },
    'Tiềm Năng': { color: 'text-indigo-600 bg-indigo-50 border-indigo-100', icon: '✨' },
    'Thường': { color: 'text-gray-500 bg-gray-50 border-gray-100', icon: '👤' }
  };

  const rank = ranks[segment] || ranks['Thường'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black uppercase border shadow-sm ${rank.color}`}>
      <span>{rank.icon}</span>
      {segment}
    </span>
  );
};

const lifecycleConfig = [
  { 
    label: "Tất cả khách hàng", 
    value: "", 
    icon: Users, 
    color: "blue",
    category: "General",
    gradient: "from-blue-600 to-indigo-700",
    accent: "#0054A6",
    bgLight: "bg-blue-50/80",
    borderCol: "border-indigo-600"
  },
  { 
    label: "Hiện hữu", 
    value: "active", 
    icon: CheckCircle2, 
    color: "green",
    category: "Snapshot",
    gradient: "from-green-500 to-green-700",
    accent: "#22C55E",
    bgLight: "bg-green-50/80",
    borderCol: "border-green-500"
  },
  { 
    label: "Nguy cơ", 
    value: "at_risk", 
    icon: AlertCircle, 
    color: "orange",
    category: "Snapshot",
    gradient: "from-orange-400 to-orange-600",
    accent: "#F97316",
    bgLight: "bg-orange-50/80",
    borderCol: "border-orange-500"
  },
  { 
    label: "Mới trong kỳ", 
    value: "new_event", 
    icon: Star, 
    color: "sky",
    category: "Transition",
    gradient: "from-sky-500 to-blue-700",
    accent: "#0EA5E9",
    bgLight: "bg-sky-50/80",
    borderCol: "border-sky-500"
  },
  { 
    label: "Mới (Lũy kế)", 
    value: "new_pop", 
    icon: Sparkles, 
    color: "indigo",
    category: "Probationary",
    gradient: "from-indigo-400 to-indigo-600",
    accent: "#818CF8",
    bgLight: "bg-indigo-50/80",
    borderCol: "border-indigo-400"
  },
  { 
    label: "Tái bản trong kỳ", 
    value: "recovered_event", 
    icon: RefreshCw, 
    color: "emerald",
    category: "Transition",
    gradient: "from-emerald-500 to-emerald-800",
    accent: "#10B981",
    bgLight: "bg-emerald-50/80",
    borderCol: "border-emerald-500"
  },
  { 
    label: "Tái bản (Lũy kế)", 
    value: "recovered_pop", 
    icon: Activity, 
    color: "emerald",
    category: "Probationary",
    gradient: "from-emerald-400 to-emerald-600",
    accent: "#34D399",
    bgLight: "bg-emerald-50/80",
    borderCol: "border-emerald-400"
  },
  { 
    label: "Rời bỏ trong kỳ", 
    value: "churn_event", 
    icon: UserMinus, 
    color: "rose",
    category: "Transition",
    gradient: "from-rose-500 to-rose-700",
    accent: "#E11D48",
    bgLight: "bg-rose-50/80",
    borderCol: "border-rose-500"
  },
  { 
    label: "Rời bỏ (Lũy kế)", 
    value: "churn_pop", 
    icon: History, 
    color: "slate",
    category: "Historical",
    gradient: "from-slate-500 to-slate-700",
    accent: "#64748B",
    bgLight: "bg-slate-50/80",
    borderCol: "border-slate-500"
  }
];

// RF5B: Memoized Customer Row for Performance
const CustomerRow = React.memo(({ c, handleRowClick, handleHistoryModal, formatCurrency, getRankBadge, lifecycleConfig }) => {
  return (
    <tr onClick={() => handleRowClick(c?.ma_crm_cms)} className="group transition-all duration-300 cursor-pointer hover:bg-indigo-50/30">
      <td className="p-2 relative">
        <span className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded-md bg-blue-50 text-vnpost-blue">
          {c?.ma_crm_cms}
        </span>
        
        {/* RF4A: Ghost Action Cluster */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-none group-hover:pointer-events-auto">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              window.open(`tel:${c?.dien_thoai || ''}`, '_self');
            }}
            className="w-8 h-8 rounded-full bg-vnpost-blue text-white flex items-center justify-center shadow-lg hover:scale-110 transition-all"
            title="Gọi điện ngay"
          >
            <Phone size={14} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleHistoryModal(c);
            }}
            className="w-8 h-8 rounded-full bg-vnpost-orange text-white flex items-center justify-center shadow-lg hover:scale-110 transition-all"
            title="Ghi chú nhanh"
          >
            <FileText size={14} />
          </button>
        </div>
      </td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 group-hover:text-vnpost-blue transition-colors text-[13px]">{c?.ten_kh}</span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleHistoryModal(c);
            }}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-vnpost-blue transition-colors"
            title="Xem lịch sử tiếp cận"
          >
            <History size={12} />
          </button>
        </div>
      </td>
      <td className="p-2">
         {(() => {
           const status = lifecycleConfig.find(l => l.value === c?.status_type) || lifecycleConfig[0];
           return (
             <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-black uppercase border shadow-sm ${status.colorClass} ${status.bgClass} ${status.textClass}`}>
               <status.icon size={12} className={(c?.status_type === 'new' || c?.status_type === 'new_event') ? 'animate-bounce' : ''} />
               {(() => {
                 if (c?.status_type === 'active') return 'Hiện hữu';
                 if (c?.status_type === 'new' || c?.status_type === 'new_event' || c?.status_type === 'new_pop') return 'Mới';
                 if (c?.status_type === 'recovered' || c?.status_type === 'recovered_event' || c?.status_type === 'recovered_pop') return 'Tái bản';
                 if (c?.status_type === 'at_risk') return 'Nguy cơ';
                 if (c?.status_type === 'churned' || c?.status_type === 'churn_event' || c?.status_type === 'churn_pop') return 'Rời bỏ';
                 return c?.status_type;
               })()}
             </span>
           );
         })()}
      </td>
      <td className="p-2">
        {getRankBadge(c?.rfm_segment)}
      </td>
      <td className="p-2 text-right">
        <span className="font-bold text-gray-700 text-[13px]">{c?.transaction_count} đơn</span>
      </td>
      <td className="p-2 text-right">
        <div className="flex flex-col items-end">
          <span className={`font-black text-[13px] ${(Number(c?.dynamic_revenue) || 0) > 1000000 ? 'text-vnpost-blue' : 'text-gray-700'}`}>
            {formatCurrency(Number(c?.dynamic_revenue) || 0)}
          </span>
        </div>
      </td>
      <td className="p-2 text-right">
        <div className={`inline-flex items-center justify-end gap-1 px-2 py-1 rounded-xl font-black text-[11px] shadow-sm border ${
          c?.growth_velocity > 0 
            ? 'bg-green-50 text-green-600 border-green-100' 
            : c?.growth_velocity < 0 
            ? 'bg-rose-50 text-rose-600 border-rose-100' 
            : 'bg-gray-50 text-gray-400 border-gray-100'
        }`}>
          <TrendingUp size={12} className={(Number(c?.growth_velocity) || 0) > 0 ? 'text-green-500' : 'text-red-400'} />
          {(Number(c?.growth_velocity) || 0) > 0 ? '+' : ''}{(Number(c?.growth_velocity) || 0).toFixed(1)}%
        </div>
      </td>
      <td className="p-2 text-center">
        <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border-2 shadow-sm font-heading ${
          c?.health_score >= 80 ? 'border-green-500 bg-green-50 text-green-700' : 
          c?.health_score >= 50 ? 'border-vnpost-orange bg-orange-50 text-vnpost-orange' : 
          'border-red-500 bg-red-50 text-red-700'
        }`}>
          <div className="flex flex-col items-center">
            <span className="text-[13px] font-black leading-none">{c?.health_score}</span>
            <span className="text-[11px] font-bold uppercase tracking-tighter opacity-70">Pts</span>
          </div>
        </div>
      </td>
      <td className="p-2 text-center">
         <span className="text-[11px] font-black border border-gray-100 bg-gray-50 px-2 py-1 rounded-xl text-gray-500 shadow-sm" title={`${c?.point_code || ''} - ${c?.point_name || ''}`}>
           {c?.point_code && c?.point_name ? `${c?.point_code}` : (c?.point_name || c?.point_code || 'N/A')}
         </span>
      </td>
      <td className="p-2 text-center">
         <div className="flex flex-col items-center">
           {c?.assigned_staff_name ? (
             <span className="text-[11px] font-black text-vnpost-blue bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
               👤 {c?.assigned_staff_name}
             </span>
           ) : (
             <span className="text-[11px] text-gray-300 font-bold italic uppercase">Chưa gán</span>
           )}
         </div>
      </td>
      <td className="p-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick(c?.ma_crm_cms);
            }}
            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
          >
            <Info size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ search: '', rfm_segment: '', lifecycle_status: 'new' });
  const [options, setOptions] = useState({ rfm_segment: [], nhom_kh: [] });
  const [loading, setLoading] = useState(false);
  const [waitingForDefaultDate, setWaitingForDefaultDate] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [coverage, setCoverage] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });
  const [selectedNode, setSelectedNode] = useState(null);

  // Modal states
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  // History Tracker
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  
  // SFTP Sync states
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncCheck, setSyncCheck] = useState({ gaps: [], updates: [], loading: false });
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lifecycleStats, setLifecycleStats] = useState({});
  const [staffOptions, setStaffOptions] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // { ma_kh, ten_kh, nhom_kh }
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignContent, setAssignContent] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [zaloMessage, setZaloMessage] = useState('');
  const [showZaloDispatch, setShowZaloDispatch] = useState(false);
  const [zaloGroupLink, setZaloGroupLink] = useState('https://zalo.me'); // Mặc định là trang chủ Zalo
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [pointOptions, setPointOptions] = useState([]);
  const [selectedPointId, setSelectedPointId] = useState("");
  const [wardOptions, setWardOptions] = useState([]);
  const [selectedWardId, setSelectedWardId] = useState("");
  
  // RF5B: Modal Scroll Hardening
  useEffect(() => {
    if (selectedCustomer) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [selectedCustomer]);

  // RF5B: Request Cancellation
  const abortControllerRef = useRef(null);
  const statsAbortControllerRef = useRef(null);
  const [apiUserRole, setApiUserRole] = useState("");
  const [apiUserWardId, setApiUserWardId] = useState(null);
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const { user } = useAuth();

  // RF4A: Navigation Logic for Modal
  const handleNextCustomer = () => {
    const currentIndex = customers.findIndex(c => c.ma_crm_cms === selectedCustomer);
    if (currentIndex !== -1 && currentIndex < customers.length - 1) {
      handleRowClick(customers[currentIndex + 1].ma_crm_cms);
    }
  };

  const handlePrevCustomer = () => {
    const currentIndex = customers.findIndex(c => c.ma_crm_cms === selectedCustomer);
    if (currentIndex > 0) {
      handleRowClick(customers[currentIndex - 1].ma_crm_cms);
    }
  };

  const hasNext = customers.findIndex(c => c.ma_crm_cms === selectedCustomer) < customers.length - 1;
  const hasPrev = customers.findIndex(c => c.ma_crm_cms === selectedCustomer) > 0;




  const getTaskFlow = (target) => {
    if (!target) return { type: 'Giao Lead', color: 'from-emerald-500 to-teal-700', text: 'GIAO LEAD MỚI', subtitle: 'Tiếp cận khách hàng tiềm năng' };
    
    if (target.nhom_kh === 'at_risk' || target.nhom_kh === 'churned') {
      return { type: 'Giao Cảnh báo', color: 'from-red-600 to-orange-600', text: 'GIAO CẢNH BÁO', subtitle: 'Khẩn cấp cứu chữa khách hàng' };
    }
    
    if (target.nhom_kh === 'active' || target.rfm_segment === 'Kim Cương' || target.rfm_segment === 'Vàng') {
      return { type: 'Giao VIP', color: 'from-amber-500 to-yellow-600', text: 'CHĂM SÓC VIP', subtitle: 'Nuôi dưỡng khách hàng giá trị cao' };
    }
    
    return { type: 'Giao Lead', color: 'from-emerald-500 to-teal-700', text: 'GIAO LEAD MỚI', subtitle: 'Tiếp cận khách hàng tiềm năng' };
  };

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const initApp = async () => {
      // RF3A: Load context
      const urlContext = getContextFromUrl(searchParams);
      const urlLifecycle = searchParams.get('lifecycle_status');
      const urlRFM = searchParams.get('rfm_segment');
      
      if (urlContext) {
        setSelectedNode(urlContext);
      }
      if (urlLifecycle) {
        setFilters(prev => ({ ...prev, lifecycle_status: urlLifecycle }));
      }
      if (urlRFM) {
        setFilters(prev => ({ ...prev, rfm_segment: urlRFM }));
      }
      
      if (!urlContext && !urlLifecycle && !urlRFM) {
        const savedContext = getNavigationContext();
        if (savedContext && savedContext.key) {
          setSelectedNode(savedContext);
          syncUrlWithContext(savedContext, searchParams, setSearchParams);
        }
      }

      await fetchOptions();
      await fetchCoverage();
    };
    initApp();
  }, []);

  useEffect(() => {
    if (showAssignModal && assignTarget) {
      const fetchTmpl = async () => {
         try {
            const res = await api.get('/api/actions/templates', { 
              params: { loai_doi_tuong: 'HienHuu', nhom_kh: assignTarget.nhom_kh } 
            });
            setTemplates(res.data);
         } catch(e) {}
      };
      const fetchStaff = async () => {
         try {
            const res = await api.get('/api/customers/staff-options', {
              params: { target_id: assignTarget.ma_kh, type: 'HienHuu', username: user?.username }
            });
            const data = res.data;
            if (Array.isArray(data)) {
               setStaffOptions(data);
               setPointOptions([]);
               setWardOptions([]);
            } else {
               setStaffOptions(data.staff || []);
               setPointOptions(data.points || []);
               setWardOptions(data.wards || []);
               setApiUserRole(data.user_role || "");
               setApiUserWardId(data.user_ward_id || null);
               
               const defaultWardId = data.default_ward_id || "";
               const defaultPointId = data.default_point_id || "";
               
               // GĐ BĐ P/X: khoá WARD về ward của họ
               if (data.user_role === 'UNIT_HEAD' && data.user_ward_id) {
                  setSelectedWardId(data.user_ward_id);
               } else {
                  setSelectedWardId(defaultWardId);
               }
               setSelectedPointId(defaultPointId);
               
               if (defaultPointId) {
                  const pIdInt = parseInt(defaultPointId, 10);
                  const staffInPoint = (data.staff || []).filter(s => s.point_id === pIdInt);
                  if (staffInPoint.length === 1) {
                     setSelectedStaffId(staffInPoint[0].id);
                  }
               }
            }
         } catch(e) {}
      };
      fetchTmpl();
      fetchStaff();
    } else {
      setTemplates([]);
      setSelectedTemplateId("");
      setAssignContent("");
      setAssignDeadline("");
      setStaffOptions([]);
      setPointOptions([]);
      setSelectedPointId("");
      setWardOptions([]);
      setSelectedWardId("");
      setApiUserRole("");
      setApiUserWardId(null);
      setShowEscalateForm(false);
      setEscalateReason("");
      setShowZaloDispatch(false);
    }
  }, [showAssignModal, assignTarget]);

  useEffect(() => {
    if (waitingForDefaultDate) return;
    fetchCustomers(page); 
    fetchLifecycleStats();
  }, [filters.search, filters.rfm_segment, filters.lifecycle_status, sortConfig, startDate, endDate, waitingForDefaultDate, page, pageSize, selectedNode]);

  // RF4D: Persist Date
  useEffect(() => {
    if (startDate || endDate) {
      saveDateContext(startDate, endDate);
    }
  }, [startDate, endDate]);


  const fetchLifecycleStats = async () => {
    if (statsAbortControllerRef.current) {
      statsAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    statsAbortControllerRef.current = controller;

    console.log("[API START] /api/analytics/dashboard (Lifecycle Stats)");
    try {
      const res = await api.get('/api/analytics/dashboard', { 
        params: { 
          start_date: startDate, 
          end_date: endDate,
          node_code: selectedNode?.key || undefined
        },
        signal: controller.signal
      });
      
      const d = res.data;
      console.log("[API SUCCESS] /api/analytics/dashboard");
      // API Dashboard trả về phím 'lifecycle' chứa các con số định danh
      const ls = d.lifecycle || {};
      
      setLifecycleStats({
        ...ls,
        "Tất cả": d.tong_kh || total
      });
    } catch (err) { 
      if (api.isCancel?.(err) || err?.name === 'AbortError') {
        console.warn("[API ABORTED] /api/analytics/dashboard");
      } else {
        console.error("Lỗi lấy dữ liệu Dashboard:", err); 
      }
    } finally {
      if (statsAbortControllerRef.current === controller) {
        console.log("[LOADING RELEASED] Lifecycle Stats");
      }
    }
  };

  const fetchCoverage = async () => {
    try {
      const res = await api.get('/api/analytics/data-coverage');
      setCoverage(res.data);
      
      // RF4D: Restore Date Context
      const dateCtx = getDateContext();
      if (dateCtx && dateCtx.startDate && dateCtx.endDate) {
        setStartDate(dateCtx.startDate);
        setEndDate(dateCtx.endDate);
      } else if (res.data.latest_month && !startDate && !endDate) {
        setStartDate(res.data.latest_month.start);
        setEndDate(res.data.latest_month.end);
        setSelectedMonth(res.data.latest_month.value);
      }
    } catch (err) { console.error(err); }
    finally {
      setWaitingForDefaultDate(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await api.get('/api/customers/filters');
      setOptions(res.data);
    } catch(err) { console.error(err); }
  };

  const fetchCustomers = async (targetPage = 1) => {
    // RF5B: Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    console.log(`[API START] /api/customers (Page: ${targetPage})`);
    try {
      const params = {
        page: targetPage,
        page_size: pageSize,
        search: filters.search || undefined,
        rfm_segment: filters.rfm_segment || undefined,
        lifecycle_status: filters.lifecycle_status || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortConfig.key,
        order: sortConfig.direction,
        node_code: selectedNode?.key || undefined
      };
      
       const res = await api.get('/api/customers', { params, signal: controller.signal });
       console.log("[API SUCCESS] /api/customers");
       setCustomers(res.data.items || []);
       setTotal(res.data.total || 0);
       setTotalPages(res.data.total_pages || 1);
       setPage(res.data.page || 1);
    } catch (err) {
      if (api.isCancel?.(err) || err?.name === 'AbortError') {
        console.warn("[API ABORTED] /api/customers");
      } else {
        console.error("Lỗi lấy dữ liệu khách hàng:", err);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        console.log("[LOADING RELEASED] /api/customers");
      }
    }
  };

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={14} className="ml-1 opacity-30" />;
    return sortConfig.direction === 'desc' 
      ? <ChevronDown size={14} className="ml-1 text-vnpost-orange" /> 
      : <ChevronUp size={14} className="ml-1 text-vnpost-orange" />;
  };

  const handleQuickMonth = (monthStr) => {
    if (!monthStr) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth(monthStr);
    const [year, month] = monthStr.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setStartDate(start);
    setEndDate(end);
  };

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    const newFilters = { ...filters, [name]: val };
    setFilters(newFilters);
  };

  const handleApplyFilter = () => {
    setPage(1);
    fetchCustomers(1);
  };




  const handleExportExcel = async () => {
    try {
      toast.info("Đang chuẩn bị dữ liệu Excel...");
      const params = {
        search: filters.search || undefined,
        rfm_segment: filters.rfm_segment || undefined,
        lifecycle_status: filters.lifecycle_status || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortConfig.key,
        order: sortConfig.direction,
        node_code: selectedNode?.key || undefined
      };

      const response = await api.get('/api/export/excel', {
        params,
        responseType: 'blob',
        timeout: 300000 // 5 minutes
      });

      if (response.data.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = () => {
          const errorData = JSON.parse(reader.result);
          toast.error(`Lỗi từ máy chủ: ${errorData.detail || 'Không xác định'}`);
        };
        reader.readAsText(response.data);
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      
      let filename = `Export_KH_HienHuu_${filters.lifecycle_status || 'All'}.xlsx`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success("Đã xuất dữ liệu thành công!");
    } catch (err) {
      console.error("=== EXPORT PIPELINE CRITICAL ERROR ===");
      console.error("Error Code:", err.code);
      console.error("Error Message:", err.message);
      console.error("Status:", err.response?.status);
      console.error("Response Data Type:", err.response?.data?.type);
      console.error("Full Error Object:", err);
      
      let message = "Lỗi không xác định";
      if (err.code === 'ECONNABORTED') {
        message = "Yêu cầu bị quá tải (Timeout) - Vui lòng thử lại sau.";
      } else if (err.message === 'Network Error') {
        message = "Lỗi kết nối mạng hoặc Server đã ngắt kết nối đột ngột.";
      } else {
        message = err.response?.data?.detail || err.message || message;
      }
      
      toast.error(`Lỗi khi xuất dữ liệu Excel: ${message}`);
    }
  };

  const handleExportMinimal = async () => {
    try {
      toast.info("Đang test đường truyền (Minimal 10 rows)...");
      const response = await api.get('/api/export/excel-minimal', {
        responseType: 'blob',
        timeout: 30000
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'MINIMAL_TEST.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Test đường truyền thành công!");
    } catch (err) {
      console.error("MINIMAL EXPORT ERROR:", err);
      toast.error(`Lỗi test đường truyền: ${err.message}`);
    }
  };

  const handleRowClick = async (crmCode) => {
    if (crmCode === 'VÃNG LAI') return;
    setSelectedCustomer(crmCode);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/api/customers/${crmCode}/details`);
      setCustomerDetails(res.data);
      setEditForm({
        dia_chi: res.data.customer.dia_chi || "",
        dien_thoai: res.data.customer.dien_thoai || "",
        nguoi_lien_he: res.data.customer.nguoi_lien_he || "",
        so_hop_dong: res.data.customer.so_hop_dong || "",
        thoi_han_hop_dong: res.data.customer.thoi_han_hop_dong || "",
        thoi_han_ket_thuc: res.data.customer.thoi_han_ket_thuc || ""
      });
    } catch(err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedCustomer(null);
    setCustomerDetails(null);
    setIsEditing(false);
  };

  const handleSaveCustomerDetail = async () => {
    setSavingEdit(true);
    try {
      await api.patch(`/api/customers/${selectedCustomer}`, editForm);
      toast.success("Cập nhật thông tin khách hàng thành công!");
      setIsEditing(false);
      // Refresh details
      handleRowClick(selectedCustomer);
    } catch (err) {
      toast.error("Lỗi khi cập nhật thông tin khách hàng");
    } finally {
      setSavingEdit(false);
    }
  };


  const handleCheckSftp = async () => {
    setSyncCheck(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await api.get('/api/import/sftp-check');
      if (res.data.error) {
         setSyncCheck({ gaps: [], updates: [], loading: false, error: res.data.error });
      } else {
         setSyncCheck({ gaps: res.data.gaps || [], updates: res.data.updates || [], loading: false, error: null });
      }
    } catch (err) {
      console.error(err);
      setSyncCheck(prev => ({ ...prev, loading: false, error: 'Không thể kết nối tới Backend' }));
    }
  };

  const handleSyncSftp = async () => {
    setIsSyncing(true);
    try {
      const res = await api.post('/api/import/sftp-sync');
      if (res.data.success) {
        const timer = setInterval(async () => {
          const statusRes = await api.get('/api/import/status');
          setSyncStatus(statusRes.data);
          if (statusRes.data.done || statusRes.data.error) {
            clearInterval(timer);
            setIsSyncing(false);
            if (statusRes.data.done) {
               fetchCustomers();
               fetchCoverage();
               handleCheckSftp();
            }
          }
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      setIsSyncing(false);
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedStaffId) {
      toast.warning("Vui lòng chọn nhân sự để phân công");
      return;
    }
    setAssigning(true);
    try {
      const flowInfo = getTaskFlow(assignTarget);
      await api.post(`/api/actions/assign`, {
        target_id: assignTarget.ma_kh,
        loai_doi_tuong: 'HienHuu',
        staff_id: selectedStaffId,
        noi_dung: assignContent,
        deadline: assignDeadline ? new Date(assignDeadline).toISOString() : null,
        template_id: selectedTemplateId || null,
        phan_loai_giao_viec: flowInfo.type
      });
      toast.success(`Đã giao việc cho nhân sự thành công!`);
      
      // Tạo nội dung tin nhắn Zalo
      const staff = staffOptions.find(s => s.id.toString() === selectedStaffId.toString());
      const staffName = staff ? staff.name : "Nhân sự";
      const deadlineStr = assignDeadline ? new Date(assignDeadline).toLocaleString('vi-VN') : "Sớm nhất";
      
      const zaloMsg = `📌 *THÔNG BÁO GIAO VIỆC*\n` +
                      `👤 *Nhân sự:* ${staffName}\n` +
                      `💎 *Khách hàng:* ${assignTarget.ten_kh} (${assignTarget.ma_kh})\n` +
                      `🏷️ *Phân loại:* ${flowInfo.type}\n` +
                      `📝 *Nội dung:* ${assignContent}\n` +
                      `⏰ *Hạn hoàn thành:* ${deadlineStr}\n` +
                      `---\n` +
                      `🚀 *Hệ thống điều hành CRM V3.0*`;
                      
      setZaloMessage(zaloMsg);
      setShowZaloDispatch(true); // Hiển thị nút điều hành Zalo
      
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi phân công nhân sự");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Assign Staff Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-[#003E7E]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-scale-up border-8 border-white">
            {!showZaloDispatch ? (
              <>
                <div className={`bg-gradient-to-r ${getTaskFlow(assignTarget).color} p-6 text-white flex justify-between items-center rounded-t-2xl flex-shrink-0 transition-colors duration-500`}>
                  <div>
                    <div className="flex items-center gap-2">
                       <h3 className="text-xl font-black uppercase tracking-tight">{getTaskFlow(assignTarget).text}</h3>
                       <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{getTaskFlow(assignTarget).type}</span>
                    </div>
                    <p className="text-xs font-bold text-white/80 mt-1 uppercase tracking-widest">{getTaskFlow(assignTarget).subtitle}</p>
                  </div>
                  <button onClick={() => setShowAssignModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all flex-shrink-0">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Đang thực hiện cho:</p>
                      <p className="text-sm font-black text-gray-800">{assignTarget?.ten_kh}</p>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">Mã: {assignTarget?.ma_kh}</p>
                    </div>
                    {assignTarget && (
                       <div className="text-right flex flex-col items-end gap-1">
                          {getRankBadge(assignTarget.rfm_segment)}
                       </div>
                    )}
                  </div>

                  {wardOptions.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Bưu điện Phường/Xã</label>
                      <select 
                        className="w-full px-4 py-4 rounded-xl border-2 border-gray-100 focus:border-vnpost-blue outline-none transition-all text-sm font-bold bg-white"
                        value={selectedWardId}
                        disabled={apiUserRole === 'UNIT_HEAD'}
                        onChange={(e) => {
                          const wId = e.target.value;
                          setSelectedWardId(wId);
                          setSelectedPointId("");
                          setSelectedStaffId("");
                        }}
                      >
                        <option value="">-- Tất cả BĐ P/X trong Cụm --</option>
                        {wardOptions.map(w => (
                          <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                        ))}
                      </select>
                      {apiUserRole === 'UNIT_HEAD' && (
                        <p className="text-[9px] text-amber-600 font-bold ml-1">🔒 Khoá theo phạm vi quản lý của bạn</p>
                      )}
                    </div>
                  )}

                  {pointOptions.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Chọn Bưu cục</label>
                      <select 
                        className="w-full px-4 py-4 rounded-xl border-2 border-gray-100 focus:border-vnpost-blue outline-none transition-all text-sm font-bold bg-white"
                        value={selectedPointId}
                        onChange={(e) => {
                          const pId = e.target.value;
                          setSelectedPointId(pId);
                          setSelectedStaffId("");
                          if (pId) {
                            const pIdInt = parseInt(pId, 10);
                            const staffInPoint = staffOptions.filter(s => s.point_id === pIdInt);
                            if (staffInPoint.length === 1) {
                              setSelectedStaffId(staffInPoint[0].id);
                            }
                          }
                        }}
                      >
                        <option value="">-- Tất cả Bưu cục --</option>
                        {pointOptions
                          .filter(p => !selectedWardId || p.ward_id === parseInt(selectedWardId, 10))
                          .map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Chọn nhân sự phụ trách</label>
                    <select 
                      className="w-full px-4 py-4 rounded-xl border-2 border-gray-100 focus:border-vnpost-blue outline-none transition-all text-sm font-bold bg-white"
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                    >
                      <option value="">-- Chọn nhân viên --</option>
                      {staffOptions
                        .filter(s => {
                          if (selectedPointId) return s.point_id === parseInt(selectedPointId, 10);
                          if (selectedWardId) {
                            const wardPointIds = pointOptions.filter(p => p.ward_id === parseInt(selectedWardId, 10)).map(p => p.id);
                            return wardPointIds.includes(s.point_id);
                          }
                          return true;
                        })
                        .map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.hr_id})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Kịch bản Giao việc (Tùy chọn)</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-vnpost-orange outline-none transition-all text-sm font-semibold bg-orange-50/30 text-vnpost-orange"
                      value={selectedTemplateId}
                      onChange={(e) => {
                        const tId = e.target.value;
                        setSelectedTemplateId(tId);
                        if (tId) {
                          const t = templates.find(x => x.id.toString() === tId);
                          if (t) setAssignContent(t.noi_dung_mau);
                        } else {
                          setAssignContent("");
                        }
                      }}
                    >
                      <option value="">-- Chọn kịch bản gợi ý --</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.tieu_de}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nội dung công việc</label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-vnpost-blue outline-none transition-all text-sm font-medium bg-white min-h-[100px]"
                      placeholder="Nhập nội dung cần nhân sự thực hiện..."
                      value={assignContent}
                      onChange={(e) => setAssignContent(e.target.value)}
                    ></textarea>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Deadline (Tùy chọn)</label>
                    <input
                      type="datetime-local"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-vnpost-blue outline-none transition-all text-sm font-bold bg-white"
                      value={assignDeadline}
                      onChange={(e) => setAssignDeadline(e.target.value)}
                    />
                  </div>

                  {/* Nút Trả về Cụm - chỉ hiện cho UNIT_HEAD */}
                  {apiUserRole === 'UNIT_HEAD' && !showEscalateForm && (
                    <button 
                      onClick={() => setShowEscalateForm(true)}
                      className="w-full py-3 border-2 border-dashed border-amber-300 bg-amber-50 rounded-2xl font-black text-amber-700 hover:bg-amber-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                    >
                      <AlertTriangle size={16} /> Trả về Cụm (Quá tải)
                    </button>
                  )}

                  {showEscalateForm && (
                    <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-200 space-y-3">
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">🚨 Yêu cầu hỗ trợ từ Cụm</p>
                      <textarea
                        className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-500 outline-none transition-all text-sm font-medium bg-white min-h-[80px]"
                        placeholder="Nhập lý do quá tải (ví dụ: Toàn bộ nhân sự BĐ P.X đã đầy lịch)..."
                        value={escalateReason}
                        onChange={(e) => setEscalateReason(e.target.value)}
                      />
                      <div className="flex gap-3">
                        <button 
                          onClick={() => { setShowEscalateForm(false); setEscalateReason(""); }}
                          className="flex-1 py-3 border border-gray-200 rounded-xl text-[10px] font-black text-gray-400 uppercase"
                        >Huỷ</button>
                        <button 
                          onClick={async () => {
                            if (!escalateReason.trim()) { toast.warning("Vui lòng nhập lý do"); return; }
                            try {
                              const res = await api.post('/api/actions/escalate', {
                                target_id: assignTarget.ma_kh,
                                loai_doi_tuong: 'HienHuu',
                                reason: escalateReason
                              });
                              toast.success(res.data.message);
                              setShowEscalateForm(false);
                              setEscalateReason("");
                              setShowAssignModal(false);
                            } catch(err) {
                              toast.error(err.response?.data?.detail || "Lỗi khi gửi yêu cầu");
                            }
                          }}
                          className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg"
                        >🚨 Gửi yêu cầu lên Cụm</button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 pt-2">
                    <button 
                      onClick={() => setShowAssignModal(false)}
                      className="flex-1 py-4 border-2 border-gray-100 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-all uppercase tracking-widest text-xs"
                    >
                      Bỏ qua
                    </button>
                    <button 
                      onClick={handleAssignSubmit}
                      disabled={assigning}
                      className="flex-1 py-4 bg-vnpost-blue text-white rounded-2xl font-black shadow-xl shadow-vnpost-blue/20 hover:bg-[#003E7E] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50"
                    >
                      {assigning ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                      Xác nhận giao
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Giao việc thành công!</h3>
                <p className="text-slate-500 mb-6 px-4">
                  Lệnh điều hành đã được chuẩn bị. Hãy nhấn nút bên dưới để "bắn" tin nhắn này lên Group Zalo điều hành.
                </p>
                
                <div className="bg-slate-50 p-4 rounded-xl text-left text-sm font-mono text-slate-600 mb-6 border border-slate-200 whitespace-pre-wrap relative group">
                  {zaloMessage}
                </div>

                {/* Cấu hình Group Zalo */}
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3 mb-6">
                  <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm">
                    <Settings size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Group Zalo Điều hành</p>
                    <input 
                      type="text" 
                      value={zaloGroupLink}
                      onChange={(e) => setZaloGroupLink(e.target.value)}
                      placeholder="Dán link Group Zalo tại đây..."
                      className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(zaloMessage);
                      toast.success("Đã sao chép nội dung!");
                      window.open(zaloGroupLink, '_blank');
                      setShowAssignModal(false);
                      setShowZaloDispatch(false);
                      fetchCustomers();
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all"
                  >
                    <MessageCircle size={20} />
                    SAO CHÉP & MỞ ZALO
                  </button>
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setShowZaloDispatch(false);
                      fetchCustomers();
                    }}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all"
                  >
                    ĐÓNG
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản Lý Vòng Đời Khách Hàng (V3)</h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs bg-vnpost-blue/10 text-vnpost-blue px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Bưu điện TP Huế</span>
             <span className="text-xs bg-vnpost-blue text-white px-2 py-0.5 rounded-full font-black uppercase border border-vnpost-blue shadow-sm">Bản Nâng Cấp 3.0</span>
             {selectedNode ? (
                <span className="text-[11px] bg-vnpost-orange text-white px-3 py-1 rounded-full font-black uppercase shadow-sm">Phạm vi: {selectedNode.title}</span>
              ) : (
                <span className="text-[11px] bg-vnpost-blue/10 text-vnpost-blue px-3 py-1 rounded-full font-bold uppercase border border-vnpost-blue/10 tracking-tighter">Bưu điện thành phố Huế</span>
              )}
             {(startDate || endDate) && (
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1 border border-indigo-100 uppercase tracking-tighter">
                  <Calendar size={12} /> BÁO CÁO: {startDate || '?'} → {endDate || '?'}
                  {coverage.max_date && (
                    <span className="ml-1 text-green-700 opacity-60">
                      (Nạp đến: {new Date(coverage.max_date).toLocaleDateString('vi-VN')})
                    </span>
                  )}
                </span>
             )}
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setShowSyncModal(true); handleCheckSftp(); }} 
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all font-bold text-sm border border-indigo-100 active:scale-95 shadow-sm"
          >
            <RefreshCw size={18} className={syncCheck.loading ? 'animate-spin' : ''} />
            <span>Đồng bộ TCT</span>
          </button>
          <button 
            onClick={() => setShowBulkModal(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all font-bold text-sm border border-emerald-100 active:scale-95 shadow-sm"
          >
            <UploadCloud size={18} />
            <span>Import thông tin KH</span>
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-vnpost-orange text-white rounded-lg hover:bg-[#E88900] transition-all font-bold text-sm shadow-md active:scale-95">
            <DownloadX size={18} />
            <span>Xuất Excel</span>
          </button>
          <button 
            onClick={handleExportMinimal} 
            className="flex items-center gap-2 px-2 py-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-200 transition-all font-bold text-[11px] uppercase border border-gray-200 active:scale-95"
            title="Debug: Xuất 10 dòng (Không style) để test Network"
          >
            Minimal
          </button>
        </div>
      </div>
      {/* RF3D: Customer Context Awareness Banner */}
      {(selectedNode || filters.lifecycle_status || filters.rfm_segment || (startDate && endDate)) && (
        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-3 border border-white/60 shadow-sm flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500 mb-4">
          <div className="bg-vnpost-blue/10 p-2 rounded-xl text-vnpost-blue">
            <Filter size={18} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">Đang soi theo:</span>
            
            {selectedNode && (
              <div className="flex items-center gap-1.5 bg-vnpost-blue text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm border border-vnpost-blue/20">
                <MapPin size={12} /> {selectedNode.title}
                <button onClick={() => { setSelectedNode(null); saveNavigationContext(null); syncUrlWithContext(null, searchParams, setSearchParams); }} className="hover:text-vnpost-orange transition-colors"><X size={12} /></button>
              </div>
            )}

            {filters.lifecycle_status && (
              <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm border border-indigo-700/20">
                <Users size={12} /> {lifecycleConfig.find(l => l.value === filters.lifecycle_status)?.label || filters.lifecycle_status}
                <button onClick={() => setFilters(prev => ({ ...prev, lifecycle_status: '' }))} className="hover:text-vnpost-orange transition-colors"><X size={12} /></button>
              </div>
            )}

            {filters.rfm_segment && (
              <div className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm border border-amber-600/20">
                <Award size={12} /> {filters.rfm_segment}
                <button onClick={() => setFilters(prev => ({ ...prev, rfm_segment: '' }))} className="hover:text-vnpost-orange transition-colors"><X size={12} /></button>
              </div>
            )}

            {startDate && endDate && (
              <div className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-[11px] font-black uppercase border border-gray-200">
                <Calendar size={12} /> {new Date(startDate).toLocaleDateString('vi-VN')} - {new Date(endDate).toLocaleDateString('vi-VN')}
              </div>
            )}
          </div>
          
          <button 
            onClick={() => {
              setFilters({ search: '', rfm_segment: '', lifecycle_status: '' });
              setSelectedNode(null);
              saveNavigationContext(null);
              syncUrlWithContext(null, searchParams, setSearchParams);
              if (coverage.latest_month) {
                setStartDate(coverage.latest_month.start);
                setEndDate(coverage.latest_month.end);
                setSelectedMonth(coverage.latest_month.value);
              }
            }}
            className="ml-auto text-[11px] font-black text-vnpost-orange hover:underline uppercase tracking-widest flex items-center gap-1"
          >
            <RefreshCw size={12} /> Xoá tất cả bộ lọc
          </button>
        </div>
      )}

      {/* RF5C - STEP 3D: OPERATIONAL COCKPIT LAYOUT REFACTOR */}
      <div className="flex flex-col gap-1.5 mb-2">
        {/* TIER 1: POPULATION (The Stock - Most Important) */}
        <div className="flex flex-col gap-1 p-1.5 bg-blue-50/20 rounded-xl border border-blue-100/50 shadow-sm">
          <div className="flex items-center gap-2 mb-0.5 px-1">
             <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
             <h3 className="text-[8px] font-black text-blue-700 uppercase tracking-widest">Quy mô dân số (Population)</h3>
          </div>
          
          {/* Row 1: Primary Stocks */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            {[
              { label: "Tổng Population", value: "total_pop", icon: Users, color: "blue" },
              { label: "Hiện hữu (Mature)", value: "active", icon: CheckCircle2, color: "purple" },
              { label: "Nguy cơ", value: "at_risk", icon: AlertCircle, color: "orange" },
              { label: "Rời bỏ (Lũy kế)", value: "churn_pop", icon: History, color: "slate" }
            ].map((item) => {
              const isActive = filters.lifecycle_status === item.value;
              const countKey = item.value === "total_pop" ? "Tất cả" : item.value;
              const count = lifecycleStats[countKey] || 0;
              const config = lifecycleConfig.find(c => c.value === item.value) || { color: item.color, borderCol: "border-gray-200", bgLight: "bg-white" };
              
              return (
                <button
                  key={item.label}
                  onClick={() => { setFilters(prev => ({ ...prev, lifecycle_status: item.value })); setPage(1); }}
                  className={`group relative p-1.5 pl-3 rounded-lg transition-all flex flex-col items-start gap-0 text-left border ${
                    isActive 
                      ? `bg-white shadow-md scale-[1.01] z-10 ${config.borderCol} border-l-4` 
                      : `bg-white/60 border-gray-100 hover:bg-white border-l-4 opacity-90`
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[8px] font-black uppercase tracking-tight truncate ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                      {item.label}
                    </span>
                    <item.icon size={10} className={isActive ? `text-${item.color}-600` : "text-gray-400"} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-base font-black tracking-tighter ${isActive ? `text-${item.color}-600` : `text-${item.color}-700`}`}>
                      {count.toLocaleString()}
                    </span>
                    <span className="text-[7px] text-gray-400 font-bold uppercase opacity-50">KH</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Row 2: Probationary Stocks */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            {[
              { label: "Mới (Lũy kế)", value: "new_pop", icon: Sparkles, color: "indigo" },
              { label: "Tái bản (Lũy kế)", value: "recovered_pop", icon: Activity, color: "emerald" }
            ].map((item) => {
              const isActive = filters.lifecycle_status === item.value;
              const count = lifecycleStats[item.value] || 0;
              const config = lifecycleConfig.find(c => c.value === item.value) || { color: item.color, borderCol: "border-gray-200", bgLight: "bg-white" };
              
              return (
                <button
                  key={item.label}
                  onClick={() => { setFilters(prev => ({ ...prev, lifecycle_status: item.value })); setPage(1); }}
                  className={`group relative p-1 pl-3 rounded-lg transition-all flex flex-col items-start gap-0 text-left border ${
                    isActive 
                      ? `bg-white shadow-sm scale-[1.01] z-10 ${config.borderCol} border-l-4` 
                      : `bg-white/40 border-gray-50 hover:bg-white border-l-4 opacity-80`
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[7px] font-black uppercase tracking-tight truncate ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                      {item.label}
                    </span>
                    <item.icon size={8} className={isActive ? `text-${item.color}-600` : "text-gray-300"} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm font-black tracking-tighter ${isActive ? `text-${item.color}-600` : `text-${item.color}-700`}`}>
                      {count.toLocaleString()}
                    </span>
                    <span className="text-[6px] text-gray-400 font-bold uppercase opacity-50">KH</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* TIER 2: EVENT STRIP (The Flow - Month Volatility) */}
        <div className="p-1 px-2 bg-rose-50/30 rounded-lg border border-rose-100/50 flex items-center gap-3">
          <div className="flex items-center gap-1.5 pr-3 border-r border-rose-200/50">
             <span className="w-1 h-2 bg-rose-500 rounded-full"></span>
             <h3 className="text-[7px] font-black text-rose-600 uppercase tracking-widest whitespace-nowrap">Biến động kỳ (Event)</h3>
          </div>
          
          <div className="flex flex-1 items-center gap-4">
            {[
              { label: "Mới trong kỳ", value: "new_event", icon: Star, color: "sky" },
              { label: "Tái bản trong kỳ", value: "recovered_event", icon: RefreshCw, color: "emerald" },
              { label: "Rời bỏ trong kỳ", value: "churn_event", icon: UserMinus, color: "rose" },
            ].map((item) => {
              const isActive = filters.lifecycle_status === item.value;
              const count = lifecycleStats[item.value] || 0;
              
              return (
                <button
                  key={item.label}
                  onClick={() => { setFilters(prev => ({ ...prev, lifecycle_status: item.value })); setPage(1); }}
                  className={`flex items-center gap-2 px-2 py-0.5 rounded-md transition-all border ${
                    isActive 
                      ? `bg-white border-${item.color}-500 shadow-sm ring-1 ring-${item.color}-500/20` 
                      : `border-transparent hover:bg-white/60`
                  }`}
                >
                  <span className={`text-[7px] font-black uppercase tracking-tight ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{item.label}</span>
                  <span className={`text-xs font-black tracking-tighter ${isActive ? `text-${item.color}-600` : `text-gray-600`}`}>
                    {count.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TIER 3: COMPACT OPERATIONAL TOOLBAR */}
        <div className="card !p-1.5 !rounded-xl shadow-sm border-gray-100 bg-white flex flex-wrap items-center gap-2">
            {/* 3.1: Scope Selector */}
            <div className="relative min-w-[180px]">
                <button 
                  onClick={() => setIsTreeOpen(!isTreeOpen)}
                  className={`w-full bg-gray-50 border rounded-lg px-2 py-1.5 text-[10px] font-bold text-vnpost-blue flex justify-between items-center transition-all ${isTreeOpen ? 'bg-white ring-1 ring-vnpost-blue/20' : 'border-gray-100'}`}
                >
                  <MapPin size={12} className="shrink-0 mr-1 opacity-50" />
                  <span className="truncate flex-1 text-left">{selectedNode ? selectedNode.title : "Phạm vi dữ liệu"}</span>
                  <ArrowUpRight size={10} className="ml-1 opacity-40" />
                </button>
                {isTreeOpen && (
                  <div className="absolute top-full left-0 w-80 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 z-[100] max-h-[350px] overflow-y-auto custom-scrollbar">
                    <TreeExplorer onSelect={(node) => { setSelectedNode(node); setPage(1); setIsTreeOpen(false); }} selectedNode={selectedNode} />
                  </div>
                )}
            </div>

            {/* 3.2: Search Box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" size={12} />
              <input 
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                type="text" 
                placeholder="Tìm tên hoặc mã CRM..." 
                className="w-full pl-8 pr-3 py-1.5 border border-gray-100 rounded-lg text-[10px] focus:outline-none focus:border-vnpost-blue bg-gray-50/30 font-medium"
              />
            </div>

            {/* 3.3: RFM Segment */}
            <select 
              name="rfm_segment" 
              value={filters.rfm_segment} 
              onChange={handleFilterChange}
              className="py-1.5 px-2 border border-gray-100 rounded-lg text-[10px] outline-none bg-white font-bold text-gray-600 min-w-[120px]"
            >
              <option value="">Phân hạng (Tất cả)</option>
              {["Kim Cương", "Vàng", "Bạc", "Tiềm Năng", "Thường"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* 3.4: Quick Month */}
            <select 
              className="py-1.5 px-2 rounded-lg border border-gray-100 outline-none text-[10px] font-black text-vnpost-blue bg-white min-w-[140px]"
              onChange={(e) => handleQuickMonth(e.target.value)}
              value={selectedMonth}
            >
              <option value="">Chọn tháng báo cáo</option>
              {coverage.months?.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>

            {/* 3.5: Date Range */}
            <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-lg border border-gray-100">
              <input type="date" className="bg-transparent px-1 py-0.5 text-[9px] font-bold outline-none border-none" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSelectedMonth(""); }} />
              <span className="text-[8px] text-gray-300">→</span>
              <input type="date" className="bg-transparent px-1 py-0.5 text-[9px] font-bold outline-none border-none" value={endDate} onChange={(e) => { setEndDate(e.target.value); setSelectedMonth(""); }} />
            </div>

            {/* 3.6: Action Button */}
            <button onClick={handleApplyFilter} className="px-3 h-[28px] bg-vnpost-blue text-white rounded-lg font-black hover:bg-[#003E7E] transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider text-[9px]">
              <Filter size={12} /> Lọc
            </button>
            
            <button 
              onClick={() => { setFilters({ search: '', rfm_segment: '', lifecycle_status: '' }); setSelectedNode(null); setStartDate(""); setEndDate(""); setSelectedMonth(""); fetchCustomers(); }}
              className="text-gray-400 hover:text-red-500 text-[9px] font-black uppercase tracking-tighter px-2"
            >
              Xóa lọc
            </button>
        </div>
      </div>

        {/* METRIC INTELLIGENCE LEGEND */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2 py-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-indigo-100">
               <Activity size={20} className="text-vnpost-blue" />
            </div>
            <div>
              <h4 className="text-[11px] font-black text-vnpost-blue uppercase tracking-wider">Health Score (Điểm Sức Khỏe)</h4>
              <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-0.5">
                Chỉ số tổng hợp từ **70% Doanh thu** và **30% Tần suất** giao dịch. <br/>
                <span className="text-green-600 font-bold">≥ 80: Tốt</span> • <span className="text-orange-500 font-bold">50-79: Cần chú ý</span> • <span className="text-red-500 font-bold">&lt; 50: Nguy cơ cao</span>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 border-l border-indigo-100/50 pl-4">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-indigo-100">
               <TrendingUp size={20} className="text-green-600" />
            </div>
            <div>
              <h4 className="text-[11px] font-black text-green-700 uppercase tracking-wider">Tăng trưởng (Growth Velocity)</h4>
              <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-0.5">
                So sánh doanh thu kỳ báo cáo với kỳ trước đó (**MoM**). <br/>
                Cho thấy tốc độ biến động quy mô gửi hàng của khách hàng theo thời gian thực.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-2 text-gray-400">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
              <span className="text-xs font-bold uppercase tracking-widest">Chi tiết danh sách</span>
           </div>
           <p className="text-[11px] font-black italic">
             Hiển thị <span className="text-vnpost-blue">{customers.length.toLocaleString()}</span> khách hàng trên tổng số <span className="text-vnpost-blue">{total.toLocaleString()}</span> hồ sơ định danh.
           </p>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-inner bg-white custom-scrollbar">
          <table className="w-full min-w-[1600px] text-left text-sm whitespace-nowrap table-fixed">
            <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
              <tr>
                <th 
                  className="p-2 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors w-32"
                  onClick={() => handleSort('ma_crm_cms')}
                >
                  <div className="flex items-center text-[11px]">Mã CRM <SortIcon column="ma_crm_cms" /></div>
                </th>
                <th 
                  className="p-2 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors w-64"
                  onClick={() => handleSort('ten_kh')}
                >
                  <div className="flex items-center text-[11px]">Tên Khách Hàng <SortIcon column="ten_kh" /></div>
                </th>
                <th 
                  className="p-2 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors w-40"
                  onClick={() => handleSort('status_type')}
                >
                  <div className="flex items-center text-[11px]">Vòng đời <SortIcon column="status_type" /></div>
                </th>
                <th 
                  className="p-2 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors w-32"
                  onClick={() => handleSort('rfm_segment')}
                >
                  <div className="flex items-center text-[11px]">Hạng <SortIcon column="rfm_segment" /></div>
                </th>
                <th 
                  className="p-2 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors text-right w-24"
                  onClick={() => handleSort('transaction_count')}
                >
                  <div className="flex items-center justify-end text-[11px]">Số đơn <SortIcon column="transaction_count" /></div>
                </th>
                <th 
                  className="p-2 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors text-right w-40"
                  onClick={() => handleSort('dynamic_revenue')}
                >
                  <div className="flex items-center justify-end text-[11px]">Doanh thu <SortIcon column="dynamic_revenue" /></div>
                </th>
                <th 
                  className="p-2 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors text-right w-32"
                  onClick={() => handleSort('growth_velocity')}
                >
                  <div className="flex items-center justify-end text-[11px]">Tăng trưởng <SortIcon column="growth_velocity" /></div>
                </th>
                <th 
                  className="p-2 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors text-center w-32"
                  onClick={() => handleSort('health_score')}
                >
                  <div className="flex items-center justify-center text-[11px]">Health Score <SortIcon column="health_score" /></div>
                </th>
                <th className="p-2 font-black uppercase tracking-tighter text-center w-32 text-[11px]">Bưu cục</th>
                <th className="p-2 font-black uppercase tracking-tighter text-center w-32 text-[11px]">Phụ trách</th>
                <th className="p-2 font-black uppercase tracking-tighter text-center w-28 text-[11px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="11" className="p-0">
                  <div className="bg-white/50 backdrop-blur-sm">
                    <Skeleton.Table rows={10} />
                  </div>
                </td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan="11" className="p-20 text-center text-gray-400 font-medium">
                  <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 border-2 border-dashed border-gray-100">
                      <TableProperties size={40} />
                    </div>
                    <div>
                      <p className="text-gray-800 font-black uppercase tracking-widest text-sm">Kho dữ liệu trống</p>
                      <p className="text-[11px] text-gray-400 mt-1 italic">Không tìm thấy khách hàng nào khớp với điều kiện lọc hiện tại.</p>
                    </div>
                    <button 
                      onClick={() => setFilters({ search: '', rfm_segment: '', lifecycle_status: '' })}
                      className="px-6 py-2 bg-vnpost-blue text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#003E7E] transition-all shadow-lg shadow-blue-100"
                    >
                      Xoá bộ lọc & Thử lại
                    </button>
                  </div>
                </td></tr>
              ) : (
                (customers || []).map(c => (
                  <CustomerRow 
                    key={c?.ma_crm_cms} 
                    c={c} 
                    handleRowClick={handleRowClick}
                    handleHistoryModal={(cust) => {
                      setHistoryTarget({ ma_kh: cust.ma_crm_cms, ten_kh: cust.ten_kh });
                      setShowHistoryModal(true);
                    }}
                    formatCurrency={formatCurrency}
                    getRankBadge={getRankBadge}
                    lifecycleConfig={lifecycleConfig}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls - UPDATED WITH PAGE SIZE SELECTOR */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8 bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hiển thị</span>
              <select 
                value={pageSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value);
                  setPageSize(newSize);
                  setPage(1);
                  fetchCustomers(1);
                }}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-black text-vnpost-blue outline-none focus:ring-2 focus:ring-vnpost-blue/10"
              >
                {[10, 20, 50, 100, 200].map(size => (
                  <option key={size} value={size}>{size} dòng</option>
                ))}
              </select>
            </div>
            <div className="h-4 w-px bg-gray-200"></div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
              Đang xem <span className="text-vnpost-blue">{(page - 1) * pageSize + 1}</span> - <span className="text-vnpost-blue">{Math.min(page * pageSize, total)}</span> trong <span className="text-vnpost-blue font-black">{total}</span> khách hàng
            </p>
          </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setPage(1); }}
                disabled={page === 1}
                className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue disabled:opacity-30 transition-all active:scale-90 shadow-sm"
              >
                <ChevronDown size={16} className="rotate-90" />
              </button>
              <button 
                onClick={() => { setPage(Math.max(1, page - 1)); }}
                disabled={page === 1}
                className="px-5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-500 hover:text-vnpost-blue hover:border-vnpost-blue disabled:opacity-30 transition-all active:scale-90 shadow-sm"
              >
                Trước
              </button>
              
              <div className="flex items-center gap-1 mx-2">
                <span className="text-xs font-black text-vnpost-blue bg-white px-4 py-2 rounded-xl border border-vnpost-blue/20 shadow-sm">
                  {page}
                </span>
                <span className="text-[10px] font-bold text-gray-300 uppercase mx-1">/</span>
                <span className="text-xs font-black text-gray-400">
                  {Math.ceil((total || 0) / (pageSize || 50))}
                </span>
              </div>

              <button 
                onClick={() => { setPage(page + 1); }}
                disabled={page * pageSize >= total}
                className="px-5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-500 hover:text-vnpost-blue hover:border-vnpost-blue disabled:opacity-30 transition-all active:scale-90 shadow-sm"
              >
                Sau
              </button>
              <button 
                onClick={() => { const lastPage = Math.ceil((total || 0) / (pageSize || 50)); setPage(lastPage); }}
                disabled={page * pageSize >= total}
                className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue disabled:opacity-30 transition-all active:scale-90 shadow-sm"
              >
                <ChevronDown size={16} className="-rotate-90" />
              </button>
            </div>
        </div>
      </div>


      {/* Drill-down Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black flex items-center gap-2">
                  Hồ sơ KH: <span className="text-vnpost-blue">{selectedCustomer}</span>
                </h3>
                {customerDetails && (
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm ${isEditing ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-vnpost-blue text-white shadow-vnpost-blue/20'}`}
                  >
                    {isEditing ? <><X size={14}/> Hủy chỉnh sửa</> : <><Edit size={14}/> Cập nhật thông tin</>}
                  </button>
                )}
              </div>
               <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-100 rounded-xl p-1 mr-2">
                    <button 
                      onClick={handlePrevCustomer}
                      disabled={!hasPrev}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-500"
                      title="Khách hàng trước đó"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    <button 
                      onClick={handleNextCustomer}
                      disabled={!hasNext}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-500"
                      title="Khách hàng tiếp theo"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                    <X size={24} className="text-gray-400" />
                  </button>
               </div>
            </div>
            
            <div className="p-6 bg-gray-50/50">
              {loadingDetails ? (
                <div className="p-10 animate-in fade-in duration-300">
                  <Skeleton.Modal />
                </div>
              ) : customerDetails ? (
                <div className="space-y-6">
                   {/* Info header */}
                   <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="md:col-span-2 space-y-4">
                       <div>
                         <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Tên Khách Hàng</p>
                         <p className="text-2xl font-black text-gray-800 tracking-tight">{customerDetails.customer.ten_kh}</p>
                         <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-[10px] font-bold bg-blue-50 text-vnpost-blue px-2 py-0.5 rounded-lg border border-blue-100">
                               📍 {customerDetails.customer.ten_bc_vhx}
                            </span>
                            <span className="text-[10px] font-bold bg-gray-50 text-gray-500 px-2 py-0.5 rounded-lg border border-gray-100">
                               🏢 {customerDetails.customer.don_vi}
                            </span>
                            {getRankBadge(customerDetails.customer.rfm_segment)}
                            <button 
                              onClick={() => {
                                setHistoryTarget({ ma_kh: customerDetails.customer.ma_crm_cms, ten_kh: customerDetails.customer.ten_kh });
                                setShowHistoryModal(true);
                              }}
                              className="text-[10px] font-black bg-vnpost-orange text-white px-3 py-1 rounded-lg shadow-sm shadow-orange-200 hover:scale-105 transition-all flex items-center gap-1.5"
                            >
                              <History size={12} /> Xem lịch sử 360°
                            </button>
                         </div>
                       </div>
                       
                       {/* Enrichment Info Section */}
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                          <div className="space-y-1">
                             <p className="text-[10px] text-gray-400 font-black uppercase flex items-center gap-1"><MapPin size={10}/> Địa chỉ</p>
                             {isEditing ? (
                               <textarea 
                                 className="w-full text-xs font-bold p-2 border rounded-lg focus:ring-2 focus:ring-vnpost-blue/10 outline-none"
                                 value={editForm.dia_chi}
                                 onChange={(e) => setEditForm({...editForm, dia_chi: e.target.value})}
                               />
                             ) : (
                               <p className="text-xs font-bold text-gray-700">{customerDetails.customer.dia_chi || "Chưa cập nhật"}</p>
                             )}
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] text-gray-400 font-black uppercase flex items-center gap-1"><Phone size={10}/> Điện thoại / Liên hệ</p>
                             {isEditing ? (
                               <div className="space-y-2">
                                 <input 
                                   className="w-full text-xs font-bold p-2 border rounded-lg focus:ring-2 focus:ring-vnpost-blue/10 outline-none"
                                   placeholder="Số điện thoại"
                                   value={editForm.dien_thoai}
                                   onChange={(e) => setEditForm({...editForm, dien_thoai: e.target.value})}
                                 />
                                 <input 
                                   className="w-full text-xs font-bold p-2 border rounded-lg focus:ring-2 focus:ring-vnpost-blue/10 outline-none"
                                   placeholder="Người liên hệ"
                                   value={editForm.nguoi_lien_he}
                                   onChange={(e) => setEditForm({...editForm, nguoi_lien_he: e.target.value})}
                                 />
                               </div>
                             ) : (
                               <div>
                                 <p className="text-xs font-black text-vnpost-blue">{customerDetails.customer.dien_thoai || "N/A"}</p>
                                 <p className="text-[10px] font-bold text-gray-500">{customerDetails.customer.nguoi_lien_he || "Chưa có tên người liên hệ"}</p>
                               </div>
                             )}
                          </div>
                       </div>
                     </div>
                     
                     <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-4">
                        <div>
                           <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-2 flex items-center gap-1"><FileText size={12}/> Thông tin Hợp đồng</p>
                           {isEditing ? (
                             <div className="space-y-2">
                                <label className="text-[9px] font-bold text-gray-400">Số hợp đồng</label>
                                <input 
                                  className="w-full text-[11px] font-bold p-2 border rounded-lg"
                                  value={editForm.so_hop_dong}
                                  onChange={(e) => setEditForm({...editForm, so_hop_dong: e.target.value})}
                                />
                                <label className="text-[9px] font-bold text-gray-400">Ngày bắt đầu / Kết thúc</label>
                                <div className="flex gap-2">
                                  <input 
                                    className="flex-1 text-[11px] font-bold p-2 border rounded-lg"
                                    value={editForm.thoi_han_hop_dong}
                                    onChange={(e) => setEditForm({...editForm, thoi_han_hop_dong: e.target.value})}
                                  />
                                  <input 
                                    className="flex-1 text-[11px] font-bold p-2 border rounded-lg"
                                    value={editForm.thoi_han_ket_thuc}
                                    onChange={(e) => setEditForm({...editForm, thoi_han_ket_thuc: e.target.value})}
                                  />
                                </div>
                             </div>
                           ) : (
                             <div className="space-y-3">
                               <div>
                                  <p className="text-[9px] font-bold text-gray-400 uppercase">Số HĐ</p>
                                  <p className="text-xs font-black text-gray-700 truncate" title={customerDetails.customer.so_hop_dong}>{customerDetails.customer.so_hop_dong || "---"}</p>
                               </div>
                               <div className="flex justify-between gap-4">
                                  <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Bắt đầu</p>
                                    <p className="text-xs font-black text-indigo-600">{customerDetails.customer.thoi_han_hop_dong || "N/A"}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Kết thúc</p>
                                    <p className="text-xs font-black text-rose-600">{customerDetails.customer.thoi_han_ket_thuc || "N/A"}</p>
                                  </div>
                               </div>
                             </div>
                           )}
                        </div>

                        {isEditing && (
                           <button 
                             onClick={handleSaveCustomerDetail}
                             disabled={savingEdit}
                             className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                           >
                             {savingEdit ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                             Lưu thay đổi
                           </button>
                        )}

                        {!isEditing && (
                           <div className="pt-2 border-t border-gray-200/50">
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Thống kê nhanh</p>
                              <div className="flex justify-between items-baseline">
                                 <span className="text-2xl font-black text-vnpost-orange">{customerDetails.total_transactions}</span>
                                 <span className="text-[10px] font-bold text-gray-400 uppercase">Giao dịch</span>
                              </div>
                           </div>
                        )}
                     </div>
                   </div>

                   {/* Charts Grid */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Trong nước vs Quốc tế */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <h4 className="font-semibold text-gray-800 mb-4 border-b pb-2">Tỉ Trọng Trong Nước / Quốc Tế</h4>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={customerDetails.scope}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {customerDetails.scope.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                              <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Cơ cấu Dịch Vụ */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <h4 className="font-semibold text-gray-800 mb-4 border-b pb-2">Doanh Thu Theo Dịch Vụ</h4>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={customerDetails.services}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                label={({name}) => name}
                              >
                                {customerDetails.services.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[(index+2) % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                   </div>

                   {/* Đề xuất chăm sóc */}
                   <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-4">
                     <AlertCircle className="text-vnpost-blue flex-shrink-0 mt-1" />
                     <div>
                       <h4 className="font-semibold text-vnpost-blue mb-1">Đề xuất Chăm Sóc & Phục Vụ</h4>
                       <p className="text-blue-900 text-sm">
                         {customerDetails.customer.is_churn === 1 
                           ? "Khách hàng có dấu hiệu rời bỏ. Bộ phận Kinh doanh cần lên lịch gọi điện trực tiếp thăm hỏi lý do không gửi hàng qua VnPost, rà soát lại chính sách giá với đối thủ cạnh tranh."
                           : customerDetails.scope.some(s => s.name === 'Quốc tế' && s.value > 0)
                             ? "Khách hàng có sử dụng dịch vụ Quốc tế. Đề xuất giới thiệu các gói chiết khấu cước vận chuyển quốc tế dành riêng cho KH lớn để nâng cao tỷ trọng."
                             : "Khách hàng đang gửi nội địa ổn định. Đội ngũ Sale/CSKH có thể giới thiệu thêm các dịch vụ Fulfillment hoặc chuyển phát quốc tế nếu khách có nhu cầu."
                         }
                       </p>
                     </div>
                   </div>
                </div>
              ) : (
                <div className="text-center py-20 text-red-500">Lỗi không thể tải dữ liệu.</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* SFTP Sync Modal */}
      <SftpSyncModal 
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        checkData={syncCheck}
        syncStatus={syncStatus}
        isSyncing={isSyncing}
        onSync={handleSyncSftp}
        onCheck={handleCheckSftp}
      />

      {/* Bulk Enrichment Modal */}
      <BulkEnrichmentModal 
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={() => {
            fetchCustomers();
            setShowBulkModal(false);
        }}
      />

      <CustomerHistoryModal 
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        targetId={historyTarget?.ma_kh}
        loaiDoiTuong="HienHuu"
        customerName={historyTarget?.ten_kh}
      />
    </div>
  );
}

// Sub-component for Bulk Enrichment
function BulkEnrichmentModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState({ running: false, percent: 0, processed: 0, total: 0 });

  useEffect(() => {
    let interval;
    if (isUploading) {
      interval = setInterval(async () => {
        try {
          const res = await api.get("/api/import/enrich-status");
          setStatus(res.data);
          if (res.data.done) {
            setIsUploading(false);
            clearInterval(interval);
            if (res.data.error) {
              toast.error(res.data.error);
            } else {
              toast.success(res.data.message);
              onSuccess();
            }
          }
        } catch (e) {
          console.error("Lỗi polling status:", e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isUploading]);

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!file) return toast.error("Vui lòng chọn file Excel");
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/import/enrich-customers", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (!res.data.success) {
        toast.error(res.data.message);
        setIsUploading(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Lỗi khi tải file");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UploadCloud size={24} />
            <h3 className="text-lg font-bold uppercase tracking-tight">Làm giàu dữ liệu hàng loạt</h3>
          </div>
          <button onClick={onClose} disabled={isUploading} className="hover:bg-white/20 p-1 rounded-full"><X size={24} /></button>
        </div>

        <div className="p-8 space-y-6">
          {!isUploading ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-gray-700">Hướng dẫn chuẩn bị File:</p>
                  <a 
                    href={`${api.defaults.baseURL}/api/import/template-enrich`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase hover:underline bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100"
                  >
                    <Download size={12} /> Tải file mẫu .xlsx
                  </a>
                </div>
                <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
                  <li>File Excel phải có cột <span className="font-bold text-vnpost-blue">ma_kh</span> hoặc <span className="font-bold text-vnpost-blue">Mã CRM/CMS</span>.</li>
                  <li>Hệ thống tự động nhận diện các cột: <span className="italic">dia_chi, dien_thoai, nguoi_lien_he, so_hop_dong...</span></li>
                  <li>Dữ liệu sẽ được cập nhật đè vào khách hàng đã tồn tại.</li>
                </ul>
              </div>

              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-emerald-400 transition-colors group cursor-pointer" onClick={() => document.getElementById('bulk-file').click()}>
                <input 
                  type="file" 
                  id="bulk-file" 
                  hidden 
                  accept=".xlsx, .xls"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <p className="text-xs font-bold text-gray-600">{file ? file.name : "Kéo thả hoặc bấm để chọn file Excel"}</p>
                  <p className="text-[10px] text-gray-400 italic">Dung lượng tối đa 10MB (.xlsx, .xls)</p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-10 space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-gray-100"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={364.4}
                      strokeDashoffset={364.4 - (364.4 * status.percent) / 100}
                      className="text-emerald-500 transition-all duration-500"
                    />
                  </svg>
                  <span className="absolute text-2xl font-black text-gray-700">{status.percent}%</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-gray-700 uppercase tracking-widest">Đang xử lý dữ liệu</p>
                  <p className="text-xs text-gray-400 font-bold mt-1">Đã xử lý: <span className="text-emerald-600">{status.processed}</span> / {status.total} dòng</p>
                </div>
              </div>
              
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${status.percent}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
           <button onClick={onClose} disabled={isUploading} className="px-6 py-2.5 text-gray-500 font-bold text-xs uppercase hover:bg-gray-100 rounded-xl transition-all">Hủy</button>
           {!isUploading && (
             <button 
               onClick={handleUpload}
               disabled={!file}
               className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-black shadow-lg shadow-emerald-200 disabled:bg-gray-300 disabled:shadow-none uppercase text-xs tracking-wider"
             >
               <Check size={16} />
               <span>Bắt đầu cập nhật</span>
             </button>
           )}
        </div>
      </div>
    </div>
  );
}

// Sub-component for SFTP Sync
function SftpSyncModal({ isOpen, onClose, checkData, onSync, syncStatus, isSyncing, onCheck }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <RefreshCw size={24} className={checkData.loading ? 'animate-spin' : ''} />
            <h3 className="text-lg font-bold">Trung tâm Đồng bộ SFTP (CAS/Portal)</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {checkData.loading ? (
            <div className="text-center py-10">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
               <p className="text-gray-500 font-medium font-mono">Đang kết nối tới server 10.1.45.10...</p>
            </div>
          ) : checkData.error ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
               <AlertCircle className="text-red-500 flex-shrink-0" />
               <div className="space-y-1">
                 <p className="font-bold text-red-800">Lỗi kết nối Server!</p>
                 <p className="text-xs text-red-600 font-mono break-all">{checkData.error}</p>
                 <button onClick={onCheck} className="mt-2 text-xs font-bold text-red-700 underline">Thử lại ngay</button>
               </div>
            </div>
          ) : (
            <>
              {/* PHẦN 1: FILE THIẾU (GAP) */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-bold text-gray-700">
                  <AlertCircle size={18} className="text-orange-500" />
                  Dữ liệu đang thiếu ({checkData.gaps.length})
                </h4>
                {checkData.gaps.length === 0 ? (
                  <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg flex items-center gap-2 font-medium">
                    <CheckCircle2 size={16} /> Chúc mừng! Sếp đã nạp đầy đủ dữ liệu hiện có trên SFTP.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {checkData.gaps.slice(0, 10).map(g => (
                      <div key={g.folder} className="flex items-center justify-between bg-orange-50 p-2 rounded border border-orange-100 text-xs">
                        <span className="font-bold text-orange-800">Ngày {g.folder}</span>
                        <span className="text-gray-500 font-mono italic">{g.file}</span>
                        <span className="bg-white px-2 py-0.5 rounded shadow-sm">{(g.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    ))}
                    {checkData.gaps.length > 10 && <p className="text-[10px] text-gray-400 text-center italic">... và {checkData.gaps.length - 10} ngày khác</p>}
                  </div>
                )}
              </div>

              {/* PHẦN 2: FILE CẬP NHẬT (REVISED) */}
              {checkData.updates.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="flex items-center gap-2 font-bold text-indigo-700">
                    <History size={18} />
                    Phát hiện file mới từ TCT ({checkData.updates.length})
                  </h4>
                  <p className="text-[10px] text-gray-500 leading-tight">
                    Tổng công ty đã đẩy lại File mới cho các ngày này. Nếu đồng bộ, hệ thống sẽ tự động ghi đè dữ liệu cũ bằng dữ liệu mới nhất.
                  </p>
                  <div className="grid gap-2">
                    {checkData.updates.map(u => (
                      <div key={u.folder} className="flex items-center justify-between bg-indigo-50 p-2 rounded border border-indigo-100 text-xs">
                        <span className="font-bold text-indigo-800">Ngày {u.folder}</span>
                        <div className="flex items-center gap-1 text-[10px]">
                           <span className="text-gray-400 line-through">{(u.old_size / 1024 / 1024).toFixed(2)}</span>
                           <ChevronRight size={10} />
                           <span className="text-blue-600 font-black">{(u.new_size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TRẠNG THÁI ĐANG CHẠY */}
          {syncStatus && syncStatus.running && (
            <div className="bg-gray-900 rounded-xl p-4 text-white font-mono text-xs shadow-inner animate-pulse">
               <div className="flex justify-between mb-2">
                 <span>Tiến trình:</span>
                 <span className="text-green-400">Đang xử lý</span>
               </div>
               <p className="text-blue-300">➜ {syncStatus.message}</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
           <button onClick={onCheck} disabled={checkData.loading || isSyncing} className="text-indigo-600 font-bold text-sm tracking-tight flex items-center gap-1 hover:underline disabled:opacity-50">
              <RefreshCw size={14} /> Quét lại Server
           </button>
           <button 
             onClick={onSync}
             disabled={checkData.loading || isSyncing || (checkData.gaps.length === 0 && checkData.updates.length === 0)}
             className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-black shadow-lg shadow-indigo-200 disabled:bg-gray-300 disabled:shadow-none uppercase tracking-wider"
           >
             {isSyncing ? <RefreshCw size={20} className="animate-spin" /> : <CloudDownload size={20} />}
             <span>{isSyncing ? "Đang xử lý..." : "Bắt đầu Đồng bộ"}</span>
           </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Search, Filter, Download, Download as DownloadX, TableProperties, AlertCircle, X, ChevronRight, ChevronLeft, Calendar, TrendingUp, ArrowUpDown, ChevronUp, ChevronDown, RefreshCw, CloudDownload, CheckCircle2, History, Star, Users, Briefcase, Zap, LogOut, UserPlus, Award, Activity, MapPin, ArrowUpRight, Save, AlertTriangle, Phone, FileText, Edit, Check, UploadCloud, Send, Settings, MessageCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import TreeExplorer from '../components/TreeExplorer';
import CustomerHistoryModal from '../components/CustomerHistoryModal';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const COLORS = ['#F9A51A', '#0054A6', '#003E7E', '#22C55E', '#9CA3AF'];

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
  const [apiUserRole, setApiUserRole] = useState("");
  const [apiUserWardId, setApiUserWardId] = useState(null);
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const { user } = useAuth();

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

  useEffect(() => {
    const initApp = async () => {
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

  const fetchLifecycleStats = async () => {
    try {
      const res = await api.get('/api/analytics/dashboard', { 
        params: { 
          start_date: startDate, 
          end_date: endDate,
          node_code: selectedNode?.key || undefined
        } 
      });
      
      const d = res.data;
      // API Dashboard trả về phím 'lifecycle' chứa các con số định danh
      const ls = d.lifecycle || {};
      
      setLifecycleStats({
        ...ls,
        "Tất cả": d.tong_kh || total
      });
    } catch (err) { 
      console.error("Lỗi lấy dữ liệu Dashboard:", err); 
    }
  };

  const fetchCoverage = async () => {
    try {
      const res = await api.get('/api/analytics/data-coverage');
      setCoverage(res.data);
      if (res.data.latest_month && !startDate && !endDate) {
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
    setLoading(true);
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
      
       const res = await api.get('/api/customers', { params });
       setCustomers(res.data.items || []);
       setTotal(res.data.total || 0);
       setTotalPages(res.data.total_pages || 1);
       setPage(res.data.page || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const lifecycleConfig = [
    { 
      label: "Tất cả", 
      value: "", 
      icon: Users, 
      color: "blue",
      gradient: "from-blue-600 to-indigo-700",
      accent: "#0054A6",
      bgLight: "bg-blue-50/80",
      borderCol: "border-indigo-600"
    },
    { 
      label: "KH Hiện hữu", 
      value: "active", 
      icon: CheckCircle2, 
      color: "green",
      gradient: "from-green-500 to-green-700",
      accent: "#22C55E",
      bgLight: "bg-green-50/80",
      borderCol: "border-green-500"
    },
    { 
      label: "KH Mới", 
      value: "new", 
      icon: Star, 
      color: "sky",
      gradient: "from-sky-500 to-blue-700",
      accent: "#0EA5E9",
      bgLight: "bg-sky-50/80",
      borderCol: "border-sky-500"
    },
    { 
      label: "KH Phục hồi", 
      value: "recovered", 
      icon: RefreshCw, 
      color: "indigo",
      gradient: "from-indigo-500 to-indigo-800",
      accent: "#6366F1",
      bgLight: "bg-indigo-50/80",
      borderCol: "border-indigo-500"
    },
    { 
      label: "KH Nguy cơ", 
      value: "at_risk", 
      icon: AlertCircle, 
      color: "orange",
      gradient: "from-orange-400 to-orange-600",
      accent: "#F97316",
      bgLight: "bg-orange-50/80",
      borderCol: "border-orange-500"
    },
    { 
      label: "KH Mất", 
      value: "churned", 
      icon: LogOut, 
      color: "rose",
      gradient: "from-rose-500 to-red-800",
      accent: "#F43F5E",
      bgLight: "bg-rose-50/80",
      borderCol: "border-rose-500"
    },
  ];

  const getRankBadge = (rank) => {
    if (rank === 'Kim Cương') return <span className="flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 shadow-sm">💎 KIM CƯƠNG</span>;
    if (rank === 'Vàng') return <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shadow-sm">🏆 VÀNG</span>;
    if (rank === 'Bạc') return <span className="flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">🥈 BẠC</span>;
    return <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">👤 THƯỜNG</span>;
  };

  const handleExportExcel = async () => {
    try {
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
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `Export_KH_HienHuu_${filters.lifecycle_status || 'All'}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Đã xuất dữ liệu thành công!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi xuất dữ liệu Excel");
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

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

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
    <div className="space-y-6">
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
                <span className="text-[10px] bg-vnpost-orange text-white px-3 py-1 rounded-full font-black uppercase shadow-sm">Phạm vi: {selectedNode.title}</span>
              ) : (
                <span className="text-[10px] bg-vnpost-blue/10 text-vnpost-blue px-3 py-1 rounded-full font-bold uppercase border border-vnpost-blue/10 tracking-tighter">Bưu điện thành phố Huế</span>
              )}
             {(startDate || endDate) && (
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 border border-indigo-100 uppercase tracking-tighter">
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
        </div>
      </div>

      {/* Lifecycle Filter Bar - PREMIUM 3D DASHBOARD STYLE */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {lifecycleConfig.map((item) => {
          const isActive = filters.lifecycle_status === item.value;
          
          const findCount = () => {
            if (item.value === "") return lifecycleStats["Tất cả"] || total;
            return lifecycleStats[item.value] || 0;
          };
          const count = findCount();
          
          return (
            <button
              key={item.label}
              onClick={() => {
                setFilters(prev => ({ ...prev, lifecycle_status: item.value }));
                setPage(1);
              }}
              className={`group relative p-4 pl-5 rounded-2xl transition-all duration-300 flex flex-col items-start gap-1 text-left overflow-hidden border-2 ${
                isActive 
                  ? `bg-white shadow-2xl scale-105 z-10 -translate-y-1 ${item.borderCol} border-l-[6px] ${item.borderCol.replace('border-', 'border-l-')}` 
                  : `${item.bgLight} border-gray-100/50 hover:${item.borderCol} hover:bg-white hover:shadow-xl hover:-translate-y-1 border-l-[6px] ${item.borderCol.replace('border-', 'border-l-')} opacity-80 hover:opacity-100`
              }`}
            >
              {/* Background Glow when Active */}
              {isActive && (
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${item.gradient} opacity-[0.08] rounded-full blur-3xl -mr-10 -mt-10`}></div>
              )}

              <div className="flex items-center justify-between w-full">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                  {item.label}
                </span>
                <item.icon size={16} className={isActive ? `text-${item.color}-600` : "text-gray-400 opacity-40"} />
              </div>
              
              <div className="flex items-baseline gap-1.5 pointer-events-none">
                <span className={`text-2xl font-black font-heading tracking-tight ${
                  isActive ? `text-${item.color}-600` : `text-${item.color}-700`
                }`}>
                  {count.toLocaleString()}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase opacity-60">Khách</span>
              </div>

              {/* Status Indicator Bar (Bottom) */}
              <div className={`absolute bottom-0 left-0 h-1 transition-all duration-500 ${
                isActive ? `w-full bg-gradient-to-r ${item.gradient}` : 'w-0'
              }`}></div>
            </button>
          );
        })}
      </div>

      <div className="card space-y-4 !p-6 shadow-sm border-gray-100 relative z-50">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Admin Hierarchy Filter */}
          <div className="w-72">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1"><MapPin size={12} /> Phạm vi dữ liệu</label>
            <div className="relative">
                <button 
                  onClick={() => setIsTreeOpen(!isTreeOpen)}
                  className={`w-full bg-gray-50 border rounded-2xl px-4 py-3 text-xs font-bold text-vnpost-blue flex justify-between items-center transition-all shadow-inner ${isTreeOpen ? 'bg-white ring-2 ring-vnpost-blue/20 border-vnpost-blue/30' : 'border-gray-100 hover:bg-white'}`}
                >
                  <span className="truncate">{selectedNode ? selectedNode.title : "Bưu điện thành phố Huế"}</span>
                  <ArrowUpRight size={14} className={`transition-transform duration-300 ${isTreeOpen ? 'rotate-180 opacity-100' : 'rotate-90 opacity-40'}`} />
                </button>

                {isTreeOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsTreeOpen(false)}></div>
                    <div className="absolute top-full left-0 w-80 mt-2 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl p-4 z-20 max-h-[400px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chọn Cụm / Bưu cục / Điểm</span>
                        <button onClick={() => setIsTreeOpen(false)} className="text-[10px] font-black text-vnpost-blue uppercase hover:underline">Đóng</button>
                      </div>
                      <TreeExplorer onSelect={(node) => { setSelectedNode(node); setPage(1); setIsTreeOpen(false); }} selectedNode={selectedNode} />
                      <div className="mt-4 pt-4 border-t border-gray-100">
                          <button onClick={() => { setSelectedNode(null); setPage(1); setIsTreeOpen(false); }} className="w-full py-2 bg-vnpost-blue/5 text-vnpost-blue rounded-lg text-[10px] font-black uppercase hover:bg-vnpost-blue hover:text-white transition-all">Đặt lại Bưu điện thành phố Huế</button>
                      </div>
                    </div>
                  </>
                )}
            </div>
          </div>

          <div className="relative flex-1 min-w-[300px] mt-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input 
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              type="text" 
              placeholder="Tìm theo tên khách hàng hoặc mã định danh CRM..." 
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-vnpost-blue focus:ring-4 focus:ring-vnpost-blue/5 transition-all bg-gray-50/30 font-medium"
            />
          </div>
          
          <div className="w-56">
            <select 
              name="rfm_segment" 
              value={filters.rfm_segment} 
              onChange={handleFilterChange}
              className="w-full p-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-vnpost-blue bg-white font-bold text-gray-700 shadow-sm transition-all"
            >
              <option value="">🎯 Phân hạng (Tất cả)</option>
              <option value="Kim Cương">💎 Kim Cương</option>
              <option value="Vàng">🏆 Vàng</option>
              <option value="Bạc">🥈 Bạc</option>
              <option value="Tiềm Năng">✨ Tiềm Năng</option>
              <option value="Thường">👤 Thường</option>
            </select>
          </div>

          <button onClick={handleApplyFilter} className="px-8 py-3 bg-vnpost-blue text-white rounded-2xl font-black hover:bg-[#003E7E] transition-all flex items-center gap-2 shadow-xl shadow-vnpost-blue/20 active:scale-95 uppercase tracking-wider text-xs">
            <Filter size={18} /> Lọc dữ liệu
          </button>
        </div>

        {/* Global Period Filter */}
        <div className="flex flex-wrap gap-4 items-end bg-gradient-to-r from-gray-50 to-white p-5 rounded-2xl border border-gray-100">
          <div className="space-y-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 ml-1">
              <Calendar size={12} /> Từ ngày
            </label>
            <input 
              type="date" 
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-orange/10 outline-none transition-all text-sm font-bold text-gray-700"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setSelectedMonth(""); }}
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 ml-1">
              <Calendar size={12} /> Đến ngày
            </label>
            <input 
              type="date" 
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-orange/10 outline-none transition-all text-sm font-bold text-gray-700"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setSelectedMonth(""); }}
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 ml-1">
              <TrendingUp size={12} /> Chọn nhanh tháng
            </label>
            <select 
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-orange/10 outline-none transition-all text-sm font-black text-vnpost-blue bg-white"
              onChange={(e) => handleQuickMonth(e.target.value)}
              value={selectedMonth}
            >
              <option value="">-- Chọn tháng báo cáo --</option>
              {coverage.months?.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center h-full pt-6">
             <button 
              onClick={() => { setStartDate(""); setEndDate(""); setSelectedMonth(""); fetchCustomers(); }}
              className="text-gray-400 hover:text-red-500 text-[10px] font-black transition-all uppercase tracking-tighter bg-white px-3 py-2.5 rounded-xl border border-dashed hover:border-red-200"
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
                  className="p-4 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors w-32"
                  onClick={() => handleSort('ma_crm_cms')}
                >
                  <div className="flex items-center">Mã CRM <SortIcon column="ma_crm_cms" /></div>
                </th>
                <th 
                  className="p-4 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors w-64"
                  onClick={() => handleSort('ten_kh')}
                >
                  <div className="flex items-center">Tên Khách Hàng <SortIcon column="ten_kh" /></div>
                </th>
                <th 
                  className="p-4 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors w-40"
                  onClick={() => handleSort('status_type')}
                >
                  <div className="flex items-center">Vòng đời <SortIcon column="status_type" /></div>
                </th>
                <th 
                  className="p-4 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors w-32"
                  onClick={() => handleSort('rfm_segment')}
                >
                  <div className="flex items-center">Hạng <SortIcon column="rfm_segment" /></div>
                </th>
                <th 
                  className="p-4 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors text-right w-24"
                  onClick={() => handleSort('transaction_count')}
                >
                  <div className="flex items-center justify-end">Số đơn <SortIcon column="transaction_count" /></div>
                </th>
                <th 
                  className="p-4 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors text-right w-40"
                  onClick={() => handleSort('dynamic_revenue')}
                >
                  <div className="flex items-center justify-end">Doanh thu <SortIcon column="dynamic_revenue" /></div>
                </th>
                <th 
                  className="p-4 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors text-right w-32"
                  onClick={() => handleSort('growth_velocity')}
                >
                  <div className="flex items-center justify-end">Tăng trưởng <SortIcon column="growth_velocity" /></div>
                </th>
                <th 
                  className="p-4 font-black uppercase tracking-tighter cursor-pointer hover:bg-gray-100 transition-colors text-center w-32"
                  onClick={() => handleSort('health_score')}
                >
                  <div className="flex items-center justify-center">Health Score <SortIcon column="health_score" /></div>
                </th>
                <th className="p-4 font-black uppercase tracking-tighter text-center w-32">Bưu cục</th>
                <th className="p-4 font-black uppercase tracking-tighter text-center w-32">Phụ trách</th>
                <th className="p-4 font-black uppercase tracking-tighter text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="11" className="p-20 text-center text-gray-400 font-medium">
                  <RefreshCw className="animate-spin mx-auto mb-3" size={32} />
                  Đang truy vấn dữ liệu từ Server...
                </td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan="11" className="p-20 text-center text-gray-400 font-medium">
                  <TableProperties size={48} className="mx-auto mb-4 text-gray-200" />
                  Không tìm thấy khách hàng nào khớp với điều kiện lọc.
                </td></tr>
              ) : (
                customers.map(c => (
                  <tr key={c.ma_crm_cms} onClick={() => handleRowClick(c.ma_crm_cms)} className="group transition-all duration-300 cursor-pointer hover:bg-indigo-50/30">
                    <td className="p-4">
                      <span className="font-mono text-[11px] font-black px-2 py-1 rounded-md bg-blue-50 text-vnpost-blue">
                        {c.ma_crm_cms}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 group-hover:text-vnpost-blue transition-colors">{c.ten_kh}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryTarget({ ma_kh: c.ma_crm_cms, ten_kh: c.ten_kh });
                            setShowHistoryModal(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-vnpost-blue transition-colors"
                          title="Xem lịch sử tiếp cận"
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                       {(() => {
                         const status = lifecycleConfig.find(l => l.value === c.status_type) || lifecycleConfig[0];
                         return (
                           <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm border-${status.color}-200 bg-${status.color}-50 text-${status.color}-700`}>
                             <status.icon size={14} className={c.status_type === 'new' ? 'animate-bounce' : ''} />
                             {(() => {
                               if (c.status_type === 'active') return 'Khách hàng Hiện hữu';
                               if (c.status_type === 'new') return 'Khách hàng Mới';
                               if (c.status_type === 'recovered') return 'Khách hàng Phục hồi';
                               if (c.status_type === 'at_risk') return 'Khách hàng Nguy cơ';
                               if (c.status_type === 'churned') return 'Khách hàng Mất';
                               return c.status_type;
                             })()}
                           </span>
                         );
                       })()}
                    </td>
                    <td className="p-4">
                      {getRankBadge(c.rfm_segment)}
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-gray-700">{c.transaction_count} đơn</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-black text-sm ${c.dynamic_revenue > 1000000 ? 'text-vnpost-blue' : 'text-gray-700'}`}>
                          {formatCurrency(c.dynamic_revenue)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className={`inline-flex items-center justify-end gap-1 px-3 py-1.5 rounded-xl font-black text-xs shadow-sm border ${
                        c.growth_velocity > 0 
                          ? 'bg-green-50 text-green-600 border-green-100' 
                          : c.growth_velocity < 0 
                          ? 'bg-rose-50 text-rose-600 border-rose-100' 
                          : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        <TrendingUp size={14} className={c.growth_velocity > 0 ? 'text-green-500' : 'text-red-400'} />
                        {c.growth_velocity > 0 ? '+' : ''}{c.growth_velocity.toFixed(1)}%
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl border-2 shadow-sm font-heading ${
                        c.health_score >= 80 ? 'border-green-500 bg-green-50 text-green-700' : 
                        c.health_score >= 50 ? 'border-vnpost-orange bg-orange-50 text-vnpost-orange' : 
                        'border-red-500 bg-red-50 text-red-700'
                      }`}>
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-black leading-none">{c.health_score}</span>
                          <span className="text-[7px] font-bold uppercase tracking-tighter opacity-70">Points</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                       <span className="text-[10px] font-black border border-gray-100 bg-gray-50 px-3 py-1.5 rounded-2xl text-gray-500 shadow-sm" title={`${c.point_code || ''} - ${c.point_name || ''}`}>
                         {c.point_code && c.point_name ? `${c.point_code} - ${c.point_name}` : (c.point_name || c.point_code || 'N/A')}
                       </span>
                    </td>
                    <td className="p-4 text-center">
                       <div className="flex flex-col items-center">
                         {c.assigned_staff_name ? (
                           <span className="text-[10px] font-black text-vnpost-blue bg-blue-50 px-2 py-1 rounded border border-blue-100 uppercase">
                             👤 {c.assigned_staff_name}
                           </span>
                         ) : (
                           <span className="text-[10px] text-gray-300 font-bold italic uppercase">Chưa gán</span>
                         )}
                       </div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignTarget({ ma_kh: c.ma_crm_cms, ten_kh: c.ten_kh, nhom_kh: c.status_type, rfm_segment: c.rfm_segment });
                          setSelectedStaffId(c.assigned_staff_id || "");
                          setShowAssignModal(true);
                        }}
                        className="p-2 text-vnpost-orange hover:bg-orange-50 rounded-lg transition-all active:scale-90"
                        title="Giao việc cho nhân viên"
                      >
                        <UserPlus size={18} />
                      </button>
                    </td>
                  </tr>
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
                <h3 className="text-xl font-black flex items-center gap-2">
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
              <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 bg-gray-50/50">
              {loadingDetails ? (
                <div className="text-center py-20 text-gray-500">Đang tải biểu đồ tỉ trọng và thông tin...</div>
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

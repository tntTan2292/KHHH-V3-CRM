import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Target, 
  Search, 
  Calendar, 
  TrendingUp, 
  Package, 
  DollarSign, 
  ChevronRight,
  ChevronLeft,
  Info,
  ArrowUpRight,
  History,
  Activity,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Award,
  Star,
  Zap,
  Users,
  MapPin,
  Filter,
  X,
  RefreshCw,
  Save,
  AlertTriangle,
  Download
} from 'lucide-react';
import TreeExplorer from '../components/TreeExplorer';
import CustomerHistoryModal from '../components/CustomerHistoryModal';
import PotentialTransactionModal from '../components/PotentialTransactionModal';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const PotentialCustomers_V3 = () => {
  const [data, setData] = useState({ items: [], total: 0, page: 1, total_pages: 1, summary: {} });
  const [loading, setLoading] = useState(true);
  const [waitingForDefaultDate, setWaitingForDefaultDate] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minDays, setMinDays] = useState(3);
  const [rfmSegment, setRfmSegment] = useState("Kim Cương");
  const [coverage, setCoverage] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'tong_doanh_thu', direction: 'desc' });
  const [pageSize, setPageSize] = useState(10);
  const [selectedNode, setSelectedNode] = useState(null);
  const [page, setPage] = useState(1);
  const [staffOptions, setStaffOptions] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); 
  
  // History Tracker
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignContent, setAssignContent] = useState("");
  const [assignDeadline, setAssignDeadline] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [pointOptions, setPointOptions] = useState([]);
  const [selectedPointId, setSelectedPointId] = useState("");
  const [wardOptions, setWardOptions] = useState([]);
  const [selectedWardId, setSelectedWardId] = useState("");
  const [apiUserRole, setApiUserRole] = useState("");
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [apiUserWardId, setApiUserWardId] = useState(null);
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [activeTab, setActiveTab] = useState("pool"); // pool | pipeline
  const { user } = useAuth();
  
  // Drill-down Modal State
  const [showTxModal, setShowTxModal] = useState(false);
  const [txTarget, setTxTarget] = useState(null);

  const getTaskFlow = (target) => {
    if (!target) return { type: 'Giao Lead', color: 'from-emerald-500 to-teal-700', text: 'GIAO LEAD MỚI', subtitle: 'Tiếp cận khách vãng lai' };
    
    if (target.nhom_kh === 'Kim Cương' || target.nhom_kh === 'Vàng') {
      return { type: 'Giao VIP', color: 'from-amber-500 to-yellow-600', text: 'CHĂM SÓC VIP', subtitle: 'Tiếp cận khách vãng lai tiềm năng cao' };
    }
    
    return { type: 'Giao Lead', color: 'from-emerald-500 to-teal-700', text: 'GIAO LEAD MỚI', subtitle: 'Tiếp cận khách vãng lai' };
  };

  const getEffectiveNodeCode = () => {
    if (selectedNode?.key) return selectedNode.key;
    if (!user?.scope || user.scope === "Toàn tỉnh") return undefined;
    return user.scope;
  };

  const buildPotentialParams = (currentPage = page, currentPageSize = pageSize) => ({
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    min_days: minDays,
    sort_by: sortConfig.key,
    order: sortConfig.direction,
    page: currentPage,
    page_size: currentPageSize,
    node_code: getEffectiveNodeCode(),
    rfm_segment: rfmSegment || undefined
  });

  const fetchPotentialData = async (currentPage = page, currentPageSize = pageSize) => {
    if (waitingForDefaultDate) return;
    setLoading(true);
    try {
      const params = buildPotentialParams(currentPage, currentPageSize);
      const res = await api.get('/api/potential', { params });
      setData(res.data);
      // Sync ng??y th???c t??? t??? backend khi backend auto-pick th??ng m???i nh???t
      if (res.data.applied_dates) {
        const ad = res.data.applied_dates;
        if (ad.start && !startDate) setStartDate(ad.start);
        if (ad.end && !endDate) setEndDate(ad.end);
      }
    } catch (err) {
      console.error('L???i t???i d??? li???u kh??ch h??ng ti???m n??ng V3:', err);
      toast.error("Kh??ng th??? t???i d??? li???u ti???m n??ng. Vui l??ng th??? l???i.");
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

  useEffect(() => {
    fetchCoverage();
  }, []);

  useEffect(() => {
    if (showAssignModal && assignTarget) {
      const fetchTmpl = async () => {
         try {
            const res = await api.get('/api/actions/templates', { 
              params: { loai_doi_tuong: 'TiemNang', nhom_kh: assignTarget.nhom_kh } 
            });
            setTemplates(res.data);
         } catch(e) {}
      };
      const fetchStaff = async () => {
         try {
            const res = await api.get('/api/customers/staff-options', {
              params: { target_id: assignTarget.ten_kh, type: 'TiemNang', username: user?.username }
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
    }
  }, [showAssignModal, assignTarget]);

  useEffect(() => {
    fetchPotentialData(page, pageSize);
  }, [startDate, endDate, minDays, sortConfig, rfmSegment, pageSize, selectedNode, waitingForDefaultDate, page]);

  const handleAssignSubmit = async () => {
    if (!selectedStaffId) {
      toast.warning("Vui lòng chọn nhân sự để phân công");
      return;
    }
    setAssigning(true);
    try {
      const flowInfo = getTaskFlow(assignTarget);
      await api.post(`/api/actions/assign`, {
        target_id: assignTarget.ten_kh,
        loai_doi_tuong: 'TiemNang',
        staff_id: selectedStaffId,
        noi_dung: assignContent,
        deadline: assignDeadline ? new Date(assignDeadline).toISOString() : null,
        template_id: selectedTemplateId || null,
        phan_loai_giao_viec: flowInfo.type
      });
      toast.success(`Đã giao việc tiếp cận khách vãng lai thành công!`);
      setShowAssignModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi phân công nhân sự");
    } finally {
      setAssigning(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      toast.info("Đang chuẩn bị dữ liệu tiềm năng...");
      const { page: _page, page_size: _pageSize, ...params } = buildPotentialParams();

      const response = await api.get('/api/export/potential', {
        params,
        responseType: 'blob',
        timeout: 300000,
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
      
      let filename = `Export_KH_TiemNang_${rfmSegment || 'All'}.xlsx`;
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

      toast.success("Đã xuất dữ liệu tiềm năng thành công!");
    } catch (err) {
      console.error("EXPORT ERROR:", err);
      const errorMsg = err.response?.data?.detail || err.message || "Lỗi không xác định";
      toast.error(`Lỗi khi xuất dữ liệu Excel: ${errorMsg}`);
    }
  };

  const fetchCoverage = async () => {
    try {
      const res = await api.get('/api/analytics/data-coverage');
      setCoverage(res.data);
      if (!startDate && !endDate && res.data.latest_month) {
        const latest = res.data.latest_month;
        setStartDate(latest.start);
        setEndDate(latest.end);
      }
    } catch (err) { console.error(err); }
    finally {
      setWaitingForDefaultDate(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 'Kim Cương') return <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200 shadow-sm animate-pulse">💎 KIM CƯƠNG</span>;
    if (rank === 'Vàng') return <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 shadow-sm">🏆 VÀNG</span>;
    if (rank === 'Bạc') return <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 shadow-sm">🥈 BẠC</span>;
    return <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 bg-gray-50/50 px-3 py-1 rounded-xl border border-gray-100 italic">👤 THƯỜNG</span>;
  };

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const segmentConfig = [
    { label: "Kim Cương", value: "Kim Cương", icon: Award, color: "indigo", gradient: "from-indigo-600 to-blue-800", bg: "bg-indigo-50" },
    { label: "Vàng", value: "Vàng", icon: Star, color: "amber", gradient: "from-amber-500 to-orange-600", bg: "bg-amber-50" },
    { label: "Bạc", value: "Bạc", icon: Zap, color: "slate", gradient: "from-slate-400 to-slate-600", bg: "bg-slate-50" },
    { label: "Thường", value: "Thường", icon: Users, color: "gray", gradient: "from-gray-400 to-gray-500", bg: "bg-gray-50" },
    { label: "Tất cả", value: "Tất cả", icon: Package, color: "blue", gradient: "from-blue-600 to-vnpost-blue", bg: "bg-blue-50" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {showAssignModal && (
        <div className="fixed inset-0 bg-[#003E7E]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-scale-up border-8 border-white">
            <div className={`bg-gradient-to-r ${getTaskFlow(assignTarget).color} p-8 text-white flex justify-between items-center rounded-t-2xl transition-colors duration-500`}>
              <div>
                <div className="flex items-center gap-2">
                   <h3 className="text-xl font-black uppercase tracking-tight">{getTaskFlow(assignTarget).text}</h3>
                   <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{getTaskFlow(assignTarget).type}</span>
                </div>
                <p className="text-xs font-bold text-white/80 mt-1 uppercase tracking-widest">{getTaskFlow(assignTarget).subtitle}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 italic">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-tighter">Đang thực hiện cho:</p>
                <p className="text-sm font-black text-vnpost-blue mt-1 underline">{assignTarget?.ten_kh}</p>
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
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nội dung công việc</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-vnpost-blue outline-none transition-all text-sm font-medium bg-white min-h-[100px]"
                  placeholder="Nhập nội dung cần nhân sự thực hiện..."
                  value={assignContent}
                  onChange={(e) => setAssignContent(e.target.value)}
                ></textarea>
              </div>

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
                  Kích hoạt 5B
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-vnpost-blue mb-1">
             <Target size={20} className="text-vnpost-orange" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em]">Hệ thống chỉ đạo 5B Elite</span>
          </div>
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">
            Quản trị & Chinh phục Tiềm năng
          </h2>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex p-1.5 bg-gray-100/80 backdrop-blur-md rounded-2xl w-fit border border-gray-200">
        <button 
          onClick={() => setActiveTab("pool")}
          className={`px-8 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'pool' ? 'bg-white text-vnpost-blue shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Package size={16} /> KHO TIỀM NĂNG (POOL)
        </button>
        <button 
          onClick={() => setActiveTab("pipeline")}
          className={`px-8 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'pipeline' ? 'bg-white text-vnpost-blue shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Zap size={16} className="text-vnpost-orange" /> GIÁM SÁT 5B (OVERSIGHT)
        </button>
      </div>

      {activeTab === 'pool' ? (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
          
          {/* Segment Filter Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {segmentConfig.map((item) => {
              const isActive = rfmSegment === item.value || (rfmSegment === "" && item.value === "Tất cả");
              const count = data.summary?.[item.value] || 0;
              
              return (
                <button
                  key={item.value}
                  onClick={() => {
                    setRfmSegment(item.value === "Tất cả" ? "" : item.value);
                    setPage(1);
                  }}
                  className={`group relative p-4 rounded-2xl transition-all duration-300 flex flex-col items-start gap-1 text-left border-2 ${
                    isActive 
                      ? `bg-white shadow-xl scale-105 z-10 -translate-y-1 border-${item.color}-500 border-l-[6px]` 
                      : `${item.bg} border-gray-100/50 hover:border-${item.color}-500 hover:bg-white hover:shadow-lg hover:-translate-y-1 border-l-[6px] opacity-80 hover:opacity-100`
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                      {item.label}
                    </span>
                    <item.icon size={16} className={isActive ? `text-${item.color}-600` : "text-gray-400 opacity-40"} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-black tracking-tight ${isActive ? `text-${item.color}-600` : `text-${item.color}-700`}`}>
                      {loading ? "..." : count.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase opacity-60">Khách</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="card !p-8 shadow-2xl border-white bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-gray-200/30">
            {/* Filters */}
            <div className="flex flex-wrap gap-6 items-end bg-gray-50/80 p-8 rounded-[2rem] border border-gray-100 mb-8">
              <div className="space-y-3 w-72">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2"><MapPin size={14} /> Phạm vi dữ liệu</label>
                <div className="relative">
                   <button 
                     onClick={() => setIsTreeOpen(!isTreeOpen)}
                     className={`w-full bg-white border rounded-[1.2rem] px-5 py-4 text-xs font-bold text-vnpost-blue flex justify-between items-center shadow-sm transition-all ${isTreeOpen ? 'ring-2 ring-vnpost-blue/20 border-vnpost-blue/30' : 'border-gray-100 hover:bg-gray-50'}`}
                   >
                     <span className="truncate">{selectedNode ? selectedNode.title : (user?.scope || "Toàn tỉnh")}</span>
                     <ChevronDown size={14} className={`transition-transform duration-300 ${isTreeOpen ? 'rotate-180' : ''}`} />
                   </button>

                   {isTreeOpen && (
                     <>
                       <div className="fixed inset-0 z-10" onClick={() => setIsTreeOpen(false)}></div>
                       <div className="absolute top-full left-0 w-80 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 z-20 animate-in fade-in slide-in-from-top-2">
                         <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chọn Phạm vi dữ liệu</span>
                           <button onClick={() => setIsTreeOpen(false)} className="text-[10px] font-black text-vnpost-blue uppercase hover:underline">Đóng</button>
                         </div>
                         <TreeExplorer onSelect={(node) => { setSelectedNode(node); setPage(1); setIsTreeOpen(false); }} selectedNode={selectedNode} />
                         <button onClick={() => { setSelectedNode(null); setPage(1); setIsTreeOpen(false); }} className="w-full mt-4 py-2 bg-gray-100 text-[10px] font-black uppercase rounded-lg hover:bg-vnpost-blue hover:text-white transition-all">Đặt lại Bưu điện thành phố Huế</button>
                       </div>
                     </>
                   )}
                 </div>
              </div>
              <div className="space-y-3 flex-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2"><Calendar size={14} /> Từ ngày</label>
                <input type="date" className="w-full px-5 py-4 rounded-[1.2rem] border border-gray-200 outline-none text-sm font-bold bg-white" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-3 flex-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2"><Calendar size={14} /> Đến ngày</label>
                <input type="date" className="w-full px-5 py-4 rounded-[1.2rem] border border-gray-200 outline-none text-sm font-bold bg-white" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <button onClick={() => setPage(1)} className="px-10 py-4 h-[58px] bg-vnpost-blue text-white rounded-[1.2rem] font-black hover:bg-[#003E7E] transition-all flex items-center gap-3 uppercase tracking-widest text-xs">
                {loading ? <RefreshCw className="animate-spin" size={20} /> : <Filter size={20} />} Lọc dữ liệu
              </button>
              <button onClick={handleExportExcel} className="px-10 py-4 h-[58px] bg-emerald-600 text-white rounded-[1.2rem] font-black hover:bg-emerald-700 transition-all flex items-center gap-3 uppercase tracking-widest text-xs shadow-lg shadow-emerald-200">
                <Download size={20} /> Xuất Excel
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-100 rounded-[2.5rem] bg-white">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#fcfdfe] text-gray-400 border-b border-gray-50">
                  <tr>
                    <th className="p-6 font-black uppercase text-[10px]">Pos</th>
                    <th className="p-6 font-black uppercase text-[10px] cursor-pointer hover:text-vnpost-blue transition-colors" onClick={() => handleSort('ten_kh')}>
                      <div className="flex items-center">Chủ hàng vãng lai <SortIcon column="ten_kh" /></div>
                    </th>
                    <th className="p-6 font-black uppercase text-[10px] text-center cursor-pointer hover:text-vnpost-blue transition-colors" onClick={() => handleSort('point_name')}>
                      <div className="flex items-center justify-center">Bưu Cục Quản lý <SortIcon column="point_name" /></div>
                    </th>
                    <th className="p-6 font-black uppercase text-[10px] text-center cursor-pointer hover:text-vnpost-blue transition-colors" onClick={() => handleSort('so_ngay_gui')}>
                      <div className="flex items-center justify-center">Tần suất (Ngày) <SortIcon column="so_ngay_gui" /></div>
                    </th>
                    <th className="p-6 font-black uppercase text-[10px] text-center cursor-pointer hover:text-vnpost-blue transition-colors" onClick={() => handleSort('tong_so_don')}>
                      <div className="flex items-center justify-center">Sản lượng <SortIcon column="tong_so_don" /></div>
                    </th>
                    <th className="p-6 font-black uppercase text-[10px] text-right cursor-pointer hover:text-vnpost-blue transition-colors" onClick={() => handleSort('tong_doanh_thu')}>
                      <div className="flex items-center justify-end">Doanh Thu <SortIcon column="tong_doanh_thu" /></div>
                    </th>
                    <th className="p-6 font-black uppercase text-[10px] text-center cursor-pointer hover:text-vnpost-blue transition-colors" onClick={() => handleSort('rfm_segment')}>
                      <div className="flex items-center justify-center">Phân hạng <SortIcon column="rfm_segment" /></div>
                    </th>
                    <th className="p-6 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50/50">
                  {loading ? (
                    <tr><td colSpan="8" className="p-20 text-center animate-pulse font-black text-gray-300 uppercase tracking-widest">Đang kết nối trung tâm dữ liệu...</td></tr>
                  ) : data.items?.length === 0 ? (
                    <tr><td colSpan="8" className="p-20 text-center font-bold text-gray-400 italic">Không có khách hàng nào trong phân khúc này.</td></tr>
                  ) : data.items?.map((item, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-all group">
                      <td className="p-6 text-gray-300 font-black text-center text-xs">{(page - 1) * pageSize + index + 1}</td>
                      <td className="p-6 font-bold text-gray-800">
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => {
                               setTxTarget({ 
                                 ten_kh: item.ten_kh, 
                                 dia_chi_full: item.dia_chi_full, 
                                 ma_bc: item.ma_bc 
                               });
                               setShowTxModal(true);
                             }}
                             className="text-left hover:text-vnpost-blue hover:underline hover:underline-offset-4 transition-all block"
                           >
                             <span className="block">{item.ten_kh}</span>
                             {item.dia_chi_rut_gon && (
                               <span className="text-[10px] text-gray-400 font-medium block truncate max-w-[150px]">
                                 {item.dia_chi_rut_gon}
                               </span>
                             )}
                           </button>
                           <button 
                             onClick={() => {
                               setHistoryTarget(item);
                               setShowHistoryModal(true);
                             }}
                             className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-vnpost-blue transition-colors ml-auto"
                             title="Xem lịch sử tương tác"
                           >
                             <History size={14} />
                           </button>
                        </div>
                      </td>
                      <td className="p-6 text-center text-xs font-black text-gray-400 uppercase">{item.point_name || 'N/A'}</td>
                      <td className="p-6 text-center font-black text-indigo-600">{item.so_ngay_gui}</td>
                      <td className="p-6 text-center font-black text-gray-800">{item.tong_so_don.toLocaleString()}</td>
                      <td className="p-6 text-right font-black text-vnpost-blue">{formatCurrency(item.tong_doanh_thu)}</td>
                      <td className="p-6 text-center">{getRankBadge(item.rfm_segment)}</td>
                      <td className="p-6 text-center">
                        <button 
                          onClick={() => {
                            setAssignTarget({ ten_kh: item.ten_kh, nhom_kh: item.rfm_segment });
                            setShowAssignModal(true);
                          }}
                          className="p-3 bg-vnpost-orange/10 hover:bg-vnpost-orange text-vnpost-orange hover:text-white rounded-xl transition-all"
                        >
                          <Target size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="mt-8 flex justify-between items-center px-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hiển thị {data.items?.length} / {data.total} khách hàng</span>
                <div className="flex gap-2">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-4 rounded-xl border border-gray-100 hover:bg-gray-50 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="flex items-center px-6 font-black text-vnpost-blue bg-blue-50 rounded-xl border border-blue-100">
                    Trang {page} / {data.total_pages}
                  </div>
                  <button 
                    disabled={page === data.total_pages}
                    onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                    className="p-4 rounded-xl border border-gray-100 hover:bg-gray-50 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
           {/* Oversight Tab UI */}
           <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center">
              <div className="p-8 bg-blue-50 text-blue-600 rounded-[2.5rem] mb-6 animate-pulse">
                 <Zap size={60} />
              </div>
              <h3 className="text-xl font-black text-gray-800 uppercase">Đang tải dữ liệu chiến trường...</h3>
              <p className="text-sm text-gray-400 font-bold mt-2 max-w-md">Hệ thống đang đồng bộ báo cáo từ nhân viên thực địa. Vui lòng đợi trong giây lát.</p>
           </div>
        </div>
      )}

      <CustomerHistoryModal 
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        targetId={historyTarget?.ten_kh}
        loaiDoiTuong="TiemNang"
        customerName={historyTarget?.ten_kh}
      />
      
      <PotentialTransactionModal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
        customerName={txTarget}
        startDate={startDate}
        endDate={endDate}
        nodeCode={getEffectiveNodeCode()}
      />
    </div>
  );
};

export default PotentialCustomers_V3;

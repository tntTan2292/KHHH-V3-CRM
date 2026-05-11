import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Calendar, 
  ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Filter, Search, Download, Target, 
  ArrowUpRight, ArrowDownRight, ArrowUpDown, RefreshCw, Info,
  MapPin, Building2, Landmark, Store
} from 'lucide-react';
import { toast } from 'react-toastify';
import TreeSelect from '../components/TreeSelect';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
};

export default function MovementReport() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], summary: {} });
  const [aggregateData, setAggregateData] = useState([]);
  const [viewMode, setViewMode] = useState('detail'); // 'detail' or 'aggregate'
  const [filters, setFilters] = useState({
    start_a: '', end_a: '',
    start_b: '', end_b: '',
    rfm_segment: '',
    nhom_kh: '',
    node_code: ''
  });
  const [statusFilter, setStatusFilter] = useState(null); // 'New', 'Lost', 'Growing', 'Declining'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'diff', direction: 'desc' });

  const [options, setOptions] = useState({ rfm: [], nhom: [] });
  const [hierarchy, setHierarchy] = useState({
    centers: [],
    clusters: [],
    wards: [],
    points: []
  });

  // 1. Initial Load & Defaults
  useEffect(() => {
    const init = async () => {
      try {
        const optRes = await api.get('/api/customers/filters');
        setOptions({ rfm: optRes.data.rfm_segment || [], nhom: optRes.data.nhom_kh || [] });

        const covRes = await api.get('/api/analytics/data-coverage');
        if (covRes.data && covRes.data.latest_month) {
          const { start, end } = covRes.data.latest_month;
          const dt_start_a = new Date(start);
          const dt_start_b = new Date(dt_start_a);
          dt_start_b.setMonth(dt_start_b.getMonth() - 1);
          
          const yb = dt_start_b.getFullYear();
          const mb = String(dt_start_b.getMonth() + 1).padStart(2, '0');
          const lastDayB = new Date(yb, dt_start_b.getMonth() + 1, 0).getDate();
          
          setFilters(prev => ({
            ...prev,
            start_a: start,
            end_a: end,
            start_b: `${yb}-${mb}-01`,
            end_b: `${yb}-${mb}-${lastDayB}`
          }));
        }

        const centerRes = await api.get('/api/nodes/children');
        setHierarchy(prev => ({ ...prev, centers: centerRes.data || [] }));
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, []);

  // 2. Hierarchical Dropdown Logic (Legacy - Kept for compatibility if needed, but we now use TreeSelect)
  const handleHierarchyChange = (code) => {
    setFilters(prev => ({ ...prev, node_code: code }));
  };

  // 3. Fetch Report
  const fetchReport = async () => {
    if (!filters.start_a || !filters.end_a || !filters.start_b || !filters.end_b) {
      toast.warning("Vui lòng chọn đầy đủ 2 dải ngày so sánh");
      return;
    }
    setLoading(true);
    try {
      if (viewMode === 'aggregate') {
        const res = await api.get('/api/reports/movement/aggregate', {
          params: {
            start_a: filters.start_a,
            end_a: filters.end_a,
            start_b: filters.start_b,
            end_b: filters.end_b,
            node_code: filters.node_code || undefined
          }
        });
        setAggregateData(res.data);
      } else {
        const res = await api.get('/api/reports/movement', {
          params: {
            start_a: filters.start_a,
            end_a: filters.end_a,
            start_b: filters.start_b,
            end_b: filters.end_b,
            rfm_segment: filters.rfm_segment || undefined,
            nhom_kh: filters.nhom_kh || undefined,
            node_code: filters.node_code || undefined
          }
        });
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi tải báo cáo");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!filters.start_a || !filters.end_a || !filters.start_b || !filters.end_b) {
      toast.warning("Vui lòng chọn dải ngày trước khi xuất");
      return;
    }
    try {
      toast.info("Đang chuẩn bị báo cáo biến động...");
      const response = await api.get('/api/reports/movement/export', {
        params: {
          start_a: filters.start_a,
          end_a: filters.end_a,
          start_b: filters.start_b,
          end_b: filters.end_b,
          node_code: filters.node_code || undefined,
          rfm_segment: filters.rfm_segment || undefined,
          nhom_kh: filters.nhom_kh || undefined,
          view_mode: viewMode
        },
        responseType: 'blob',
        timeout: 300000
      });
      
      if (response.data.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = () => {
          const errorData = JSON.parse(reader.result);
          toast.error(`Lỗi: ${errorData.detail || 'Không xác định'}`);
        };
        reader.readAsText(response.data);
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      const prefix = viewMode === 'aggregate' ? 'TongHop' : 'ChiTiet';
      
      const safeStart = filters.start_a.replace(/\//g, '-');
      const safeEnd = filters.end_a.replace(/\//g, '-');
      
      link.setAttribute('download', `${prefix}_BienDong_${safeStart}_${safeEnd}.xlsx`);
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success("Đã xuất báo cáo thành công");
    } catch (err) {
      console.error("EXPORT ERROR:", err);
      
      // Chẩn đoán sâu: Giải mã Blob nếu có
      let errorMsg = "Không xác định";
      if (err.response?.data instanceof Blob) {
        errorMsg = await err.response.data.text();
      } else {
        errorMsg = JSON.stringify(err.response?.data || err.message);
      }

      alert(`[HỆ THỐNG TÌM LỖI - ELITE CRM]
      - URL: ${err.config?.url}
      - Mã lỗi: ${err.response?.status}
      - Chi tiết: ${errorMsg}
      
      Sếp hãy chụp ảnh bảng này gửi tôi nhé!`);
      
      toast.error("Lỗi khi xuất báo cáo (Xem chi tiết ở bảng Alert)");
    }
  };

  const handleDrillDown = async (node) => {
    const newFilters = { ...filters, node_code: node.node_code };
    setFilters(newFilters);
    setViewMode('detail');
    setLoading(true);
    try {
      const res = await api.get('/api/reports/movement', {
        params: {
          start_a: filters.start_a,
          end_a: filters.end_a,
          start_b: filters.start_b,
          end_b: filters.end_b,
          node_code: node.node_code
        }
      });
      setData(res.data);
      toast.success(`Đã chuyển sâu xuống: ${node.node_name}`);
    } catch (err) {
      toast.error("Lỗi khi drill-down");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-gray-50 border-2 border-gray-50 rounded-xl px-4 py-2 text-xs font-bold text-vnpost-blue outline-none focus:border-vnpost-blue focus:bg-white transition-all shadow-sm";
  const selectClass = "w-full bg-gray-50 border-2 border-gray-50 rounded-xl px-4 py-2 text-xs font-bold text-gray-700 outline-none focus:border-vnpost-blue focus:bg-white transition-all shadow-sm cursor-pointer";

  return (
    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-vnpost-blue">
            <TrendingUp size={16} className="text-vnpost-orange" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Business Intelligence Center</span>
          </div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Báo Cáo Biến Động Khách Hàng</h1>
          <p className="text-gray-400 text-xs font-medium italic">So sánh hiệu quả kinh doanh giữa 2 kỳ tùy biến</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-gray-100 p-1.5 rounded-2xl flex gap-1 shadow-inner">
             <button 
                onClick={() => setViewMode('detail')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'detail' ? 'bg-white text-vnpost-blue shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
             >
                Cá nhân KH
             </button>
             <button 
                onClick={() => setViewMode('aggregate')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'aggregate' ? 'bg-white text-vnpost-blue shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
             >
                Tổng hợp Đơn vị
             </button>
          </div>
          <button 
            onClick={handleExport}
            className="px-6 py-3 bg-white text-emerald-600 border-2 border-emerald-50 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-emerald-50 transition-all"
          >
            <Download size={16} />
            Xuất Excel
          </button>
          <button 
            onClick={fetchReport}
            className="px-8 py-3 bg-vnpost-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Chạy Báo Cáo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-2">
             <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1">
               <Calendar size={12} className="text-vnpost-blue" /> Dải ngày so sánh
             </h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <p className="text-[9px] font-black text-vnpost-blue uppercase ml-1">Kỳ Hiện Tại (Kỳ A)</p>
                   <div className="flex gap-2">
                      <input type="date" value={filters.start_a} onChange={e => setFilters({...filters, start_a: e.target.value})} className={inputClass} />
                      <input type="date" value={filters.end_a} onChange={e => setFilters({...filters, end_a: e.target.value})} className={inputClass} />
                   </div>
                </div>
                <div className="space-y-1">
                   <p className="text-[9px] font-black text-gray-400 uppercase ml-1">Kỳ Đối Chiếu (Kỳ B)</p>
                   <div className="flex gap-2">
                      <input type="date" value={filters.start_b} onChange={e => setFilters({...filters, start_b: e.target.value})} className={inputClass} />
                      <input type="date" value={filters.end_b} onChange={e => setFilters({...filters, end_b: e.target.value})} className={inputClass} />
                   </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-6 space-y-2">
             <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-1">
               <MapPin size={12} className="text-vnpost-blue" /> Phân vùng địa bàn (Elite Hierarchy)
             </h3>
             <div className="w-full">
                <TreeSelect 
                  value={filters.node_code} 
                  onChange={val => handleHierarchyChange(val)} 
                  placeholder="-- Chọn Đơn vị / Cụm / Bưu cục --"
                  valueType="key"
                />
             </div>
             <p className="text-[9px] text-gray-400 italic">Hệ thống sẽ tự động tổng hợp dữ liệu cho đơn vị được chọn và tất cả các đơn vị trực thuộc.</p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-50 flex items-center gap-4">
           <div className="flex-1 flex gap-3">
              <select value={filters.rfm_segment} onChange={e => setFilters({...filters, rfm_segment: e.target.value})} className={selectClass}>
                 <option value="">-- Tất cả hạng RFM --</option>
                 {options.rfm.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select value={filters.nhom_kh} onChange={e => setFilters({...filters, nhom_kh: e.target.value})} className={selectClass}>
                 <option value="">-- Tất cả nhóm KH --</option>
                 {options.nhom.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl shadow bg-gradient-to-br from-blue-500 to-blue-700 text-white">
           <div className="flex justify-between items-start">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Doanh thu Kỳ A</p>
              <DollarSign size={16} className="opacity-30" />
           </div>
           <h3 className="text-lg font-black mt-1">{formatCurrency(data.summary.total_rev_a)}</h3>
        </div>

        <button 
           onClick={() => setStatusFilter(statusFilter === 'New' ? null : 'New')}
           className={`p-4 rounded-xl shadow-sm transition-all hover:-translate-y-1 text-left border-2 ${statusFilter === 'New' ? 'border-emerald-500 bg-emerald-50/30' : 'border-transparent bg-white'}`}
        >
           <div className="flex justify-between items-start">
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Khách Mới</p>
              <Users size={16} className="text-emerald-200" />
           </div>
           <h3 className="text-xl font-black text-gray-800 mt-1">{data.summary.new_count || 0}</h3>
        </button>

        <button 
           onClick={() => setStatusFilter(statusFilter === 'Lost' ? null : 'Lost')}
           className={`p-4 rounded-xl shadow-sm transition-all hover:-translate-y-1 text-left border-2 ${statusFilter === 'Lost' ? 'border-red-500 bg-red-50/30' : 'border-transparent bg-white'}`}
        >
           <div className="flex justify-between items-start">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Ngừng Gửi</p>
              <Users size={16} className="text-red-200" />
           </div>
           <h3 className="text-xl font-black text-gray-800 mt-1">{data.summary.lost_count || 0}</h3>
        </button>

        <button 
           onClick={() => setStatusFilter(statusFilter === 'Growing' ? null : 'Growing')}
           className={`p-4 rounded-xl shadow-sm transition-all hover:-translate-y-1 text-left border-2 ${statusFilter === 'Growing' ? 'border-blue-500 bg-blue-50/30' : 'border-transparent bg-white'}`}
        >
           <div className="flex justify-between items-start">
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Tăng Trưởng</p>
              <TrendingUp size={16} className="text-blue-200" />
           </div>
           <h3 className="text-xl font-black text-gray-800 mt-1">{data.summary.growing_count || 0}</h3>
        </button>

        <button 
           onClick={() => setStatusFilter(statusFilter === 'Declining' ? null : 'Declining')}
           className={`p-4 rounded-xl shadow-sm transition-all hover:-translate-y-1 text-left border-2 ${statusFilter === 'Declining' ? 'border-orange-500 bg-orange-50/30' : 'border-transparent bg-white'}`}
        >
           <div className="flex justify-between items-start">
              <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Suy Giảm</p>
              <TrendingDown size={16} className="text-orange-200" />
           </div>
           <h3 className="text-xl font-black text-gray-800 mt-1">{data.summary.declining_count || 0}</h3>
        </button>
      </div>

      {/* Sort handler & icon */}
      {(() => {
        const handleSort = (key) => {
          setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
          }));
          setPage(1);
        };

        const SortIcon = ({ column }) => {
          if (sortConfig.key !== column) return <ArrowUpDown size={12} className="ml-1 opacity-30 inline" />;
          return sortConfig.direction === 'desc'
            ? <ChevronDown size={12} className="ml-1 text-vnpost-orange inline" />
            : <ChevronUp size={12} className="ml-1 text-vnpost-orange inline" />;
        };

        // Filter → Sort → Paginate
        const filteredItems = (data.items || []).filter(i => !statusFilter || i.status === statusFilter);
        const sortedItems = [...filteredItems].sort((a, b) => {
          const dir = sortConfig.direction === 'asc' ? 1 : -1;
          const valA = a[sortConfig.key];
          const valB = b[sortConfig.key];
          if (typeof valA === 'string') return dir * valA.localeCompare(valB);
          return dir * ((valA || 0) - (valB || 0));
        });
        const totalFiltered = sortedItems.length;
        const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
        const safePage = Math.min(page, totalPages);
        const paginatedItems = sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize);

        return (
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">
            {viewMode === 'detail' ? 'Chi tiết biến động từng khách hàng' : 'Bảng tổng hợp biến động theo đơn vị'}
          </h3>
          <div className="flex items-center gap-4 flex-wrap">
            {statusFilter && (
              <button 
                onClick={() => { setStatusFilter(null); setPage(1); }}
                className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-black uppercase flex items-center gap-1 hover:bg-gray-200 transition-all"
              >
                Bỏ lọc: {statusFilter} ✕
              </button>
            )}
            {viewMode === 'detail' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase">Hiển thị</span>
                <select 
                  value={pageSize} 
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-black text-vnpost-blue cursor-pointer focus:ring-2 focus:ring-vnpost-blue/10"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-[10px] font-black text-gray-400 uppercase">dòng/trang</span>
              </div>
            )}
            <div className="text-[10px] font-bold text-gray-400 italic">
              {viewMode === 'detail' ? `Hiển thị: ${paginatedItems.length} / ${totalFiltered} khách hàng` : `Tổng cộng: ${aggregateData.length} đơn vị`}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          {viewMode === 'detail' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-gray-50">
                <tr>
                  <th className="p-4 w-[4%] text-center">#</th>
                  <th className="p-4 w-[22%] cursor-pointer select-none hover:text-vnpost-blue transition-colors" onClick={() => handleSort('ten_kh')}>
                    Tên Khách hàng <SortIcon column="ten_kh" />
                  </th>
                  <th className="p-4 text-center w-[12%] cursor-pointer select-none hover:text-vnpost-blue transition-colors" onClick={() => handleSort('rfm_segment')}>
                    Hạng / Nhóm <SortIcon column="rfm_segment" />
                  </th>
                  <th className="p-4 text-center w-[16%]">Bưu cục</th>
                  <th className="p-4 text-right w-[12%] cursor-pointer select-none hover:text-vnpost-blue transition-colors" onClick={() => handleSort('rev_a')}>
                    Doanh thu Kỳ A <SortIcon column="rev_a" />
                  </th>
                  <th className="p-4 text-right w-[12%] cursor-pointer select-none hover:text-vnpost-blue transition-colors" onClick={() => handleSort('rev_b')}>
                    Doanh thu Kỳ B <SortIcon column="rev_b" />
                  </th>
                  <th className="p-4 text-center w-[10%] cursor-pointer select-none hover:text-vnpost-blue transition-colors" onClick={() => handleSort('diff')}>
                    Biến động <SortIcon column="diff" />
                  </th>
                  <th className="p-4 text-center w-[10%] cursor-pointer select-none hover:text-vnpost-blue transition-colors" onClick={() => handleSort('status')}>
                    <span className="flex items-center justify-center gap-1 text-vnpost-orange">
                      Trạng thái <SortIcon column="status" /> <Link to="/guidelines#movement-analysis"><Info size={12} /></Link>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                   <tr><td colSpan="8" className="p-20 text-center text-gray-300 font-black uppercase tracking-[0.2em] animate-pulse">Đang xử lý dữ liệu quy mô lớn...</td></tr>
                ) : paginatedItems.length === 0 ? (
                   <tr><td colSpan="8" className="p-20 text-center text-gray-300 font-black uppercase italic">Không tìm thấy khách hàng nào phù hợp với bộ lọc.</td></tr>
                ) : paginatedItems.map((item, idx) => (
                  <tr key={item.ma_kh || idx} className="hover:bg-blue-50/30 transition-all group border-b border-gray-50">
                    <td className="p-4 text-center text-gray-300 font-black text-xs">{(safePage - 1) * pageSize + idx + 1}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 max-w-[280px]">
                        <span className="text-vnpost-blue font-black truncate" title={item.ten_kh}>{item.ten_kh}</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.ma_kh}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <span className="text-[10px] font-black text-vnpost-blue bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">{item.rfm_segment}</span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase">{item.nhom_kh}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 break-words block max-w-[150px] mx-auto">{item.point_name}</span>
                    </td>
                    <td className="p-4 text-right font-black text-vnpost-blue">{formatCurrency(item.rev_a)}</td>
                    <td className="p-4 text-right font-bold text-gray-400">{formatCurrency(item.rev_b)}</td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-black text-xs ${item.growth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {item.growth > 0 ? '+' : ''}{item.growth}%
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 italic">{formatCurrency(item.diff)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                       <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                <tr>
                  <th className="p-6">Tên Đơn vị</th>
                  <th className="p-6 text-right">Doanh thu Kỳ A</th>
                  <th className="p-6 text-right">Doanh thu Kỳ B</th>
                  <th className="p-6 text-center">Biến động (%)</th>
                  <th className="p-6 text-center">Khách Mới</th>
                  <th className="p-6 text-center">Khách Mất</th>
                  <th className="p-6 text-center">Đang Tăng</th>
                  <th className="p-6 text-center">Đang Giảm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                   <tr><td colSpan="8" className="p-20 text-center text-gray-300 font-black uppercase tracking-[0.2em] animate-pulse">Đang tổng hợp dữ liệu đơn vị...</td></tr>
                ) : aggregateData.length === 0 ? (
                   <tr><td colSpan="8" className="p-20 text-center text-gray-300 font-black uppercase italic">Chưa có dữ liệu tổng hợp.</td></tr>
                ) : aggregateData.map((node, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-all group cursor-pointer" onClick={() => handleDrillDown(node)}>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-vnpost-blue/5 flex items-center justify-center text-vnpost-blue group-hover:bg-vnpost-blue group-hover:text-white transition-all">
                          <Building2 size={16} />
                        </div>
                        <div className="flex flex-col">
                           <span className="font-bold text-gray-800 group-hover:text-vnpost-blue transition-colors">{node.node_name}</span>
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{node.node_type} - {node.node_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-right font-black text-vnpost-blue">{formatCurrency(node.rev_a)}</td>
                    <td className="p-6 text-right font-bold text-gray-400">{formatCurrency(node.rev_b)}</td>
                    <td className="p-6 text-center">
                       <span className={`px-3 py-1 rounded-full text-[11px] font-black ${node.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                         {node.growth > 0 ? '+' : ''}{node.growth}%
                       </span>
                    </td>
                    <td className="p-6 text-center font-bold text-emerald-600">{node.new_count}</td>
                    <td className="p-6 text-center font-bold text-red-600">{node.lost_count}</td>
                    <td className="p-6 text-center font-bold text-blue-600">{node.growing_count}</td>
                    <td className="p-6 text-center font-bold text-orange-600">{node.declining_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination - Detail mode */}
        {viewMode === 'detail' && totalPages > 1 && (
          <div className="px-8 py-6 border-t border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Trang {safePage} / {totalPages} • {totalFiltered} khách hàng
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-[10px] font-black text-gray-500 hover:bg-vnpost-blue hover:text-white disabled:opacity-30 transition-all uppercase"
              >
                Đầu
              </button>
              <button
                disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              {/* Page number buttons */}
              {(() => {
                const pages = [];
                let startP = Math.max(1, safePage - 2);
                let endP = Math.min(totalPages, startP + 4);
                if (endP - startP < 4) startP = Math.max(1, endP - 4);
                for (let i = startP; i <= endP; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                        i === safePage
                          ? 'bg-vnpost-blue text-white shadow-lg shadow-blue-200'
                          : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }
                return pages;
              })()}
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={16} />
              </button>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-[10px] font-black text-gray-500 hover:bg-vnpost-blue hover:text-white disabled:opacity-30 transition-all uppercase"
              >
                Cuối
              </button>
            </div>
          </div>
        )}
      </div>
        );
      })()}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    'New': { label: 'Khách Mới', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    'Lost': { label: 'Ngừng Gửi', color: 'bg-red-50 text-red-600 border-red-100' },
    'Growing': { label: 'Tăng Trưởng', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    'Declining': { label: 'Sụt Giảm', color: 'bg-orange-50 text-orange-600 border-orange-100' },
    'Stable': { label: 'Duy Trì', color: 'bg-gray-50 text-gray-500 border-gray-100' }
  };
  const s = map[status] || map['Stable'];
  return (
    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${s.color}`}>
      {s.label}
    </span>
  );
}

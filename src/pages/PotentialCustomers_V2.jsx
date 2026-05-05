import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Link } from 'react-router-dom';
import { 
  Target, 
  Search, 
  Calendar, 
  TrendingUp, 
  Package, 
  DollarSign, 
  ChevronRight,
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
  Filter,
  Users
} from 'lucide-react';

const PotentialCustomers_V2 = () => {
  const [data, setData] = useState({ items: [], total: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minDays, setMinDays] = useState(3);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [coverage, setCoverage] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'tong_doanh_thu', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const fetchPotentialData = async (currentPage = page, currentPageSize = pageSize) => {
    setLoading(true);
    try {
      const params = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        min_days: minDays,
        sort_by: sortConfig.key,
        order: sortConfig.direction,
        page: currentPage,
        page_size: currentPageSize
      };
      const res = await api.get('/api/potential', { params });
      setData(res.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu khách hàng tiềm năng:', err);
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
    fetchPotentialData(1, pageSize);
  }, [startDate, endDate, minDays, sortConfig, pageSize]);

  const fetchCoverage = async () => {
    try {
      const res = await api.get('/api/analytics/data-coverage');
      setCoverage(res.data);
      if (!startDate && !endDate && res.data.latest_month) {
        const latest = res.data.latest_month;
        setSelectedMonth(latest.value);
        setStartDate(latest.start);
        setEndDate(latest.end);
      }
    } catch (err) { console.error(err); }
  };

  const getRankBadge = (rank) => {
    if (rank === 'Kim Cương') return <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200 shadow-sm animate-pulse">💎 KIM CƯƠNG</span>;
    if (rank === 'Vàng') return <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 shadow-sm font-premium">🏆 VÀNG</span>;
    if (rank === 'Bạc') return <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200 shadow-sm">🥈 BẠC</span>;
    return <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 bg-gray-50/50 px-3 py-1 rounded-xl border border-gray-100 italic">👤 THƯỜNG</span>;
  };

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-vnpost-blue mb-1">
             <Target size={20} className="text-vnpost-orange" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em]">Cổng phân tích khách hàng</span>
          </div>
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">
            Mạng Lưới Tiềm Năng (V3)
          </h2>
          <div className="flex items-center gap-2 mt-2">
             <p className="text-gray-500 text-sm font-medium">Hệ thống tự động xếp hạng dựa trên ngưỡng doanh thu X2 chuẩn 2026.</p>
             <div className="h-4 w-px bg-gray-200 mx-1"></div>
             {(startDate || endDate) && (
                <span className="bg-white text-vnpost-blue px-4 py-1.5 rounded-2xl shadow-sm text-[10px] font-black flex items-center gap-2 border border-blue-50 uppercase tracking-widest">
                  <Calendar size={12} className="text-vnpost-blue/40" /> {startDate || '?'} → {endDate || '?'}
                </span>
             )}
          </div>
        </div>
      </div>

      {/* Analytics Summary - Ultra Premium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-8 bg-white border-white/50 shadow-xl shadow-blue-50/20 flex flex-col justify-between hover:-translate-y-1 transition-all rounded-[2.5rem] group relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 text-blue-50/50 rotate-12 group-hover:scale-110 transition-transform">
             <Users size={120} />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl"><Activity size={24} /></div>
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Scale</span>
          </div>
          <div className="mt-8 relative z-10">
            <h3 className="text-4xl font-black text-gray-800 tracking-tighter">
               {(data.total || 0).toLocaleString()}
            </h3>
            <p className="text-gray-400 text-xs font-black uppercase mt-2 opacity-60">Chủ hàng vãng lai</p>
          </div>
        </div>
        
        <div className="card p-8 bg-white border-white/50 shadow-xl shadow-indigo-50/20 flex flex-col justify-between hover:-translate-y-1 transition-all rounded-[2.5rem] group relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 text-indigo-50/50 -rotate-12 group-hover:rotate-0 transition-transform">
             <Package size={120} />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl"><Package size={24} /></div>
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Volume (Sample)</span>
          </div>
          <div className="mt-8 relative z-10">
            <h3 className="text-4xl font-black text-gray-800 tracking-tighter">
               {(data.items || []).reduce((acc, curr) => acc + (curr.tong_so_don || 0), 0).toLocaleString()}
            </h3>
            <p className="text-gray-400 text-xs font-black uppercase mt-2 opacity-60">Vận đơn (Trang hiện tại)</p>
          </div>
        </div>

        <div className="card p-8 bg-white border-white/50 shadow-xl shadow-emerald-50/20 flex flex-col justify-between hover:-translate-y-1 transition-all rounded-[2.5rem] group relative overflow-hidden">
           <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-50"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-3xl"><DollarSign size={24} /></div>
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Potential Rev</span>
          </div>
          <div className="mt-8 relative z-10">
            <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">
              {formatCurrency((data.items || []).reduce((acc, curr) => acc + (curr.tong_doanh_thu || 0), 0))}
            </h3>
            <p className="text-gray-400 text-xs font-black uppercase mt-2 opacity-60">Doanh thu (Trang hiện tại)</p>
          </div>
        </div>

        <div className="card p-8 bg-gradient-to-br from-[#003E7E] to-[#0054A6] text-white border-none shadow-2xl shadow-blue-200/50 rounded-[2.5rem] relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-150 group-hover:rotate-45 transition-all duration-1000">
              <Star size={160} />
           </div>
           <div className="flex justify-between items-start relative z-10">
              <div className="p-4 bg-white/20 backdrop-blur-md rounded-3xl text-amber-300"><Award size={24} /></div>
              <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">High Quality</span>
           </div>
           <div className="mt-8 relative z-10">
              <h3 className="text-4xl font-black tracking-tighter">
                {(data.items || []).filter(d => d.rfm_segment === 'Kim Cương' || d.rfm_segment === 'Vàng').length.toLocaleString()}
              </h3>
              <p className="text-white/60 text-xs font-black uppercase mt-2">Hạng Diamond & Gold (Sample)</p>
           </div>
        </div>
      </div>

      <div className="card !p-8 shadow-2xl border-white bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-gray-200/30">
        {/* Modern Filter Interface */}
        <div className="flex flex-wrap gap-6 items-end bg-gray-50/80 p-8 rounded-[2rem] border border-gray-100 mb-8">
          <div className="space-y-3 flex-1 min-w-[180px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
              <Calendar size={14} className="text-vnpost-blue/40" /> Từ ngày
            </label>
            <input 
              type="date" 
              className="w-full px-5 py-4 rounded-[1.2rem] border border-gray-200 outline-none focus:ring-4 focus:ring-vnpost-blue/5 transition-all text-sm font-bold text-gray-700 bg-white shadow-sm"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setSelectedMonth(""); }}
            />
          </div>
          <div className="space-y-3 flex-1 min-w-[180px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
              <Calendar size={14} className="text-vnpost-blue/40" /> Đến ngày
            </label>
            <input 
              type="date" 
              className="w-full px-5 py-4 rounded-[1.2rem] border border-gray-200 outline-none focus:ring-4 focus:ring-vnpost-blue/5 transition-all text-sm font-bold text-gray-700 bg-white shadow-sm"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setSelectedMonth(""); }}
            />
          </div>
          <div className="space-y-3 w-32">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
              <Zap size={14} className="text-vnpost-orange/60" /> Ngày gửi
            </label>
            <input 
              type="number" 
              min="1"
              className="w-full px-5 py-4 rounded-[1.2rem] border border-gray-200 outline-none focus:ring-4 focus:ring-vnpost-orange/5 transition-all text-sm font-black text-vnpost-blue bg-white shadow-sm"
              value={minDays}
              onChange={(e) => setMinDays(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-3 flex-1 min-w-[220px]">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
              <TrendingUp size={14} className="text-indigo-400" /> Báo cáo tháng
            </label>
            <select 
              className="w-full px-5 py-4 rounded-[1.2rem] border border-gray-200 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm font-black text-vnpost-blue bg-white shadow-sm cursor-pointer"
              onChange={(e) => {
                const monthStr = e.target.value;
                if (!monthStr) { setSelectedMonth(""); return; }
                setSelectedMonth(monthStr);
                const [year, month] = monthStr.split('-').map(Number);
                const start = `${year}-${String(month).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                setStartDate(start);
                setEndDate(end);
              }}
              value={selectedMonth || ""}
            >
              <option value="">-- Chọn tháng báo cáo --</option>
              {coverage.months?.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <button onClick={() => fetchPotentialData(1)} className="px-10 py-4 h-[58px] bg-[#0054A6] text-white rounded-[1.2rem] font-black hover:bg-[#003E7E] transition-all flex items-center gap-3 shadow-2xl shadow-blue-200 active:scale-95 uppercase tracking-widest text-xs">
            <Filter size={20} /> Phân tích ngay
          </button>
        </div>

        {/* Table Aesthetics */}
        <div className="flex items-center justify-between px-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-7 bg-vnpost-blue rounded-full shadow-sm"></div>
              <h4 className="text-xs font-black uppercase tracking-[0.25em] text-gray-500">Đối tượng vãng lai sản lượng lớn</h4>
            </div>
            <div className="flex items-center gap-8 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 bg-gray-50 px-6 py-2.5 rounded-2xl border border-gray-100">
               <div className="flex items-center gap-2 group cursor-help"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-md group-hover:scale-125 transition-transform animate-pulse"></div> &gt; 20 ngày</div>
               <div className="flex items-center gap-2 group cursor-help"><div className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-md group-hover:scale-125 transition-transform"></div> &gt; 10 ngày</div>
               <div className="flex items-center gap-2 group cursor-help"><div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-md group-hover:scale-125 transition-transform"></div> &gt; 5 ngày</div>
            </div>
        </div>

        {/* Data Table - Ultra Clean */}
        <div className="overflow-x-auto border border-gray-100 rounded-[2.5rem] shadow-2xl shadow-gray-100/50 bg-white">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#fcfdfe] text-gray-400 border-b border-gray-50">
              <tr>
                <th className="p-6 font-black uppercase tracking-widest w-12 text-center opacity-30 text-[10px]">Pos</th>
                <th className="p-6 font-black uppercase tracking-widest cursor-pointer hover:bg-gray-50 transition-colors text-[10px]" onClick={() => handleSort('ten_kh')}>
                  <div className="flex items-center">Chủ hàng vãng lai <SortIcon column="ten_kh" /></div>
                </th>
                <th className="p-6 font-black uppercase tracking-widest text-center text-[10px]">Bưu Cục Quản lý</th>
                <th className="p-6 font-black uppercase tracking-widest text-center cursor-pointer hover:bg-gray-50 transition-colors text-[10px]" onClick={() => handleSort('so_ngay_gui')}>
                  <div className="flex items-center justify-center">Tần suất <SortIcon column="so_ngay_gui" /></div>
                </th>
                <th className="p-6 font-black uppercase tracking-widest text-center cursor-pointer hover:bg-gray-50 transition-colors text-[10px]" onClick={() => handleSort('tong_so_don')}>
                  <div className="flex items-center justify-center">Sản lượng <SortIcon column="tong_so_don" /></div>
                </th>
                <th className="p-6 font-black uppercase tracking-widest text-right cursor-pointer hover:bg-gray-50 transition-colors text-[10px]" onClick={() => handleSort('tong_doanh_thu')}>
                  <div className="flex items-center justify-end">Doanh Thu <SortIcon column="tong_doanh_thu" /></div>
                </th>
                <th className="p-6 font-black uppercase tracking-widest text-center cursor-pointer hover:bg-gray-50 transition-colors text-[10px]" onClick={() => handleSort('ngay_gan_nhat')}>
                  <div className="flex items-center justify-center">Lần cuối <SortIcon column="ngay_gan_nhat" /></div>
                </th>
                <th className="p-6 font-black uppercase tracking-widest text-center text-[10px]">
                  <Link to="/guidelines#potentials" className="hover:underline flex items-center justify-center gap-1 text-vnpost-orange">
                    Ranking V3 <Info size={12} />
                  </Link>
                </th>
                <th className="p-6 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/50">
              {loading ? (
                <tr><td colSpan="9" className="p-40 text-center">
                   <div className="flex flex-col items-center">
                      <div className="relative">
                        <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></div>
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#0054A6] mb-8 relative z-10"></div>
                      </div>
                      <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px] mt-4">V3 Intelligence Engine is calculating...</p>
                   </div>
                </td></tr>
              ) : (data.items || []).length === 0 ? (
                <tr><td colSpan="9" className="p-40 text-center text-gray-300 font-black uppercase tracking-[0.2em] italic text-[10px]">
                  Dữ liệu trống trong phân đoạn được chọn.
                </td></tr>
              ) : (
                (data.items || []).map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50/30 transition-all duration-400 group cursor-default">
                    <td className="p-6 text-gray-200 font-black text-center text-xs opacity-50 group-hover:opacity-100 transition-opacity">{((page - 1) * pageSize + index + 1).toString().padStart(2, '0')}</td>
                    <td className="p-6">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 group-hover:text-vnpost-blue transition-colors truncate max-w-[250px]" title={item.ten_kh}>
                            {item.ten_kh}
                          </span>
                          <ArrowUpRight size={14} className="text-vnpost-orange opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all" />
                        </div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Gợi ý: Cần chuyển định danh</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                       <span className="text-[10px] font-black border border-gray-100 bg-gray-50 px-3 py-1.5 rounded-2xl text-gray-500 shadow-sm">
                         {item.ma_bc}
                       </span>
                    </td>
                    <td className="p-6 text-center">
                      <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-tighter shadow-sm border ${item.so_ngay_gui >= 20 ? 'bg-red-50 text-red-600 border-red-100' : item.so_ngay_gui >= 10 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        {item.so_ngay_gui} ngày / kỳ
                      </span>
                    </td>
                    <td className="p-6 text-center font-bold text-gray-500">
                      <span className="text-gray-800 font-black text-lg">{item.tong_so_don.toLocaleString()}</span> <small className="text-[9px] opacity-30 font-black uppercase ml-1">đơn</small>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-black text-vnpost-blue text-base">{formatCurrency(item.tong_doanh_thu)}</span>
                        <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Cơ hội +{Math.round(item.tong_doanh_thu * 0.1).toLocaleString()}đ</span>
                      </div>
                    </td>
                    <td className="p-6 text-center text-gray-400 font-black text-[10px] uppercase tracking-tighter">
                      <div className="flex items-center justify-center gap-2 bg-gray-50/50 py-1.5 rounded-xl border border-transparent group-hover:border-gray-100 transition-all">
                        <History size={12} className="opacity-40" />
                        {item.ngay_gan_nhat}
                      </div>
                    </td>
                    <td className="p-6 text-center">
                       {getRankBadge(item.rfm_segment)}
                    </td>
                    <td className="p-6 text-center">
                       <button className="p-3 hover:bg-white rounded-2xl transition-all text-vnpost-blue shadow-sm border border-transparent hover:border-gray-100 active:scale-75">
                          <ChevronRight size={22} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Console - NEW PREMIUM UI */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hiển thị</span>
              <select 
                value={pageSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value);
                  setPageSize(newSize);
                  setPage(1);
                  fetchPotentialData(1, newSize);
                }}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-black text-vnpost-blue outline-none focus:ring-2 focus:ring-vnpost-blue/10"
              >
                {[20, 50, 100, 200].map(size => (
                  <option key={size} value={size}>{size} dòng</option>
                ))}
              </select>
            </div>
            <div className="h-4 w-px bg-gray-200"></div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
              Đang xem <span className="text-vnpost-blue">{(page - 1) * pageSize + 1}</span> - <span className="text-vnpost-blue">{Math.min(page * pageSize, (data.total || 0))}</span> của <span className="text-vnpost-blue font-black">{(data.total || 0)}</span> bản ghi
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setPage(1); fetchPotentialData(1, pageSize); }}
              disabled={page === 1}
              className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-200 transition-all active:scale-90"
            >
              <ArrowUpDown size={16} className="rotate-90" />
            </button>
            <button 
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchPotentialData(p, pageSize); }}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-500 hover:text-vnpost-blue hover:border-vnpost-blue disabled:opacity-30 transition-all active:scale-90"
            >
              Trước
            </button>
            
            <div className="flex items-center gap-1 mx-2">
              <span className="text-xs font-black text-vnpost-blue bg-white px-3 py-1.5 rounded-xl border border-vnpost-blue/20 shadow-sm">
                {page}
              </span>
              <span className="text-[10px] font-bold text-gray-300 uppercase mx-1">/</span>
              <span className="text-xs font-black text-gray-400">
                {data.total_pages || 1}
              </span>
            </div>

            <button 
              onClick={() => { const p = page + 1; setPage(p); fetchPotentialData(p, pageSize); }}
              disabled={page >= (data.total_pages || 1)}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-500 hover:text-vnpost-blue hover:border-vnpost-blue disabled:opacity-30 transition-all active:scale-90"
            >
              Sau
            </button>
            <button 
              onClick={() => { const p = data.total_pages || 1; setPage(p); fetchPotentialData(p, pageSize); }}
              disabled={page >= (data.total_pages || 1)}
              className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-vnpost-blue hover:border-vnpost-blue disabled:opacity-30 transition-all active:scale-90"
            >
              <ArrowUpDown size={16} className="-rotate-90" />
            </button>
          </div>
        </div>
        
        {/* Superior Insight Footer */}
        <div className="mt-10 p-8 rounded-[2.5rem] bg-gradient-to-br from-vnpost-blue/5 via-vnpost-blue/[0.02] to-transparent border-l-8 border-l-vnpost-blue flex flex-col md:flex-row items-center gap-8 hover:shadow-2xl transition-all duration-700 group">
           <div className="p-6 bg-white rounded-[2rem] shadow-xl text-vnpost-blue transform group-hover:rotate-12 transition-transform duration-500"><Info size={40} className="text-[#0054A6]" /></div>
           <div className="space-y-3 flex-1">
             <div className="flex items-center gap-3">
               <h4 className="text-sm font-black text-vnpost-blue uppercase tracking-[0.3em]">Chiến lược Khai thác Khách hàng V3</h4>
               <div className="h-0.5 flex-1 bg-gradient-to-r from-vnpost-blue/10 to-transparent"></div>
             </div>
             <p className="text-sm text-gray-600 leading-relaxed font-semibold">
               Báo cáo cho thấy nhóm <span className="text-indigo-700 font-black px-2 py-0.5 bg-indigo-50 rounded-lg border border-indigo-100 shadow-sm italic">Kim Cương 💎</span> (Doanh thu &gt; 5M và &gt; 20 đơn gửi) đang là nguồn sinh lời chính nhưng đối diện rủi ro rời bỏ cao do chưa có hợp đồng định danh.
               <br />
               <span className="text-vnpost-orange font-black">Lệnh hành động:</span> Sếp cần chỉ đạo đội Phát triển khách hàng phối hợp ngay với Trưởng bưu cục để tiếp cận trực tiếp nhóm này, ký kết hợp đồng định danh để nạp vào CRM chính thức.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PotentialCustomers_V2;

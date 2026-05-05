import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import { 
  ShieldCheck, 
  Clock, 
  Users, 
  Trash2, 
  Archive,
  RefreshCw,
  X,
  Search,
  Monitor,
  Activity,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

const SuperadminCenter = () => {
  const [activeTab, setActiveTab] = useState('sessions');
  const [logTab, setLogTab] = useState('ALL'); // ALL, LOGIN, TASKS, SYSTEM
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupStats, setCleanupStats] = useState(null);
  const [cleanupConfig, setCleanupConfig] = useState({
    categories: [],
    start_date: '',
    end_date: ''
  });
  const [logFilters, setLogFilters] = useState({
    action: '',
    resource: '',
    start_date: '',
    end_date: ''
  });

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/superadmin/sessions');
      setSessions(response.data);
    } catch (error) {
      toast.error('Không thể lấy danh sách phiên làm việc');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let actionParam = logFilters.action;
      let resourceParam = logFilters.resource;

      if (logTab === 'LOGIN') actionParam = 'LOGIN_ONLY';
      if (logTab === 'TASKS_5B') {
        actionParam = 'TASKS_ONLY';
        resourceParam = 'TiemNang';
      }
      if (logTab === 'TASKS_EXISTING') {
        actionParam = 'TASKS_ONLY';
        resourceParam = 'HienHuu';
      }
      if (logTab === 'SYSTEM') {
        actionParam = 'SYSTEM_ONLY';
      }

      const response = await api.get('/api/superadmin/logs', {
        params: {
          limit: 100,
          action: actionParam || undefined,
          resource: resourceParam || undefined,
          start_date: logFilters.start_date || undefined,
          end_date: logFilters.end_date || undefined
        }
      });
      setLogs(response.data);
    } catch (error) {
      toast.error('Không thể lấy nhật ký hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const fetchCleanupStats = async () => {
    setStatsLoading(true);
    try {
      const response = await api.get('/api/superadmin/cleanup/stats');
      setCleanupStats(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy thông số dọn dẹp');
      toast.error('Không thể lấy thông số dọn dẹp hiện tại');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions') fetchSessions();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, logTab, logFilters]);

  const handleKick = async (sessionId) => {
    if (!window.confirm('Bạn có chắc chắn muốn ngắt kết nối người dùng này?')) return;
    try {
      await api.post(`/api/superadmin/sessions/${sessionId}/kick`);
      toast.success('Đã ngắt kết nối thành công');
      fetchSessions();
    } catch (error) {
      toast.error('Lỗi khi ngắt kết nối người dùng');
    }
  };

  const handleCleanup = async () => {
    if (cleanupConfig.categories.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một danh mục cần dọn dẹp');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn dọn dẹp dữ liệu đã chọn? Thao tác này không thể hoàn tác!')) return;
    
    setLoading(true);
    try {
      const response = await api.delete('/api/superadmin/cleanup', {
        params: {
          categories: cleanupConfig.categories.join(','),
          start_date: cleanupConfig.start_date || undefined,
          end_date: cleanupConfig.end_date || undefined
        }
      });
      toast.success(response.data.message);
      setShowCleanupModal(false);
      if (activeTab === 'logs') fetchLogs();
    } catch (error) {
      toast.error('Lỗi khi dọn dẹp dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/superadmin/backup');
      toast.success(`Đã sao lưu thành công: ${response.data.file}`);
    } catch (error) {
      toast.error('Lỗi khi sao lưu dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-2 text-vnpost-blue mb-1">
            <ShieldCheck className="w-8 h-8" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Trung tâm Điều hành Superadmin</h1>
          </div>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest opacity-60">Quyền lực tối cao - Giám sát & Bảo mật hệ thống</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              fetchCleanupStats();
              setShowCleanupModal(true);
            }}
            className="flex items-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all font-bold text-xs uppercase tracking-widest border border-rose-100"
          >
            <Trash2 className="w-4 h-4" />
            Dọn rác Test
          </button>
          <button 
            onClick={handleBackup}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-vnpost-blue text-white rounded-xl hover:bg-blue-800 transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20"
          >
            <Archive className="w-4 h-4" />
            {loading ? 'Đang xử lý...' : 'Backup & Nén'}
          </button>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex gap-2 p-1.5 bg-white rounded-2xl shadow-sm border border-gray-100 w-fit">
        <button 
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'sessions' ? 'bg-vnpost-blue text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <Monitor className="w-4 h-4" />
          Giám sát Online ({sessions.length})
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-vnpost-blue text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <Activity className="w-4 h-4" />
          Nhật ký Truy vết
        </button>
      </div>

      {/* Log Sub-tabs and Filters */}
      {activeTab === 'logs' && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex gap-1 p-1 bg-gray-50 rounded-xl overflow-x-auto">
             {[
               { id: 'ALL', label: 'Tất cả' },
               { id: 'TASKS_5B', label: 'Giao việc (5B)' },
               { id: 'TASKS_EXISTING', label: 'Quản lý tiếp cận' },
               { id: 'LOGIN', label: 'Đăng nhập' },
               { id: 'SYSTEM', label: 'Hệ thống' }
             ].map(t => (
               <button 
                 key={t.id}
                 onClick={() => setLogTab(t.id)}
                 className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${logTab === t.id ? 'bg-white text-vnpost-blue shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 {t.label}
               </button>
             ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
               <Calendar className="w-3.5 h-3.5 text-gray-400" />
               <input 
                 type="date" 
                 className="bg-transparent text-[10px] font-bold outline-none"
                 value={logFilters.start_date}
                 onChange={e => setLogFilters({...logFilters, start_date: e.target.value})}
               />
               <span className="text-gray-300">→</span>
               <input 
                 type="date" 
                 className="bg-transparent text-[10px] font-bold outline-none"
                 value={logFilters.end_date}
                 onChange={e => setLogFilters({...logFilters, end_date: e.target.value})}
               />
             </div>
             <button 
               onClick={() => setLogFilters({ action: '', resource: '', start_date: '', end_date: '' })}
               className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all"
               title="Xóa bộ lọc"
             >
               <RefreshCw className="w-4 h-4" />
             </button>
          </div>
        </div>
      )}

      {/* Content Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'sessions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Người dùng</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Địa chỉ IP</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Hoạt động cuối</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-vnpost-blue font-black border border-blue-200">
                          {s.username?.[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{s.full_name}</p>
                          <p className="text-[10px] font-black text-vnpost-blue uppercase tracking-tighter opacity-60">@{s.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-500 font-bold">{s.ip_address}</td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-300" />
                        {new Date(s.last_activity).toLocaleString('vi-VN')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleKick(s.id)}
                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        title="Ngắt kết nối ngay"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-20 text-center">
                      <p className="text-gray-400 font-bold italic text-sm">Không có người dùng nào đang hoạt động</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="overflow-x-auto">
             <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Thời gian</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Hành động</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Chi tiết tác vụ</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">User / IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-bold text-gray-400">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase border w-fit ${
                          log.action === 'LOGIN' ? 'bg-green-50 text-green-600 border-green-100' :
                          log.action === 'REPORT_TASK' ? 'bg-orange-50 text-vnpost-orange border-orange-100' :
                          log.action.includes('TASK') ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          'bg-blue-50 text-vnpost-blue border-blue-100'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest ml-1">
                          Module: {log.resource || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-md font-medium">
                      {log.details}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-[10px]">
                        <p className="font-black text-gray-800 uppercase tracking-tighter">UID: {log.user_id || 'System'}</p>
                        <p className="text-gray-400 font-mono">{log.ip_address}</p>
                      </div>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-20 text-center">
                      <p className="text-gray-400 font-bold italic text-sm">Không tìm thấy nhật ký nào phù hợp</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {/* Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-600 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Trash2 className="w-6 h-6" />
                  Dọn dẹp & Tối ưu dữ liệu
                </h3>
                <p className="text-xs font-bold text-rose-100 mt-1 uppercase tracking-widest">Lựa chọn các thành phần cần dọn dẹp</p>
              </div>
              <button onClick={() => setShowCleanupModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'SYSTEM_LOGS', label: 'Nhật ký Hệ thống', sub: statsLoading ? 'Đang tính toán...' : `Gồm ${cleanupStats?.logs?.total || 0} bản ghi (Giao việc, Cập nhật...)` },
                  { id: 'LOGIN_LOGS', label: 'Nhật ký Đăng nhập', sub: statsLoading ? 'Đang tính toán...' : `Gồm ${cleanupStats?.logs?.login || 0} lần truy cập` },
                  { id: 'TASKS_5B', label: 'Giao việc (5B)', sub: statsLoading ? 'Đang tính toán...' : `Gồm ${cleanupStats?.tasks?.tiem_nang || 0} nhiệm vụ cho khách vãng lai` },
                  { id: 'TASKS_EXISTING', label: 'Quản lý tiếp cận', sub: statsLoading ? 'Đang tính toán...' : `Gồm ${cleanupStats?.tasks?.hien_huu || 0} nhiệm vụ cho khách đã có mã (Bao gồm cả Đã hoàn thành)` },
                  { id: 'POTENTIAL_LEADS', label: 'Dữ liệu Hành trình 5B', sub: statsLoading ? 'Đang tính toán...' : `Gồm ${cleanupStats?.potentials?.total || 0} khách hàng vãng lai đang theo dõi` },
                  { id: 'TEST_CUSTOMERS', label: 'Khách hàng Thử nghiệm', sub: statsLoading ? 'Đang tính toán...' : `Gồm ${cleanupStats?.customers?.test || 0} bản ghi có tên "TEST"` }
                ].map(cat => (
                  <label key={cat.id} className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${cleanupConfig.categories.includes(cat.id) ? 'border-rose-500 bg-rose-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
                      checked={cleanupConfig.categories.includes(cat.id)}
                      onChange={(e) => {
                        const newCats = e.target.checked 
                          ? [...cleanupConfig.categories, cat.id]
                          : cleanupConfig.categories.filter(id => id !== cat.id);
                        setCleanupConfig({...cleanupConfig, categories: newCats});
                      }}
                    />
                    <div>
                      <p className="text-sm font-black text-gray-800 uppercase">{cat.label}</p>
                      <p className="text-[10px] font-bold text-gray-400 leading-relaxed">{cat.sub}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="p-6 bg-gray-50 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <Calendar className="w-3.5 h-3.5" />
                  Giới hạn khoảng thời gian xóa
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 ml-1">Từ ngày</p>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:border-rose-500 transition-all"
                      value={cleanupConfig.start_date}
                      onChange={e => setCleanupConfig({...cleanupConfig, start_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 ml-1">Đến ngày</p>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:border-rose-500 transition-all"
                      value={cleanupConfig.end_date}
                      onChange={e => setCleanupConfig({...cleanupConfig, end_date: e.target.value})}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 italic">Để trống nếu muốn xóa toàn bộ (không lọc theo ngày).</p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-[10px] font-bold leading-relaxed uppercase">Lưu ý: Thao tác dọn dẹp sẽ xóa vĩnh viễn các bản ghi được chọn trong cơ sở dữ liệu. Vui lòng kiểm tra kỹ trước khi thực hiện.</p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowCleanupModal(false)}
                  className="flex-1 py-4 border-2 border-gray-100 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-all uppercase tracking-widest text-xs"
                >
                  Bỏ qua
                </button>
                <button 
                  onClick={handleCleanup}
                  disabled={loading}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  Xác nhận Dọn dẹp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default SuperadminCenter;

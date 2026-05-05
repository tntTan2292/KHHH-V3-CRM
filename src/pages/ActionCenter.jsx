import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Target, Calendar, CheckCircle2, XCircle, Clock, AlertCircle, Search, User, Filter, MoreVertical, Edit3, Send, PlayCircle, MapPin, X, RefreshCw, ChevronUp, ChevronDown, History } from 'lucide-react';
import { toast } from 'react-toastify';
import TreeExplorer from '../components/TreeExplorer';
import CustomerHistoryModal from '../components/CustomerHistoryModal';

export default function ActionCenter() {
  const { user } = useAuth();
  const isLeader = user?.role !== 'STAFF';
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // Mặc định 1 tháng qua
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const filterParams = {
    node_code: selectedNode?.code,
    start_date: startDate,
    end_date: endDate
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 text-vnpost-blue mb-1">
             <Target size={20} className="text-vnpost-orange" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em]">Module Chuyên trách V3.0</span>
          </div>
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">
            Quản trị Tiếp cận Khách hàng
          </h2>
          <p className="text-gray-500 text-sm font-medium mt-1">
            {isLeader ? 'Giám sát tiến độ và hiệu quả tiếp cận của nhân viên.' : 'Bảng công việc Kanban cá nhân.'}
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Node Selector */}
          <div className="relative">
            <button
              onClick={() => setIsTreeOpen(!isTreeOpen)}
              className="bg-white border-2 border-gray-100 px-6 py-3 rounded-2xl flex items-center gap-3 hover:border-vnpost-blue transition-all shadow-sm"
            >
              <MapPin size={18} className="text-vnpost-blue" />
              <span className="text-xs font-black text-gray-700">
                {selectedNode ? selectedNode.name : "Phạm vi dữ liệu"}
              </span>
            </button>
            {isTreeOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase">Chọn đơn vị quản lý</h3>
                    <button onClick={() => setIsTreeOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={16}/></button>
                 </div>
                 <TreeExplorer onNodeSelect={(node) => { setSelectedNode(node); setIsTreeOpen(false); }} />
              </div>
            )}
          </div>

          {/* Date Filter */}
          <div className="bg-white border-2 border-gray-100 p-1.5 rounded-2xl flex items-center gap-2 shadow-sm">
            <div className="flex items-center gap-2 px-3">
               <Calendar size={16} className="text-gray-400" />
               <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-black text-gray-700 outline-none border-none bg-transparent"
               />
            </div>
            <div className="w-4 h-0.5 bg-gray-200 rounded-full"></div>
            <div className="flex items-center gap-2 px-3">
               <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-black text-gray-700 outline-none border-none bg-transparent"
               />
            </div>
          </div>
        </div>
      </div>

      {isLeader ? (
        <LeaderDashboard filters={filterParams} />
      ) : (
        <StaffKanbanBoard filters={filterParams} />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// LEADER DASHBOARD
// -------------------------------------------------------------
function LeaderDashboard({ filters }) {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [assigningTask, setAssigningTask] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  
  // History Tracker
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);

  useEffect(() => {
    fetchData();
    fetchStaff();
  }, [filters]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/api/users/staff'); // Cần đảm bảo endpoint này tồn tại hoặc dùng /api/nhan-su
      setStaffList(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, summaryRes] = await Promise.all([
        api.get('/api/actions/tasks', { params: { ...filters, loai_doi_tuong: 'HienHuu' } }),
        api.get('/api/actions/summary', { params: { ...filters, loai_doi_tuong: 'HienHuu' } })
      ]);
      setTasks(tasksRes.data.items || []);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAssign = async (staffId) => {
    if (!assigningTask || !staffId) return;
    try {
      await api.patch(`/api/actions/tasks/${assigningTask.id}/reassign`, null, {
        params: { staff_id: staffId }
      });
      toast.success('Đã giao việc thành công!');
      setAssigningTask(null);
      fetchData();
    } catch (err) {
      toast.error('Lỗi khi giao việc');
    }
  };

  const sortedTasks = useMemo(() => {
    let sortableItems = [...tasks];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'staff_name') {
           aVal = a.staff_name || 'Z'; 
           bVal = b.staff_name || 'Z';
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [tasks, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (loading) return <div className="p-20 text-center text-gray-400 font-bold">Đang tải dữ liệu...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-6 bg-white border border-gray-100 shadow-xl shadow-gray-200/40 rounded-3xl flex items-center gap-4">
           <div className="p-3 bg-blue-50 text-blue-500 rounded-xl"><Target size={24} /></div>
           <div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tổng Giao Việc</p>
             <h3 className="text-2xl font-black text-gray-800">{summary?.total || 0}</h3>
           </div>
        </div>
        <div className="card p-6 bg-white border border-gray-100 shadow-xl shadow-gray-200/40 rounded-3xl flex items-center gap-4">
           <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl"><CheckCircle2 size={24} /></div>
           <div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Đã Hoàn Thành</p>
             <h3 className="text-2xl font-black text-gray-800">{summary?.completed || 0}</h3>
           </div>
        </div>
        <div className="card p-6 bg-white border border-gray-100 shadow-xl shadow-gray-200/40 rounded-3xl flex items-center gap-4">
           <div className="p-3 bg-orange-50 text-orange-500 rounded-xl"><Clock size={24} /></div>
           <div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Đang Xử Lý</p>
             <h3 className="text-2xl font-black text-gray-800">{summary?.processing || 0}</h3>
           </div>
        </div>
        <div className="card p-6 bg-white border border-gray-100 shadow-xl shadow-gray-200/40 rounded-3xl flex items-center gap-4">
           <div className="p-3 bg-red-50 text-red-500 rounded-xl"><AlertCircle size={24} /></div>
           <div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mới Nhận</p>
             <h3 className="text-2xl font-black text-gray-800">{summary?.new || 0}</h3>
           </div>
        </div>
      </div>

      {/* List of reports */}
      <div className="card p-6 bg-white border border-gray-100 shadow-2xl shadow-gray-200/50 rounded-3xl">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Chi tiết Báo cáo từ Nhân sự</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="p-4 rounded-tl-xl cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ten_kh_display')}>
                   <div className="flex items-center gap-1">Khách hàng Mục tiêu <SortIcon config={sortConfig} field="ten_kh_display" /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('staff_name')}>
                   <div className="flex items-center gap-1">Nhân sự <SortIcon config={sortConfig} field="staff_name" /></div>
                </th>
                <th className="p-4">Kịch bản Giao</th>
                <th className="p-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('trang_thai')}>
                   <div className="flex items-center gap-1">Trạng thái <SortIcon config={sortConfig} field="trang_thai" /></div>
                </th>
                <th className="p-4 rounded-tr-xl">Báo cáo Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedTasks.length === 0 ? (
                 <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-bold text-xs uppercase">Chưa có dữ liệu giao việc</td></tr>
              ) : sortedTasks.map(task => (
                <tr key={task.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="font-bold text-gray-800">{task.ten_kh_display}</div>
                       <button 
                         onClick={() => {
                           setHistoryTarget(task);
                           setShowHistoryModal(true);
                         }}
                         className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-vnpost-blue transition-colors"
                         title="Xem lịch sử tiếp cận"
                       >
                         <History size={14} />
                       </button>
                    </div>
                    <div className="text-[9px] text-gray-400 font-black uppercase mt-0.5">{task.loai_doi_tuong}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {task.staff_id ? (
                        <>
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black">
                            {task.staff_name?.charAt(0) || 'U'}
                          </div>
                          <span className="font-semibold text-gray-700">{task.staff_name}</span>
                        </>
                      ) : (
                        <button 
                          onClick={() => setAssigningTask(task)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-vnpost-orange/10 text-vnpost-orange hover:bg-vnpost-orange hover:text-white rounded-lg transition-all font-black text-[10px] uppercase tracking-wider"
                        >
                          <User size={12} /> Giao ngay
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                       <FlowBadge type={task.phan_loai_giao_viec} />
                       <span className="text-xs font-semibold text-vnpost-blue">{task.tieu_de}</span>
                    </div>
                    <div className="text-[9px] text-gray-400 mt-1 max-w-[200px] truncate" title={task.noi_dung}>{task.noi_dung}</div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={task.trang_thai} />
                  </td>
                  <td className="p-4 max-w-[250px]">
                    {task.bao_cao_ket_qua ? (
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        {task.bao_cao_ket_qua}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300 font-bold uppercase italic">Chưa báo cáo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Assign Modal */}
      {assigningTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="font-black text-gray-800 flex items-center gap-2 uppercase tracking-widest text-xs">
                 <User size={16} className="text-vnpost-blue" /> Điều phối nhân sự
               </h3>
               <button onClick={() => setAssigningTask(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Chọn nhân viên để giao khách hàng:</p>
               <div className="font-bold text-vnpost-blue mb-4 text-sm bg-blue-50 p-3 rounded-xl border border-blue-100">
                  {assigningTask.ten_kh_display}
               </div>
               
               <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {staffList.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 text-xs italic font-bold">Không tìm thấy danh sách nhân viên</p>
                  ) : staffList.map(s => (
                    <button 
                      key={s.id}
                      onClick={() => handleQuickAssign(s.id)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center font-black group-hover:bg-vnpost-blue group-hover:text-white transition-colors">
                           {s.full_name?.charAt(0) || 'U'}
                         </div>
                         <div>
                            <p className="text-sm font-black text-gray-800">{s.full_name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{s.point_name}</p>
                         </div>
                      </div>
                      <Send size={16} className="text-gray-300 group-hover:text-vnpost-blue" />
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      <CustomerHistoryModal 
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        targetId={historyTarget?.target_id}
        loaiDoiTuong={historyTarget?.loai_doi_tuong}
        customerName={historyTarget?.ten_kh_display}
      />
    </div>
  );
}

// -------------------------------------------------------------
// STAFF KANBAN BOARD
// -------------------------------------------------------------
function StaffKanbanBoard({ filters }) {
  const [tasks, setTasks] = useState({
    'Mới': [],
    'Đang xử lý': [],
    'Hoàn thành': [],
    'Thất bại': []
  });
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/actions/tasks', { params: filters });
      const allTasks = res.data.items || [];
      
      const grouped = {
        'Mới': allTasks.filter(t => t.trang_thai === 'Mới' || t.trang_thai === 'Hủy'),
        'Đang xử lý': allTasks.filter(t => t.trang_thai === 'Đang xử lý'),
        'Hoàn thành': allTasks.filter(t => t.trang_thai === 'Hoàn thành'),
        'Thất bại': allTasks.filter(t => t.trang_thai === 'Thất bại')
      };
      setTasks(grouped);
    } catch(err) {
      toast.error('Lỗi tải công việc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  const handleUpdateReport = async (taskId, newStatus, reportText) => {
    try {
      await api.patch(`/api/actions/tasks/${taskId}/report`, {
        trang_thai: newStatus,
        bao_cao_ket_qua: reportText
      });
      toast.success('Đã cập nhật báo cáo thành công');
      setSelectedTask(null);
      fetchTasks(); // Reload
    } catch(err) {
      toast.error('Có lỗi xảy ra khi báo cáo');
    }
  };

  if (loading) return <div className="p-20 text-center text-gray-400 font-bold">Đang tải Kanban...</div>;

  const columns = [
    { id: 'Mới', title: 'Việc Mới Nhận', icon: <AlertCircle size={16} />, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: 'Đang xử lý', title: 'Đang Tiến Hành', icon: <PlayCircle size={16} />, color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { id: 'Hoàn thành', title: 'Đã Báo Cáo Xong', icon: <CheckCircle2 size={16} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  ];

  return (
    <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
      {columns.map(col => (
        <div key={col.id} className="min-w-[320px] max-w-[320px] flex flex-col gap-4">
           {/* Column Header */}
           <div className={`p-4 rounded-2xl border font-black uppercase tracking-widest text-xs flex items-center justify-between shadow-sm ${col.color}`}>
              <div className="flex items-center gap-2">
                {col.icon} {col.title}
              </div>
              <span className="bg-white/50 px-2 py-0.5 rounded-full text-[10px]">{tasks[col.id].length}</span>
           </div>

           {/* Cards */}
           <div className="flex-1 space-y-4">
              {tasks[col.id].map(task => (
                <div 
                  key={task.id} 
                  onClick={() => setSelectedTask(task)}
                  className="bg-white p-5 rounded-3xl shadow-lg shadow-gray-200/40 border border-gray-100 hover:border-vnpost-blue/30 cursor-pointer transition-all hover:-translate-y-1 group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <FlowBadge type={task.phan_loai_giao_viec} />
                    {task.deadline && (
                      <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><Clock size={12}/> {task.deadline.substring(0, 10)}</span>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-gray-800 text-sm mb-1 group-hover:text-vnpost-blue transition-colors">
                    {task.ten_kh_display}
                  </h4>
                  <p className="text-xs text-gray-500 font-medium line-clamp-2 leading-relaxed">
                    Kịch bản: {task.tieu_de}
                  </p>
                </div>
              ))}
              
              {tasks[col.id].length === 0 && (
                <div className="p-8 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400 text-xs font-bold">
                   Trống
                </div>
              )}
           </div>
        </div>
      ))}

      {/* Task Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
               <h3 className="font-black text-gray-800 tracking-tight flex items-center gap-2">
                 <Target className="text-vnpost-orange" size={20} /> Xử lý Nhiệm vụ
               </h3>
               <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XCircle size={20} className="text-gray-400"/></button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
               <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-black text-vnpost-blue uppercase tracking-widest mb-1">Mục tiêu tiếp cận</p>
                  <h4 className="text-lg font-bold text-gray-800 mb-2">{selectedTask.ten_kh_display}</h4>
                  <div className="flex gap-4 text-xs font-semibold text-gray-500">
                    <span className="flex items-center gap-1"><Calendar size={14}/> Hạn chót: {selectedTask.deadline || 'Không có'}</span>
                    <span className="flex items-center gap-1"><Target size={14}/> {selectedTask.tieu_de}</span>
                  </div>
               </div>

               <div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Chi tiết việc cần làm (Kịch bản do Sếp giao)</p>
                 <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
                    {selectedTask.noi_dung}
                 </div>
               </div>

               <ReportForm 
                  task={selectedTask} 
                  onSubmit={handleUpdateReport} 
               />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportForm({ task, onSubmit }) {
  const [status, setStatus] = useState(task.trang_thai === 'Mới' ? 'Đang xử lý' : task.trang_thai);
  const [report, setReport] = useState(task.bao_cao_ket_qua || '');

  return (
    <div className="space-y-4 pt-4 border-t border-gray-100">
      <p className="text-[10px] font-black text-vnpost-orange uppercase tracking-widest">Ghi nhận Báo cáo Kết quả</p>
      
      <div className="flex gap-4">
        <label className="flex-1 cursor-pointer">
          <input type="radio" name="status" className="peer hidden" value="Đang xử lý" checked={status === 'Đang xử lý'} onChange={(e) => setStatus(e.target.value)} />
          <div className="p-3 text-center border-2 border-gray-100 rounded-xl peer-checked:border-orange-400 peer-checked:bg-orange-50 peer-checked:text-orange-600 font-bold text-xs transition-all">
            Đang tiến hành
          </div>
        </label>
        <label className="flex-1 cursor-pointer">
          <input type="radio" name="status" className="peer hidden" value="Hoàn thành" checked={status === 'Hoàn thành'} onChange={(e) => setStatus(e.target.value)} />
          <div className="p-3 text-center border-2 border-gray-100 rounded-xl peer-checked:border-emerald-400 peer-checked:bg-emerald-50 peer-checked:text-emerald-600 font-bold text-xs transition-all">
            Hoàn thành tốt
          </div>
        </label>
        <label className="flex-1 cursor-pointer">
          <input type="radio" name="status" className="peer hidden" value="Thất bại" checked={status === 'Thất bại'} onChange={(e) => setStatus(e.target.value)} />
          <div className="p-3 text-center border-2 border-gray-100 rounded-xl peer-checked:border-red-400 peer-checked:bg-red-50 peer-checked:text-red-600 font-bold text-xs transition-all">
            Chưa thành công
          </div>
        </label>
      </div>

      <textarea
        className="w-full p-4 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-vnpost-blue/10 bg-gray-50 min-h-[120px]"
        placeholder="Nhập chi tiết quá trình gặp khách hàng, phản hồi của họ và kết quả cuối cùng..."
        value={report}
        onChange={(e) => setReport(e.target.value)}
      ></textarea>

      <div className="flex justify-end pt-2">
         <button 
           onClick={() => onSubmit(task.id, status, report)}
           className="px-8 py-3 bg-[#0054A6] hover:bg-[#003E7E] text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
         >
           <Send size={16} /> Gửi Báo Cáo
         </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'Hoàn thành') return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg border border-emerald-100">Hoàn thành</span>;
  if (status === 'Đang xử lý') return <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded-lg border border-orange-100">Đang xử lý</span>;
  if (status === 'Thất bại') return <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-lg border border-red-100">Thất bại</span>;
  return <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg border border-blue-100">{status}</span>;
}

function FlowBadge({ type }) {
  if (type === 'Giao Cảnh báo') return <span className="text-[9px] font-black uppercase tracking-widest text-red-700 bg-red-100 px-2 py-1 rounded-md border border-red-200">🚨 CẢNH BÁO</span>;
  if (type === 'Giao VIP') return <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2 py-1 rounded-md border border-amber-200">💎 VIP</span>;
  return <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200">🎯 LEAD</span>;
}

function SortIcon({ config, field }) {
  if (config.key !== field) return <ChevronDown size={12} className="opacity-20" />;
  return config.direction === 'asc' ? <ChevronUp size={12} className="text-vnpost-blue" /> : <ChevronDown size={12} className="text-vnpost-blue" />;
}

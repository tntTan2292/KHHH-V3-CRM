import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveNavigationContext, getNavigationContext, syncUrlWithContext, getContextFromUrl } from '../utils/navigationMemory';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Target, Calendar, CheckCircle2, XCircle, Clock, AlertCircle, Search, User, Filter, MoreVertical, Edit3, Send, PlayCircle, MapPin, X, RefreshCw, ChevronUp, ChevronDown, History, Network, Globe, Map, Building2, Boxes, Building, Store, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import TreeExplorer from '../components/TreeExplorer';
import CustomerHistoryModal from '../components/CustomerHistoryModal';

const getDescendantIds = (node) => {
  if (!node) return [];
  let ids = [node.id];
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      ids = [...ids, ...getDescendantIds(child)];
    });
  }
  return ids;
};

export default function ActionCenter() {
  const { user } = useAuth();
  const isLeader = user?.role !== 'STAFF';
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedNode, setSelectedNode] = useState(null);
  const [isTreeOpen, setIsTreeOpen] = useState(false);

  // RF3A: Load context
  useEffect(() => {
    const urlContext = getContextFromUrl(searchParams);
    if (urlContext) {
      setSelectedNode(urlContext);
    } else {
      const savedContext = getNavigationContext();
      if (savedContext && savedContext.key) {
        setSelectedNode(savedContext);
        syncUrlWithContext(savedContext, searchParams, setSearchParams);
      }
    }
  }, []);
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
                 <TreeExplorer onSelect={(node) => { 
                   setSelectedNode(node); 
                   setIsTreeOpen(false); 
                   saveNavigationContext(node);
                   syncUrlWithContext(node, searchParams, setSearchParams);
                 }} selectedNode={selectedNode} />
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
  const [selectedNode, setSelectedNode] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  
  // Auto-select node when assigning a task
  useEffect(() => {
    if (assigningTask && staffList.length > 0 && treeData.length > 0 && !selectedNode) {
       const staffId = assigningTask.staff_id || assigningTask.assigned_staff_id;
       if (staffId) {
          const staff = staffList.find(s => s.id === parseInt(staffId) || s.id === staffId);
          if (staff && staff.point_id) {
             const findNode = (nodes, id) => {
                for (const n of nodes) {
                   if (n.id === id) return n;
                   if (n.children) {
                      const found = findNode(n.children, id);
                      if (found) return found;
                   }
                }
                return null;
             };
             const targetNode = findNode(treeData, staff.point_id);
             if (targetNode) {
                setSelectedNode(targetNode);
             }
          }
       }
    }
  }, [assigningTask, staffList, treeData, selectedNode]);

  // History Tracker
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);

  const [hierarchyTree, setHierarchyTree] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    fetchData();
    fetchStaff();
    fetchHierarchy();
  }, [filters]);

  const fetchHierarchy = async () => {
    try {
      const res = await api.get('/api/nodes/tree');
      setHierarchyTree(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await api.get('/api/users/staff');
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
             {/* RF2B C6 - Completion % */}
             {summary?.total > 0 && (<p className="text-[10px] font-black text-emerald-600 mt-1">Tỉ lệ: {Math.round(((summary?.completed || 0) / summary.total) * 100)}%</p>)}
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
      
      {/* SLA Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {/* Overdue Staff Table */}
         <div className="card p-6 bg-white border border-gray-100 shadow-xl shadow-gray-200/40 rounded-3xl">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Top Nhân sự Quá Hạn</h3>
            {summary?.staff_stats?.length > 0 ? (
               <table className="w-full text-left text-sm">
                 <thead>
                   <tr className="text-[10px] text-gray-400 uppercase border-b border-gray-50">
                     <th className="pb-2">Nhân sự</th>
                     <th className="pb-2">Đang giữ</th>
                     <th className="pb-2">Quá hạn</th>
                     <th className="pb-2">Tỷ lệ</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                   {summary.staff_stats.map(s => (
                     <tr key={s.staff_name}>
                       <td className="py-2 font-bold text-gray-700">{s.staff_name}</td>
                       <td className="py-2">{s.pending}</td>
                       <td className="py-2 text-red-500 font-bold">{s.overdue}</td>
                       <td className="py-2 font-semibold">{s.rate}%</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            ) : (
               <div className="text-center text-gray-400 text-xs italic py-4">Tất cả nhân sự đều đúng tiến độ</div>
            )}
         </div>

         <div className="flex flex-col gap-4">
           <div className="card p-6 bg-red-50/50 border border-red-100 shadow-xl shadow-red-200/20 rounded-3xl flex items-center gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl"><AlertCircle size={24} /></div>
              <div>
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Tổng Task Quá Hạn</p>
                <h3 className="text-2xl font-black text-red-600">{summary?.overdue_count || 0}</h3>
              </div>
           </div>
           <div className="flex gap-4 h-full">
             <div className="card p-6 flex-1 bg-orange-50/50 border border-orange-100 rounded-3xl flex flex-col justify-center gap-2">
                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Sắp Quá Hạn (&lt; 24h)</p>
                <h3 className="text-xl font-black text-orange-600 flex items-center gap-2"><Clock size={16}/> {summary?.upcoming_overdue_count || 0}</h3>
             </div>
             <div className="card p-6 flex-1 bg-yellow-50/50 border border-yellow-100 rounded-3xl flex flex-col justify-center gap-2">
                <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Task Treo Lâu (&gt; 2 ngày)</p>
                <h3 className="text-xl font-black text-yellow-600 flex items-center gap-2"><History size={16}/> {summary?.stale_task_count || 0}</h3>
             </div>
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
                    <div className="flex flex-col gap-2 items-start">
                      <StatusBadge status={task.trang_thai} />
                      {task.overdue_at && <span className="bg-red-50 text-red-600 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border border-red-200 tracking-wider">⚠️ QUÁ HẠN</span>}
                      {task.upcoming_sla && !task.overdue_at && <span className="bg-orange-50 text-orange-600 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border border-orange-200 tracking-wider">SẮP QUÁ HẠN</span>}
                      {task.stale_days >= 2 && <span className="bg-yellow-50 text-yellow-600 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border border-yellow-200 tracking-wider">TREO {task.stale_days} NGÀY</span>}
                    </div>
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

      {/* Quick Assign Modal - Flexible Assignment UI */}
      {assigningTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 flex flex-col md:flex-row h-[80vh]">
            
            {/* Hierarchy Tree Panel */}
            <div className="w-full md:w-1/2 bg-gray-50 border-r border-gray-100 flex flex-col">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                 <h3 className="font-black text-gray-800 flex items-center gap-2 uppercase tracking-widest text-xs">
                   <Network size={16} className="text-vnpost-blue" /> Cây Điều Phối
                 </h3>
               </div>
               <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Lọc theo Đơn vị:</p>
                 
                 <div className="space-y-1">
                    <button 
                       onClick={() => setSelectedNode(null)}
                       className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-colors ${!selectedNode ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                      Tất cả nhân sự
                    </button>
                    {hierarchyTree.map(node => (
                       <HierarchyNodeItem key={node.id} node={node} selectedNode={selectedNode} onSelect={setSelectedNode} />
                    ))}
                 </div>
               </div>
            </div>

            {/* Staff List Panel */}
            <div className="w-full md:w-1/2 flex flex-col bg-white">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                 <div>
                   <h3 className="font-black text-gray-800 flex items-center gap-2 uppercase tracking-widest text-xs mb-1">
                     <User size={16} className="text-vnpost-blue" /> Chọn Nhân sự
                   </h3>
                   <div className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[200px]" title={assigningTask.ten_kh_display}>
                     Giao: {assigningTask.ten_kh_display}
                   </div>
                 </div>
                 <button onClick={() => { setAssigningTask(null); setSelectedNode(null); }} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                 <div className="mb-4">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Đang xem:</p>
                   {selectedNode ? (
                     <div className="inline-block bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                       <p className="text-xs font-bold text-vnpost-blue uppercase tracking-wider">
                         {selectedNode.title || selectedNode.name} {selectedNode.key ? `(${selectedNode.key})` : ''}
                       </p>
                     </div>
                   ) : (
                     <p className="text-xs font-bold text-gray-500 italic">Tất cả nhân sự trong quyền</p>
                   )}
                 </div>
                 
                 <div className="space-y-2">
                    {(() => {
                      const validIds = selectedNode ? getDescendantIds(selectedNode) : [];
                      const filteredStaff = staffList.filter(s => !selectedNode || validIds.includes(s.point_id));
                      
                      if (filteredStaff.length === 0) {
                        return (
                          <div className="text-center py-10">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3"><User size={20} className="text-gray-300"/></div>
                            <p className="text-gray-400 text-xs italic font-bold">Không có nhân sự nào trong đơn vị này</p>
                          </div>
                        );
                      }
                      
                      return filteredStaff.map(s => (
                        <button 
                          key={s.id}
                          onClick={() => handleQuickAssign(s.id)}
                          className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-blue-50 border border-gray-50 hover:border-blue-100 transition-all text-left group shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center font-black group-hover:bg-vnpost-blue group-hover:text-white transition-colors border border-gray-100 group-hover:border-vnpost-blue">
                               {s.full_name?.charAt(0) || 'U'}
                             </div>
                             <div>
                                <p className="text-sm font-black text-gray-800">{s.full_name}</p>
                                <div className="flex gap-2 items-center mt-1">
                                  <span className="text-[9px] text-gray-400 font-bold uppercase bg-gray-100 px-1.5 py-0.5 rounded">{s.chuc_vu || 'Nhân viên'}</span>
                                  <span className="text-[9px] text-vnpost-blue font-bold uppercase truncate max-w-[120px]">{s.point_name}</span>
                                </div>
                             </div>
                          </div>
                          <Send size={16} className="text-gray-300 group-hover:text-vnpost-blue" />
                        </button>
                      ));
                    })()}
                 </div>
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
  const { user } = useAuth();
  const [tasks, setTasks] = useState({
    'Mới': [],
    'Đang xử lý': [],
    'Hoàn thành': [],
    'Thất bại': []
  });
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [staffOptions, setStaffOptions] = useState([]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/actions/tasks', { params: filters });
      const allTasks = res.data.items || [];
      
      // Sort tasks: overdue_at first
      allTasks.sort((a, b) => {
        if (a.overdue_at && !b.overdue_at) return -1;
        if (!a.overdue_at && b.overdue_at) return 1;
        return 0;
      });
      
      const grouped = {
        'Mới': allTasks.filter(t => t.trang_thai === 'Mới' || t.trang_thai === 'Hủy'),
        'Đang xử lý': allTasks.filter(t => t.trang_thai === 'Đang xử lý' || t.trang_thai === 'CHỜ CHỈ ĐẠO'),
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
    fetchStaff();
  }, [filters]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/api/users/staff');
      setStaffOptions(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptTask = async () => {
    try {
      await api.post(`/api/actions/tasks/${selectedTask.id}/accept`);
      toast.success('Đã nhận xử lý công việc');
      setSelectedTask(null);
      fetchTasks();
    } catch(err) {
      toast.error('Lỗi khi nhận việc');
    }
  };

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
                  className={`bg-white p-5 rounded-3xl shadow-lg shadow-gray-200/40 border ${task.overdue_at ? 'border-red-400' : 'border-gray-100'} hover:border-vnpost-blue/30 cursor-pointer transition-all hover:-translate-y-1 group`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2 flex-wrap items-center">
                      <FlowBadge type={task.phan_loai_giao_viec} />
                      {task.overdue_at && <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-0.5 rounded border border-red-200 uppercase tracking-widest shadow-sm">⚠️ QUÁ HẠN</span>}
                    </div>
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
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]">
            <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
               <h3 className="font-black text-gray-800 tracking-tight flex items-center gap-2 uppercase text-sm">
                 <Target className="text-vnpost-orange" size={20} /> Xử lý Nhiệm vụ
               </h3>
               <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XCircle size={20} className="text-gray-400"/></button>
            </div>
            
            <div className="flex flex-col lg:flex-row overflow-hidden flex-1">
               {/* Left Side: Detail & Report Form */}
               <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6 lg:border-r border-gray-100">
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

                  {user?.nhan_su_id === selectedTask?.staff_id && (
                     <div className="pt-4 border-t border-gray-100 space-y-4">
                       {selectedTask.trang_thai === 'Mới' && (
                         <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex flex-col items-center text-center gap-3">
                           <p className="text-sm font-bold text-orange-800">Bạn vừa nhận được một nhiệm vụ mới. Vui lòng xác nhận để bắt đầu xử lý.</p>
                           <button onClick={handleAcceptTask} className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-orange-500/30 transition-all">
                             <CheckCircle2 size={16} /> Nhận xử lý
                           </button>
                         </div>
                       )}

                       {selectedTask.trang_thai !== 'Mới' && (
                         <>
                           <ReportForm 
                              task={selectedTask} 
                              onSubmit={handleUpdateReport} 
                           />
                         </>
                       )}
                     </div>
                  )}

                  {user?.nhan_su_id !== selectedTask?.staff_id && (
                     <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center">
                       <p className="text-sm font-bold text-gray-500">Bạn đang xem nhiệm vụ của người khác. Chỉ người phụ trách mới được quyền thao tác.</p>
                     </div>
                  )}
               </div>

               {/* Right Side: Timeline UI */}
               <div className="w-full lg:w-[400px] bg-gray-50/30 overflow-y-auto custom-scrollbar border-t lg:border-t-0 border-gray-100 shrink-0">
                  <TaskTimeline taskId={selectedTask.id} currentStatus={selectedTask.trang_thai} />
               </div>
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

function TaskTimeline({ taskId, currentStatus }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/actions/${taskId}/timeline`);
        setTimeline(res.data || []);
      } catch (err) {
        toast.error('Lỗi tải timeline');
      } finally {
        setLoading(false);
      }
    };
    if (taskId) fetchTimeline();
  }, [taskId, currentStatus]); // Reload timeline when task status changes

  if (loading) return <div className="p-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest">Đang tải lịch sử sự kiện...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
         <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
           <History size={14} className="text-gray-300" />
           Dấu chân Timeline
         </h4>
         <span className="text-[9px] font-black bg-white px-2 py-1 rounded-lg text-gray-400 shadow-sm border border-gray-100">{timeline.length} Events</span>
                  <div className="flex items-start justify-between gap-2 mb-1">
                     <span className="font-black text-gray-800 text-[11px] uppercase tracking-wider">{event.event_type.replace(/_/g, ' ')}</span>
                     <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-50">
                        {new Date(event.created_at).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'})}
                     </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                     <User size={10} /> 
                     Thực hiện: <span className="font-bold text-gray-700">{event.action_by}</span>
                  </div>
                  
                  {(event.event_type === "DELEGATED" || event.event_type === "ASSIGN_STAFF" || event.event_type === "REASSIGNED") && (
                    <div className="text-[10px] text-gray-600 mb-2 mt-1 bg-gray-100/50 p-2 rounded-lg border border-gray-100">
                      <div className="flex flex-col gap-1">
                        {event.from_staff_name && <span className="flex items-center gap-1"><span className="text-gray-400 w-6">Từ:</span> <span className="font-bold">{event.from_staff_name}</span></span>}
                        {event.to_staff_name && <span className="flex items-center gap-1"><span className="text-gray-400 w-6">Đến:</span> <span className="font-bold text-vnpost-blue">{event.to_staff_name}</span></span>}
                      </div>
                    </div>
                  )}

                  {/* Status Change Indicator */}
                  {event.previous_status && event.previous_status !== event.new_status && (
                    <div className="flex items-center gap-1 mt-2 mb-1">
                      <span className="text-[9px] text-gray-400 line-through">{event.previous_status}</span>
                      <span className="text-[9px] text-gray-400">→</span>
                      <span className="text-[9px] font-black text-gray-700">{event.new_status}</span>
                    </div>
                  )}

                  {event.evidence_text && (
                    <div className="mt-2 text-[11px] text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm whitespace-pre-wrap leading-relaxed relative overflow-hidden group-hover:border-blue-100 transition-colors">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gray-200 group-hover:bg-blue-300 transition-colors"></div>
                      <span className="pl-1">{event.evidence_text}</span>
                    </div>
                  )}
               </div>
            </div>
          );
        })}
        {timeline.length === 0 && <div className="text-xs text-gray-400 italic font-bold">Chưa có sự kiện nào được ghi nhận.</div>}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Hierarchy Tree Components
// -------------------------------------------------------------
function HierarchyNodeItem({ node, depth = 0, selectedNode, onSelect }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNode?.id === node.id;
  
  const nodeRef = useRef(null);

  // Auto expand if selectedNode is a descendant
  useEffect(() => {
    if (selectedNode) {
      const hasSelectedChild = (n, targetId) => {
         if (!n.children) return false;
         for (const child of n.children) {
            if (child.id === targetId) return true;
            if (hasSelectedChild(child, targetId)) return true;
         }
         return false;
      };
      if (hasSelectedChild(node, selectedNode.id)) {
         setExpanded(true);
      }
    }
  }, [selectedNode, node]);

  // Auto scroll into view if selected
  useEffect(() => {
    if (isSelected && nodeRef.current) {
      nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const getTypeConfig = (type) => {
    switch (type) {
      case 'ROOT': return { icon: <Globe size={14} className="text-blue-600" /> };
      case 'BRANCH': return { icon: <Map size={14} className="text-indigo-600" /> };
      case 'CENTER': return { icon: <Building2 size={14} className="text-violet-600" /> };
      case 'CLUSTER': return { icon: <Boxes size={14} className="text-orange-600" /> };
      case 'UNIT': return { icon: <Building size={14} className="text-teal-600" /> };
      case 'POINT': return { icon: <Store size={14} className="text-emerald-600" /> };
      default: return { icon: <Network size={14} className="text-gray-400" /> };
    }
  };

  const config = getTypeConfig(node.type);

  return (
    <div className="w-full relative" ref={nodeRef}>
      {depth > 0 && (
        <div className="absolute top-0 bottom-0 border-l-2 border-gray-100 z-0" style={{ left: `${(depth - 1) * 24 + 19}px` }}></div>
      )}
      <div 
        className={`flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer transition-all relative z-10 ${isSelected ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'hover:bg-gray-50 border border-transparent'}`}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        <div 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded-md transition-colors shrink-0"
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} className="text-gray-500"/> : <ChevronRight size={14} className="text-gray-400"/>) : <span className="w-3.5" />}
        </div>
        <div className="flex-1 flex items-center gap-2.5 overflow-hidden" onClick={() => onSelect(node)}>
          <div className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center shrink-0">
             {config.icon}
          </div>
          <div className="flex flex-col min-w-0">
             <span className={`text-sm font-bold truncate ${isSelected ? 'text-vnpost-blue' : 'text-gray-700'}`}>{node.title || node.name}</span>
          </div>
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="mt-0.5 space-y-0.5 relative z-0">
          {node.children.map(child => (
            <HierarchyNodeItem key={child.id} node={child} depth={depth + 1} selectedNode={selectedNode} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

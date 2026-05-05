import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Users, Target, Zap, TrendingUp, TrendingDown, 
  MessageSquare, Phone, MapPin, Award, 
  MoreVertical, Plus, Filter, Search,
  Clock, CheckCircle2, AlertCircle, Brain, Calendar, MapPin as MapPinIcon, Filter as FilterIcon, X, Sparkles, RefreshCw, User
} from 'lucide-react';
import TreeExplorer from '../components/TreeExplorer';

const INITIAL_STAGES = [
  { id: 'B1', title: 'BẮT NHỊP', color: 'blue', icon: Search, desc: 'Tiếp cận & Khảo sát' },
  { id: 'B2', title: 'BÀN BẠC', color: 'indigo', icon: MessageSquare, desc: 'Tư vấn giải pháp' },
  { id: 'B3', title: 'BÁN HÀNG', color: 'emerald', icon: Zap, desc: 'Mở mã & Đơn đầu' },
  { id: 'B4', title: 'BÙNG NỔ', color: 'rose', icon: TrendingUp, desc: 'Kích hoạt sản lượng' },
  { id: 'B5', title: 'BÁM SÁT', color: 'purple', icon: Award, desc: 'Duy trì & Chăm sóc' }
];

export default function LeadPipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // 1. Lấy dữ liệu từ Potential Pool (theo ngày và bưu cục)
      const potentialRes = await api.get('/api/potential', { 
        params: { 
          start_date: startDate,
          end_date: endDate,
          node_code: selectedNode?.code,
          page_size: 100, 
          sort_by: 'tong_doanh_thu', 
          order: 'desc' 
        } 
      });
      
      // 2. Lấy dữ liệu từ Active Tasks (TiemNang)
      const tasksRes = await api.get('/api/actions/tasks', {
        params: {
          loai_doi_tuong: 'TiemNang',
          node_code: selectedNode?.code,
          start_date: startDate,
          end_date: endDate
        }
      });

      const poolItems = potentialRes.data.items || [];
      const taskItems = tasksRes.data.items || [];

      // Map pool items
      const mappedPool = poolItems.map(item => ({
        id: item.ten_kh,
        name: item.ten_kh,
        stage: item.rfm_segment === 'Kim Cương' ? 'B2' : 'B1', 
        score: Math.min(95, Math.floor(item.tong_so_don / 5) + 50),
        competitor: 'Đang cập nhật...',
        est_vol: `${item.tong_so_don} đơn/${item.so_ngay_gui} ngày`,
        address: item.point_name || 'Huế',
        last_contact: item.ngay_gan_nhat || 'Chưa liên hệ',
        priority: item.rfm_segment === 'Kim Cương' ? 'high' : 'medium',
        has_task: false
      }));

      // Map task items (leads đang chăm sóc)
      const mappedTasks = taskItems.map(task => {
        // Ánh xạ trạng thái task sang stage 5B
        let stage = 'B1';
        if (task.trang_thai === 'Đang xử lý') stage = 'B2';
        else if (task.trang_thai === 'Hoàn thành') stage = 'B3';
        
        return {
          id: task.target_id,
          name: task.target_id,
          stage: stage,
          score: 60,
          competitor: 'Đang khai thác',
          est_vol: 'Theo Task',
          address: task.staff_name || 'Huế',
          last_contact: task.created_at || 'Vừa giao',
          priority: task.phan_loai_giao_viec === 'Giao VIP' ? 'high' : 'medium',
          has_task: true,
          task_status: task.trang_thai
        };
      });

      // Merge & Deduplicate (Ưu tiên thông tin từ Task nếu có)
      const leadMap = new Map();
      mappedPool.forEach(l => leadMap.set(l.id, l));
      mappedTasks.forEach(l => {
        if (leadMap.has(l.id)) {
           // Cập nhật stage từ task
           const existing = leadMap.get(l.id);
           leadMap.set(l.id, { ...existing, stage: l.stage, has_task: true, task_status: l.task_status });
        } else {
           leadMap.set(l.id, l);
        }
      });
      
      setLeads(Array.from(leadMap.values()));
    } catch (err) {
      console.error('Lỗi tải dữ liệu Pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [startDate, endDate, selectedNode]);

  const getPriorityColor = (p) => {
    if (p === 'high') return 'text-rose-500 bg-rose-50 border-rose-100';
    return 'text-blue-500 bg-blue-50 border-blue-100';
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="bg-vnpost-blue p-4 rounded-[2rem] shadow-xl shadow-blue-100">
            <Target className="text-vnpost-orange" size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-vnpost-blue leading-tight">
              HÀNH TRÌNH CHINH PHỤC 5B
            </h1>
            <p className="text-gray-400 font-bold text-sm flex items-center gap-2 mt-1">
              <Sparkles size={14} className="text-vnpost-orange" />
              Tư duy BẮT - BÀN - BÁN - BÙNG - BÁM (Sales Pipeline 3.0)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Node Selector */}
          <div className="relative">
            <button
              onClick={() => setIsTreeOpen(!isTreeOpen)}
              className="bg-white border-2 border-gray-100 px-6 py-3 rounded-2xl flex items-center gap-3 hover:border-vnpost-blue transition-all shadow-sm"
            >
              <MapPinIcon size={18} className="text-vnpost-blue" />
              <span className="text-sm font-black text-gray-700">
                {selectedNode ? selectedNode.name : "Phạm vi dữ liệu"}
              </span>
            </button>
            {isTreeOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 animate-in fade-in slide-in-from-top-2">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase">Chọn đơn vị</h3>
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

          <div className="bg-white p-1 rounded-2xl shadow-sm border-2 border-gray-100 flex">
             <button className="px-6 py-2 bg-vnpost-blue text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-100 transition-all">Kanban</button>
             <button className="px-6 py-2 text-gray-400 font-bold text-xs hover:text-vnpost-blue transition-all">Danh sách</button>
          </div>
          
          <button 
            onClick={fetchLeads}
            className="bg-white text-vnpost-blue p-3.5 rounded-2xl shadow-sm border-2 border-gray-100 hover:bg-blue-50 transition-all"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {INITIAL_STAGES.map((stage) => (
          <div key={stage.id} className={`bg-white p-5 rounded-[2rem] border border-${stage.color}-100 shadow-sm relative overflow-hidden`}>
             <div className={`absolute -right-4 -bottom-4 opacity-5 text-${stage.color}-600`}>
                <stage.icon size={80} />
             </div>
             <p className={`text-[10px] font-black text-${stage.color}-600 uppercase tracking-widest`}>{stage.title}</p>
             <div className="flex items-end gap-2 mt-2">
                <span className="text-2xl font-black text-gray-800">
                  {leads.filter(l => l.stage === stage.id).length}
                </span>
                <span className="text-[10px] text-gray-400 mb-1 font-bold">Leads</span>
             </div>
          </div>
        ))}
      </div>

      {/* Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-[calc(100vh-320px)] min-h-[600px]">
        {INITIAL_STAGES.map((stage) => (
          <div key={stage.id} className="flex flex-col gap-4">
            {/* Column Header */}
            <div className={`flex items-center justify-between p-4 bg-${stage.color}-50/50 rounded-2xl border-b-4 border-${stage.color}-500/30`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-${stage.color}-500 text-white rounded-xl shadow-lg shadow-${stage.color}-100`}>
                   <stage.icon size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-800 uppercase">{stage.title}</h3>
                  <p className="text-[9px] text-gray-400 font-bold">{stage.desc}</p>
                </div>
              </div>
              <div className="bg-white/80 px-2 py-0.5 rounded-lg text-[10px] font-black text-gray-400 border border-gray-100">
                {leads.filter(l => l.stage === stage.id).length}
              </div>
            </div>

            {/* Leads List */}
            <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
              {leads.filter(l => l.stage === stage.id).map((lead) => (
                <div 
                  key={lead.id} 
                  onClick={() => setSelectedLead(lead)}
                  className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${getPriorityColor(lead.priority)}`}>
                      {lead.priority === 'high' ? '🚨 Priority' : 'Standard'}
                    </div>
                    {lead.has_task && (
                      <div className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                        Active Task
                      </div>
                    )}
                  </div>

                  <h4 className="text-sm font-black text-vnpost-blue mb-2 leading-tight group-hover:text-blue-600 transition-colors">{lead.name}</h4>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
                      <User size={12} className="text-vnpost-blue" />
                      <span className="truncate font-black text-gray-700">Giao cho: {lead.address}</span>
                    </div>
                    
                    {/* Field Data Badge */}
                    <div className="p-3 bg-gray-50 rounded-2xl space-y-2 border border-gray-100">
                       <div className="flex justify-between items-center text-[10px]">
                         <span className="text-gray-400 font-bold uppercase">Đối thủ:</span>
                         <span className="text-rose-600 font-black italic">{lead.competitor}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px]">
                         <span className="text-gray-400 font-bold uppercase">Quy mô:</span>
                         <span className="text-gray-700 font-black">{lead.est_vol}</span>
                       </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                       <div className={`p-1.5 ${lead.has_task ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'} rounded-lg`}>
                          {lead.has_task ? <CheckCircle2 size={12} /> : <Brain size={12} />}
                       </div>
                       <span className="text-[11px] font-black text-gray-700">
                         {lead.has_task ? lead.task_status : `${lead.score}%`}
                       </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold">
                       <Clock size={12} />
                       <span>{lead.last_contact}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Quick Add Button */}
              <button className="w-full py-4 border-2 border-dashed border-gray-100 rounded-3xl text-gray-300 hover:border-blue-200 hover:text-blue-400 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 text-xs font-bold">
                <Plus size={16} /> Thêm Lead mới
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-vnpost-blue flex justify-between items-center">
                 <h3 className="text-white font-black flex items-center gap-2 uppercase tracking-widest text-sm">
                   <Target className="text-vnpost-orange" size={20} /> Chi tiết hành trình
                 </h3>
                 <button onClick={() => setSelectedLead(null)} className="text-white/60 hover:text-white transition-colors">
                   <X size={24} />
                 </button>
              </div>
              
              <div className="p-8 space-y-6">
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Đối tượng tiếp cận</p>
                    <h2 className="text-2xl font-black text-vnpost-blue">{selectedLead.name}</h2>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                       <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Nhân sự phụ trách</p>
                       <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-vnpost-blue text-white flex items-center justify-center font-black text-xs">
                             {selectedLead.address.charAt(0)}
                          </div>
                          <span className="text-sm font-black text-gray-700">{selectedLead.address}</span>
                       </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                       <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Trạng thái hiện tại</p>
                       <div className="flex items-center gap-2 text-vnpost-orange">
                          <Zap size={16} />
                          <span className="text-sm font-black uppercase">
                            {INITIAL_STAGES.find(s => s.id === selectedLead.stage)?.title}
                          </span>
                       </div>
                    </div>
                 </div>

                 {selectedLead.has_task ? (
                   <div className="space-y-4">
                      <div className="p-6 bg-blue-50/50 rounded-3xl border-2 border-dashed border-blue-100">
                         <p className="text-[10px] font-black text-vnpost-blue uppercase tracking-widest mb-2">📌 Nội dung nhiệm vụ đang giao</p>
                         <p className="text-sm font-medium text-gray-600 leading-relaxed italic">
                           "Đang triển khai kịch bản tiếp cận khách hàng tiềm năng. Mục tiêu: Chuyển đổi sang mã định danh trong kỳ báo cáo..."
                         </p>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
                         <span className="text-xs font-black text-orange-700 uppercase">Tiến độ công việc:</span>
                         <StatusBadge status={selectedLead.task_status} />
                      </div>
                   </div>
                 ) : (
                   <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                      <p className="text-xs font-bold text-gray-400 italic">Chưa có nhiệm vụ cụ thể được gán. Hãy sử dụng chức năng "Giao việc" để bắt đầu hành trình chinh phục khách hàng này.</p>
                   </div>
                 )}

                 <div className="flex gap-3 pt-4">
                    <button className="flex-1 bg-vnpost-blue text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-800 transition-all">Giao việc mới</button>
                    <button onClick={() => setSelectedLead(null)} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Đóng</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'Hoàn thành') return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-lg">Đã hoàn thành</span>;
  if (status === 'Đang xử lý') return <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-black uppercase rounded-lg">Đang thực hiện</span>;
  return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-lg">{status}</span>;
}

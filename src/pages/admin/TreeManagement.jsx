import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
  Network, Plus, Edit2, Trash2, ChevronRight, ChevronDown, 
  MapPin, Home, Building2, Flag, Save, X, AlertCircle, RefreshCw, Globe
} from 'lucide-react';
import { toast } from 'react-toastify';

// Sử dụng api từ utils

const NODE_TYPES = [
  { value: 'ROOT', label: 'Tổng Cục/Gốc', icon: Building2, color: 'text-rose-600', bg: 'bg-rose-50' },
  { value: 'BRANCH', label: 'Khối Quản Lý', icon: Home, color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'CLUSTER', label: 'Cụm', icon: Flag, color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'WARD', label: 'Phường/Xã', icon: Globe, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'POINT', label: 'Bưu cục/Điểm', icon: MapPin, color: 'text-indigo-600', bg: 'bg-indigo-50' },
];

export default function TreeManagement() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [parentNode, setParentNode] = useState(null);
  const [flatNodes, setFlatNodes] = useState([]); // List for parent selection
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'POINT',
    parent_id: null
  });

  useEffect(() => {
    fetchTree();
  }, []);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/nodes/tree');
      setTree(res.data);
      
      // Flatten tree for select dropdown
      const flat = [];
      const flatten = (nodes) => {
        nodes.forEach(n => {
          flat.push({ id: n.id, title: n.title, type: n.type });
          if (n.children) flatten(n.children);
        });
      };
      flatten(res.data);
      setFlatNodes(flat);

      // Mặc định expand root
      if (res.data.length > 0) {
        setExpandedNodes(new Set([res.data[0].id]));
      }
    } catch (err) {
      toast.error("Không thể tải cây thư mục");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const handleOpenModal = (parent = null, node = null) => {
    setParentNode(parent);
    if (node) {
      setEditingNode(node);
      setFormData({
        code: node.key,
        name: node.title,
        type: node.type,
        parent_id: node.parent_id
      });
    } else {
      setEditingNode(null);
      setFormData({
        code: '',
        name: '',
        type: parent ? getNextType(parent.type) : 'CENTER',
        parent_id: parent ? parent.id : null
      });
    }
    setShowModal(true);
  };

  const getNextType = (parentType) => {
    if (parentType === 'ROOT') return 'BRANCH';
    if (parentType === 'BRANCH') return 'CLUSTER';
    if (parentType === 'CLUSTER') return 'WARD';
    return 'POINT';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingNode) {
        await api.patch(`/api/admin/hierarchy/nodes/${editingNode.id}`, formData);
        toast.success("Cập nhật node thành công");
      } else {
        await api.post('/api/admin/hierarchy/nodes', formData);
        toast.success("Thêm node mới thành công");
      }
      setShowModal(false);
      fetchTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Đã có lỗi xảy ra");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Sếp chắc chắn muốn xóa node này? (Chỉ xóa được nếu không có node con)")) return;
    try {
      await api.delete(`/api/admin/hierarchy/nodes/${id}`);
      toast.success("Đã xóa node");
      fetchTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Lỗi khi xóa");
    }
  };

  const renderNode = (node, parent = null, level = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const typeConfig = NODE_TYPES.find(t => t.value === node.type) || NODE_TYPES[0];
    const Icon = typeConfig.icon;

    return (
      <div key={node.id} className="space-y-1">
        <div 
          className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border border-transparent ${
            level === 0 ? 'bg-white shadow-sm font-bold' : 'hover:bg-blue-50/50 hover:border-blue-100'
          }`}
          style={{ marginLeft: `${level * 24}px` }}
        >
          <button 
            onClick={() => toggleExpand(node.id)}
            className={`w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors ${!hasChildren && 'invisible'}`}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className={`p-2 rounded-lg ${typeConfig.bg} ${typeConfig.color}`}>
            <Icon size={18} />
          </div>

          <div className="flex-1 flex items-center justify-between">
            <div>
              <span className="text-gray-800 tracking-tight">{node.title}</span>
              <span className="ml-2 text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                {node.key}
              </span>
              {node.type === 'ROOT' && <span className="ml-2 text-[10px] font-black text-rose-500 uppercase tracking-widest">(Gốc)</span>}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {node.type !== 'POINT' && (
                <button 
                  onClick={() => handleOpenModal(node)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                  title="Thêm node con"
                >
                  <Plus size={16} />
                </button>
              )}
              <button 
                onClick={() => handleOpenModal(parent, node)}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                title="Sửa"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => handleDelete(node.id)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                title="Xóa"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="relative">
             <div className="absolute left-[11px] top-0 bottom-4 w-px bg-gray-200" style={{ marginLeft: `${level * 24}px` }}></div>
             {node.children.map(child => renderNode(child, node, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header Area */}
      <div className="flex justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
          <Network size={120} />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">
            <Network className="text-vnpost-blue" size={32} /> Quản lý mô hình
          </h2>
          <p className="text-sm text-gray-500 mt-2 font-bold uppercase tracking-tight flex items-center gap-2">
            Thiết lập quan hệ Cha - Con cho chiến lược <span className="text-vnpost-orange underline decoration-wavy">Data-Driven CRM</span>
          </p>
        </div>
        {!tree.length && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg active:scale-95 z-10"
          >
            <Plus size={20} /> Khởi Tạo Node Gốc
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Help / Guide */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <AlertCircle size={18} className="text-blue-500" /> Hướng dẫn phân cấp
            </h4>
            <div className="space-y-4">
              {NODE_TYPES.map((type, idx) => (
                <div key={type.value} className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${type.bg} ${type.color}`}>
                    <type.icon size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Cấp {idx + 1}</p>
                    <p className="text-sm font-bold text-gray-700">{type.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-[10px] text-blue-700 leading-relaxed font-bold">
                ⚠️ LƯU Ý: Thay đổi cấu trúc cây sẽ ảnh hưởng ngay lập tức đến kết quả lọc dữ liệu của nhân viên cấp dưới.
              </p>
            </div>
          </div>
        </div>

        {/* Right: The Tree Editor */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 text-gray-400">
              <RefreshCw className="animate-spin mb-4" size={32} />
              <p className="font-bold uppercase tracking-widest text-xs">Đang dựng cây phân cấp...</p>
            </div>
          ) : (
            <div className="space-y-2 pb-20">
              {tree.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 font-bold uppercase tracking-wider text-sm">Chưa có dữ liệu cây</p>
                </div>
              ) : (
                tree.map(node => renderNode(node))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-[#003E7E]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up border-8 border-white">
             <div className="bg-gradient-to-r from-vnpost-blue to-blue-800 p-8 text-white flex justify-between items-center rounded-t-2xl">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">
                    {editingNode ? "Sửa Node" : "Thêm Node Con"}
                  </h3>
                  {parentNode && (
                    <p className="text-xs font-bold text-blue-200 mt-1 uppercase tracking-widest opacity-80">
                      Thuộc: {parentNode.name}
                    </p>
                  )}
                </div>
                <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                  <X size={24} />
                </button>
             </div>

             <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Loại Node</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-bold bg-white"
                  >
                    {NODE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mã Định Danh (Code)</label>
                  <input 
                    required
                    disabled={!!editingNode}
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    type="text" 
                    placeholder="Ví dụ: HU_CUM01" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-black uppercase disabled:bg-gray-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tên Hiển Thị</label>
                  <input 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    type="text" 
                    placeholder="Ví dụ: Cụm Trưởng Đại Diện 01" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Đơn Vị Quản Lý (Cha)</label>
                  <select 
                    value={formData.parent_id || ''}
                    onChange={(e) => setFormData({...formData, parent_id: e.target.value || null})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-bold bg-white"
                  >
                    <option value="">-- Cấp Cao Nhất (Gốc) --</option>
                    {flatNodes
                      .filter(n => !editingNode || n.id !== editingNode.id) // Không cho chọn chính mình
                      .map(n => (
                        <option key={n.id} value={n.id}>{n.title} ({n.type})</option>
                      ))
                    }
                  </select>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 border-2 border-gray-100 rounded-2xl font-black text-gray-400 uppercase tracking-widest text-xs">
                    Hủy
                  </button>
                  <button type="submit" className="flex-1 py-4 bg-vnpost-blue text-white rounded-2xl font-black shadow-xl shadow-vnpost-blue/20 hover:bg-[#003E7E] flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                    <Save size={18} /> {editingNode ? "Lưu Thay Đổi" : "Khởi Tạo Node"}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}

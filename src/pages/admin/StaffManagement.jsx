import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
  Users, UserPlus, Search, Edit2, Trash2, Mail, Phone, 
  MapPin, Briefcase, Link2, X, Check, Save, AlertCircle, RefreshCw,
  Lock, Unlock, ShieldCheck, UserCheck, Download, Upload, FileSpreadsheet, Eye
} from 'lucide-react';
import { toast } from 'react-toastify';
import TreeExplorer from '../../components/TreeExplorer';
import TreeSelect from '../../components/TreeSelect';


export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [includeChildren, setIncludeChildren] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  
  const [formData, setFormData] = useState({
    hr_id: '',
    full_name: '',
    username_app: '',
    point_id: '',
    chuc_vu: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchStaffByNode();
  }, [selectedNode, includeChildren]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, nodesRes] = await Promise.all([
        api.get(`/api/admin/personnel/staff`),
        api.get(`/api/nodes/tree`), // Use existing tree node endpoint
      ]);
      setStaff(staffRes.data);
      setNodes(flattenNodes(nodesRes.data));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Không thể tải dữ liệu nhân sự");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffByNode = async () => {
    if (!selectedNode?.id) {
      fetchData();
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/api/users/by-node`, {
        params: {
          node_id: selectedNode.id,
          include_children: includeChildren
        }
      });
      setStaff(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Không thể tải danh sách user theo node");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const flattenNodes = (nodesList, level = 0) => {
    let flat = [];
    nodesList.forEach(node => {
      flat.push({ ...node, level });
      if (node.children) {
        flat = [...flat, ...flattenNodes(node.children, level + 1)];
      }
    });
    return flat;
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingStaff(item);
      setFormData({
        hr_id: item.hr_id,
        full_name: item.full_name,
        username_app: item.username_app || '',
        point_id: item.point_id || '',
        chuc_vu: item.chuc_vu || '',
        email: item.email || '',
        phone: item.phone || ''
      });
    } else {
      setEditingStaff(null);
      setFormData({
        hr_id: '',
        full_name: '',
        username_app: '',
        point_id: '',
        chuc_vu: '',
        email: '',
        phone: ''
      });
    }
    setUnitSearch('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        await api.patch(`/api/admin/personnel/staff/${editingStaff.id}`, formData);
        toast.success("Cập nhật thành công");
      } else {
        await api.post(`/api/admin/personnel/staff`, formData);
        toast.success("Thêm nhân sự mới thành công");
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Đã có lỗi xảy ra");
    }
  };

  const handleToggleActive = async (staffId) => {
    try {
      const res = await api.post(`/api/admin/personnel/staff/${staffId}/toggle-active`);
      setStaff(staff.map(s => s.id === staffId ? { ...s, is_active: res.data.is_active } : s));
      toast.success(res.data.is_active ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Lỗi khi thay đổi trạng thái");
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/personnel/export-excel`, {
        responseType: 'blob',
        timeout: 60000, // Chờ tối đa 1 phút do server có thể đang bận đồng bộ dữ liệu
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'NhanSu_Mapping_V3.xlsx');
      document.body.appendChild(link);
      link.click();
      toast.success("Đã xuất file Excel thành công");
    } catch (err) {
      toast.error("Lỗi khi xuất file Excel");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/admin/personnel/import-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Lỗi khi nhập file Excel");
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };
  
  const handleSimulateUser = (staff) => {
    // We need the user_id for simulation
    if (!staff.user_id) {
        toast.error("Nhân sự này chưa có tài khoản hệ thống để mô phỏng");
        return;
    }
    localStorage.setItem('simulate_user_id', staff.user_id);
    toast.success(`Đã kích hoạt chế độ mô phỏng cho: ${staff.full_name}`);
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  };

  const handleResetPassword = async (staff) => {
    if (!staff.user_id) {
        toast.error("Nhân sự này chưa được tạo tài khoản hệ thống");
        return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn reset mật khẩu cho ${staff.full_name}?`)) return;
    
    try {
        const res = await api.post(`/api/users/${staff.user_id}/reset-password`);
        toast.success(res.data.message, { autoClose: 10000 }); // Show longer to see the password
    } catch (err) {
        toast.error("Không thể reset mật khẩu");
    }
  };

  const filteredStaff = staff.filter(s => 
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.hr_id.toLowerCase().includes(search.toLowerCase()) ||
    (s.username_app || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-vnpost-blue" /> Quản lý nhân sự
          </h2>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-tighter font-bold">
            Gắn kết Username giao dịch với hồ sơ nhân sự và phân cấp quản lý
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg active:scale-95"
          >
            <Download size={18} /> Xuất Excel
          </button>
          
          <label className="flex items-center gap-2 px-4 py-3 bg-vnpost-orange text-white rounded-xl font-bold hover:bg-orange-600 cursor-pointer transition-all shadow-lg active:scale-95">
            <Upload size={18} /> Nhập Excel
            <input 
              type="file" 
              className="hidden" 
              accept=".xlsx, .xls"
              onChange={handleImport}
            />
          </label>

          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-6 py-3 bg-vnpost-blue text-white rounded-xl font-bold hover:bg-[#003E7E] transition-all shadow-lg active:scale-95"
          >
            <UserPlus size={20} /> Thêm Nhân Sự
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Summary Cards & Unlinked Usernames */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-[#003E7E] to-[#0054A6] p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Users size={80} />
            </div>
            <p className="text-xs font-bold opacity-70 uppercase tracking-widest">Tổng nhân sự</p>
            <h3 className="text-4xl font-black mt-2">{staff.length}</h3>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-black bg-white/20 px-3 py-1.5 rounded-full w-fit">
              <Check size={12} /> HỆ THỐNG ĐÃ XÁC THỰC
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                  <MapPin size={18} className="text-vnpost-blue" /> Lọc theo cây đơn vị
                </h4>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                  Click node để tải lại danh sách user
                </p>
              </div>
            </div>

            <label className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-600">
              <input
                type="checkbox"
                checked={includeChildren}
                onChange={(e) => setIncludeChildren(e.target.checked)}
                className="rounded border-gray-300 text-vnpost-blue focus:ring-vnpost-blue/20"
              />
              Bao gồm cả node con
            </label>

            <div className="h-[420px]">
              <TreeExplorer
                selectedNode={selectedNode}
                onSelect={(node) => setSelectedNode(node)}
              />
            </div>
          </div>

        </div>

        {/* Right: Staff List Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input 
              type="text" 
              placeholder="Tìm nhân sự theo tên, mã HR hoặc Username giao dịch..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-100 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-vnpost-blue/5 transition-all text-sm font-medium"
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100 uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="p-4">Nhân Sự</th>
                  <th className="p-4">Chức Vụ / Đơn Vị</th>
                  <th className="p-4">Mapping App</th>
                  <th className="p-4">Liên Hệ</th>
                  <th className="p-4">Tài Khoản</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan="6" className="p-20 text-center text-gray-400">Đang tải danh sách...</td></tr>
                ) : filteredStaff.length === 0 ? (
                  <tr><td colSpan="6" className="p-20 text-center text-gray-400">Không tìm thấy nhân sự phù hợp</td></tr>
                ) : filteredStaff.map(s => (
                  <tr key={s.id} className="hover:bg-blue-50/30 transition-all group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-vnpost-blue/10 flex items-center justify-center text-vnpost-blue font-black text-xs border border-vnpost-blue/20">
                          {s.full_name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">{s.full_name}</span>
                          <span className="text-[10px] font-black text-vnpost-blue uppercase tracking-tighter shadow-sm w-fit">{s.hr_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                          <Briefcase size={12} className="text-vnpost-orange" /> {s.chuc_vu || "Chưa cập nhật"}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin size={12} /> {s.point_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {s.username_app ? (
                        <div className="flex items-center gap-2">
                           <span className="px-2 py-1 bg-green-50 text-green-700 rounded-md font-mono font-black text-[10px] border border-green-100 flex items-center gap-1">
                             <Link2 size={10} /> {s.username_app}
                           </span>
                        </div>
                      ) : (
                        <span className="text-xs text-rose-500 font-bold italic opacity-60">Chưa map user app</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Mail size={12}/> {s.email || '-'}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12}/> {s.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {s.has_account ? (
                        <button 
                          onClick={() => handleToggleActive(s.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black transition-all border ${
                            s.is_active 
                            ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' 
                            : 'bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {s.is_active ? <Unlock size={12} /> : <Lock size={12} />}
                          {s.is_active ? 'ĐANG MỞ' : 'ĐANG KHÓA'}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-300 italic">Chưa tạo</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleOpenModal(s)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shadow-sm"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleSimulateUser(s)}
                          className="p-2 text-vnpost-orange hover:bg-orange-100 rounded-lg transition-colors shadow-sm"
                          title="Xem với tư cách User này"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleResetPassword(s)}
                          className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shadow-sm"
                          title="Reset mật khẩu"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(s.id)}
                          className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors shadow-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-[#003E7E]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl animate-fade-in border-8 border-white">
            <div className="bg-gradient-to-r from-vnpost-blue to-blue-800 p-8 text-white flex justify-between items-center rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">
                  {editingStaff ? "Cập Nhật Hồ Sơ" : "Thêm Nhân Sự Mới"}
                </h3>
                <p className="text-xs font-bold text-blue-200 mt-1 uppercase tracking-widest opacity-80">Thông tin nhân sự 3.0</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mã HR (Duy nhất)</label>
                  <input 
                    required
                    disabled={!!editingStaff}
                    value={formData.hr_id}
                    onChange={(e) => setFormData({...formData, hr_id: e.target.value})}
                    type="text" 
                    placeholder="Ví dụ: HUM001" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-bold disabled:bg-gray-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Họ và Tên</label>
                  <input 
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    type="text" 
                    placeholder="Nhập tên nhân sự..." 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-xs font-bold mb-1">ĐƠN VỊ / VỊ TRÍ</label>
                  <TreeSelect 
                    value={formData.point_id}
                    onChange={(val) => setFormData({...formData, point_id: val})}
                    placeholder="-- Chọn Đơn Vị --"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username App Tính Cước</label>
                  <div className="relative">
                    <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      value={formData.username_app}
                      onChange={(e) => setFormData({...formData, username_app: e.target.value})}
                      type="text" 
                      placeholder="Ví dụ: bdhue_test" 
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-orange/5 outline-none transition-all text-sm font-black text-vnpost-orange uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Chức vụ</label>
                  <input 
                    value={formData.chuc_vu}
                    onChange={(e) => setFormData({...formData, chuc_vu: e.target.value})}
                    type="text" 
                    placeholder="Trưởng Phường..." 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                  <input 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    type="email" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Số điện thoại</label>
                  <input 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    type="tel" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-vnpost-blue/5 outline-none transition-all text-sm font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 border-2 border-gray-100 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-all uppercase tracking-widest text-xs"
                >
                  Hủy Bỏ
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-vnpost-blue text-white rounded-2xl font-black shadow-xl shadow-vnpost-blue/20 hover:bg-[#003E7E] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <Save size={18} /> {editingStaff ? "Cập Nhật Hồ Sơ" : "Xác Nhận Thêm Mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

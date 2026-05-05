import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
  ShieldCheck, UserCheck, MapPin, Search, Edit2, 
  ChevronRight, Lock, Unlock, Shield, Info, Save, X, 
  AlertCircle, RefreshCw, Key, Users, Filter, Eye
} from 'lucide-react';
import { toast } from 'react-toastify';
import TreeExplorer from '../../components/TreeExplorer';
import PermissionMatrix from '../../components/PermissionMatrix';


export default function RoleManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('assignments');
  
  // Filtering state
  const [selectedTreeNode, setSelectedTreeNode] = useState(null);
  const [includeChildren, setIncludeChildren] = useState(false);
  
  // Permissions State
  const [permissions, setPermissions] = useState([]);
  const [showRolePermsModal, setShowRolePermsModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [rolePermIds, setRolePermIds] = useState([]);

  // User Overrides state
  const [userGrantedIds, setUserGrantedIds] = useState([]);
  const [userDeniedIds, setUserDeniedIds] = useState([]);
  const [modalTab, setModalTab] = useState('basic'); // 'basic' or 'permissions'


  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState([]);
  const [selectedScopeNode, setSelectedScopeNode] = useState(null);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
    fetchPermissions();
  }, [selectedTreeNode, includeChildren]);
  
  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole);
    } else {
      setSelectedRolePermissions([]);
    }
  }, [selectedRole]);

  const fetchRolePermissions = async (roleId) => {
    try {
      const res = await api.get(`/api/admin/roles/${roleId}/permissions`);
      setSelectedRolePermissions(res.data);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await api.get(`/api/admin/roles/permissions`);
      setPermissions(res.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get(`/api/admin/roles/`);
      setRoles(res.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let res;
      if (selectedTreeNode) {
        // Fetch by node (tree filter)
        res = await api.get(`/api/users/by-node`, {
          params: { 
            node_id: selectedTreeNode.id,
            include_children: includeChildren
          }
        });
      } else {
        // Fetch all users with roles
        res = await api.get(`/api/admin/roles/users`);
      }
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(error.response?.data?.detail || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user) => {
    // If the user doesn't have a linked system user record yet (user_id is null), 
    // it means they only exist in NhanSu but not in Users table.
    // In this UI, we only manage people who ALREADY have a system account.
    if (!user.user_id) {
      toast.info('Nhân sự này chưa khởi tạo tài khoản. Hãy qua mục Nhân sự để Active trước.');
      return;
    }
    
    setEditingUser(user);
    setSelectedRole(user.role_id);
    setSelectedScopeNode(user.scope_node_id ? { id: user.scope_node_id, name: user.scope_node_name } : null);
    setModalTab('basic');
    fetchUserOverrides(user.user_id);
    setShowModal(true);
  };

  const fetchUserOverrides = async (userId) => {
    try {
      const res = await api.get(`/api/admin/roles/user/${userId}/permissions`);
      const granted = res.data.overrides.filter(o => o.is_granted).map(o => o.permission_id);
      const denied = res.data.overrides.filter(o => !o.is_granted).map(o => o.permission_id);
      setUserGrantedIds(granted);
      setUserDeniedIds(denied);
    } catch (error) {
      console.error('Error fetching user overrides:', error);
    }
  };

  const handleEditRolePerms = async (role) => {
    setEditingRole(role);
    try {
      const res = await api.get(`/api/admin/roles/${role.id}/permissions`);
      setRolePermIds(res.data);
      setShowRolePermsModal(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Lỗi khi tải quyền của vai trò');
    }
  };

  const handleSaveRolePerms = async () => {
    try {
      await api.post(`/api/admin/roles/assign-to-role`, {
        role_id: editingRole.id,
        permission_ids: rolePermIds
      });
      toast.success(`Đã cập nhật quyền cho vai trò ${editingRole.name}`);
      setShowRolePermsModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Lỗi khi lưu quyền');
    }
  };

  const handleSaveAssignment = async () => {
    if (!editingUser) return;
    
    try {
      // 1. Save Basic Assignment (Role & Scope)
      await api.post(`/api/admin/roles/assign`, {
        user_id: editingUser.user_id,
        role_id: selectedRole,
        scope_node_id: selectedScopeNode?.id || null
      });

      // 2. Save Overrides
      await api.post(`/api/admin/roles/assign-to-user`, {
        user_id: editingUser.user_id,
        permission_ids: userGrantedIds,
        denied_ids: userDeniedIds
      });

      toast.success('Đã cập nhật toàn bộ quyền hạn thành công');
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Lỗi khi cập nhật quyền hạn');
    }
  };
  
  const handleSimulateUser = (userId) => {
    localStorage.setItem('simulate_user_id', userId);
    toast.success('Đã kích hoạt chế độ mô phỏng. Toàn bộ Dashboard sẽ hiển thị theo quyền của User này.');
    // Chuyển hướng về Dashboard để xem kết quả
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.hr_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 bg-vnpost-bg min-h-screen">
      {/* Header Area */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-vnpost-blue p-3 rounded-2xl text-white shadow-lg shadow-blue-200">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">Quản lý phân quyền</h2>
              <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-1 flex items-center gap-2">
                <Lock size={12} className="text-vnpost-orange" /> Quản trị vai trò & Phạm vi truy cập dữ liệu
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-100 relative z-10">
          <button 
            onClick={() => setActiveTab('assignments')}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'assignments' ? 'bg-white shadow-md text-vnpost-blue' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Giao quyền User
          </button>
          <button 
            onClick={() => setActiveTab('definitions')}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'definitions' ? 'bg-white shadow-md text-vnpost-blue' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Định nghĩa Vai trò
          </button>
        </div>
      </div>

      {activeTab === 'assignments' ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar: Tree Explorer */}
          <div className="lg:w-80 space-y-4 shrink-0">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col min-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-gray-700 text-sm uppercase tracking-tight flex items-center gap-2">
                  <Filter size={16} className="text-vnpost-blue" /> Lọc theo Đơn vị
                </h4>
                <button 
                  onClick={() => setSelectedTreeNode(null)}
                  className="text-[10px] font-black text-vnpost-orange uppercase hover:underline"
                >
                  Xóa lọc
                </button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar">
                <TreeExplorer 
                  onSelect={(node) => setSelectedTreeNode(node)}
                  selectedNode={selectedTreeNode}
                />
              </div>

              <label className="mt-4 flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100 text-[10px] font-black text-gray-500 uppercase cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={includeChildren}
                  onChange={(e) => setIncludeChildren(e.target.checked)}
                  className="rounded text-vnpost-blue"
                />
                Bao gồm cả node con
              </label>
            </div>
          </div>

          {/* Right Column: Main Table */}
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[600px]">
            <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/20">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm theo Username, Tên hoặc Mã HR..."
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border-none bg-white shadow-sm focus:ring-2 focus:ring-vnpost-blue/10 text-sm font-bold"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                  {filteredUsers.length} Tài khoản
                </span>
                <button 
                  onClick={fetchUsers}
                  className="p-2 text-gray-500 hover:text-vnpost-blue transition-all"
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b">
                    <th className="px-6 py-4">Nhân sự</th>
                    <th className="px-6 py-4">Vai trò</th>
                    <th className="px-6 py-4">Phạm vi dữ liệu (Scope)</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="5" className="px-6 py-8 h-16 bg-gray-50/20"></td>
                      </tr>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-20 text-center text-gray-400 font-bold italic">
                        {selectedTreeNode ? 'Không có tài khoản nào tại đơn vị này' : 'Hãy chọn một đơn vị hoặc tìm kiếm tài khoản'}
                      </td>
                    </tr>
                  ) : filteredUsers.map(user => (
                    <tr key={user.hr_id} className="hover:bg-gray-50/30 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${user.role_name === 'ADMIN' ? 'bg-orange-50 text-vnpost-orange' : 'bg-blue-50 text-vnpost-blue'}`}>
                            <Users size={20} />
                          </div>
                          <div>
                            <div className="font-black text-gray-800 flex items-center gap-2">
                              {user.username || user.username_app || 'N/A'}
                              {user.role_name === 'ADMIN' && <Shield size={12} className="text-vnpost-orange" />}
                            </div>
                            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-tighter">
                              {user.full_name} • Mã HR: {user.hr_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          user.role_name === 'ADMIN' ? 'bg-orange-50 text-vnpost-orange border-orange-100' :
                          user.role_name === 'MANAGER' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                          user.role_name === 'LEADER' ? 'bg-blue-50 text-vnpost-blue border-blue-100' :
                          user.role_name === 'UNIT_HEAD' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          'bg-gray-50 text-gray-500 border-gray-100'
                        }`}>
                          {user.role_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 text-xs font-bold ${
                          user.scope_node_name === 'Toàn tỉnh' && user.role_name !== 'ADMIN' 
                          ? 'text-vnpost-orange' 
                          : 'text-gray-600'
                        }`}>
                          <MapPin size={14} className={user.scope_node_name === 'Toàn tỉnh' ? 'text-vnpost-orange' : 'text-gray-300'} />
                          {user.scope_node_name}
                          {user.scope_node_name === 'Toàn tỉnh' && user.role_name !== 'ADMIN' && (
                            <span className="text-[9px] bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">Cần gán lại</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.has_account ? (
                          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${user.is_active ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                            {user.is_active ? 'Hoạt động' : 'Đang khóa'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-gray-300 uppercase italic">Chưa kích hoạt</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            disabled={!user.has_account}
                            onClick={() => handleEditClick(user)}
                            className={`p-2 rounded-xl transition-all ${user.has_account ? 'text-vnpost-blue hover:bg-blue-50' : 'text-gray-200 cursor-not-allowed'}`}
                            title="Hiệu chỉnh quyền"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            disabled={!user.has_account}
                            onClick={() => handleSimulateUser(user.user_id)}
                            className={`p-2 rounded-xl transition-all ${user.has_account ? 'text-vnpost-orange hover:bg-orange-50' : 'text-gray-200 cursor-not-allowed'}`}
                            title="Xem với tư cách User này"
                          >
                            <Eye size={18} />
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
      ) : (
        /* Role Definitions Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map(role => (
            <div key={role.id} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
                <Shield size={64} />
              </div>
              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
                  role.name === 'ADMIN' ? 'bg-orange-500 text-white' : 
                  role.name === 'MANAGER' ? 'bg-purple-600 text-white' :
                  'bg-vnpost-blue text-white'
                }`}>
                  <Key size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-2">{role.name}</h3>
                <p className="text-sm text-gray-500 font-bold mb-6 min-h-[40px] leading-relaxed">
                  {role.description}
                </p>
                <div 
                  onClick={() => handleEditRolePerms(role)}
                  className="pt-6 border-t border-gray-50 flex items-center justify-between group/edit cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    <Info size={14} /> Chỉnh sửa quyền
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover/edit:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Permissions Modal */}
      {showRolePermsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setShowRolePermsModal(false)}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col relative z-10">
             <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-vnpost-blue text-white">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Thiết lập quyền mặc định</h3>
                  <p className="text-xs font-bold text-blue-200 mt-1 uppercase opacity-80">Vai trò: {editingRole?.name}</p>
                </div>
                <button onClick={() => setShowRolePermsModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                  <X size={24} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                <PermissionMatrix 
                  permissions={permissions}
                  selectedIds={rolePermIds}
                  onChange={(ids) => setRolePermIds(ids)}
                  mode="role"
                />
             </div>
             <div className="p-8 border-t border-gray-100 flex justify-end gap-4 bg-white">
                <button onClick={() => setShowRolePermsModal(false)} className="px-6 py-3 rounded-2xl text-sm font-black text-gray-500">Hủy</button>
                <button onClick={handleSaveRolePerms} className="px-8 py-3 bg-vnpost-blue text-white rounded-2xl font-black shadow-lg flex items-center gap-2">
                  <Save size={18} /> Lưu quyền vai trò
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className="bg-vnpost-blue p-3 rounded-2xl text-white shadow-lg">
                  <Unlock size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-800">Hiệu chỉnh quyền hạn</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                    Cấu hình cho user: <span className="text-vnpost-blue underline">{editingUser?.username || editingUser?.username_app}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="px-8 pt-4 flex gap-6 border-b border-gray-50 bg-gray-50/30">
              <button 
                onClick={() => setModalTab('basic')}
                className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${modalTab === 'basic' ? 'text-vnpost-blue' : 'text-gray-400'}`}
              >
                Cơ bản & Phạm vi
                {modalTab === 'basic' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-vnpost-blue rounded-t-full"></div>}
              </button>
              <button 
                onClick={() => setModalTab('permissions')}
                className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${modalTab === 'permissions' ? 'text-vnpost-blue' : 'text-gray-400'}`}
              >
                Quyền đặc lệ (Overrides)
                {modalTab === 'permissions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-vnpost-blue rounded-t-full"></div>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {modalTab === 'basic' ? (
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Left Column: Role Selection */}
                  <div className="flex-1 space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Chọn Vai trò</label>
                      <div className="grid grid-cols-1 gap-3">
                        {roles.map(role => (
                          <button
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                              selectedRole === role.id 
                              ? 'border-vnpost-blue bg-blue-50/50' 
                              : 'border-gray-100 hover:border-gray-200 bg-white'
                            }`}
                          >
                            <div>
                              <div className={`text-sm font-black uppercase tracking-tight ${selectedRole === role.id ? 'text-vnpost-blue' : 'text-gray-700'}`}>
                                {role.name}
                              </div>
                              <div className="text-[10px] font-bold text-gray-400 mt-0.5">{role.description}</div>
                            </div>
                            {selectedRole === role.id && <div className="w-2 h-2 rounded-full bg-vnpost-blue"></div>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                      <AlertCircle size={20} className="text-amber-500 shrink-0" />
                      <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                        Lưu ý: Quyền ADMIN sẽ có phạm vi truy cập toàn tỉnh mặc định. Các vai trò khác cần được gán cụ thể một Node trên cây đơn vị để giới hạn dữ liệu.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Tree Explorer for Scope */}
                  <div className="flex-1 space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Phạm vi dữ liệu (Scope Node)</label>
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 h-[400px] flex flex-col">
                      <div className="flex-1 overflow-auto custom-scrollbar">
                        <TreeExplorer 
                          onSelect={(node) => setSelectedScopeNode(node)}
                          selectedNode={selectedScopeNode}
                        />
                      </div>
                      {selectedScopeNode && (
                        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase">Đang chọn:</span>
                          <span className="px-3 py-1 bg-white rounded-lg text-xs font-black text-vnpost-blue border border-blue-100 shadow-sm">
                            {selectedScopeNode.name || selectedScopeNode.title}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Permissions Overrides Tab */
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 mb-6">
                    <Info size={20} className="text-vnpost-blue shrink-0" />
                    <p className="text-[11px] text-blue-700 font-bold leading-relaxed">
                      Thiết lập đặc lệ cho <span className="underline">{editingUser?.full_name}</span>. Quyền được gán ở đây sẽ ghi đè (Override) quyền mặc định của vai trò.
                    </p>
                  </div>
                  
                  <PermissionMatrix 
                    permissions={permissions}
                    selectedIds={userGrantedIds}
                    deniedIds={userDeniedIds}
                    rolePermissions={selectedRolePermissions}
                    onChange={(granted, denied) => {
                      setUserGrantedIds(granted);
                      setUserDeniedIds(denied);
                    }}
                    mode="user"
                  />
                </div>
              )}
            </div>

            <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-4">
              <button 
                onClick={() => setShowModal(false)}
                className="px-6 py-3 rounded-2xl text-sm font-black text-gray-500 hover:bg-white transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSaveAssignment}
                className="px-8 py-3 rounded-2xl text-sm font-black text-white bg-vnpost-blue shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                <Save size={18} /> Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

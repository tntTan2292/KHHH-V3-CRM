import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Bell, Search, UserCircle, Database, Menu, LogOut, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Topbar({ onMenuClick }) {
  const [latestDate, setLatestDate] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  
  const isSimulating = !!localStorage.getItem('simulate_user_id');

  const stopSimulation = () => {
    localStorage.removeItem('simulate_user_id');
    window.location.reload();
  };

  useEffect(() => {
    const fetchFreshness = async () => {
      try {
        const res = await api.get('/api/analytics/dashboard');
        if (res.data.latest_date) {
          setLatestDate(new Date(res.data.latest_date).toLocaleDateString('vi-VN'));
        }
      } catch (err) { console.error("Lỗi lấy ngày cập nhật:", err); }
    };
    fetchFreshness();
    const interval = setInterval(fetchFreshness, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-header h-14 flex items-center justify-between px-4 md:px-6 shadow-sm bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>

        <div className="hidden sm:block text-xs md:text-sm text-gray-500 font-medium">
          Hệ thống <span className="hidden lg:inline">Quản trị Khách hàng</span> <span className="mx-1 md:mx-2 text-vnpost-blue font-bold">•</span> VNPost Huế
        </div>
        {latestDate && (
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-vnpost-blue rounded-full border border-blue-100 text-[10px] font-black tracking-tighter">
            <Database size={12} />
            DỮ LIỆU ĐẾN: {latestDate}
          </div>
        )}
        
        {isSimulating && (
          <div className="flex items-center gap-3 px-4 py-1.5 bg-rose-50 border border-rose-100 rounded-2xl animate-pulse">
            <Eye size={16} className="text-rose-500" />
            <div className="hidden lg:block text-[11px] font-black text-rose-600 uppercase tracking-tight">
              Đang mô phỏng: {user?.full_name}
            </div>
            <button 
              onClick={stopSimulation}
              className="bg-rose-500 text-white p-1 rounded-lg hover:bg-rose-600 transition-all flex items-center gap-1 text-[10px] font-black"
            >
              <EyeOff size={12} /> THOÁT
            </button>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3 md:gap-4">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Tìm mã khách hàng, tên..." 
            className="pl-9 pr-4 py-2 bg-gray-50 border border-transparent rounded-full text-sm focus:outline-none focus:bg-white focus:border-vnpost-blue focus:ring-4 focus:ring-vnpost-blue/5 w-48 xl:w-64 transition-all"
          />
        </div>
        
        <button className="text-gray-400 hover:text-vnpost-blue transition-colors p-2 rounded-full hover:bg-blue-50 relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 border-l border-gray-100 pl-3 md:pl-4 group"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs md:text-sm font-bold text-gray-700 leading-tight group-hover:text-vnpost-blue transition-colors">
                {user?.full_name || 'Người dùng'}
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-tighter font-semibold">
                {user?.role_display || user?.role || 'Nhân viên'}
              </p>
            </div>
            <div className="relative">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-vnpost-blue to-blue-700 flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-sm overflow-hidden">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <UserCircle size={24} />}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-fade-in origin-top-right">
              <div className="px-4 py-3 border-b border-gray-50 mb-1">
                <p className="text-xs text-gray-400 font-medium">Đang đăng nhập với</p>
                <p className="text-sm font-bold text-gray-800 truncate">{user?.username}</p>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-vnpost-blue text-[10px] font-black rounded-md">
                  {user?.scope || 'Toàn tỉnh'}
                </div>
              </div>
              <button className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                <UserCircle size={18} className="text-gray-400" /> Hồ sơ cá nhân
              </button>
              <button 
                onClick={logout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
              >
                <LogOut size={18} /> Đăng xuất hệ thống
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Mailbox, Target, PieChart, ClipboardCheck, ChevronLeft, ChevronRight, ShieldCheck, X, Info, TrendingUp, Zap } from 'lucide-react';
import vnpostLogo from '../assets/logo.png';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const location = useLocation();
  const { user } = useAuth();

  const isRouteActive = (path) => {
    return location.pathname === path;
  };

  // Sử dụng quyền từ user object trong AuthContext (đã có sẵn slug)
  const userPermissions = user?.permissions || [];
  const loading = !user;

  const navGroups = [
    {
      title: 'Quản lý Khách hàng',
      items: [
        { name: 'Dashboard Tổng quan', path: '/dashboard', icon: <LayoutDashboard size={20} />, permission: 'view_dashboard' },
        { name: 'Danh sách Khách hàng', path: '/customers', icon: <Users size={20} />, permission: 'view_customers' },
        { name: 'Khách hàng Tiềm năng', path: '/potential', icon: <Target size={20} />, permission: 'view_potential' },
        { name: 'Hành trình 5B', path: '/potential/pipeline', icon: <Zap size={20} />, permission: 'view_potential' },
      ]
    },
    {
      title: 'Hệ thống Báo cáo & Phân tích',
      items: [
        { name: 'Phân tích & Vòng đời', path: '/analytics', icon: <PieChart size={20} />, permission: 'view_analytics' },
        { name: 'Báo cáo Biến động', path: '/reports/movement', icon: <TrendingUp size={20} />, permission: 'view_analytics' },
      ]
    },
    {
      title: 'Trung tâm Hành động',
      items: [
        { name: 'Quản lý Tiếp cận', path: '/action-center', icon: <Target size={20} />, permission: 'view_dashboard' },
      ]
    },
    {
      title: 'Quản trị Danh mục',
      items: [
        { name: 'Quản lý mô hình', path: '/admin/tree', icon: <Mailbox size={20} />, permission: 'manage_tree' },
        { name: 'Quản lý nhân sự', path: '/admin/staff', icon: <ClipboardCheck size={20} />, permission: 'manage_staff' },
        { name: 'Quản lý phân quyền', path: '/admin/roles', icon: <ShieldCheck size={20} />, permission: 'manage_roles' },
      ]
    },
    {
      title: 'Quản trị Tối cao',
      items: [
        { name: 'Superadmin Center', path: '/admin/super-center', icon: <ShieldCheck size={20} />, permission: 'superadmin_access' },
      ]
    },
    {
      title: 'Hệ thống & Hỗ trợ',
      items: [
        { name: 'Thông tin & Hướng dẫn', path: '/guidelines', icon: <Info size={20} />, permission: null },
      ]
    }
  ];

  const hasPermission = (permission) => {
    if (!permission) return true;
    if (permission === 'superadmin_access') {
      return user?.role?.trim?.().toUpperCase() === 'SUPERADMIN' || user?.role === 'SUPERADMIN';
    }
    return userPermissions.includes(permission);
  };


  return (
    <>
      {/* Backdrop for Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed md:relative inset-y-0 left-0 ${isCollapsed ? 'md:w-20' : 'md:w-64'} w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-50 transform transition-all duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className={`p-6 border-b border-white/5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-4 relative`}>
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="flex-shrink-0">
              <img 
                src={vnpostLogo} 
                alt="VNPost" 
                className="w-10 h-auto brightness-0 invert opacity-80" 
              />
            </div>
            {!isCollapsed && (
              <div className="transition-opacity duration-300">
                <h1 className="font-extrabold text-sm tracking-tight text-white uppercase opacity-90">
                  Portal <span className="text-vnpost-orange">CRM 3.0</span>
                </h1>
                <p className="text-[10px] font-bold text-blue-300 opacity-60 uppercase tracking-widest mt-0.5">
                  Bưu điện TP Huế
                </p>
              </div>
            )}
          </div>
          
          {/* Collapse Toggle Button - Desktop */}
          <button 
            onClick={onToggleCollapse}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-vnpost-orange text-[#003E7E] rounded-full items-center justify-center shadow-lg hover:scale-110 transition-transform z-50"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Close Button on Mobile */}
          <button onClick={onClose} className="md:hidden text-white/60 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-8 overflow-y-auto overflow-x-hidden">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter(item => hasPermission(item.permission));
            if (visibleItems.length === 0) return null;

            return (
              <div key={groupIdx} className="space-y-2">
                {!isCollapsed && (
                  <p className="text-[10px] font-bold text-blue-300/50 uppercase tracking-[0.2em] px-4 mb-2">
                    {group.title}
                  </p>
                )}
                {visibleItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-4 rounded-2xl transition-all duration-200 group relative ${
                      isRouteActive(item.path)
                        ? 'bg-vnpost-orange text-[#003E7E] font-bold shadow-xl shadow-orange-500/30'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex-shrink-0">{item.icon}</div>
                    {!isCollapsed && <span className="ml-4 whitespace-nowrap text-[14px] font-bold tracking-tight transition-opacity duration-300">{item.name}</span>}
                    
                    {/* Tooltip when collapsed */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-[100] shadow-2xl border border-white/10 translate-x-[-10px] group-hover:translate-x-0">
                        {item.name}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

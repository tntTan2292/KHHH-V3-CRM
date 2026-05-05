import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

// Lazy Loading các trang để tối ưu bundle size ban đầu
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const PotentialCustomers = lazy(() => import('./pages/PotentialCustomers_V3'));
const ServiceMix = lazy(() => import('./pages/ServiceMix'));
const ActionCenter = lazy(() => import('./pages/ActionCenter'));
const TreeManagement = lazy(() => import('./pages/admin/TreeManagement'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const RoleManagement = lazy(() => import('./pages/admin/RoleManagement'));
const SuperadminCenter = lazy(() => import('./pages/admin/SuperadminCenter'));
const Login = lazy(() => import('./pages/Login'));
const Guidelines = lazy(() => import('./pages/Guidelines'));
const MovementReport = lazy(() => import('./pages/MovementReport'));
const LeadPipeline = lazy(() => import('./pages/LeadPipeline'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));

// Loading Screen Component
const PageLoading = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50">
    <div className="w-16 h-16 relative">
      <div className="absolute inset-0 border-4 border-vnpost-blue/10 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-vnpost-orange border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div className="mt-6 flex flex-col items-center gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-vnpost-blue/40">Loading Intelligence</span>
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 bg-vnpost-orange rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-1.5 bg-vnpost-orange rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-1.5 h-1.5 bg-vnpost-orange rounded-full animate-bounce"></div>
      </div>
    </div>
  </div>
);

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-vnpost-bg">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-gray-50/30 flex flex-col">
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/potential" element={<PotentialCustomers />} />
              <Route path="/potential/pipeline" element={<LeadPipeline />} />
              <Route path="/analytics" element={<ServiceMix />} />
              
              {/* Admin Routes */}
              <Route path="/admin/tree" element={<TreeManagement />} />
              <Route path="/admin/staff" element={<StaffManagement />} />
              <Route path="/admin/roles" element={<RoleManagement />} />
              <Route path="/admin/super-center" element={<SuperadminCenter />} />
              
              <Route path="/action-center" element={<ActionCenter />} />
              <Route path="/guidelines" element={<Guidelines />} />
              <Route path="/reports/movement" element={<MovementReport />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route 
              path="/*" 
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Suspense>
        <ToastContainer position="bottom-right" autoClose={3000} theme="colored" />
      </Router>
    </AuthProvider>
  );
}

export default App;

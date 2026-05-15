import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import api from '../utils/api';
import { toast } from 'react-toastify';

const ELITE_MESSAGES = [
  "Dữ liệu là mỏ vàng, hãy khai thác một cách thông minh.",
  "Mọi quyết định đúng đắn đều bắt đầu từ dữ liệu sạch.",
  "CRM 3.0: Tầm nhìn mới, sức mạnh mới cho VNPost.",
  "Đoàn kết - Kỷ cương - Sáng tạo - Hiệu quả.",
  "Chuyển đổi số là chìa khóa của tương lai."
];

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayName, setDisplayName] = useState(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    // Rotate quotes
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % ELITE_MESSAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch name when username changes
  useEffect(() => {
    const fetchName = async () => {
      if (username.length >= 4) {
        try {
          const res = await api.get(`/api/auth/name/${username}`);
          if (res.data.name) {
            setDisplayName(res.data.name);
          } else {
            setDisplayName(null);
          }
        } catch (e) {
          setDisplayName(null);
        }
      } else {
        setDisplayName(null);
      }
    };

    const timeoutId = setTimeout(fetchName, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const result = await login(username.trim(), password);
    
    if (result.success) {
      toast.success("Chào mừng trở lại!");
      if (result.must_change_password) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } else {
      toast.error(result.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-900 relative overflow-hidden">
      {/* Background with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 scale-105"
        style={{ backgroundImage: 'url("/vnpost_premium_bg_1777267357632.png")' }}
      ></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-vnpost-blue/40 to-black/80"></div>

      {/* Decorative Circles */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-vnpost-blue/10 blur-[100px] z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-vnpost-yellow/5 blur-[100px] z-0"></div>

      <div className="relative z-10 w-full max-w-[380px] px-6">
        {/* Logo & Brand */}
        <div className="text-center mb-6 animate-fade-in-down">
          <div className="inline-flex items-center justify-center p-2.5 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 mb-3 shadow-2xl">
            <Shield className="text-vnpost-yellow" size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1">
            CRM <span className="text-vnpost-yellow italic">3.0</span>
          </h1>
          <p className="text-gray-400 font-medium tracking-widest uppercase text-[10px]">Intelligence Hub • Elite Protocol</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/10 p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-[11px] font-bold uppercase tracking-wider mb-1.5 ml-1">Mã nhân sự / Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="text-gray-500 group-focus-within:text-vnpost-yellow transition-colors" size={16} />
                </div>
                <input
                  type="text"
                  required
                  className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-vnpost-yellow/50 focus:border-vnpost-yellow/50 transition-all text-sm"
                  placeholder="Ví dụ: 00109101"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              {displayName && (
                <div className="mt-2.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl animate-bounce-in backdrop-blur-md overflow-hidden">
                  <p className="text-white text-[10px] font-black flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="w-1.5 h-1.5 rounded-full bg-vnpost-yellow animate-pulse shadow-[0_0_8px_rgba(255,185,0,0.8)] shrink-0"></span>
                    Chào mừng, {displayName}!
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-300 text-[11px] font-bold uppercase tracking-wider mb-1.5 ml-1">Mật khẩu</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="text-gray-500 group-focus-within:text-vnpost-yellow transition-colors" size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-vnpost-yellow/50 focus:border-vnpost-yellow/50 transition-all text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-600 bg-black/30 text-vnpost-yellow focus:ring-vnpost-yellow/50" />
                <span className="text-[10px] text-gray-400 group-hover:text-gray-200 transition-colors">Ghi nhớ đăng nhập</span>
              </label>
              <a href="#" className="text-[10px] text-vnpost-yellow hover:underline">Quên mật khẩu?</a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-vnpost-yellow to-yellow-600 text-vnpost-blue font-black py-3 rounded-xl shadow-[0_8px_15px_-5px_rgba(255,185,0,0.3)] hover:shadow-[0_12px_20px_-5px_rgba(255,185,0,0.5)] hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:scale-100 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> ĐANG XÁC THỰC...
                </>
              ) : (
                <>
                  ĐĂNG NHẬP HỆ THỐNG <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quote Section */}
          <div className="mt-8 pt-4 border-t border-white/5 text-center">
            <p className="text-gray-500 text-[10px] italic transition-all duration-1000 leading-relaxed px-2">
              "{ELITE_MESSAGES[quoteIndex]}"
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-gray-600 text-xs uppercase tracking-widest">
          © 2026 VNPost Hue • Antigravity Force
        </p>
      </div>

      <style>{`
        @keyframes fade-in-down {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes bounce-in {
          0% { opacity: 0; transform: scale(0.95); }
          50% { transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.8s ease-out; }
        .animate-fade-in { animation: fade-in 1s ease-out; }
        .animate-bounce-in { animation: bounce-in 0.4s ease-out; }
      `}</style>
    </div>
  );
};

export default Login;

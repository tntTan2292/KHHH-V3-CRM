import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { Lock, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

const ChangePassword = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Trim values to avoid whitespace issues
    const trimmedOld = oldPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmedNew !== trimmedConfirm) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (trimmedNew.length < 8) {
        toast.error('Mật khẩu phải có ít nhất 8 ký tự');
        return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/auth/change-password', {
        old_password: trimmedOld,
        new_password: trimmedNew
      });
      toast.success('Đổi mật khẩu thành công! Hãy đăng nhập lại bằng mật khẩu mới.');
      // Logout and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Lỗi khi đổi mật khẩu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-vnpost-blue/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-vnpost-orange/10 blur-[120px]"></div>

        <div className="w-full max-w-md bg-white/10 backdrop-blur-3xl rounded-3xl border border-white/10 p-8 shadow-2xl relative z-10 animate-fade-in">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center p-3 bg-vnpost-orange/20 rounded-2xl mb-4">
                    <ShieldCheck className="text-vnpost-orange" size={32} />
                </div>
                <h1 className="text-2xl font-black text-white uppercase tracking-tight">An toàn tài khoản</h1>
                <p className="text-gray-400 text-sm mt-2 font-medium">Bạn cần đổi mật khẩu để tiếp tục sử dụng hệ thống</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label htmlFor="old_password" size={18} className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mật khẩu hiện tại</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="password"
                            id="old_password"
                            name="old_password"
                            autoComplete="current-password"
                            required
                            className="w-full bg-black/30 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white focus:ring-2 focus:ring-vnpost-orange/50 outline-none transition-all"
                            placeholder="Nhập mật khẩu cũ..."
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="new_password" size={18} className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mật khẩu mới (Chuẩn an toàn)</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="password"
                            id="new_password"
                            name="new_password"
                            autoComplete="new-password"
                            required
                            className="w-full bg-black/30 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white focus:ring-2 focus:ring-vnpost-orange/50 outline-none transition-all"
                            placeholder="Ít nhất 8 ký tự..."
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="confirm_password" size={18} className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Xác nhận mật khẩu mới</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="password"
                            id="confirm_password"
                            name="confirm_password"
                            autoComplete="new-password"
                            required
                            className="w-full bg-black/30 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white focus:ring-2 focus:ring-vnpost-orange/50 outline-none transition-all"
                            placeholder="Nhập lại mật khẩu mới..."
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-gradient-to-r from-vnpost-orange to-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs mt-4"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <>Cập nhật mật khẩu <ArrowRight size={18} /></>}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5">
                <ul className="text-[10px] text-gray-500 space-y-2 font-medium">
                    <li className="flex items-center gap-2 italic">• Tối thiểu 8 ký tự</li>
                    <li className="flex items-center gap-2 italic">• Nên bao gồm Chữ hoa, Chữ thường và Số</li>
                    <li className="flex items-center gap-2 italic">• Không nên trùng với mã nhân sự</li>
                </ul>
            </div>
        </div>
    </div>
  );
};

export default ChangePassword;

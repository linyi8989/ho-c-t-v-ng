import React, { useState } from 'react';
import { 
  Mail, Lock, User, Phone, CheckCircle, ArrowRight, BookOpen, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../lib/authErrors';

interface RegisterProps {
  onNavigateToLogin: () => void;
  onNavigateToHome: () => void;
}

export default function Register({ onNavigateToLogin, onNavigateToHome }: RegisterProps) {
  const { registerWithEmail } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !confirmPassword) {
      setError('Vui lòng điền đầy đủ tất cả thông tin bắt buộc.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải chứa ít nhất 6 ký tự.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerWithEmail(email.trim(), password, name.trim(), phone.trim() || undefined);
      onNavigateToHome();
    } catch (err: any) {
      console.error(err);
      setError(getAuthErrorMessage(err, 'Đăng ký tài khoản thất bại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 relative overflow-hidden" id="register-screen">
      {/* Decorative colored glow bubbles */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-5 relative z-10">
        
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl shadow-lg flex items-center justify-center mx-auto">
            <BookOpen size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-4">ĐĂNG KÝ TÀI KHOẢN</h2>
          <p className="text-xs text-gray-400 font-medium">Tạo tài khoản mới hoàn toàn miễn phí tại V-Homework</p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-semibold flex items-start space-x-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-400">Họ và tên *</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Nguyễn Văn An"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3.5 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-400">Địa chỉ Email *</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="an.nguyen@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3.5 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-400">Số điện thoại (Tùy chọn)</label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                placeholder="0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3.5 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-400">Mật khẩu *</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3.5 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-gray-400">Nhập lại *</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3.5 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>
              {isSubmitting 
                ? 'ĐANG XỬ LÝ...' 
                : 'ĐĂNG KÝ TÀI KHOẢN'}
            </span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-gray-50">
          <p className="text-xs text-gray-500 font-semibold">
            Đã có tài khoản?{' '}
            <button
              onClick={onNavigateToLogin}
              className="text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              Đăng nhập ngay
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

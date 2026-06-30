import React, { useState } from 'react';
import { 
  Mail, Lock, Chrome, Phone, CheckCircle, ArrowRight, BookOpen, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../lib/authErrors';

interface LoginProps {
  onNavigateToRegister: () => void;
  onNavigateToHome: () => void;
}

export default function Login({ onNavigateToRegister, onNavigateToHome }: LoginProps) {
  const { loginWithEmail, loginWithGoogle } = useAuth();
  
  // Tab/Mode
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');

  // Email form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone form
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phonePassword, setPhonePassword] = useState('');

  // Status/Error
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await loginWithEmail(email, password);
      onNavigateToHome();
    } catch (err: any) {
      console.error(err);
      setError(getAuthErrorMessage(err, 'Đăng nhập thất bại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      onNavigateToHome();
    } catch (err: any) {
      console.error(err);
      setError(getAuthErrorMessage(err, 'Đăng nhập Google thất bại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !phonePassword) {
      setError('Vui lòng nhập đầy đủ số điện thoại và mật khẩu.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      // 1. Get email linked to this phone number
      const response = await fetch('/api/auth/email-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Số điện thoại chưa được đăng ký.');
      }

      const { email } = await response.json();
      
      // 2. Log in with the email and password
      await loginWithEmail(email, phonePassword);
      onNavigateToHome();
    } catch (err: any) {
      console.error(err);
      setError(getAuthErrorMessage(err, 'Số điện thoại hoặc mật khẩu không chính xác.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 relative overflow-hidden" id="login-screen">
      {/* Decorative colored glow bubbles */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-6 relative z-10">
        
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl shadow-lg flex items-center justify-center mx-auto">
            <BookOpen size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-4">ĐĂNG NHẬP HỆ THỐNG</h2>
          <p className="text-xs text-gray-400 font-medium">Đăng nhập để vào khu học tập và chơi game cùng V-Homework</p>
        </div>

        {/* Auth Method Selector */}
        <div className="grid grid-cols-2 p-1 bg-gray-50 rounded-2xl border border-gray-100">
          <button
            onClick={() => {
              setLoginMethod('email');
              setError('');
            }}
            className={`py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              loginMethod === 'email' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Email & Mật khẩu
          </button>
          <button
            onClick={() => {
              setLoginMethod('phone');
              setError('');
            }}
            className={`py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              loginMethod === 'phone' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Số điện thoại
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-semibold flex items-start space-x-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* METHOD 1: EMAIL */}
        {loginMethod === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-400">Địa chỉ Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-400">Mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>{isSubmitting ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* METHOD 2: PHONE */}
        {loginMethod === 'phone' && (
          <form onSubmit={handlePhoneLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-400">Số điện thoại</label>
              <div className="relative">
                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  placeholder="0912345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-gray-400">Mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={phonePassword}
                  onChange={(e) => setPhonePassword(e.target.value)}
                  className="w-full p-4 pl-12 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-700 text-sm transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>{isSubmitting ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* SOCIAL AUTH DIVIDER */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="flex-shrink mx-4 text-gray-400 font-extrabold text-[10px] uppercase">Hoặc đăng nhập bằng</span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        {/* Google Authentication */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="w-full py-3.5 border-2 border-gray-100 hover:border-indigo-400 hover:bg-indigo-50/10 text-gray-600 font-bold text-sm rounded-2xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Chrome size={18} className="text-red-500" />
          <span>Tiếp tục với Google / Gmail</span>
        </button>

        {/* Navigation back / redirect */}
        <div className="text-center pt-2">
          <p className="text-xs text-gray-500 font-semibold">
            Chưa có tài khoản?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              Đăng ký ngay tại đây
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

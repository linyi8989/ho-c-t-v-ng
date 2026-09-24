import React from 'react';
import {
  Award,
  BookOpen,
  Edit3,
  FileText,
  Layers,
  Plus,
  Shield,
  Users,
} from 'lucide-react';
import type { GrammarQuestionType } from '../../types';

export type AdminTab =
  | 'dashboard'
  | 'vocab-sets'
  | 'editor'
  | 'grammar-sets'
  | 'grammar-editor'
  | 'listening-library'
  | 'writing-library'
  | 'classes'
  | 'assignments'
  | 'results'
  | 'users'
  | 'audit-logs';

interface AdminShellUser {
  name?: string;
  email?: string;
  role?: string;
}

interface AdminShellProps {
  activeTab: AdminTab;
  user: AdminShellUser | null;
  grammarQuestionType: GrammarQuestionType;
  onSelectTab: (tab: AdminTab) => void;
  onOpenNewGrammar: (questionType: GrammarQuestionType) => void;
  overlays?: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminShell({
  activeTab,
  user,
  grammarQuestionType,
  onSelectTab,
  onOpenNewGrammar,
  overlays,
  children,
}: AdminShellProps) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50/50" id="admin-dashboard-container">
      {overlays}

      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-100 flex flex-col shrink-0" id="admin-sidebar">
        <div className="p-6 border-b border-gray-50 flex items-center space-x-3">
          <span className="p-2 bg-indigo-600 text-white rounded-2xl shadow-md shrink-0">
            <BookOpen size={20} />
          </span>
          <div>
            <h1 className="font-black text-gray-800 tracking-tight text-base leading-snug">Cô Diệu Tiếng Anh</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {user?.role === 'super_admin' ? 'Hệ thống Admin' : 'Dashboard Giáo Viên'}
            </p>
          </div>
        </div>

        <nav className="p-4 flex-1 space-y-1">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-dashboard"
          >
            <Layers size={18} />
            <span>Tổng quan</span>
          </button>

          <button
            onClick={() => onSelectTab('vocab-sets')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'vocab-sets' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-sets"
          >
            <BookOpen size={18} />
            <span>Kho từ vựng</span>
          </button>

          <button
            onClick={() => onSelectTab('editor')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'editor' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-editor"
          >
            <Plus size={18} />
            <span>Soạn từ vựng mới</span>
          </button>

          <button
            onClick={() => onSelectTab('grammar-sets')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'grammar-sets' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-grammar-sets"
          >
            <FileText size={18} />
            <span>Kho bài ngữ pháp</span>
          </button>

          <button
            onClick={() => onOpenNewGrammar('multiple_choice')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'grammar-editor' && grammarQuestionType === 'multiple_choice'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-grammar-editor"
          >
            <Plus size={18} />
            <span>Soạn bài ngữ pháp</span>
          </button>

          <button
            onClick={() => onOpenNewGrammar('rewrite')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'grammar-editor' && grammarQuestionType === 'rewrite'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-grammar-rewrite-editor"
          >
            <Edit3 size={18} />
            <span>Soạn bài tự luận</span>
          </button>

          <button
            onClick={() => onSelectTab('listening-library')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'listening-library' ? 'bg-sky-50 text-sky-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-listening-library"
          >
            <BookOpen size={18} />
            <span>Kho đề luyện thi</span>
          </button>

          <button
            onClick={() => onSelectTab('writing-library')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'writing-library' ? 'bg-violet-50 text-violet-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-writing-library"
          >
            <Edit3 size={18} />
            <span>Kho đề Writing</span>
          </button>

          <button
            onClick={() => onSelectTab('classes')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'classes' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-classes"
          >
            <Users size={18} />
            <span>Quản lý Lớp học</span>
          </button>

          <button
            onClick={() => onSelectTab('results')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'results' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-results"
          >
            <Award size={18} />
            <span>Bảng vàng học sinh</span>
          </button>

          <button
            onClick={() => onSelectTab('users')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-users"
          >
            <Shield size={18} className="text-amber-500" />
            <span>{user?.role === 'super_admin' ? 'Quản lý Tài khoản' : 'Quản lý Học sinh'}</span>
          </button>

          {user?.role === 'super_admin' && (
            <button
              onClick={() => onSelectTab('audit-logs')}
              className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'audit-logs' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
              id="tab-audit-logs"
            >
              <FileText size={18} className="text-amber-500" />
              <span>Nhật ký hệ thống</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold shrink-0">
              {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-800 truncate">{user?.name || 'Hệ thống Admin'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email || 'Chưa có email'}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 max-w-7xl overflow-x-hidden" id="admin-main-panel">
        {children}
      </main>
    </div>
  );
}

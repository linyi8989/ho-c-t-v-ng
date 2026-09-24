import { Edit3, Filter, Lock, Search, Unlock } from 'lucide-react';
import type { User } from '../../../types';
import LibraryPagination from '../LibraryPagination';

export interface AccountManagementController {
  user: User | null;
  filteredUsers: any[];
  usersSearch: string;
  usersRoleFilter: string;
  usersStatusFilter: string;
  usersPage: number;
  usersPageSize: number;
  usersTotalItems: number;
  usersTotalPages: number;
  setUsersSearch: (value: string) => void;
  setUsersRoleFilter: (value: string) => void;
  setUsersStatusFilter: (value: string) => void;
  setUsersPage: (value: number) => void;
  setUsersPageSize: (value: number) => void;
  setEditingAccount: (value: any) => void;
  setEditingAccountName: (value: string) => void;
  handleUpdateUserRole: (userId: string, role: string) => void;
  handleToggleAccountStatus: (account: any) => void;
}

export default function AccountManagementPanel({
  controller,
}: {
  controller: AccountManagementController;
}) {
  const {
    user,
    filteredUsers,
    usersSearch,
    usersRoleFilter,
    usersStatusFilter,
    usersPage,
    usersPageSize,
    usersTotalItems,
    usersTotalPages,
    setUsersSearch,
    setUsersRoleFilter,
    setUsersStatusFilter,
    setUsersPage,
    setUsersPageSize,
    setEditingAccount,
    setEditingAccountName,
    handleUpdateUserRole,
    handleToggleAccountStatus,
  } = controller;

  return (
          <div className="space-y-6 animate-fade-in" id="users-tab-content">
            <div>
              <h2 className="text-2xl font-black text-gray-800">
                {user?.role === 'super_admin' ? 'Quản lý Tài khoản người dùng' : 'Quản lý Học sinh'}
              </h2>
              <p className="text-gray-400 text-sm">
                {user?.role === 'super_admin'
                  ? 'Quản lý chung tài khoản đăng ký và hồ sơ học sinh khách. Hồ sơ khách luôn có vai trò Học sinh.'
                  : 'Đổi tên hiển thị cho học sinh có hoạt động trong các lớp bạn quản lý.'}
              </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm theo tên, liên hệ hoặc ID..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="w-full bg-gray-50 border-0 rounded-2xl py-2.5 pl-11 pr-4 text-sm font-semibold text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex items-center space-x-2 bg-gray-50 rounded-2xl px-3 border border-gray-50">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={usersRoleFilter}
                    onChange={(e) => setUsersRoleFilter(e.target.value)}
                    className="bg-transparent border-0 text-xs font-bold text-gray-500 focus:ring-0 outline-none cursor-pointer py-2 pr-8"
                  >
                    <option value="">Tất cả vai trò</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="teacher">Giáo viên (Teacher)</option>
                    <option value="student">Học sinh (Student)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 bg-gray-50 rounded-2xl px-3 border border-gray-50">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={usersStatusFilter}
                    onChange={(e) => setUsersStatusFilter(e.target.value)}
                    className="bg-transparent border-0 text-xs font-bold text-gray-500 focus:ring-0 outline-none cursor-pointer py-2 pr-8"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="blocked">Đã khóa</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4">STT</th>
                      <th className="p-4">Tên hiển thị</th>
                      <th className="p-4">Loại hồ sơ</th>
                      <th className="p-4">Liên hệ (Email / SĐT)</th>
                      <th className="p-4">ID tài khoản</th>
                      <th className="p-4 text-center">Vai trò</th>
                      <th className="p-4 text-center">Trạng thái</th>
                      <th className="p-4">Hoạt động cuối</th>
                      <th className="p-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Không tìm thấy tài khoản người dùng nào khớp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u, index) => (
                        <tr key={u.id} className="hover:bg-gray-50/30 text-sm font-semibold text-gray-700">
                          <td className="p-4 text-gray-400 text-xs font-bold">{(usersPage - 1) * usersPageSize + index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                                {(u.name || 'U').charAt(0).toUpperCase()}
                              </span>
                              <strong className="text-gray-800 font-bold">{u.name || 'Chưa đặt tên'}</strong>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${u.accountType === 'guest' ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'}`}>
                              {u.accountType === 'guest' ? 'Học sinh khách' : 'Đã đăng ký'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-600 font-medium">{u.email || (u.accountType === 'guest' ? 'Không yêu cầu liên hệ' : 'Không có email')}</span>
                              {u.phone && <span className="text-[10px] text-gray-400 font-bold">{u.phone}</span>}
                            </div>
                          </td>
                          <td className="p-4 text-xs font-mono text-gray-400 max-w-[120px] truncate" title={u.id}>
                            {u.id}
                          </td>
                          <td className="p-4 text-center">
                            {u.accountType === 'guest' ? (
                              <span className="text-xs font-bold text-gray-600">Học sinh</span>
                            ) : (
                              <select
                                value={u.role}
                                disabled={u.id === user?.id}
                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                className="bg-gray-50 text-xs font-bold text-gray-700 border-0 rounded-xl py-1.5 px-3 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                              >
                                <option value="student">Học sinh (Student)</option>
                                <option value="teacher">Giáo viên (Teacher)</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              u.status === 'blocked' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {u.status === 'blocked' ? 'Đã khóa' : 'Hoạt động'}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                            {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('vi-VN') : 'Chưa ghi nhận'}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => { setEditingAccount(u); setEditingAccountName(u.name || ''); }}
                                className="rounded-xl border border-indigo-100 bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100"
                                title="Sửa tên hiển thị"
                              >
                                <Edit3 size={14} />
                              </button>
                            {user?.role === 'super_admin' && u.id !== user?.id ? (
                              <button
                                onClick={() => handleToggleAccountStatus(u)}
                                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                  u.status === 'blocked'
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                                    : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'
                                }`}
                                title={u.status === 'blocked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                              >
                                {u.status === 'blocked' ? <Unlock size={14} /> : <Lock size={14} />}
                              </button>
                            ) : user?.role === 'super_admin' ? (
                              <span className="text-xs text-gray-400 italic">Bản thân</span>
                            ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <LibraryPagination
              currentPage={Math.min(usersPage, usersTotalPages)}
              totalPages={usersTotalPages}
              pageSize={usersPageSize}
              totalItems={usersTotalItems}
              onPageChange={setUsersPage}
              onPageSizeChange={(size) => { setUsersPageSize(size); setUsersPage(1); }}
            />
          </div>
  );
}

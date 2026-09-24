import type React from 'react';
import { Trash2, Users } from 'lucide-react';
import type { Class, ClassMember } from '../../../types';
import LibraryPagination from '../LibraryPagination';

export interface ClassManagementController {
  classes: Class[];
  classMembers: ClassMember[];
  newClassName: string;
  newMemberNames: Record<string, string>;
  classPage: number;
  classPageSize: number;
  classTotalItems: number;
  classTotalPages: number;
  setNewClassName: (value: string) => void;
  setNewMemberNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setClassPage: (value: number) => void;
  setClassPageSize: (value: number) => void;
  handleCreateClass: (event: React.FormEvent) => void;
  handleAddClassMember: (classId: string, event: React.FormEvent) => void;
  handleDeleteClassMember: (classId: string, memberId: string, studentName: string) => void;
  handleDeleteClass: (id: string, className: string) => void;
}

export default function ClassManagementPanel({
  controller,
}: {
  controller: ClassManagementController;
}) {
  const {
    classes,
    classMembers,
    newClassName,
    newMemberNames,
    classPage,
    classPageSize,
    classTotalItems,
    classTotalPages,
    setNewClassName,
    setNewMemberNames,
    setClassPage,
    setClassPageSize,
    handleCreateClass,
    handleAddClassMember,
    handleDeleteClassMember,
    handleDeleteClass,
  } = controller;

  return (
          <div className="space-y-8 animate-fade-in" id="classes-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Quản lý Lớp học</h2>
                <p className="text-gray-400 text-sm">Quản lý danh sách các lớp học của cô và theo dõi các học sinh đăng ký.</p>
              </div>

              {/* Add New Class Form Box */}
              <form onSubmit={handleCreateClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tên lớp học mới..."
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="p-3 bg-white border border-gray-100 hover:border-indigo-300 rounded-2xl outline-none font-bold text-sm focus:ring-4 focus:ring-indigo-50 transition-all text-gray-800 min-w-[200px]"
                />
                <button
                  type="submit"
                  disabled={!newClassName.trim()}
                  className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all whitespace-nowrap cursor-pointer"
                  id="create-class-btn"
                >
                  Tạo lớp
                </button>
              </form>
            </div>

            {/* Grid list of classes */}
            {classes.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400">
                Cô chưa tạo lớp học nào. Hãy nhập tên lớp để khởi tạo ở trên nhé!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="classes-grid">
                {classes.map((cls) => {
                  const enrolledMembers = classMembers.filter(m => m.classId === cls.id);
                  return (
                    <div key={cls.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4" id={`class-card-${cls.id}`}>
                      <div className="flex justify-between items-start pb-2 border-b border-gray-50">
                        <div>
                          <h3 className="font-extrabold text-gray-800 text-lg">{cls.name}</h3>
                          <span className="text-xs text-gray-400">Mã tham gia lớp: <strong className="font-mono text-indigo-600 font-black text-sm bg-indigo-50 px-2 py-0.5 rounded">{cls.code}</strong></span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleDeleteClass(cls.id, cls.name)}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                            title="Xóa lớp học"
                          >
                            <Trash2 size={16} />
                          </button>
                          <span className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl shadow-xs shrink-0">
                            <Users size={20} />
                          </span>
                        </div>
                      </div>

                      {/* Simple list of student members inside class */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-black uppercase text-gray-400 tracking-wider">Học sinh đăng ký trong lớp ({enrolledMembers.length}):</p>
                        </div>

                        <div className="bg-gray-50/50 rounded-2xl p-4 max-h-[160px] overflow-y-auto space-y-2 border border-gray-100">
                          {enrolledMembers.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Chưa có học sinh nào được thêm vào lớp này.</p>
                          ) : (
                            enrolledMembers.map((member, idx) => (
                              <div key={member.id} className="flex items-center justify-between text-sm text-gray-700 font-semibold bg-white p-2 rounded-xl border border-gray-100">
                                <div className="flex items-center space-x-2">
                                  <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                                  <span className="text-gray-800">{member.studentName}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteClassMember(cls.id, member.id, member.studentName)}
                                  className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                  title="Xóa học sinh khỏi lớp"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Add student inline form */}
                      <form onSubmit={(e) => handleAddClassMember(cls.id, e)} className="flex gap-2 pt-3 border-t border-white/5">
                        <input
                          type="text"
                          placeholder="Họ và tên học sinh..."
                          value={newMemberNames[cls.id] || ''}
                          onChange={(e) => setNewMemberNames(prev => ({ ...prev, [cls.id]: e.target.value }))}
                          className="flex-1 p-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500"
                        />
                        <button
                          type="submit"
                          disabled={!(newMemberNames[cls.id] || '').trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:translate-y-0 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
                        >
                          Thêm học sinh
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
            <LibraryPagination
              currentPage={Math.min(classPage, classTotalPages)}
              totalPages={classTotalPages}
              pageSize={classPageSize}
              totalItems={classTotalItems}
              onPageChange={setClassPage}
              onPageSizeChange={(size) => { setClassPageSize(size); setClassPage(1); }}
            />
          </div>
  );
}

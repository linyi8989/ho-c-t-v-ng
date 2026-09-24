import type React from 'react';
import { Calendar, Copy, Play, Send, Trash2 } from 'lucide-react';
import type { Assignment, Class, VocabSet } from '../../../types';
import { GAMES_LIST } from '../../../lib/game-engine/gameList';
import LibraryPagination from '../LibraryPagination';

type AssignmentResourceType = 'vocabulary' | 'listening' | 'mover_reading_writing' | 'exam';

export interface AssignmentManagementController {
  classes: Class[];
  assignments: Assignment[];
  vocabSets: VocabSet[];
  listeningSets: any[];
  moverReadingWritingSets: any[];
  examSets: any[];
  assignClassId: string;
  assignResourceType: AssignmentResourceType;
  assignSetId: string;
  assignGameId: string;
  assignDueDate: string;
  assignTitle: string;
  assignmentPage: number;
  assignmentPageSize: number;
  assignmentTotalItems: number;
  assignmentTotalPages: number;
  setAssignClassId: (value: string) => void;
  setAssignResourceType: (value: AssignmentResourceType) => void;
  setAssignSetId: (value: string) => void;
  setAssignGameId: (value: string) => void;
  setAssignDueDate: (value: string) => void;
  setAssignTitle: (value: string) => void;
  setAssignmentPage: (value: number) => void;
  setAssignmentPageSize: (value: number) => void;
  handleCreateAssignment: (event: React.FormEvent) => void;
  handleDeleteAssignment: (id: string) => void;
  handleViewVocabularyAssignment: (assignment: Assignment, set: VocabSet) => Promise<void>;
  getSetVisibility: (set: VocabSet) => string;
  getAssignmentRecordLink: (assignment: Assignment) => string;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

export default function AssignmentManagementPanel({
  controller,
}: {
  controller: AssignmentManagementController;
}) {
  const {
    classes,
    assignments,
    vocabSets,
    listeningSets,
    moverReadingWritingSets,
    examSets,
    assignClassId,
    assignResourceType,
    assignSetId,
    assignGameId,
    assignDueDate,
    assignTitle,
    assignmentPage,
    assignmentPageSize,
    assignmentTotalItems,
    assignmentTotalPages,
    setAssignClassId,
    setAssignResourceType,
    setAssignSetId,
    setAssignGameId,
    setAssignDueDate,
    setAssignTitle,
    setAssignmentPage,
    setAssignmentPageSize,
    handleCreateAssignment,
    handleDeleteAssignment,
    handleViewVocabularyAssignment,
    getSetVisibility,
    getAssignmentRecordLink,
    showNotification,
  } = controller;

  return (
          <div className="space-y-8 animate-fade-in" id="assignments-tab-content">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Column 1: New Assignment form scheduler */}
              <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5" id="assignment-creation-box">
                <div className="flex items-center space-x-2 pb-3 border-b border-gray-50">
                  <Send className="text-indigo-600" size={18} />
                  <h3 className="font-extrabold text-gray-800 text-base">Giao bài tập mới</h3>
                </div>

                <form onSubmit={handleCreateAssignment} className="space-y-4">

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Chọn lớp học *</label>
                    <select
                      value={assignClassId}
                      onChange={(e) => setAssignClassId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      <option value="">-- Chọn lớp học --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Loại nội dung *</label>
                    <select
                      value={assignResourceType}
                      onChange={(e) => {
                        setAssignResourceType(e.target.value as 'vocabulary' | 'listening' | 'mover_reading_writing' | 'exam');
                        setAssignSetId('');
                      }}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                    >
                      <option value="vocabulary">Từ vựng</option>
                      <option value="listening">Bộ đề nghe 5 Part</option>
                      <option value="mover_reading_writing">Movers Reading &amp; Writing 6 Part</option>
                      <option value="exam">Cambridge / IELTS / Kho đề Writing</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">
                      {assignResourceType === 'listening'
                        ? 'Chọn bộ đề nghe *'
                        : assignResourceType === 'mover_reading_writing'
                          ? 'Chọn bộ đề Reading & Writing *'
                          : assignResourceType === 'exam'
                            ? 'Chọn bộ đề Cambridge / IELTS / Writing *'
                          : 'Chọn bộ từ vựng *'}
                    </label>
                    <select
                      value={assignSetId}
                      onChange={(e) => setAssignSetId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      <option value="">-- Chọn nội dung --</option>
                      {assignResourceType === 'listening'
                        ? listeningSets.filter(s => s.status === 'published' && s.visibility !== 'draft').map(s => <option key={s.id} value={s.id}>{s.title}</option>)
                        : assignResourceType === 'mover_reading_writing'
                          ? moverReadingWritingSets.filter(s => s.status === 'published' && s.visibility !== 'draft').map(s => <option key={s.id} value={s.id}>{s.title}</option>)
                        : assignResourceType === 'exam'
                          ? examSets.filter(s => s.status === 'published' && s.visibility !== 'draft').map(s => <option key={s.id} value={s.id}>{s.moduleId === 'writing' ? 'Writing' : s.level || s.moduleId} · {s.title}</option>)
                        : vocabSets.filter(s => getSetVisibility(s) !== 'draft').map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>

                  {assignResourceType === 'vocabulary' && <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Thể loại game yêu cầu *</label>
                    <select
                      value={assignGameId}
                      onChange={(e) => setAssignGameId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      {GAMES_LIST.filter(g => !g.hidden).map(g => <option key={g.gameId} value={g.gameId}>{g.title} ({g.category})</option>)}
                    </select>
                  </div>}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Hạn nộp bài tập *</label>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Tiêu đề giao bài tập (Tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Luyện flashcard trước buổi học"
                      value={assignTitle}
                      onChange={(e) => setAssignTitle(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-semibold text-gray-600 text-sm focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer mt-4 text-sm"
                    id="schedule-assignment-btn"
                  >
                    Xác nhận giao bài
                  </button>

                </form>
              </div>

              {/* Column 2: Scheduled Assignments grid list */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4" id="assignments-scheduled-grid">
                <div className="pb-3 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Bài tập đã giao ({assignmentTotalItems})</h3>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {assignments.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm font-medium">Cô chưa giao bài tập nào cho học sinh.</div>
                  ) : (
                    assignments.map((assign) => {
                      const assignmentLink = getAssignmentRecordLink(assign);
                      return (
                      <div key={assign.id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-3xl flex justify-between items-center" id={`assignment-strip-${assign.id}`}>
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-gray-800 text-base leading-tight">{assign.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-semibold">
                            <span className="text-indigo-600">{assign.className}</span>
                            <span>•</span>
                            <span className="font-mono">{assign.resourceTitle || assign.listeningSetTitle || assign.vocabSetTitle}</span>
                            <span>•</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase uppercase">
                              {assign.resourceType === 'listening'
                                ? 'Nghe 5 Part'
                                : assign.resourceType === 'mover_reading_writing'
                                  ? 'Reading & Writing 6 Part'
                                : assign.resourceType === 'exam'
                                  ? `${assign.examModuleId || 'Exam'} · ${assign.examPaperId || ''}`
                                : GAMES_LIST.find(g => g.gameId === assign.gameId)?.title || assign.gameId}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-[10px] text-gray-400 font-semibold pt-1">
                            <Calendar size={12} />
                            <span>Hạn nộp: {assign.dueDate}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <input
                            value={assignmentLink}
                            readOnly
                            className="min-w-0 max-w-[340px] bg-white border border-indigo-100 rounded-xl px-3 py-2 text-[11px] font-semibold text-gray-600"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(assignmentLink);
                              showNotification("Da copy link bai giao.");
                            }}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer border border-indigo-100"
                            title="Copy link bai giao"
                          >
                            <Copy size={14} />
                          </button>
                        </div>

                        <div className="flex space-x-1 shrink-0">
                          <button
                            onClick={() => {
                              if (assign.resourceType === 'listening' || assign.resourceType === 'mover_reading_writing' || assign.resourceType === 'exam') {
                                if (assignmentLink) window.open(assignmentLink, '_blank', 'noopener,noreferrer');
                                return;
                              }
                              const foundSet = vocabSets.find(s => s.id === assign.vocabSetId);
                              if (foundSet) void handleViewVocabularyAssignment(assign, foundSet);
                            }}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer"
                            title="Học thử game này"
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assign.id)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                            title="Thu hồi bài tập"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
                <LibraryPagination
                  currentPage={Math.min(assignmentPage, assignmentTotalPages)}
                  totalPages={assignmentTotalPages}
                  pageSize={assignmentPageSize}
                  totalItems={assignmentTotalItems}
                  onPageChange={setAssignmentPage}
                  onPageSizeChange={(size) => { setAssignmentPageSize(size); setAssignmentPage(1); }}
                />
              </div>

            </div>
          </div>
  );
}

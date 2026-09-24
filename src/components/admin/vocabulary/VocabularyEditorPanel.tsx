import {
  Check,
  Copy,
  Images,
  ListPlus,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Volume2
} from 'lucide-react';
import type { TtsSettings, VocabItem } from '../../../types';
import { VocabImageThumbnail } from '../vocab-images';

type VocabVisibility = 'public' | 'assignment' | 'draft';
type Handler = (...args: any[]) => any;

export interface VocabularyEditorController {
  editingSetId: string | null;
  editorTitle: string;
  editorDescription: string;
  editorSubject: string;
  editorGrade: string;
  editorStatus: VocabVisibility;
  editorTags: string[];
  editorItems: VocabItem[];
  gradeOptions: string[];
  ttsSettings: TtsSettings;
  TTS_VOICE_OPTIONS: Array<{ value: string; label: string }>;
  isPreviewingTts: boolean;
  isBatchGeneratingAudio: boolean;
  isBatchGeneratingImages: boolean;
  vocabImageBatchProgress: { completed: number; total: number } | null;
  busyVocabImageItemId: string | null;
  batchTerms: string;
  batchMeanings: string;
  batchIpas: string;
  batchPartsOfSpeech: string;
  batchExamples: string;
  batchExampleMeanings: string;
  batchVocabularyText: string;
  copiedBulkPrompt: string | null;
  setActiveTab: (tab: 'vocab-sets') => void;
  setEditorTitle: (value: string) => void;
  setEditorDescription: (value: string) => void;
  setEditorSubject: (value: string) => void;
  setEditorGrade: (value: string) => void;
  setEditorStatus: (value: VocabVisibility) => void;
  setEditorTags: (value: string[]) => void;
  setBatchTerms: (value: string) => void;
  setBatchMeanings: (value: string) => void;
  setBatchIpas: (value: string) => void;
  setBatchPartsOfSpeech: (value: string) => void;
  setBatchExamples: (value: string) => void;
  setBatchExampleMeanings: (value: string) => void;
  setBatchVocabularyText: (value: string) => void;
  updateTtsSettings: (patch: Partial<TtsSettings>) => void;
  handleAddItemRow: Handler;
  handleCheckAudioStatusSmart: Handler;
  handleCopyBulkImportPrompt: Handler;
  handleDeleteItemRow: Handler;
  handleGenerateAllAudioBeforeSave: Handler;
  handleGenerateAllBlankIpas: Handler;
  handleGenerateAllVocabImages: Handler;
  handleGenerateIpaForRow: Handler;
  handleGenerateItemAudioBeforeSave: Handler;
  handleOpenImagePicker: Handler;
  handlePasteVocabImage: Handler;
  handlePlayItemAudio: Handler;
  handlePreviewTtsVoice: Handler;
  handleProcessBatchAdd: Handler;
  handleSaveSet: Handler;
  handleTtsProviderChange: Handler;
  handleUpdateItemValue: Handler;
  handleUploadVocabImage: Handler;
  removeVocabImage: Handler;
  speakEnglish: Handler;
}

interface VocabularyEditorPanelProps {
  controller: VocabularyEditorController;
}

export default function VocabularyEditorPanel({ controller }: VocabularyEditorPanelProps) {
  const {
    TTS_VOICE_OPTIONS,
    batchExampleMeanings,
    batchExamples,
    batchIpas,
    batchMeanings,
    batchPartsOfSpeech,
    batchTerms,
    batchVocabularyText,
    busyVocabImageItemId,
    copiedBulkPrompt,
    editingSetId,
    editorDescription,
    editorGrade,
    editorItems,
    editorStatus,
    editorSubject,
    editorTags,
    editorTitle,
    gradeOptions,
    handleAddItemRow,
    handleCheckAudioStatusSmart,
    handleCopyBulkImportPrompt,
    handleDeleteItemRow,
    handleGenerateAllAudioBeforeSave,
    handleGenerateAllBlankIpas,
    handleGenerateAllVocabImages,
    handleGenerateIpaForRow,
    handleGenerateItemAudioBeforeSave,
    handleOpenImagePicker,
    handlePasteVocabImage,
    handlePlayItemAudio,
    handlePreviewTtsVoice,
    handleProcessBatchAdd,
    handleSaveSet,
    handleTtsProviderChange,
    handleUpdateItemValue,
    handleUploadVocabImage,
    isBatchGeneratingAudio,
    isBatchGeneratingImages,
    isPreviewingTts,
    removeVocabImage,
    setActiveTab,
    setBatchExampleMeanings,
    setBatchExamples,
    setBatchIpas,
    setBatchMeanings,
    setBatchPartsOfSpeech,
    setBatchTerms,
    setBatchVocabularyText,
    setEditorDescription,
    setEditorGrade,
    setEditorStatus,
    setEditorSubject,
    setEditorTags,
    setEditorTitle,
    speakEnglish,
    ttsSettings,
    updateTtsSettings,
    vocabImageBatchProgress
  } = controller;

  return (
          <div className="space-y-8 animate-fade-in" id="editor-tab-content">
            
            {/* Editor Top Options */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800">
                  {editingSetId ? "Chỉnh sửa bộ từ vựng" : "Soạn thảo bộ từ vựng mới"}
                </h2>
                <p className="text-gray-400 text-sm">Điền đầy đủ thông tin bên dưới hoặc nhập nhanh nhiều dòng để đưa dữ liệu vào bảng.</p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('vocab-sets')}
                  className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSaveSet}
                  className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-sm shadow-md transition-all cursor-pointer active:scale-95"
                  id="save-vocabset-btn"
                >
                  Lưu bộ từ vựng
                </button>
              </div>
            </div>

            {/* Core Info Details */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6" id="editor-details-form">
              <div className="md:col-span-8 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Tên bộ từ vựng *</label>
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Ví dụ: Ordinal Numbers (Số thứ tự)"
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-bold text-gray-800 text-lg transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Mô tả chi tiết</label>
                  <textarea
                    value={editorDescription}
                    onChange={(e) => setEditorDescription(e.target.value)}
                    placeholder="Mô tả ngắn gọn về bài học từ vựng này..."
                    className="w-full p-4 h-24 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-600 text-sm transition-all resize-none"
                  />
                </div>
              </div>

              <div className="md:col-span-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-400">Khối lớp học</label>
                    <select
                      value={editorGrade}
                      onChange={(e) => setEditorGrade(e.target.value)}
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                    >
                      {gradeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-400">Môn học/Chủ đề</label>
                    <input
                      type="text"
                      value={editorSubject}
                      onChange={(e) => setEditorSubject(e.target.value)}
                      placeholder="Science, Math,..."
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Trạng thái chia sẻ</label>
                  <select
                    value={editorStatus}
                    onChange={(e) => setEditorStatus(e.target.value as any)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                  >
                    <option value="public">Công khai: Hiển thị ở trang chủ, ai cũng có thể học</option>
                    <option value="assignment">Giao bài tập bằng link riêng: Không hiện công khai, chỉ ai có link mới làm được</option>
                    <option value="draft">Bản nháp: Chỉ lưu tạm, học sinh chưa xem được</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Từ khóa/Tags (cách nhau bằng phẩy)</label>
                  <input
                    type="text"
                    value={editorTags.join(', ')}
                    onChange={(e) => setEditorTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                    placeholder="numbers, basic, ordinal"
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm" id="tts-settings-card-v2">
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Volume2 size={18} className="text-indigo-600" />
                      <h3 className="font-extrabold text-gray-800 text-sm">C&#224;i &#273;&#7863;t ph&#225;t &#226;m TTS</h3>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">
                      T&#7841;o audio tr&#432;&#7899;c khi l&#432;u. Khi b&#7845;m L&#432;u b&#7897; t&#7915;, metadata audio s&#7869; &#273;&#432;&#7907;c l&#432;u c&#249;ng t&#7915; v&#7921;ng.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Provider</label>
                    <select
                      value={ttsSettings.provider}
                      onChange={(e) => handleTtsProviderChange(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="ai33">AI33 v3</option>
                      <option value="yupvox">YupVox</option>
                    </select>
                  </div>

                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Voice ID</label>
                    <input
                      type="text"
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value.trim() })}
                      placeholder={ttsSettings.provider === 'yupvox' ? 'EBF147' : 'elevenlabs_wMBr6SfqQVuOqplK01NE'}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-gray-700 text-xs focus:bg-white focus:border-indigo-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Ng&#244;n ng&#7919;</label>
                    <select
                      value={ttsSettings.lang}
                      onChange={(e) => {
                        const lang = e.target.value as TtsSettings['lang'];
                        updateTtsSettings({ lang });
                      }}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="en-US">en-US</option>
                      <option value="en-GB">en-GB</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">T&#7889;c &#273;&#7897;</label>
                    <select
                      value={String(ttsSettings.speed)}
                      onChange={(e) => updateTtsSettings({ speed: Number(e.target.value) })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {[0.8, 0.9, 1, 1.1, 1.2].map(speed => (
                        <option key={speed} value={speed}>{speed.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {ttsSettings.provider === 'yupvox' && (
                  <p className="text-xs text-slate-500 font-medium">
                    YupVox dùng Voice ID (mặc định EBF147). Tốc độ được lưu cùng bộ từ và áp dụng khi phát audio cho học sinh.
                  </p>
                )}

              </div>
            </div>

            <div className="hidden" id="tts-settings-card">
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Volume2 size={18} className="text-indigo-600" />
                      <h3 className="font-extrabold text-gray-800 text-sm">Cài đặt phát âm TTS</h3>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">
                      Audio được tạo nền sau khi lưu và được cache theo voice_id, ngôn ngữ, tốc độ và nội dung từ.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 font-bold text-xs w-fit">
                    <input
                      type="checkbox"
                      checked={ttsSettings.autoGenerate}
                      onChange={(e) => updateTtsSettings({ autoGenerate: e.target.checked })}
                      className="accent-indigo-600"
                    />
                    <span>Tự tạo audio khi lưu</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Provider</label>
                    <select
                      value={ttsSettings.provider}
                      onChange={(e) => handleTtsProviderChange(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="ai33">AI33 v3</option>
                      <option value="yupvox">YupVox</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Giọng đọc mẫu</label>
                    <select
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {TTS_VOICE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Voice ID</label>
                    <input
                      type="text"
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value.trim() })}
                      placeholder="Ví dụ: elevenlabs_wMBr6SfqQVuOqplK01NE"
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-gray-700 text-xs focus:bg-white focus:border-indigo-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Ngôn ngữ</label>
                    <select
                      value={ttsSettings.lang}
                      onChange={(e) => {
                        const lang = e.target.value as TtsSettings['lang'];
                        updateTtsSettings({ lang });
                      }}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="en-US">en-US</option>
                      <option value="en-GB">en-GB</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Tốc độ</label>
                    <select
                      value={String(ttsSettings.speed)}
                      onChange={(e) => updateTtsSettings({ speed: Number(e.target.value) })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {[0.8, 0.9, 1, 1.1, 1.2].map(speed => (
                        <option key={speed} value={speed}>{speed.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewTtsVoice}
                    disabled={isPreviewingTts || !ttsSettings.voice.trim()}
                    className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2"
                  >
                    <Volume2 size={14} />
                    <span>{isPreviewingTts ? 'Đang tạo...' : 'Nghe thử giọng'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckAudioStatusSmart}
                    disabled={!editingSetId}
                    className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-xl font-black text-xs border border-slate-200 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    <span>Kiểm tra audio</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden" id="tts-settings-card-legacy-hidden">
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div className="space-y-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <Volume2 size={18} className="text-indigo-600" />
                    <h3 className="font-extrabold text-gray-800 text-sm">Cài đặt phát âm TTS</h3>
                  </div>
                  <p className="hidden">
                    Moi dong mot tu theo dang: word | meaning | ipa | partOfSpeech.
                  </p>
                  <p className="hidden">
                    Tạo audio nền sau khi lưu. Học sinh sẽ phát file đã cache, không gọi TTS mỗi lần nghe.
                  </p>
                </div>

                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 font-bold text-xs">
                  <input
                    type="checkbox"
                    checked={ttsSettings.autoGenerate}
                    onChange={(e) => updateTtsSettings({ autoGenerate: e.target.checked })}
                    className="accent-indigo-600"
                  />
                  <span>Tự tạo audio khi lưu</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 flex-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Provider</label>
                    <select
                      value={ttsSettings.provider}
                      onChange={(e) => handleTtsProviderChange(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="ai33">AI33 v3</option>
                      <option value="yupvox">YupVox</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Giọng đọc</label>
                    <select
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {TTS_VOICE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Ngôn ngữ</label>
                    <select
                      value={ttsSettings.lang}
                      onChange={(e) => {
                        const lang = e.target.value as TtsSettings['lang'];
                        updateTtsSettings({ lang });
                      }}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="en-US">en-US</option>
                      <option value="en-GB">en-GB</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Tốc độ</label>
                    <select
                      value={String(ttsSettings.speed)}
                      onChange={(e) => updateTtsSettings({ speed: Number(e.target.value) })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {[0.8, 0.9, 1, 1.1, 1.2].map(speed => (
                        <option key={speed} value={speed}>{speed.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Nghe thử</label>
                    <button
                      type="button"
                      onClick={handlePreviewTtsVoice}
                      disabled={isPreviewingTts}
                      className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2"
                    >
                      <Volume2 size={14} />
                      <span>{isPreviewingTts ? 'Đang tạo...' : 'Nghe thử'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Batch Paste Board */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5" id="batch-paste-panel">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-50 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <ListPlus className="text-indigo-600" size={20} />
                    <h3 className="font-extrabold text-gray-800 text-base">Nhập nhanh từ vựng nhiều dòng</h3>
                  </div>
                  <p className="text-xs text-gray-500 font-semibold">
                    Mỗi dòng một từ theo dạng: word | meaning | ipa | partOfSpeech.
                  </p>
                  <p className="hidden">
                    Mỗi dòng ở các ô bên dưới sẽ ghép thành một dòng tương ứng trong bảng từ vựng.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyBulkImportPrompt('vocabulary')}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
                  aria-live="polite"
                >
                  {copiedBulkPrompt === 'vocabulary' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  {copiedBulkPrompt === 'vocabulary' ? 'Đã sao chép' : 'Sao chép prompt từ vựng'}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-gray-500">D&#225;n d&#7919; li&#7879;u t&#7915; v&#7921;ng</label>
                <textarea
                  value={batchVocabularyText}
                  onChange={(e) => setBatchVocabularyText(e.target.value)}
                  placeholder={'traffic | giao th\u00f4ng | /\u02c8tr\u00e6f\u026ak/ | noun\nroad | con \u0111\u01b0\u1eddng | /r\u0259\u028ad/ | noun\nturn | r\u1ebd, l\u01b0\u1ee3t | /t\u025c\u02d0n/ | verb, noun'}
                  className="w-full min-h-[220px] p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-mono text-sm leading-7 focus:bg-white focus:border-indigo-400 resize-y"
                />
              </div>

              <div className="hidden">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột từ tiếng Anh *</label>
                  <textarea
                    value={batchTerms}
                    onChange={(e) => setBatchTerms(e.target.value)}
                    placeholder="apple&#10;banana&#10;cat"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột nghĩa tiếng Việt *</label>
                  <textarea
                    value={batchMeanings}
                    onChange={(e) => setBatchMeanings(e.target.value)}
                    placeholder="quả táo&#10;quả chuối&#10;con mèo"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột phiên âm IPA</label>
                  <textarea
                    value={batchIpas}
                    onChange={(e) => setBatchIpas(e.target.value)}
                    placeholder="/ˈæpl/&#10;/bəˈnænə/&#10;/kæt/"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột từ loại</label>
                  <textarea
                    value={batchPartsOfSpeech}
                    onChange={(e) => setBatchPartsOfSpeech(e.target.value)}
                    placeholder="Noun&#10;Noun&#10;Noun"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột ví dụ tiếng Anh</label>
                  <textarea
                    value={batchExamples}
                    onChange={(e) => setBatchExamples(e.target.value)}
                    placeholder="I eat an apple after lunch.&#10;She puts a banana in her school bag.&#10;The cat sleeps near the window."
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột dịch nghĩa tiếng Việt</label>
                  <textarea
                    value={batchExampleMeanings}
                    onChange={(e) => setBatchExampleMeanings(e.target.value)}
                    placeholder="Tôi ăn một quả táo sau bữa trưa.&#10;Cô ấy bỏ một quả chuối vào cặp đi học.&#10;Con mèo ngủ gần cửa sổ."
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={handleProcessBatchAdd}
                disabled={!batchVocabularyText.trim()}
                className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 disabled:bg-gray-50 disabled:text-gray-300 text-indigo-700 font-bold rounded-xl transition-all border border-indigo-100 text-sm cursor-pointer"
                id="process-batch-btn"
              >
                Ghép dữ liệu vào bảng từ vựng
              </button>
            </div>

            {/* Main Interactive Vocabulary Grid Table */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4" id="editor-items-grid">
              
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-50">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-gray-800 text-base">Danh sách từ vựng ({editorItems.length} từ)</h3>
                  <p className="text-xs text-gray-400 font-medium">Bấm "Thêm dòng" để soạn thảo hoặc tự sinh các phần còn thiếu trong bảng.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleGenerateAllBlankIpas}
                    className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-indigo-100 cursor-pointer"
                    id="auto-generate-ipa-btn"
                  >
                    <Sparkles size={14} />
                    <span>Tự sinh các phần còn thiếu</span>
                  </button>

                  <button
                    onClick={handleGenerateAllAudioBeforeSave}
                    disabled={isBatchGeneratingAudio}
                    className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 disabled:bg-gray-50 disabled:text-gray-300 text-emerald-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-emerald-100 cursor-pointer"
                    id="batch-generate-audio-btn"
                    title="Tạo audio cho các dòng hiện tại trước khi lưu bộ từ"
                  >
                    <Volume2 size={14} />
                    <span>{isBatchGeneratingAudio ? 'Đang gửi...' : 'Tạo audio hàng loạt'}</span>
                  </button>

                  <button
                    onClick={handleCheckAudioStatusSmart}
                    disabled={!editingSetId}
                    className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 disabled:bg-gray-50 disabled:text-gray-300 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-slate-100 cursor-pointer"
                    id="check-audio-status-btn"
                    title={editingSetId ? 'Kiểm tra audio đã tồn tại/chưa tạo/lỗi' : 'Bộ từ mới chưa có trạng thái audio'}
                  >
                    <RefreshCw size={14} />
                    <span>Kiểm tra audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleGenerateAllVocabImages()}
                    disabled={isBatchGeneratingImages || !editorItems.some(item => item.term.trim())}
                    className="py-2.5 px-4 bg-violet-50 hover:bg-violet-100 disabled:bg-gray-50 disabled:text-gray-300 text-violet-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-violet-100 cursor-pointer"
                    id="batch-generate-vocab-images-btn"
                    title="Chia từ qua các dịch vụ AI đã cấu hình, tự tải ảnh về và gắn vào bảng soạn"
                  >
                    {isBatchGeneratingImages ? <RefreshCw size={14} className="animate-spin" /> : <Images size={14} />}
                    <span>{isBatchGeneratingImages
                      ? `Đang tạo ${vocabImageBatchProgress?.completed || 0}/${vocabImageBatchProgress?.total || editorItems.filter(item => item.term.trim()).length} ảnh...`
                      : 'Tạo ảnh hàng loạt'}</span>
                  </button>

                  <button
                    onClick={handleAddItemRow}
                    className="py-2.5 px-4 bg-gray-50 hover:bg-indigo-600 hover:text-white text-gray-700 font-bold rounded-xl text-xs border border-gray-100 transition-all flex items-center space-x-1 cursor-pointer"
                    id="add-single-row-btn"
                  >
                    <Plus size={14} />
                    <span>Thêm dòng từ mới</span>
                  </button>
                </div>
              </div>

              {/* Items Table Sheet */}
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse" id="vocab-editor-table">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4 text-center w-12">STT</th>
                      <th className="p-4 w-44">Từ Tiếng Anh *</th>
                      <th className="p-4 w-44">Nghĩa Tiếng Việt *</th>
                      <th className="p-4 w-36">Phát âm IPA</th>
                      <th className="p-4 w-28">Loại từ</th>
                      <th className="p-4 min-w-[200px]">Ví dụ minh họa</th>
                      <th className="p-4 w-32 text-center">Ảnh</th>
                      <th className="p-4 w-40">Audio TTS</th>
                      <th className="p-4 text-center w-12">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {editorItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Danh sách từ vựng trống. Hãy thêm dòng hoặc sử dụng các công cụ sinh nhanh ở trên!
                        </td>
                      </tr>
                    ) : (
                      editorItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50/30">
                          <td className="p-3 text-center text-xs font-bold text-gray-400">
                            {index + 1}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.term}
                              onChange={(e) => handleUpdateItemValue(item.id, 'term', e.target.value)}
                              placeholder="Từ tiếng Anh"
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-bold text-sm transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.meaning}
                              onChange={(e) => handleUpdateItemValue(item.id, 'meaning', e.target.value)}
                              placeholder="Nghĩa tiếng Việt"
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-semibold text-sm transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.ipa}
                                onChange={(e) => handleUpdateItemValue(item.id, 'ipa', e.target.value)}
                                placeholder="/pronunciation/"
                                className="w-full p-2.5 pr-10 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-mono text-xs transition-all"
                              />
                              <button
                                onClick={() => handleGenerateIpaForRow(item.id, item.term)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                title="Tự động bổ sung IPA, loại từ, ví dụ và dịch ví dụ"
                              >
                                <Sparkles size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.pos}
                              onChange={(e) => handleUpdateItemValue(item.id, 'pos', e.target.value)}
                              placeholder="Noun, Verb, Adjective..."
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none text-xs font-semibold transition-all"
                            />
                          </td>
                          <td className="p-3 space-y-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.example}
                                onChange={(e) => handleUpdateItemValue(item.id, 'example', e.target.value)}
                                placeholder="English example sentence..."
                                className="w-full p-2 pr-9 bg-gray-50 border border-gray-100 focus:bg-white rounded-xl outline-none text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => item.example.trim() && speakEnglish(item.example)}
                                disabled={!item.example.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 rounded-lg transition-all cursor-pointer"
                                title="Nghe ví dụ tiếng Anh"
                              >
                                <Volume2 size={12} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.exampleMeaning}
                              onChange={(e) => handleUpdateItemValue(item.id, 'exampleMeaning', e.target.value)}
                              placeholder="Dịch nghĩa tiếng Việt..."
                              className="w-full p-2 bg-gray-50 border border-gray-100 focus:bg-white rounded-xl outline-none text-xs text-gray-500"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <VocabImageThumbnail
                              item={item}
                              busy={isBatchGeneratingImages || busyVocabImageItemId === item.id}
                              onGenerate={() => void handleOpenImagePicker(item.id)}
                              onPaste={() => void handlePasteVocabImage(item.id)}
                              onUpload={(file) => void handleUploadVocabImage(item.id, file)}
                              onRemove={() => removeVocabImage(item.id)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg border text-[10px] font-black ${
                                item.audioStatus === 'ready' || item.audioUrl
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : item.audioStatus === 'failed'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : item.audioStatus === 'generating' || item.audioStatus === 'queued'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}>
                                {item.audioStatus === 'ready' || item.audioUrl
                                  ? 'Đã có'
                                  : item.audioStatus === 'failed'
                                    ? 'Lỗi'
                                    : item.audioStatus === 'generating'
                                      ? 'Đang tạo'
                                      : item.audioStatus === 'queued'
                                        ? 'Đang chờ'
                                        : 'Chưa tạo'}
                              </span>
                              {item.audioError && (
                                <span className="text-[10px] text-rose-500 font-semibold line-clamp-2" title={item.audioError}>
                                  {item.audioError}
                                </span>
                              )}
                              {item.ttsText && item.ttsText !== item.term.trim() && (
                                <span className="text-[10px] text-slate-500 font-semibold line-clamp-2" title={`TTS text: ${item.ttsText}`}>
                                  TTS: {item.ttsText}
                                </span>
                              )}
                              {Array.isArray(item.audioWarnings) && item.audioWarnings.length > 0 && (
                                <span className="text-[10px] text-amber-700 font-semibold line-clamp-2" title={item.audioWarnings.join(' ')}>
                                  {item.audioWarnings[0]}
                                </span>
                              )}
                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handlePlayItemAudio(item)}
                                  disabled={!item.term.trim()}
                                  className="p-2 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                                  title="Nghe thử audio"
                                >
                                  <Volume2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateItemAudioBeforeSave(item.id, false)}
                                  disabled={
                                    !item.term.trim() ||
                                    item.audioStatus === 'generating' ||
                                    item.audioStatus === 'queued' ||
                                    Boolean(item.audioUrl || item.audioHash || item.audioStatus === 'ready')
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                                  title="Tao audio moi cho dong nay"
                                >
                                  <Play size={13} />
                                  <span className="text-[10px] font-black">Tao</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateItemAudioBeforeSave(item.id, true)}
                                  disabled={
                                    !item.term.trim() ||
                                    item.audioStatus === 'generating' ||
                                    item.audioStatus === 'queued' ||
                                    (!item.audioUrl && !item.audioHash && item.audioStatus !== 'failed')
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-2 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
                                  title="Tạo hoặc tạo lại audio cho dòng này"
                                >
                                  <RefreshCw size={13} />
                                  <span className="text-[10px] font-black">Tao lai</span>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteItemRow(item.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
}

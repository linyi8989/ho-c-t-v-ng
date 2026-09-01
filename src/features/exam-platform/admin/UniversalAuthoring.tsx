import { ClipboardCopy, FileJson, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ExamPaperDefinition, ExamPaperContent, ExamPartContent } from '../types';
import { importStarterExamBundle, importStarterSinglePart } from '../starterImport';
import { importUniversalExamBundle, importUniversalExamPart, type UniversalImportReport } from '../universalImport';
import { buildUniversalExamImportPrompt, buildUniversalExamPartImportPrompt } from '../universalImportPrompt';

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

function fixedStarterStructure(content: ExamPaperContent) {
  if (content.moduleId === 'flyer' && content.paperId === 'listening') return { partCount: 5, questionCounts: [5, 5, 5, 5, 5], label: 'Flyers Listening' };
  if (content.moduleId === 'flyer' && content.paperId === 'reading-writing') return { partCount: 7, questionCounts: null, label: 'Flyers Reading & Writing' };
  if (content.moduleId === 'ket' && content.paperId === 'listening' && content.templateVersion === 'ket-listening-5-v1') return { partCount: 5, questionCounts: null, label: 'KET Listening' };
  if (content.moduleId === 'ket' && content.paperId === 'reading-writing' && content.templateVersion === 'ket-reading-writing-9-v1') return { partCount: 9, questionCounts: null, label: 'KET Reading & Writing' };
  if (content.moduleId !== 'starter') return null;
  if (content.paperId === 'listening') return { partCount: 4, questionCounts: [5, 5, 5, 5], label: 'Starters Listening' };
  if (content.paperId === 'reading-writing') return { partCount: 5, questionCounts: [5, 5, 5, 5, 5], label: 'Starters Reading & Writing' };
  return null;
}

async function copyPrompt(value: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = value;
    fallback.readOnly = true;
    fallback.style.position = 'fixed';
    fallback.style.left = '-9999px';
    document.body.appendChild(fallback);
    let copied = false;
    try { fallback.select(); copied = document.execCommand('copy'); } finally { fallback.remove(); }
    if (!copied) window.prompt('Nhấn Ctrl+C để sao chép prompt Universal JSON v2:', value);
    return copied;
  }
}

function JsonSource({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <>
    <textarea value={value} onChange={event => onChange(event.target.value)} className={`min-h-44 font-mono ${fieldClass}`} placeholder='Dán exam-bundle-import-v2 hoặc JSON của một Part…' />
    <div className="mt-2">
      <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-700"><Upload size={14} />Tải file JSON</button>
      <input ref={inputRef} type="file" accept="application/json,.json,.txt" className="hidden" onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) file.text().then(onChange).catch(() => undefined);
      }} />
    </div>
  </>;
}

function ReportGrid({ reports }: { reports: UniversalImportReport[] }) {
  if (!reports.length) return null;
  return <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{reports.map(report => <div key={report.part} className={`rounded-xl border p-3 text-xs ${report.warnings.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><p className="font-black">Part {report.part} · {report.blockCount} dạng · {report.questionCount} câu</p><p className="mt-1 font-semibold">{report.warnings.length ? `${report.warnings.length} mục cần xác nhận` : 'Đã nhập nội dung'}</p>{report.warnings.slice(0, 2).map((warning, index) => <p key={index} className="mt-1 text-[10px]">{warning}</p>)}</div>)}</div>;
}

export function UniversalWholeImportPanel({
  content,
  definition,
  onChange,
  onImported,
  onMessage,
}: {
  content: ExamPaperContent;
  definition: ExamPaperDefinition;
  onChange: (content: ExamPaperContent) => void;
  onImported: () => void;
  onMessage: (message: { text: string; error?: boolean }) => void;
}) {
  const [source, setSource] = useState('');
  const [reports, setReports] = useState<UniversalImportReport[]>([]);
  const [copied, setCopied] = useState(false);
  const fixed = fixedStarterStructure(content);
  return <details open className="rounded-2xl border border-violet-200 bg-violet-50 p-4" id="universal-whole-json-import">
    <summary className="cursor-pointer text-sm font-black text-violet-900"><FileJson size={16} className="mr-2 inline" />Nhập Universal JSON tổng</summary>
    <p className="mt-2 text-xs font-semibold leading-5 text-violet-800">{fixed ? fixed.questionCounts ? `${fixed.label} khóa đúng ${fixed.partCount} Part với số câu lần lượt ${fixed.questionCounts.join('–')}; JSON nhập nội dung và đáp án theo từng mô hình Part đã thiết kế.` : `${fixed.label} khóa đúng ${fixed.partCount} Part nhưng số câu của từng Part được lấy từ JSON/đề gốc, không bị schema áp đặt.` : 'JSON quyết định số Part, số dạng bài trong từng Part và số câu.'} Tọa độ chỉ được nhận như gợi ý để giáo viên xác nhận; nhập JSON không tự xuất bản.</p>
    <button type="button" data-exam-action="copy-universal-json-prompt" onClick={async () => {
      const success = await copyPrompt(buildUniversalExamImportPrompt(content));
      if (!success) return;
      setCopied(true);
      onMessage({ text: 'Đã sao chép prompt Universal JSON v2. Hãy gửi kèm ảnh/PDF đề và official answer key trong ChatGPT Web.' });
      window.setTimeout(() => setCopied(false), 2200);
    }} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-xs font-black text-violet-800"><ClipboardCopy size={15} />{copied ? 'Đã sao chép prompt' : 'Sao chép prompt gửi ChatGPT'}</button>
    <div className="mt-3"><JsonSource value={source} onChange={setSource} /></div>
    <button type="button" data-exam-action="import-universal-whole" onClick={() => {
      try {
        const parsed = JSON.parse(source);
        if (parsed?.format === 'exam-bundle-import-v1' && content.moduleId === 'starter' && content.paperId === 'listening') {
          const legacy = importStarterExamBundle(content, source, definition);
          onChange(legacy.content);
          setReports(legacy.reports.filter(report => report.status === 'imported' || report.status === 'warning').map(report => ({ part: report.part, blockCount: 1, questionCount: report.questionCount, warnings: report.warnings })));
          onMessage({ text: `Đã nhập ${legacy.appliedParts.length} Part bằng adapter Starter v1. Có thể dùng prompt mới để chuyển sang cấu trúc nhiều block.` });
        } else {
          const result = importUniversalExamBundle(content, source);
          const fixed = fixedStarterStructure(content);
          if (fixed && (result.content.parts.length !== fixed.partCount || result.content.parts.some((part, index) => part.part !== index + 1 || (fixed.questionCounts ? part.questions.length !== fixed.questionCounts[index] : part.questions.length < 1)))) {
            throw new Error(fixed.questionCounts ? `${fixed.label} phải có đúng ${fixed.partCount} Part theo thứ tự và số câu ${fixed.questionCounts.join('–')}. JSON chưa được áp dụng.` : `${fixed.label} phải có đúng ${fixed.partCount} Part theo thứ tự và mỗi Part có ít nhất một câu. JSON chưa được áp dụng.`);
          }
          onChange(result.content);
          setReports(result.reports);
          onMessage({ text: `Đã tạo ${result.content.parts.length} Part, ${result.content.parts.reduce((sum, part) => sum + (part.blocks?.length || 1), 0)} dạng bài và ${result.content.parts.reduce((sum, part) => sum + part.questions.length, 0)} câu.` });
        }
        onImported();
      } catch (reason: any) {
        onMessage({ text: reason?.message || 'Universal JSON không hợp lệ.', error: true });
      }
    }} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white"><FileJson size={15} />Phân tích và tạo cấu trúc đề</button>
    <ReportGrid reports={reports} />
  </details>;
}

export function UniversalPartImportPanel({
  content,
  definition,
  partIndex,
  onChange,
  onMessage,
}: {
  content: ExamPaperContent;
  definition: ExamPaperDefinition;
  partIndex: number;
  onChange: (part: ExamPartContent, dynamic: boolean) => void;
  onMessage: (message: { text: string; error?: boolean }) => void;
}) {
  const [source, setSource] = useState('');
  const [copied, setCopied] = useState(false);
  return <details className="rounded-2xl border border-violet-200 bg-violet-50 p-4" data-universal-part-import={partIndex + 1}>
    <summary className="cursor-pointer text-sm font-black text-violet-900"><FileJson size={16} className="mr-2 inline" />Nhập lại JSON Part {partIndex + 1}</summary>
    <p className="mt-2 text-xs font-semibold text-violet-800">Nhận object Part v2 hoặc JSON tổng v2; chỉ Part này được thay đổi.{content.moduleId === 'starter' && content.paperId === 'listening' ? ' Starter Listening JSON v1 cũ vẫn được hỗ trợ.' : ''}</p>
    <button type="button" data-exam-action="copy-part-json-prompt" onClick={async () => {
      const success = await copyPrompt(buildUniversalExamPartImportPrompt(content, partIndex));
      if (!success) return;
      setCopied(true);
      onMessage({ text: `Đã sao chép prompt riêng Part ${partIndex + 1}. Prompt yêu cầu AI phân biệt từng hành động colour/draw và chỉ trả Part này.` });
      window.setTimeout(() => setCopied(false), 2200);
    }} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-xs font-black text-violet-800"><ClipboardCopy size={15} />{copied ? `Đã sao chép prompt Part ${partIndex + 1}` : `Sao chép prompt riêng Part ${partIndex + 1}`}</button>
    <div className="mt-3"><JsonSource value={source} onChange={setSource} /></div>
    <button type="button" onClick={() => {
      try {
        const parsed = JSON.parse(source);
        if ((parsed?.format === 'exam-bundle-import-v1' || parsed?.section) && content.moduleId === 'starter' && content.paperId === 'listening') {
          const legacy = importStarterSinglePart(content, partIndex, source, definition);
          onChange(legacy.part, false);
          onMessage({ text: `Đã nhập Part ${partIndex + 1} bằng adapter Starter v1.` });
        } else {
          const result = importUniversalExamPart(content, partIndex, source);
          const fixed = fixedStarterStructure(content);
          if (fixed?.questionCounts && result.part.questions.length !== fixed.questionCounts[partIndex]) {
            throw new Error(`${fixed.label} Part ${partIndex + 1} phải có đúng ${fixed.questionCounts[partIndex]} câu. JSON chưa được áp dụng.`);
          }
          onChange(result.part, !((content.moduleId === 'starter' && content.paperId === 'reading-writing') || (content.moduleId === 'flyer' && (content.paperId === 'listening' || content.paperId === 'reading-writing')) || (content.moduleId === 'ket' && content.paperId === 'listening' && content.templateVersion === 'ket-listening-5-v1') || (content.moduleId === 'ket' && content.paperId === 'reading-writing' && content.templateVersion === 'ket-reading-writing-9-v1')));
          onMessage({ text: `Đã nhập Part ${partIndex + 1}: ${result.report.blockCount} dạng, ${result.report.questionCount} câu.${result.report.warnings.length ? ` ${result.report.warnings.length} mục cần xác nhận.` : ''}` });
        }
      } catch (reason: any) {
        onMessage({ text: reason?.message || `JSON Part ${partIndex + 1} không hợp lệ.`, error: true });
      }
    }} className="mt-3 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white">Kiểm tra và nhập Part này</button>
  </details>;
}

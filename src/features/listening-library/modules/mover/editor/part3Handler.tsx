import React, { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import type { ListeningPart3, ListeningPart3ConnectImage, ListeningPart3Legacy } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import { ListeningRegionEditor } from '../../../../listening/admin/ListeningRegionEditor';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import {
  smartImportSourceAssetId,
  type ListeningSmartImportCandidate,
  type ListeningSmartImportData,
  type SmartImportResolutionSource,
} from '../../../../listening-editor/smart-import/types';
import { createMoverEditorId } from './editorUtilities';
import { EditorField, MoverPartBaseEditor, type MoverPartEditorProps } from './shared';
import { applyPart3ConnectAnalysis } from './directImport';
import {
  comparePart3PictureSlots,
  part3PicturePositionLabel,
  validatePart3ImportData,
} from './part3Review';

type Part3ImportData = Extract<ListeningSmartImportData, { part: 3 }>;

const clampOffset = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
const sourceLabels: Record<SmartImportResolutionSource, string> = {
  ai: 'AI nhận',
  mixed: 'AI + draft',
  'current-part': 'Giữ draft',
  derived: 'Được suy ra',
  teacher: 'Giáo viên sửa',
};

function ResolutionBadge({ source }: { source?: SmartImportResolutionSource }) {
  if (!source) return null;
  const warning = source === 'current-part' || source === 'mixed';
  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase ${warning ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
      {sourceLabels[source]}
    </span>
  );
}

function LegacyPart3Editor({ part, props }: { part: ListeningPart3Legacy; props: MoverPartEditorProps<ListeningPart3> }) {
  const { assets, aiCapability, onUpload, onChange } = props;
  const composite = part.displayMode === 'composite';
  const commit = (next: ListeningPart3Legacy) => onChange(next);
  return (
    <div className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
      <p className="text-xs font-bold text-amber-800">Dữ liệu Part 3 legacy vẫn được hỗ trợ mở, chơi và chấm. Smart Import mới sẽ chuyển riêng Part 3 sang chế độ nối trực tiếp trên ảnh.</p>
      {composite ? (
        <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Ảnh bảng tổng hợp A–F" kind="image" value={part.boardAssetId} onChange={boardAssetId => commit({ ...part, boardAssetId })} />
      ) : (
        <div>
          <button type="button" onClick={() => commit({ ...part, options: [...part.options, { id: createMoverEditorId('p3-option'), label: String.fromCharCode(65 + part.options.length), imageAssetId: '' }] })} className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"><Plus size={13} className="inline" /> Thêm vị trí</button>
          <div className="grid gap-3 lg:grid-cols-2">
            {part.options.map((option, index) => <div key={option.id}><ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label={`Vị trí ${String.fromCharCode(65 + index)}`} kind="image" value={option.imageAssetId} onChange={imageAssetId => commit({ ...part, options: part.options.map(item => item.id === option.id ? { ...item, imageAssetId } : item) })} /></div>)}
          </div>
        </div>
      )}
      {part.items.map((item, index) => (
        <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[1fr_180px]">
          <EditorField label={`Nhãn ${index + 1}`} value={item.label} onChange={label => commit({ ...part, items: part.items.map(entry => entry.id === item.id ? { ...entry, label } : entry) })} />
          <label className="space-y-1"><span className="text-xs font-black text-slate-700">Đáp án</span><select value={item.correctOptionId} onChange={event => commit({ ...part, items: part.items.map(entry => entry.id === item.id ? { ...entry, correctOptionId: event.target.value } : entry) })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"><option value="">— Chọn —</option>{part.options.map((option, optionIndex) => <option key={option.id} value={option.id}>{String.fromCharCode(65 + optionIndex)}</option>)}</select></label>
        </div>
      ))}
    </div>
  );
}

function AppliedPart3MappingEditor({ part, commit }: { part: ListeningPart3ConnectImage; commit: (next: ListeningPart3ConnectImage) => void }) {
  const sortedConnections = part.correctConnections.slice().sort((first, second) => {
    const firstPicture = part.pictures.find(picture => picture.id === first.pictureId);
    const secondPicture = part.pictures.find(picture => picture.id === second.pictureId);
    if (!firstPicture || !secondPicture) return 0;
    return comparePart3PictureSlots(
      { pictureSide: firstPicture.side, pictureRow: firstPicture.row },
      { pictureSide: secondPicture.side, pictureRow: secondPicture.row },
    );
  });
  const rows = Array.from({ length: 5 }, (_, index) => sortedConnections[index] || { answerId: '', pictureId: '' });
  const commitRows = (nextRows: typeof rows) => {
    const correctConnections = nextRows.filter(row => row.answerId && row.pictureId);
    const usedAnswers = new Set([part.exampleConnection.answerId, ...correctConnections.map(row => row.answerId)]);
    const unused = part.answers.filter(answer => !usedAnswers.has(answer.id));
    commit({ ...part, correctConnections, distractorAnswerId: unused.length === 1 ? unused[0].id : part.distractorAnswerId });
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1"><span className="text-xs font-black">Example</span><select value={part.exampleConnection.answerId} onChange={event => commit({ ...part, exampleConnection: { ...part.exampleConnection, answerId: event.target.value } })} className="w-full rounded-xl border p-2 text-xs"><option value="">— Chọn đáp án —</option>{part.answers.map(answer => <option key={answer.id} value={answer.id}>{answer.label}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black">Hình example</span><select value={part.exampleConnection.pictureId} onChange={event => commit({ ...part, exampleConnection: { ...part.exampleConnection, pictureId: event.target.value } })} className="w-full rounded-xl border p-2 text-xs"><option value="">— Chọn hình —</option>{part.pictures.slice().sort((a, b) => comparePart3PictureSlots({ pictureSide: a.side, pictureRow: a.row }, { pictureSide: b.side, pictureRow: b.row })).map(picture => <option key={picture.id} value={picture.id}>{part3PicturePositionLabel(picture.side, picture.row)}</option>)}</select></label>
      </div>
      {rows.map((connection, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[90px_1fr_1fr] md:items-center">
          <span className="text-xs font-black text-slate-700">Câu {index + 1}</span>
          <select value={connection.answerId} onChange={event => commitRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, answerId: event.target.value } : row))} className="rounded-xl border p-2 text-xs"><option value="">— Chọn đáp án —</option>{part.answers.filter(answer => answer.id !== part.exampleConnection.answerId).map(answer => <option key={answer.id} value={answer.id}>{answer.label}</option>)}</select>
          <select value={connection.pictureId} onChange={event => commitRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, pictureId: event.target.value } : row))} className="rounded-xl border p-2 text-xs"><option value="">— Chọn hình —</option>{part.pictures.filter(picture => picture.id !== part.exampleConnection.pictureId).slice().sort((a, b) => comparePart3PictureSlots({ pictureSide: a.side, pictureRow: a.row }, { pictureSide: b.side, pictureRow: b.row })).map(picture => <option key={picture.id} value={picture.id}>{part3PicturePositionLabel(picture.side, picture.row)}</option>)}</select>
        </div>
      ))}
      <label className="block space-y-1"><span className="text-xs font-black">Đáp án nhiễu</span><select value={part.distractorAnswerId} onChange={event => commit({ ...part, distractorAnswerId: event.target.value })} className="w-full rounded-xl border p-2 text-xs"><option value="">—</option>{part.answers.filter(answer => answer.id !== part.exampleConnection.answerId).map(answer => <option key={answer.id} value={answer.id}>{answer.label}</option>)}</select></label>
    </div>
  );
}

function ConnectPart3Editor({ part, props }: { part: ListeningPart3ConnectImage; props: MoverPartEditorProps<ListeningPart3> }) {
  const { assets, assetUrl, aiCapability, onUpload, onChange } = props;
  const commit = (next: ListeningPart3ConnectImage) => onChange(next);
  const exampleAnswer = part.answers.find(answer => answer.id === part.exampleConnection.answerId);
  const examplePicture = part.pictures.find(picture => picture.id === part.exampleConnection.pictureId);
  const rows = part.correctConnections.map((connection, index) => ({
    index,
    answer: part.answers.find(answer => answer.id === connection.answerId),
    picture: part.pictures.find(picture => picture.id === connection.pictureId),
  })).filter(row => row.answer && row.picture).sort((first, second) => comparePart3PictureSlots(
    { pictureSide: first.picture!.side, pictureRow: first.picture!.row },
    { pictureSide: second.picture!.side, pictureRow: second.picture!.row },
  ));
  const distractor = part.answers.find(answer => answer.id === part.distractorAnswerId);
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4" data-part3-compact-editor>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-slate-900">Nội dung Part 3 hiện tại</h4>
          <p className="text-xs font-semibold text-slate-600">Ảnh gốc được dùng trực tiếp; geometry và node được lưu bên dưới.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black ${rows.length === 5 && exampleAnswer && examplePicture && distractor ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{rows.length}/5 mapping</span>
      </div>
      {part.boardAssetId ? <img src={assetUrl(part.boardAssetId)} alt="Ảnh đề bài Part 3" className="mx-auto max-h-96 w-full rounded-xl border border-slate-200 object-contain" /> : <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-800">Chưa có ảnh đề bài. Hãy dùng Smart Import với hai ảnh ở phía trên.</p>}
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3" data-part3-mapping-summary>
        <p className="text-xs font-black text-slate-800">Example: <span className="text-violet-700">{exampleAnswer?.label || 'Chưa xác định'}</span> → {examplePicture ? part3PicturePositionLabel(examplePicture.side, examplePicture.row) : 'Chưa xác định'}</p>
        {rows.map((row, index) => <p key={`${row.answer!.id}-${row.picture!.id}`} className="text-xs font-bold text-slate-700"><span className="inline-block w-14 text-slate-500">Câu {index + 1}:</span> {row.answer!.label} → {part3PicturePositionLabel(row.picture!.side, row.picture!.row)}</p>)}
        <p className="border-t border-slate-200 pt-2 text-xs font-black text-slate-800">Đáp án nhiễu: <span className="text-rose-700">{distractor?.label || 'Chưa xác định'}</span></p>
      </div>
      <details className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
        <summary className="cursor-pointer text-xs font-black text-sky-800">Sửa example, mapping hoặc đáp án nhiễu</summary>
        <div className="mt-3"><AppliedPart3MappingEditor part={part} commit={commit} /></div>
      </details>
      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-part3-advanced-editor>
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-black text-slate-800"><Settings2 size={14} /> Chỉnh nâng cao: vùng và vị trí node</summary>
        <div className="mt-4 space-y-5">
          <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Thay ảnh đề bài Part 3" kind="image" value={part.boardAssetId} onChange={boardAssetId => commit({ ...part, boardAssetId })} />
          <section className="space-y-3">
            <h5 className="text-xs font-black text-slate-800">7 vùng đáp án</h5>
            {part.answers.map((answer, index) => <div key={answer.id} className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-[1fr_160px_160px]"><EditorField label={`Đáp án ${index + 1}`} value={answer.label} onChange={label => commit({ ...part, answers: part.answers.map(item => item.id === answer.id ? { ...item, label } : item) })} />{(['leftAnchorOffset', 'rightAnchorOffset'] as const).map(field => <label key={field} className="space-y-1"><span className="text-xs font-black">Node cạnh {field === 'leftAnchorOffset' ? 'trái' : 'phải'}</span><input type="range" min="0" max="1" step="0.01" value={answer[field]} onChange={event => commit({ ...part, answers: part.answers.map(item => item.id === answer.id ? { ...item, [field]: clampOffset(Number(event.target.value)) } : item) })} className="w-full" /></label>)}</div>)}
            <ListeningRegionEditor imageUrl={assetUrl(part.boardAssetId)} items={part.answers.map(answer => ({ id: answer.id, label: answer.label, region: answer.region }))} onChange={items => commit({ ...part, answers: part.answers.map(answer => ({ ...answer, region: items.find(item => item.id === answer.id)?.region || answer.region })) })} />
          </section>
          <section className="space-y-3">
            <h5 className="text-xs font-black text-slate-800">6 vùng hình</h5>
            {part.pictures.map(picture => <div key={picture.id} className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-[1fr_170px]"><EditorField label={part3PicturePositionLabel(picture.side, picture.row)} value={picture.label} onChange={label => commit({ ...part, pictures: part.pictures.map(item => item.id === picture.id ? { ...item, label } : item) })} /><label className="space-y-1"><span className="text-xs font-black">Node dọc cạnh hướng vào giữa</span><input type="range" min="0" max="1" step="0.01" value={picture.anchorOffset} onChange={event => commit({ ...part, pictures: part.pictures.map(item => item.id === picture.id ? { ...item, anchorOffset: clampOffset(Number(event.target.value)) } : item) })} className="w-full" /></label></div>)}
            <ListeningRegionEditor imageUrl={assetUrl(part.boardAssetId)} items={part.pictures.map(picture => ({ id: picture.id, label: part3PicturePositionLabel(picture.side, picture.row), region: picture.region }))} onChange={items => commit({ ...part, pictures: part.pictures.map(picture => ({ ...picture, region: items.find(item => item.id === picture.id)?.region || picture.region })) })} />
          </section>
          <label className="flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={part.exampleConnection.renderOverlayLine} onChange={event => commit({ ...part, exampleConnection: { ...part.exampleConnection, renderOverlayLine: event.target.checked } })} /> Vẽ thêm đường example lên ảnh (mặc định tắt)</label>
        </div>
      </details>
    </section>
  );
}

function CandidatePart3Review({ data, imageUrl, onChange, onApply }: { data: Part3ImportData; imageUrl?: string; onChange: (next: Part3ImportData) => void; onApply: () => void }) {
  const [newAnswer, setNewAnswer] = useState('');
  const [newPicture, setNewPicture] = useState('');
  const issues = validatePart3ImportData(data);
  const rows = data.connections.map((connection, index) => ({ connection, index })).sort((first, second) => comparePart3PictureSlots(first.connection, second.connection));
  const pictures = data.pictures.slice().sort((first, second) => comparePart3PictureSlots({ pictureSide: first.side, pictureRow: first.row }, { pictureSide: second.side, pictureRow: second.row }));
  const updateConnection = (index: number, patch: Partial<Part3ImportData['connections'][number]>) => onChange({ ...data, connections: data.connections.map((connection, connectionIndex) => connectionIndex === index ? { ...connection, ...patch, source: 'teacher' } : connection) });
  const addConnection = () => {
    const [pictureSide, rawRow] = newPicture.split(':');
    if (!newAnswer || !['left', 'right'].includes(pictureSide) || ![1, 2, 3].includes(Number(rawRow)) || data.connections.length >= 5) return;
    onChange({ ...data, connections: [...data.connections, { answerLabel: newAnswer, pictureSide: pictureSide as 'left' | 'right', pictureRow: Number(rawRow) as 1 | 2 | 3, source: 'teacher' }] });
    setNewAnswer('');
    setNewPicture('');
  };
  return (
    <div className="space-y-4" data-part3-candidate-review>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-2xl font-black text-slate-900">{data.answers.length}/7</p><p className="text-xs font-bold text-slate-600">đáp án ở giữa</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-2xl font-black text-slate-900">{data.pictures.length}/6</p><p className="text-xs font-bold text-slate-600">hình trái/phải</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-2xl font-black text-slate-900">{data.connections.length}/5</p><p className="text-xs font-bold text-slate-600">mapping chấm điểm</p></div>
      </div>
      {imageUrl && <img src={imageUrl} alt="Ảnh đề bài Part 3 dùng để kiểm tra mapping" className="mx-auto max-h-96 w-full rounded-xl border border-slate-200 object-contain" />}
      <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
        <div className="grid gap-2 md:grid-cols-[90px_1fr_1fr_auto] md:items-center">
          <span className="text-xs font-black text-violet-800">Example</span>
          <select value={data.example?.answerLabel || ''} onChange={event => onChange({ ...data, example: { answerLabel: event.target.value, pictureSide: data.example?.pictureSide || 'left', pictureRow: data.example?.pictureRow || 1, renderOverlayLine: data.example?.renderOverlayLine || false, source: 'teacher' } })} className="rounded-xl border p-2 text-xs"><option value="">— Chưa xác định —</option>{data.answers.map(answer => <option key={answer.label} value={answer.label}>{answer.label}</option>)}</select>
          <select value={data.example ? `${data.example.pictureSide}:${data.example.pictureRow}` : ''} onChange={event => { const [pictureSide, rawRow] = event.target.value.split(':'); onChange({ ...data, example: { answerLabel: data.example?.answerLabel || '', pictureSide: pictureSide as 'left' | 'right', pictureRow: Number(rawRow) as 1 | 2 | 3, renderOverlayLine: data.example?.renderOverlayLine || false, source: 'teacher' } }); }} className="rounded-xl border p-2 text-xs"><option value="">— Chưa xác định —</option>{pictures.map(picture => <option key={`${picture.side}:${picture.row}`} value={`${picture.side}:${picture.row}`}>{part3PicturePositionLabel(picture.side, picture.row)}</option>)}</select>
          <ResolutionBadge source={data.example?.source} />
        </div>
        {rows.map(({ connection, index }, displayIndex) => <div key={`${connection.pictureSide}:${connection.pictureRow}:${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[90px_1fr_1fr_auto] md:items-center"><span className="text-xs font-black text-slate-700">Câu {displayIndex + 1}</span><select value={connection.answerLabel} onChange={event => updateConnection(index, { answerLabel: event.target.value })} className="rounded-xl border p-2 text-xs">{data.answers.map(answer => <option key={answer.label} value={answer.label}>{answer.label}</option>)}</select><select value={`${connection.pictureSide}:${connection.pictureRow}`} onChange={event => { const [pictureSide, rawRow] = event.target.value.split(':'); updateConnection(index, { pictureSide: pictureSide as 'left' | 'right', pictureRow: Number(rawRow) as 1 | 2 | 3 }); }} className="rounded-xl border p-2 text-xs">{pictures.map(picture => <option key={`${picture.side}:${picture.row}`} value={`${picture.side}:${picture.row}`}>{part3PicturePositionLabel(picture.side, picture.row)}</option>)}</select><ResolutionBadge source={connection.source} /></div>)}
        {data.connections.length < 5 && <div className="grid gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 md:grid-cols-[90px_1fr_1fr_auto] md:items-center"><span className="text-xs font-black text-amber-800">Thêm câu</span><select value={newAnswer} onChange={event => setNewAnswer(event.target.value)} className="rounded-xl border p-2 text-xs"><option value="">— Chọn đáp án —</option>{data.answers.map(answer => <option key={answer.label} value={answer.label}>{answer.label}</option>)}</select><select value={newPicture} onChange={event => setNewPicture(event.target.value)} className="rounded-xl border p-2 text-xs"><option value="">— Chọn hình —</option>{pictures.map(picture => <option key={`${picture.side}:${picture.row}`} value={`${picture.side}:${picture.row}`}>{part3PicturePositionLabel(picture.side, picture.row)}</option>)}</select><button type="button" onClick={addConnection} disabled={!newAnswer || !newPicture} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Thêm</button></div>}
        <div className="grid gap-2 border-t border-violet-200 pt-3 md:grid-cols-[90px_1fr_auto] md:items-center"><span className="text-xs font-black text-rose-800">Nhiễu</span><select value={data.distractorLabel || ''} onChange={event => onChange({ ...data, distractorLabel: event.target.value, distractorSource: 'teacher' })} className="rounded-xl border p-2 text-xs"><option value="">— Chưa xác định —</option>{data.answers.map(answer => <option key={answer.label} value={answer.label}>{answer.label}</option>)}</select><ResolutionBadge source={data.distractorSource} /></div>
      </div>
      {issues.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-black text-amber-900">Cần hoàn thiện trước khi áp dụng</p><ul className="mt-1 list-disc space-y-1 pl-5 text-xs font-semibold text-amber-800">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-part3-candidate-advanced>
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-black text-slate-800"><Settings2 size={14} /> Chỉnh nâng cao: nhãn, vùng và node</summary>
        <div className="mt-4 space-y-5">
          <section className="space-y-3">
            <h5 className="text-xs font-black">7 vùng đáp án</h5>
            {data.answers.map((answer, index) => <div key={`${answer.label}-${index}`} className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-[1fr_130px_130px_auto]"><EditorField label={`Đáp án ${index + 1}`} value={answer.label} onChange={label => onChange({ ...data, answers: data.answers.map((item, itemIndex) => itemIndex === index ? { ...item, label, source: 'teacher' } : item) })} />{(['leftAnchorOffset', 'rightAnchorOffset'] as const).map(field => <label key={field} className="space-y-1"><span className="text-[10px] font-black">Node {field === 'leftAnchorOffset' ? 'trái' : 'phải'}</span><input type="number" min="0" max="1" step="0.01" value={answer[field]} onChange={event => onChange({ ...data, answers: data.answers.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: clampOffset(Number(event.target.value)), source: 'teacher' } : item) })} className="w-full rounded-lg border p-2 text-xs" /></label>)}<ResolutionBadge source={answer.source} /></div>)}
            {imageUrl && data.answers.length > 0 && <ListeningRegionEditor imageUrl={imageUrl} items={data.answers.map((answer, index) => ({ id: `candidate-answer-${index}`, label: answer.label, region: answer.region }))} onChange={items => onChange({ ...data, answers: data.answers.map((answer, index) => ({ ...answer, region: items[index]?.region || answer.region, source: 'teacher' })) })} />}
          </section>
          <section className="space-y-3">
            <h5 className="text-xs font-black">6 vùng hình</h5>
            {data.pictures.map((picture, index) => <div key={`${picture.side}:${picture.row}`} className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-[1fr_100px_80px_100px_auto]"><EditorField label={part3PicturePositionLabel(picture.side, picture.row)} value={picture.label} onChange={label => onChange({ ...data, pictures: data.pictures.map((item, itemIndex) => itemIndex === index ? { ...item, label, source: 'teacher' } : item) })} /><select value={picture.side} onChange={event => onChange({ ...data, pictures: data.pictures.map((item, itemIndex) => itemIndex === index ? { ...item, side: event.target.value as 'left' | 'right', source: 'teacher' } : item) })} className="self-end rounded-lg border p-2 text-xs"><option value="left">Trái</option><option value="right">Phải</option></select><select value={picture.row} onChange={event => onChange({ ...data, pictures: data.pictures.map((item, itemIndex) => itemIndex === index ? { ...item, row: Number(event.target.value) as 1 | 2 | 3, source: 'teacher' } : item) })} className="self-end rounded-lg border p-2 text-xs">{[1, 2, 3].map(row => <option key={row}>{row}</option>)}</select><label className="space-y-1"><span className="text-[10px] font-black">Node cạnh</span><input type="number" min="0" max="1" step="0.01" value={picture.anchorOffset} onChange={event => onChange({ ...data, pictures: data.pictures.map((item, itemIndex) => itemIndex === index ? { ...item, anchorOffset: clampOffset(Number(event.target.value)), source: 'teacher' } : item) })} className="w-full rounded-lg border p-2 text-xs" /></label><ResolutionBadge source={picture.source} /></div>)}
            {imageUrl && data.pictures.length > 0 && <ListeningRegionEditor imageUrl={imageUrl} items={data.pictures.map((picture, index) => ({ id: `candidate-picture-${index}`, label: part3PicturePositionLabel(picture.side, picture.row), region: picture.region }))} onChange={items => onChange({ ...data, pictures: data.pictures.map((picture, index) => ({ ...picture, region: items[index]?.region || picture.region, source: 'teacher' })) })} />}
          </section>
        </div>
      </details>
      <button type="button" onClick={onApply} disabled={issues.length > 0} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Áp dụng vào Part 3</button>
    </div>
  );
}

export default function MoverPart3Editor(props: MoverPartEditorProps<ListeningPart3>) {
  const { part, token, assets, smartImportCapability, onImportCandidateChange, onImportCandidateApplied, onUpload, onChange } = props;
  const importAnalysis = (candidate: ListeningSmartImportCandidate) => {
    if (candidate.data.part !== 3) throw new Error('Dữ liệu AI không đúng Part 3.');
    const issues = validatePart3ImportData(candidate.data);
    if (issues.length) {
      throw new Error(`Part 3 chưa đủ điều kiện tự nhập: ${issues.join(' · ')}`);
    }
    const questionAssetId = smartImportSourceAssetId(candidate, 'question');
    if (!questionAssetId) throw new Error('Thiếu ảnh đề bài Part 3.');
    onChange(applyPart3ConnectAnalysis(part, candidate.data, questionAssetId));
    onImportCandidateChange(undefined);
    onImportCandidateApplied();
  };
  return (
    <div className="space-y-5">
      <MoverPartBaseEditor {...props} />
      <SmartImportPanel token={token} part={part} assets={assets} capability={smartImportCapability} onCandidateChange={onImportCandidateChange} onAnalyzed={importAnalysis} onUpload={onUpload} pastedTextPlacement="advanced" analyzeLabel="AI phân tích và nhập Part 3" analyzedNotice="Đã nhập mapping Part 3 vào bài soạn. Hãy kiểm tra và sửa trực tiếp bên dưới nếu cần." />
      {part.displayMode === 'connect-image' ? <ConnectPart3Editor part={part} props={props} /> : <LegacyPart3Editor part={part} props={props} />}
    </div>
  );
}

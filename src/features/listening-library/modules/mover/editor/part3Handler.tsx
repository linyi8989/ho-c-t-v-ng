import React from 'react';
import { Plus } from 'lucide-react';
import type { ListeningPart3, ListeningPart3ConnectImage, ListeningPart3Legacy } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import { ListeningRegionEditor } from '../../../../listening/admin/ListeningRegionEditor';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import { hashListeningPart } from '../../../../listening-editor/smart-import/hash';
import { smartImportSourceAssetId } from '../../../../listening-editor/smart-import/types';
import { createMoverEditorId } from './editorUtilities';
import { EditorField, MoverPartBaseEditor, type MoverPartEditorProps } from './shared';
import { applyPart3ConnectAnalysis } from './directImport';

const clampOffset = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));

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

function ConnectPart3Editor({ part, props }: { part: ListeningPart3ConnectImage; props: MoverPartEditorProps<ListeningPart3> }) {
  const { assets, assetUrl, aiCapability, onUpload, onChange } = props;
  const commit = (next: ListeningPart3ConnectImage) => onChange(next);
  const connectionRows = Array.from({ length: 5 }, (_, index) => part.correctConnections[index] || { answerId: '', pictureId: '' });
  const updateConnection = (index: number, patch: Partial<(typeof connectionRows)[number]>) => commit({ ...part, correctConnections: connectionRows.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item).filter(item => item.answerId || item.pictureId) });
  return (
    <div className="space-y-5">
      <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Ảnh đề bài Part 3" kind="image" value={part.boardAssetId} onChange={boardAssetId => commit({ ...part, boardAssetId })} />
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-black text-slate-800">7 answer ở giữa và anchor bị khóa theo cạnh</h4>
        {part.answers.map((answer, index) => (
          <div key={answer.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_180px_180px]">
            <EditorField label={`Answer ${index + 1}`} value={answer.label} onChange={label => commit({ ...part, answers: part.answers.map(item => item.id === answer.id ? { ...item, label } : item) })} />
            {(['leftAnchorOffset', 'rightAnchorOffset'] as const).map(field => <label key={field} className="space-y-1"><span className="text-xs font-black text-slate-700">Offset cạnh {field === 'leftAnchorOffset' ? 'trái' : 'phải'}</span><input type="range" min="0" max="1" step="0.01" value={answer[field]} onChange={event => commit({ ...part, answers: part.answers.map(item => item.id === answer.id ? { ...item, [field]: clampOffset(Number(event.target.value)) } : item) })} className="w-full" /></label>)}
          </div>
        ))}
        <ListeningRegionEditor imageUrl={assetUrl(part.boardAssetId)} items={part.answers.map(answer => ({ id: answer.id, label: answer.label, region: answer.region }))} onChange={items => commit({ ...part, answers: part.answers.map(answer => ({ ...answer, region: items.find(item => item.id === answer.id)?.region || answer.region })) })} />
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-black text-slate-800">6 picture: 3 trái + 3 phải</h4>
        {part.pictures.map(picture => <div key={picture.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_180px]"><EditorField label={`${picture.side === 'left' ? 'Trái' : 'Phải'} · hàng ${picture.row}`} value={picture.label} onChange={label => commit({ ...part, pictures: part.pictures.map(item => item.id === picture.id ? { ...item, label } : item) })} /><label className="space-y-1"><span className="text-xs font-black text-slate-700">Offset dọc cạnh hướng vào giữa</span><input type="range" min="0" max="1" step="0.01" value={picture.anchorOffset} onChange={event => commit({ ...part, pictures: part.pictures.map(item => item.id === picture.id ? { ...item, anchorOffset: clampOffset(Number(event.target.value)) } : item) })} className="w-full" /></label></div>)}
        <ListeningRegionEditor imageUrl={assetUrl(part.boardAssetId)} items={part.pictures.map(picture => ({ id: picture.id, label: picture.label, region: picture.region }))} onChange={items => commit({ ...part, pictures: part.pictures.map(picture => ({ ...picture, region: items.find(item => item.id === picture.id)?.region || picture.region })) })} />
      </section>
      <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
        <h4 className="text-sm font-black text-slate-800">Example và 5 mapping riêng tư</h4>
        <div className="grid gap-3 md:grid-cols-3"><label className="space-y-1"><span className="text-xs font-black">Example answer</span><select value={part.exampleConnection.answerId} onChange={event => commit({ ...part, exampleConnection: { ...part.exampleConnection, answerId: event.target.value } })} className="w-full rounded-xl border p-2"><option value="">—</option>{part.answers.map(answer => <option key={answer.id} value={answer.id}>{answer.label}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-black">Example picture</span><select value={part.exampleConnection.pictureId} onChange={event => commit({ ...part, exampleConnection: { ...part.exampleConnection, pictureId: event.target.value } })} className="w-full rounded-xl border p-2"><option value="">—</option>{part.pictures.map(picture => <option key={picture.id} value={picture.id}>{picture.side} {picture.row}</option>)}</select></label><label className="flex items-end gap-2 pb-2 text-xs font-black"><input type="checkbox" checked={part.exampleConnection.renderOverlayLine} onChange={event => commit({ ...part, exampleConnection: { ...part.exampleConnection, renderOverlayLine: event.target.checked } })} /> Vẽ overlay example (mặc định tắt)</label></div>
        {connectionRows.map((connection, index) => <div key={index} className="grid gap-2 md:grid-cols-2"><select value={connection.answerId} onChange={event => updateConnection(index, { answerId: event.target.value })} className="rounded-xl border p-2 text-xs"><option value="">Answer câu {index + 1}</option>{part.answers.filter(answer => answer.id !== part.exampleConnection.answerId).map(answer => <option key={answer.id} value={answer.id}>{answer.label}</option>)}</select><select value={connection.pictureId} onChange={event => updateConnection(index, { pictureId: event.target.value })} className="rounded-xl border p-2 text-xs"><option value="">Picture câu {index + 1}</option>{part.pictures.filter(picture => picture.id !== part.exampleConnection.pictureId).map(picture => <option key={picture.id} value={picture.id}>{picture.side} {picture.row}</option>)}</select></div>)}
        <label className="block space-y-1"><span className="text-xs font-black">Answer nhiễu</span><select value={part.distractorAnswerId} onChange={event => commit({ ...part, distractorAnswerId: event.target.value })} className="w-full rounded-xl border p-2 text-xs"><option value="">—</option>{part.answers.filter(answer => answer.id !== part.exampleConnection.answerId).map(answer => <option key={answer.id} value={answer.id}>{answer.label}</option>)}</select></label>
      </section>
    </div>
  );
}

export default function MoverPart3Editor(props: MoverPartEditorProps<ListeningPart3>) {
  const { part, token, assets, assetUrl, smartImportCapability, importCandidate, onImportCandidateChange, onImportCandidateApplied, onUpload, onChange } = props;
  const candidate = importCandidate?.part === 3 && importCandidate.data.part === 3 ? importCandidate : undefined;
  const candidateData = candidate?.data.part === 3 ? candidate.data : undefined;
  const candidateQuestionAssetId = candidate ? smartImportSourceAssetId(candidate, 'question') : undefined;
  const updateCandidateData = (next: NonNullable<typeof candidateData>) => {
    if (candidate) onImportCandidateChange({ ...candidate, data: next });
  };
  const applyCandidate = async () => {
    if (!candidate || candidate.data.part !== 3) return;
    const data = candidate.data;
    const normalized = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en');
    const answerLabels = data.answers.map(answer => normalized(answer.label));
    const pictureSlots = data.pictures.map(picture => `${picture.side}:${picture.row}`);
    const scoredLabels = data.connections.map(connection => normalized(connection.answerLabel));
    const scoredSlots = data.connections.map(connection => `${connection.pictureSide}:${connection.pictureRow}`);
    const exampleLabel = normalized(data.example?.answerLabel || '');
    const exampleSlot = data.example ? `${data.example.pictureSide}:${data.example.pictureRow}` : '';
    if (
      data.answers.length !== 7 || new Set(answerLabels).size !== 7
      || data.pictures.length !== 6 || new Set(pictureSlots).size !== 6
      || !data.example || data.connections.length !== 5 || !data.distractorLabel
      || new Set(scoredLabels).size !== 5 || new Set(scoredSlots).size !== 5
      || scoredLabels.includes(exampleLabel) || scoredSlots.includes(exampleSlot)
    ) {
      window.alert('Candidate Part 3 chưa đủ 7 answer, 6 picture, example, 5 mapping duy nhất và 1 distractor. Hãy chỉnh candidate trước khi áp dụng.');
      return;
    }
    if (await hashListeningPart(part) !== candidate.basePartHash) {
      window.alert('Part 3 đã thay đổi sau khi phân tích. Hãy phân tích lại để tránh ghi đè dữ liệu mới.');
      return;
    }
    const questionAssetId = smartImportSourceAssetId(candidate, 'question');
    if (!questionAssetId) return;
    onChange(applyPart3ConnectAnalysis(part, candidate.data, questionAssetId));
    onImportCandidateChange(undefined);
    onImportCandidateApplied();
  };
  return (
    <div className="space-y-5">
      <MoverPartBaseEditor {...props} />
      <SmartImportPanel token={token} part={part} assets={assets} capability={smartImportCapability} candidate={candidate} onCandidateChange={onImportCandidateChange} onUpload={onUpload} analyzeLabel="Phân tích ảnh đề + ảnh đáp án Part 3" analyzedNotice="Đã tạo candidate. Hãy kiểm tra example, 7 answer, 6 picture và 5 mapping trước khi áp dụng.">
        {candidateData && <div className="space-y-4">
          <p className="text-xs font-bold text-slate-700">Nhận diện {candidateData.answers.length} answer, {candidateData.pictures.length} picture, {candidateData.connections.length} mapping chấm điểm. Example được tách riêng và không tính vào 5 câu.</p>
          <div className="grid gap-2 md:grid-cols-2">{candidateData.answers.map((answer, index) => <div key={index} className="grid gap-2 rounded-xl border bg-slate-50 p-2 sm:grid-cols-[1fr_90px_90px]"><EditorField label={`Answer ${index + 1}`} value={answer.label} onChange={label => updateCandidateData({ ...candidateData, answers: candidateData.answers.map((item, itemIndex) => itemIndex === index ? { ...item, label } : item) })} />{(['leftAnchorOffset', 'rightAnchorOffset'] as const).map(field => <label key={field} className="space-y-1"><span className="text-[9px] font-black">{field === 'leftAnchorOffset' ? 'Cạnh trái' : 'Cạnh phải'}</span><input type="number" min="0" max="1" step="0.01" value={answer[field]} onChange={event => updateCandidateData({ ...candidateData, answers: candidateData.answers.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: clampOffset(Number(event.target.value)) } : item) })} className="w-full rounded-lg border p-2 text-xs" /></label>)}</div>)}</div>
          {candidateData.answers.length > 0 && <ListeningRegionEditor imageUrl={assetUrl(candidateQuestionAssetId)} items={candidateData.answers.map((answer, index) => ({ id: `candidate-answer-${index}`, label: answer.label, region: answer.region }))} onChange={items => updateCandidateData({ ...candidateData, answers: candidateData.answers.map((answer, index) => ({ ...answer, region: items[index]?.region || answer.region })) })} />}
          <div className="grid gap-2 md:grid-cols-2">{candidateData.pictures.map((picture, index) => <div key={index} className="grid gap-2 rounded-xl border bg-slate-50 p-2 sm:grid-cols-[1fr_100px_80px_90px]"><EditorField label={`Picture ${index + 1}`} value={picture.label} onChange={label => updateCandidateData({ ...candidateData, pictures: candidateData.pictures.map((item, itemIndex) => itemIndex === index ? { ...item, label } : item) })} /><select value={picture.side} onChange={event => updateCandidateData({ ...candidateData, pictures: candidateData.pictures.map((item, itemIndex) => itemIndex === index ? { ...item, side: event.target.value as 'left' | 'right' } : item) })} className="self-end rounded-lg border p-2 text-xs"><option value="left">left</option><option value="right">right</option></select><select value={picture.row} onChange={event => updateCandidateData({ ...candidateData, pictures: candidateData.pictures.map((item, itemIndex) => itemIndex === index ? { ...item, row: Number(event.target.value) as 1 | 2 | 3 } : item) })} className="self-end rounded-lg border p-2 text-xs">{[1, 2, 3].map(row => <option key={row}>{row}</option>)}</select><label className="space-y-1"><span className="text-[9px] font-black">Offset cạnh</span><input type="number" min="0" max="1" step="0.01" value={picture.anchorOffset} onChange={event => updateCandidateData({ ...candidateData, pictures: candidateData.pictures.map((item, itemIndex) => itemIndex === index ? { ...item, anchorOffset: clampOffset(Number(event.target.value)) } : item) })} className="w-full rounded-lg border p-2 text-xs" /></label></div>)}</div>
          {candidateData.pictures.length > 0 && <ListeningRegionEditor imageUrl={assetUrl(candidateQuestionAssetId)} items={candidateData.pictures.map((picture, index) => ({ id: `candidate-picture-${index}`, label: picture.label, region: picture.region }))} onChange={items => updateCandidateData({ ...candidateData, pictures: candidateData.pictures.map((picture, index) => ({ ...picture, region: items[index]?.region || picture.region })) })} />}
          <div className="grid gap-2 md:grid-cols-2"><label className="space-y-1"><span className="text-xs font-black">Example answer</span><select value={candidateData.example?.answerLabel || ''} onChange={event => updateCandidateData({ ...candidateData, example: { answerLabel: event.target.value, pictureSide: candidateData.example?.pictureSide || 'left', pictureRow: candidateData.example?.pictureRow || 1, renderOverlayLine: candidateData.example?.renderOverlayLine || false } })} className="w-full rounded-xl border p-2 text-xs"><option value="">—</option>{candidateData.answers.map(answer => <option key={answer.label} value={answer.label}>{answer.label}</option>)}</select></label><label className="space-y-1"><span className="text-xs font-black">Example picture</span><select value={candidateData.example ? `${candidateData.example.pictureSide}:${candidateData.example.pictureRow}` : ''} onChange={event => { const [pictureSide, rawRow] = event.target.value.split(':'); updateCandidateData({ ...candidateData, example: { answerLabel: candidateData.example?.answerLabel || '', pictureSide: pictureSide as 'left' | 'right', pictureRow: Number(rawRow) as 1 | 2 | 3, renderOverlayLine: candidateData.example?.renderOverlayLine || false } }); }} className="w-full rounded-xl border p-2 text-xs"><option value="">—</option>{candidateData.pictures.map(picture => <option key={`${picture.side}:${picture.row}`} value={`${picture.side}:${picture.row}`}>{picture.side} {picture.row}</option>)}</select></label></div>
          {Array.from({ length: 5 }, (_, index) => candidateData.connections[index] || { answerLabel: '', pictureSide: 'left' as const, pictureRow: 1 as const }).map((connection, index, rows) => <div key={index} className="grid gap-2 md:grid-cols-2"><select value={connection.answerLabel} onChange={event => updateCandidateData({ ...candidateData, connections: rows.map((row, rowIndex) => rowIndex === index ? { ...row, answerLabel: event.target.value } : row) })} className="rounded-xl border p-2 text-xs"><option value="">Scored answer {index + 1}</option>{candidateData.answers.map(answer => <option key={answer.label} value={answer.label}>{answer.label}</option>)}</select><select value={`${connection.pictureSide}:${connection.pictureRow}`} onChange={event => { const [pictureSide, rawRow] = event.target.value.split(':'); updateCandidateData({ ...candidateData, connections: rows.map((row, rowIndex) => rowIndex === index ? { ...row, pictureSide: pictureSide as 'left' | 'right', pictureRow: Number(rawRow) as 1 | 2 | 3 } : row) }); }} className="rounded-xl border p-2 text-xs">{candidateData.pictures.map(picture => <option key={`${picture.side}:${picture.row}`} value={`${picture.side}:${picture.row}`}>{picture.side} {picture.row}</option>)}</select></div>)}
          <label className="block space-y-1"><span className="text-xs font-black">Distractor answer</span><select value={candidateData.distractorLabel || ''} onChange={event => updateCandidateData({ ...candidateData, distractorLabel: event.target.value })} className="w-full rounded-xl border p-2 text-xs"><option value="">—</option>{candidateData.answers.map(answer => <option key={answer.label} value={answer.label}>{answer.label}</option>)}</select></label>
          <button type="button" onClick={() => void applyCandidate()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Validate và áp dụng candidate vào Part 3</button>
        </div>}
      </SmartImportPanel>
      {part.displayMode === 'connect-image' ? <ConnectPart3Editor part={part} props={props} /> : <LegacyPart3Editor part={part} props={props} />}
    </div>
  );
}

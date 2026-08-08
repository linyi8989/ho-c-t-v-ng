import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ListeningPart5, ListeningPart5Legacy, ListeningPart5SceneColourDraw } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import { ListeningRegionEditor } from '../../../../listening/admin/ListeningRegionEditor';
import FixedRegionEditor from '../../../../listening-editor/regions/FixedRegionEditor';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import { hashListeningPart } from '../../../../listening-editor/smart-import/hash';
import { smartImportSourceAssetId } from '../../../../listening-editor/smart-import/types';
import { createMoverDefaultRegion, createMoverEditorId } from './editorUtilities';
import { applyPart5SceneAnalysis } from './directImport';
import { EditorField, MoverPartBaseEditor, type MoverPartEditorProps } from './shared';

function LegacyPart5Editor({ part, props }: { part: ListeningPart5Legacy; props: MoverPartEditorProps<ListeningPart5> }) {
  const { assets, assetUrl, aiCapability, onUpload, onChange } = props;
  const commit = (next: ListeningPart5Legacy) => onChange(next);
  return <div className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
    <p className="text-xs font-bold text-amber-800">Dữ liệu Part 5 legacy vẫn được hỗ trợ. Smart Import mới sẽ chuyển riêng Part 5 sang scene-colour-draw.</p>
    <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Tranh tô màu Part 5" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => commit({ ...part, sceneAssetId })} />
    <div className="grid gap-3 md:grid-cols-5">{part.targets.map((target, index) => <label key={target.id} className="space-y-1 rounded-xl border bg-white p-3"><span className="text-xs font-black">Đáp án màu {index + 1}</span><select value={target.correctColourId} onChange={event => commit({ ...part, targets: part.targets.map(item => item.id === target.id ? { ...item, correctColourId: event.target.value } : item) })} className="w-full rounded-xl border p-2 text-xs">{part.colours.map(colour => <option key={colour.id} value={colour.id}>{colour.label}</option>)}</select></label>)}</div>
    <FixedRegionEditor imageUrl={assetUrl(part.sceneAssetId)} items={part.targets.map(target => ({ id: target.id, label: target.label, region: target.region }))} onChange={items => commit({ ...part, targets: part.targets.map(target => ({ ...target, region: items.find(item => item.id === target.id)?.region || target.region })) })} />
  </div>;
}

function ScenePart5Editor({ part, props }: { part: ListeningPart5SceneColourDraw; props: MoverPartEditorProps<ListeningPart5> }) {
  const { assets, assetUrl, aiCapability, onUpload, onChange } = props;
  const commit = (next: ListeningPart5SceneColourDraw) => onChange(next);
  const addObject = () => commit({ ...part, interactiveObjects: [...part.interactiveObjects, { id: createMoverEditorId('p5-object'), label: 'Object mới', geometry: createMoverDefaultRegion(part.interactiveObjects.length), interactionKinds: ['colour'] }] });
  const addPaletteItem = () => commit({ ...part, objectPalette: [...part.objectPalette, { id: createMoverEditorId('p5-token'), objectType: 'object', label: 'Lựa chọn mới' }] });
  const updateQuestion = (questionId: string, updater: (question: ListeningPart5SceneColourDraw['questions'][number]) => ListeningPart5SceneColourDraw['questions'][number]) => commit({ ...part, questions: part.questions.map(question => question.id === questionId ? updater(question) : question) });
  const placeActions = part.questions.flatMap(question => question.actions.filter(action => action.type === 'place_object').map(action => ({ id: action.id, label: `${question.questionNumber}. ${question.staffPrompt}`, region: action.targetRegion })));
  return <div className="space-y-5">
    <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Ảnh đề bài Part 5" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => commit({ ...part, sceneAssetId })} />
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between"><div><h4 className="text-sm font-black">Public geometry · vùng có thể tương tác</h4><p className="text-[10px] font-semibold text-slate-500">Các vùng này chỉ dùng render/tương tác, không cho biết object nào là đáp án.</p></div><button type="button" onClick={addObject} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"><Plus size={13} className="inline" /> Thêm object</button></div>
      <div className="grid gap-2 md:grid-cols-2">{part.interactiveObjects.map((object, index) => <div key={object.id} className="flex items-end gap-2 rounded-xl border bg-white p-3"><div className="flex-1"><EditorField label={`Object ${index + 1}`} value={object.label} onChange={label => commit({ ...part, interactiveObjects: part.interactiveObjects.map(item => item.id === object.id ? { ...item, label } : item) })} /></div><button type="button" onClick={() => commit({ ...part, interactiveObjects: part.interactiveObjects.filter(item => item.id !== object.id) })} className="rounded-lg p-2 text-rose-600" aria-label="Xóa object"><Trash2 size={16} /></button></div>)}</div>
      {part.interactiveObjects.length > 0 && <ListeningRegionEditor imageUrl={assetUrl(part.sceneAssetId)} items={part.interactiveObjects.map(object => ({ id: object.id, label: object.label, region: object.geometry }))} onChange={items => commit({ ...part, interactiveObjects: part.interactiveObjects.map(object => ({ ...object, geometry: items.find(item => item.id === object.id)?.region || object.geometry })) })} />}
    </section>
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between"><div><h4 className="text-sm font-black">Object palette cho place_object</h4><p className="text-[10px] font-semibold text-slate-500">Mỗi loại object dùng trong đáp án cần ít nhất một lựa chọn nhiễu cùng loại.</p></div><button type="button" onClick={addPaletteItem} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"><Plus size={13} className="inline" /> Thêm lựa chọn</button></div>
      {part.objectPalette.map((item, index) => <div key={item.id} className="grid gap-3 rounded-xl border bg-white p-3 lg:grid-cols-[1fr_1fr_180px_1.2fr_40px]"><EditorField label={`Nhãn ${index + 1}`} value={item.label} onChange={label => commit({ ...part, objectPalette: part.objectPalette.map(entry => entry.id === item.id ? { ...entry, label } : entry) })} /><EditorField label="Loại object" value={item.objectType} onChange={objectType => commit({ ...part, objectPalette: part.objectPalette.map(entry => entry.id === item.id ? { ...entry, objectType } : entry) })} /><label className="space-y-1"><span className="text-xs font-black">Màu (nếu có)</span><select value={item.colourId || ''} onChange={event => commit({ ...part, objectPalette: part.objectPalette.map(entry => entry.id === item.id ? { ...entry, colourId: event.target.value || undefined } : entry) })} className="w-full rounded-xl border p-2.5 text-xs"><option value="">Không màu</option>{part.colours.map(colour => <option key={colour.id} value={colour.id}>{colour.label}</option>)}</select></label><ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Ảnh token" kind="image" value={item.tokenAssetId} onChange={tokenAssetId => commit({ ...part, objectPalette: part.objectPalette.map(entry => entry.id === item.id ? { ...entry, tokenAssetId } : entry) })} /><button type="button" onClick={() => commit({ ...part, objectPalette: part.objectPalette.filter(entry => entry.id !== item.id) })} className="self-end rounded-lg p-2 text-rose-600" aria-label="Xóa lựa chọn"><Trash2 size={16} /></button></div>)}
    </section>
    <section className="space-y-4">
      {part.questions.map(question => <div key={question.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-end gap-3"><div className="flex-1"><EditorField label={`Câu ${question.questionNumber}`} value={question.staffPrompt} onChange={staffPrompt => updateQuestion(question.id, current => ({ ...current, staffPrompt }))} /></div><button type="button" onClick={() => updateQuestion(question.id, current => ({ ...current, actions: [...current.actions, { id: createMoverEditorId('p5-action'), type: 'colour_object', correctObjectId: part.interactiveObjects[0]?.id || '', correctColourId: part.colours[0]?.id || '' }] }))} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700">+ Tô màu</button><button type="button" onClick={() => updateQuestion(question.id, current => ({ ...current, actions: [...current.actions, { id: createMoverEditorId('p5-action'), type: 'place_object', correctPaletteItemId: part.objectPalette[0]?.id || '', targetRegion: createMoverDefaultRegion(current.actions.length) }] }))} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">+ Đặt hình</button></div>
        {question.actions.map((action, actionIndex) => <div key={action.id} className="grid gap-2 rounded-xl border bg-slate-50 p-3 md:grid-cols-[120px_1fr_1fr_40px]"><span className="self-center text-xs font-black">Action {actionIndex + 1}<br />{action.type}</span>{action.type === 'colour_object' ? <><label className="space-y-1"><span className="text-[10px] font-black">Object đúng</span><select value={action.correctObjectId} onChange={event => updateQuestion(question.id, current => ({ ...current, actions: current.actions.map(item => item.id === action.id && item.type === 'colour_object' ? { ...item, correctObjectId: event.target.value } : item) }))} className="w-full rounded-xl border p-2 text-xs"><option value="">—</option>{part.interactiveObjects.map(object => <option key={object.id} value={object.id}>{object.label}</option>)}</select></label><label className="space-y-1"><span className="text-[10px] font-black">Màu đúng</span><select value={action.correctColourId} onChange={event => updateQuestion(question.id, current => ({ ...current, actions: current.actions.map(item => item.id === action.id && item.type === 'colour_object' ? { ...item, correctColourId: event.target.value } : item) }))} className="w-full rounded-xl border p-2 text-xs">{part.colours.map(colour => <option key={colour.id} value={colour.id}>{colour.label}</option>)}</select></label></> : <><label className="space-y-1"><span className="text-[10px] font-black">Palette item đúng</span><select value={action.correctPaletteItemId} onChange={event => updateQuestion(question.id, current => ({ ...current, actions: current.actions.map(item => item.id === action.id && item.type === 'place_object' ? { ...item, correctPaletteItemId: event.target.value } : item) }))} className="w-full rounded-xl border p-2 text-xs"><option value="">—</option>{part.objectPalette.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><EditorField label="Quan hệ/vị trí" value={action.relationLabel || ''} onChange={relationLabel => updateQuestion(question.id, current => ({ ...current, actions: current.actions.map(item => item.id === action.id && item.type === 'place_object' ? { ...item, relationLabel } : item) }))} /></>}<button type="button" onClick={() => updateQuestion(question.id, current => ({ ...current, actions: current.actions.filter(item => item.id !== action.id) }))} className="self-center rounded-lg p-2 text-rose-600" aria-label="Xóa action"><Trash2 size={16} /></button></div>)}
      </div>)}
      {placeActions.length > 0 && <div className="space-y-2"><p className="text-xs font-black text-rose-700">Private answer geometry · chỉ staff/backend dùng</p><ListeningRegionEditor imageUrl={assetUrl(part.sceneAssetId)} items={placeActions} onChange={items => commit({ ...part, questions: part.questions.map(question => ({ ...question, actions: question.actions.map(action => action.type === 'place_object' ? { ...action, targetRegion: items.find(item => item.id === action.id)?.region || action.targetRegion } : action) })) })} /></div>}
    </section>
  </div>;
}

export default function MoverPart5Editor(props: MoverPartEditorProps<ListeningPart5>) {
  const { part, token, assets, smartImportCapability, importCandidate, onImportCandidateChange, onImportCandidateApplied, onUpload, onChange } = props;
  const candidate = importCandidate?.part === 5 && importCandidate.data.part === 5 ? importCandidate : undefined;
  const applyCandidate = async () => {
    if (!candidate || candidate.data.part !== 5) return;
    if (await hashListeningPart(part) !== candidate.basePartHash) {
      window.alert('Part 5 đã thay đổi sau khi phân tích. Hãy phân tích lại để tránh ghi đè draft mới.');
      return;
    }
    const sceneAssetId = smartImportSourceAssetId(candidate, 'question');
    if (!sceneAssetId) return;
    onChange(applyPart5SceneAnalysis(part, candidate.data, sceneAssetId));
    onImportCandidateChange(undefined);
    onImportCandidateApplied();
  };
  return <div className="space-y-5">
    <MoverPartBaseEditor {...props} />
    <SmartImportPanel token={token} part={part} assets={assets} capability={smartImportCapability} candidate={candidate} onCandidateChange={onImportCandidateChange} onUpload={onUpload} analyzeLabel="Phân tích ảnh đề + ảnh đáp án Part 5" analyzedNotice="Candidate giữ số action AI đọc được theo từng câu; action cũ không match chắc chắn vẫn được giữ khi áp dụng.">
      {candidate?.data.part === 5 && <div className="space-y-3"><p className="text-xs font-bold text-slate-700">Nhận diện {candidate.data.interactiveObjects.length} object công khai, {candidate.data.paletteItems.length} palette item và {candidate.data.questions.reduce((total, question) => total + question.actions.length, 0)} action.</p><button type="button" onClick={() => void applyCandidate()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Áp dụng candidate vào Part 5</button></div>}
    </SmartImportPanel>
    {part.displayMode === 'scene-colour-draw' ? <ScenePart5Editor part={part} props={props} /> : <LegacyPart5Editor part={part} props={props} />}
  </div>;
}

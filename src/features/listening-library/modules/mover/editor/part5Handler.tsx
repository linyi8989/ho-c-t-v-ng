import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  ListeningPart5,
  ListeningPart5Action,
  ListeningPart5Legacy,
  ListeningPart5SceneColourDraw,
  ListeningRegion,
} from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import { ListeningRegionEditor } from '../../../../listening/admin/ListeningRegionEditor';
import FixedRegionEditor from '../../../../listening-editor/regions/FixedRegionEditor';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import { smartImportSourceAssetId, type ListeningSmartImportCandidate } from '../../../../listening-editor/smart-import/types';
import { createMoverDefaultRegion, createMoverEditorId } from './editorUtilities';
import { Part5SceneEditor } from './Part5SceneEditor';
import { applyPart5SceneAnalysis } from './directImport';
import { EditorField, MoverPartBaseEditor, type MoverPartEditorProps } from './shared';

const previewRegionStyle = (region: ListeningRegion): React.CSSProperties => ({
  left: `${region.x * 100}%`,
  top: `${region.y * 100}%`,
  width: `${region.width * 100}%`,
  height: `${region.height * 100}%`,
  borderRadius: region.shape === 'ellipse' ? '999px' : '8px',
  clipPath: region.shape === 'polygon' && region.points?.length
    ? `polygon(${region.points.map(point => `${((point.x - region.x) / Math.max(region.width, .0001)) * 100}% ${((point.y - region.y) / Math.max(region.height, .0001)) * 100}%`).join(',')})`
    : undefined,
});

function LegacyPart5Editor({ part, props }: { part: ListeningPart5Legacy; props: MoverPartEditorProps<ListeningPart5> }) {
  const { assets, assetUrl, aiCapability, onUpload, onChange } = props;
  const commit = (next: ListeningPart5Legacy) => onChange(next);
  return <div className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
    <p className="text-xs font-bold text-amber-800">Dữ liệu Part 5 legacy vẫn mở, chơi và chấm theo schema cũ.</p>
    <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Tranh tô màu Part 5" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => commit({ ...part, sceneAssetId })} />
    <div className="grid gap-3 md:grid-cols-5">{part.targets.map((target, index) => <label key={target.id} className="space-y-1 rounded-xl border bg-white p-3"><span className="text-xs font-black">Đáp án màu {index + 1}</span><select value={target.correctColourId} onChange={event => commit({ ...part, targets: part.targets.map(item => item.id === target.id ? { ...item, correctColourId: event.target.value } : item) })} className="w-full rounded-xl border p-2 text-xs">{part.colours.map(colour => <option key={colour.id} value={colour.id}>{colour.label}</option>)}</select></label>)}</div>
    <FixedRegionEditor imageUrl={assetUrl(part.sceneAssetId)} items={part.targets.map(target => ({ id: target.id, label: target.label, region: target.region }))} onChange={items => commit({ ...part, targets: part.targets.map(target => ({ ...target, region: items.find(item => item.id === target.id)?.region || target.region })) })} />
  </div>;
}

function upgradeScenePart5(part: ListeningPart5SceneColourDraw): ListeningPart5SceneColourDraw | undefined {
  const usedColourIds = part.questions.flatMap(question => question.actions.flatMap(action => action.type === 'colour_object' ? [action.correctColourId] : []));
  const colourPaletteIds = [...new Set([
    ...usedColourIds,
    ...(part.colourPaletteIds || []),
    ...part.colours.map(colour => colour.id),
  ].filter(id => part.colours.some(colour => colour.id === id)))].slice(0, 6);
  const usedPaletteIds = [...new Set(part.questions.flatMap(question => question.actions.flatMap(action => action.type === 'place_object' ? [action.correctPaletteItemId] : [])))];
  if (usedPaletteIds.length > 2) return undefined;
  const paletteById = new Map(part.objectPalette.map(item => [item.id, item]));
  const objectPalette = [...usedPaletteIds.map(id => paletteById.get(id)).filter(Boolean), ...part.objectPalette.filter(item => !usedPaletteIds.includes(item.id))]
    .slice(0, 3) as ListeningPart5SceneColourDraw['objectPalette'];
  while (objectPalette.length < 3) {
    const index = objectPalette.length;
    objectPalette.push({
      id: createMoverEditorId('p5-token'),
      objectType: `draw-object-${index + 1}`,
      label: index === 2 ? 'Vật nhiễu' : `Vật ${index + 1}`,
    });
  }
  return { ...part, interactionSchemaVersion: 2, colourPaletteIds, objectPalette };
}

function ScenePart5Editor({ part, props }: { part: ListeningPart5SceneColourDraw; props: MoverPartEditorProps<ListeningPart5> }) {
  const { assets, assetUrl, aiCapability, onUpload, onChange } = props;
  const commit = (next: ListeningPart5SceneColourDraw) => onChange(next);
  const paletteColourIds = part.colourPaletteIds || [];
  const paletteColours = paletteColourIds.flatMap(id => {
    const colour = part.colours.find(item => item.id === id);
    return colour ? [colour] : [];
  });
  const updateQuestion = (questionId: string, updater: (question: ListeningPart5SceneColourDraw['questions'][number]) => ListeningPart5SceneColourDraw['questions'][number]) => commit({ ...part, questions: part.questions.map(question => question.id === questionId ? updater(question) : question) });
  const addColourAction = (questionId: string) => {
    const objectId = createMoverEditorId('p5-object');
    const action: ListeningPart5Action = { id: createMoverEditorId('p5-action'), type: 'colour_object', correctObjectId: objectId, correctColourId: paletteColourIds[0] || '' };
    commit({
      ...part,
      interactiveObjects: [...part.interactiveObjects, { id: objectId, label: 'Vật cần tô', geometry: createMoverDefaultRegion(part.interactiveObjects.length), interactionKinds: ['colour'], geometryConfirmedByTeacher: false }],
      questions: part.questions.map(question => question.id === questionId ? { ...question, actions: [...question.actions, action] } : question),
    });
  };
  const addPlaceAction = (questionId: string) => updateQuestion(questionId, question => ({
    ...question,
    actions: [...question.actions, { id: createMoverEditorId('p5-action'), type: 'place_object', correctPaletteItemId: part.objectPalette[0]?.id || '', targetRegion: createMoverDefaultRegion(question.actions.length), geometryConfirmedByTeacher: false }],
  }));
  const removeAction = (questionId: string, action: ListeningPart5Action) => {
    const nextQuestions = part.questions.map(question => question.id === questionId ? { ...question, actions: question.actions.filter(item => item.id !== action.id) } : question);
    const referencedObjectIds = new Set(nextQuestions.flatMap(question => question.actions.flatMap(item => item.type === 'colour_object' ? [item.correctObjectId] : [])));
    commit({ ...part, questions: nextQuestions, interactiveObjects: part.interactiveObjects.filter(object => referencedObjectIds.has(object.id)) });
  };
  const colourMaskItems = part.interactiveObjects.map(object => ({ id: object.id, label: object.label, region: object.geometry }));
  const placeActions = part.questions.flatMap(question => question.actions.filter(action => action.type === 'place_object').map(action => ({ id: action.id, label: `${question.questionNumber}. ${question.staffPrompt}`, region: action.targetRegion })));

  return <div className="space-y-5">
    <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Ảnh đề bài · hiển thị cho học sinh" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => commit({ ...part, sceneAssetId })} />

    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div><h4 className="text-sm font-black text-emerald-950">6 màu cho học sinh</h4><p className="text-[11px] font-semibold text-emerald-800">Chọn 5 màu dùng trong bài và 1 màu nhiễu. Mỗi màu chỉ được chọn một lần.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{Array.from({ length: 6 }, (_, index) => {
        const colourId = paletteColourIds[index] || '';
        const colour = part.colours.find(item => item.id === colourId);
        return <label key={index} className="space-y-2 rounded-xl border bg-white p-3"><span className="text-[11px] font-black">Màu {index + 1}{index === 5 ? ' · nhiễu' : ''}</span><select value={colourId} onChange={event => commit({ ...part, colourPaletteIds: Array.from({ length: 6 }, (_, slot) => slot === index ? event.target.value : paletteColourIds[slot] || '') })} className="w-full rounded-lg border p-2 text-xs"><option value="">— Chọn màu —</option>{part.colours.map(item => <option key={item.id} value={item.id} disabled={paletteColourIds.some((selectedId, slot) => slot !== index && selectedId === item.id)}>{item.label}</option>)}</select>{colour && <span className="block h-6 rounded-lg border" style={{ backgroundColor: colour.value }} />}</label>;
      })}</div>
    </section>

    <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
      <div><h4 className="text-sm font-black text-sky-950">3 vật để kéo thả</h4><p className="text-[11px] font-semibold text-sky-800">Upload 2 icon PNG dùng làm đáp án và 1 icon PNG nhiễu. Nền trong suốt được khuyến nghị.</p></div>
      <div className="grid gap-3 lg:grid-cols-3">{part.objectPalette.map((item, index) => <div key={item.id} className="space-y-3 rounded-xl border bg-white p-3"><EditorField label={`Tên vật ${index + 1}${index === 2 ? ' · nhiễu' : ''}`} value={item.label} onChange={label => commit({ ...part, objectPalette: part.objectPalette.map(entry => entry.id === item.id ? { ...entry, label, objectType: label.trim() || entry.objectType } : entry) })} /><ListeningAssetPicker assets={assets} aiCapability={{ enabled: false, reason: 'Icon Draw phải do giáo viên upload và xác nhận.' }} onUpload={onUpload} allowedMimeTypes={['image/png']} label={`Icon PNG ${index + 1}`} kind="image" value={item.tokenAssetId} onChange={tokenAssetId => commit({ ...part, objectPalette: part.objectPalette.map(entry => entry.id === item.id ? { ...entry, tokenAssetId } : entry) })} /></div>)}</div>
    </section>

    <section className="space-y-4">
      <div><h4 className="text-sm font-black">5 câu Colour + Draw</h4><p className="text-[11px] font-semibold text-slate-500">Mỗi câu có thể có một hoặc nhiều action. AI chỉ hỗ trợ đọc nội dung; mask và drop-zone luôn do giáo viên vẽ.</p></div>
      {part.questions.map(question => <div key={question.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3"><div className="min-w-64 flex-1"><EditorField label={`Câu ${question.questionNumber}`} value={question.staffPrompt} onChange={staffPrompt => updateQuestion(question.id, current => ({ ...current, staffPrompt }))} /></div><button type="button" onClick={() => addColourAction(question.id)} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700"><Plus size={13} className="inline" /> Colour</button><button type="button" onClick={() => addPlaceAction(question.id)} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700"><Plus size={13} className="inline" /> Draw</button></div>
        {question.actions.map((action, actionIndex) => {
          const object = action.type === 'colour_object' ? part.interactiveObjects.find(item => item.id === action.correctObjectId) : undefined;
          return <div key={action.id} className="grid gap-3 rounded-xl border bg-slate-50 p-3 md:grid-cols-[110px_1fr_1fr_40px]"><span className="self-center text-xs font-black">{action.type === 'colour_object' ? 'Colour' : 'Draw'} {actionIndex + 1}</span>{action.type === 'colour_object' ? <><EditorField label="Vật cần tô" value={object?.label || ''} onChange={label => commit({ ...part, interactiveObjects: part.interactiveObjects.map(item => item.id === action.correctObjectId ? { ...item, label } : item) })} /><label className="space-y-1"><span className="text-xs font-black">Màu đúng</span><select value={action.correctColourId} onChange={event => updateQuestion(question.id, current => ({ ...current, actions: current.actions.map(item => item.id === action.id && item.type === 'colour_object' ? { ...item, correctColourId: event.target.value } : item) }))} className="w-full rounded-xl border p-2.5 text-xs"><option value="">— Chọn màu —</option>{paletteColours.map(colour => <option key={colour.id} value={colour.id}>{colour.label}</option>)}</select></label></> : <><label className="space-y-1"><span className="text-xs font-black">Icon đúng</span><select value={action.correctPaletteItemId} onChange={event => updateQuestion(question.id, current => ({ ...current, actions: current.actions.map(item => item.id === action.id && item.type === 'place_object' ? { ...item, correctPaletteItemId: event.target.value } : item) }))} className="w-full rounded-xl border p-2.5 text-xs"><option value="">— Chọn icon —</option>{part.objectPalette.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><EditorField label="Mô tả vị trí" value={action.relationLabel || ''} onChange={relationLabel => updateQuestion(question.id, current => ({ ...current, actions: current.actions.map(item => item.id === action.id && item.type === 'place_object' ? { ...item, relationLabel } : item) }))} /></>}<button type="button" onClick={() => removeAction(question.id, action)} className="self-center rounded-lg p-2 text-rose-600" aria-label="Xóa action"><Trash2 size={16} /></button></div>;
        })}
      </div>)}
    </section>

    {colourMaskItems.length > 0 && <section className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/30 p-4"><div><h4 className="text-sm font-black text-violet-950">Tô vùng đáp án Colour</h4><p className="text-[11px] font-semibold text-violet-800">Vẽ tương đối quanh vật thể; công cụ sẽ bám theo đường viền tối trên ảnh đề để tạo mask sát hình thay vì giữ nguyên nét vẽ nguệch ngoạc.</p></div><ListeningRegionEditor edgeSnap imageUrl={assetUrl(part.sceneAssetId)} items={colourMaskItems} onChange={items => commit({ ...part, interactiveObjects: part.interactiveObjects.map(object => { const next = items.find(item => item.id === object.id)?.region; return next ? { ...object, geometry: next, geometryConfirmedByTeacher: JSON.stringify(next) !== JSON.stringify(object.geometry) ? true : object.geometryConfirmedByTeacher } : object; }) })} /></section>}
    <section className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/30 p-4"><div><h4 className="text-sm font-black text-rose-950">Vị trí Draw đã nhận diện</h4><p className="text-[11px] font-semibold text-rose-800">Vùng có thể đến từ thông số bên ngoài hoặc AI. Vùng này chỉ dùng cho staff/backend và không gửi xuống student.</p></div>{placeActions.length > 0 ? <><div className="relative mx-auto max-w-4xl overflow-hidden rounded-xl border bg-white"><img src={assetUrl(part.sceneAssetId)} alt="Xem trước vị trí Draw" className="block h-auto w-full" />{placeActions.map(item => <div key={item.id} style={previewRegionStyle(item.region)} className="absolute flex items-center justify-center border-2 border-rose-600 bg-rose-300/30 text-[10px] font-black text-rose-950"><span className="rounded bg-white/90 px-1">{item.label}</span></div>)}</div><details className="rounded-xl border border-rose-200 bg-white p-3"><summary className="cursor-pointer text-xs font-black text-rose-800">Chỉnh nâng cao nếu vùng đặt sai vị trí</summary><div className="mt-3"><ListeningRegionEditor imageUrl={assetUrl(part.sceneAssetId)} items={placeActions} onChange={items => commit({ ...part, questions: part.questions.map(question => ({ ...question, actions: question.actions.map(action => { if (action.type !== 'place_object') return action; const next = items.find(item => item.id === action.id)?.region; return next ? { ...action, targetRegion: next, geometryConfirmedByTeacher: JSON.stringify(next) !== JSON.stringify(action.targetRegion) ? true : action.geometryConfirmedByTeacher } : action; }) })) })} /></div></details></> : <div className="rounded-xl border-2 border-dashed border-rose-200 bg-white px-4 py-8 text-center text-xs font-bold text-rose-700">Chưa có vị trí Draw. Nhập targetRegion chắc chắn hoặc chọn vùng thủ công trong editor.</div>}</section>
  </div>;
}

export default function MoverPart5Editor(props: MoverPartEditorProps<ListeningPart5>) {
  const { part, token, assets, smartImportCapability, onImportCandidateChange, onImportCandidateApplied, onUpload, onChange } = props;
  const importAnalysis = (candidate: ListeningSmartImportCandidate) => {
    if (candidate.data.part !== 5) throw new Error('Dữ liệu phân tích không đúng Part 5.');
    const sceneAssetId = smartImportSourceAssetId(candidate, 'question');
    if (!sceneAssetId) throw new Error('Thiếu ảnh đề bài Part 5.');
    onChange(applyPart5SceneAnalysis(part, candidate.data, sceneAssetId));
    onImportCandidateChange(undefined);
    onImportCandidateApplied();
  };
  const migrate = () => {
    if (part.displayMode !== 'scene-colour-draw') return;
    const upgraded = upgradeScenePart5(part);
    if (!upgraded) {
      window.alert('Draft cũ đang dùng hơn 2 icon đáp án. Hãy giữ schema v1 hoặc giảm số icon đúng trước khi chuyển sang palette 3 icon.');
      return;
    }
    onChange(upgraded);
  };
  return <div className="space-y-5">
    <MoverPartBaseEditor {...props} />
    <SmartImportPanel token={token} part={part} assets={assets} capability={smartImportCapability} onCandidateChange={onImportCandidateChange} onAnalyzed={importAnalysis} onUpload={onUpload} analyzeLabel="Phân tích ảnh và nhập Part 5" analyzedNotice="Đã nhập nội dung, màu và gợi ý vị trí Draw vào bài soạn. Hãy tải icon và xác nhận vùng Colour/Draw trực tiếp trong bảng." />
    {part.displayMode === 'scene-colour-draw' && part.interactionSchemaVersion === 1 ? <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-900">Part 5 này đang dùng scene schema v1. Dữ liệu vẫn chơi/chấm bình thường; chuyển sang v2 để dùng workflow 6 màu + 3 icon và geometry do giáo viên xác nhận.</p><button type="button" onClick={migrate} className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-black text-white">Chuyển Part 5 sang Colour + Draw v2</button></div> : part.displayMode === 'scene-colour-draw' ? <Part5SceneEditor part={part} props={props} /> : <LegacyPart5Editor part={part} props={props} />}
  </div>;
}

import { ImageIcon, Upload } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset } from '../../listening/types';
import FileDropPasteInput from '../../listening/shared/FileDropPasteInput';
import FixedRegionEditor from '../../listening-editor/regions/FixedRegionEditor';
import { examPartUnits, replaceExamPartUnit } from '../examStructure';
import type { ExamPartContent } from '../types';
import { FLYER_NAME_REGION_HEIGHT, FLYER_NAME_REGION_WIDTH } from '../flyerListeningMigration';
import { StarterListeningPart4Editor, StarterSpecialPartEditor } from './StarterAuthoring';

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

function FlyerNamePlacementEditor({ part, onChange }: { part: ExamPartContent; onChange: (part: ExamPartContent) => void }) {
  const unit = examPartUnits(part)[0] || part;
  const layout = unit.interactionLayout?.kind === 'flyer-name-placement-v1' ? unit.interactionLayout : undefined;
  if (!layout) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-black text-amber-900">JSON chưa đúng dạng name-scene của Flyers Part {part.part}.</p>;
  const commit = (nextUnit: ExamPartContent) => onChange(replaceExamPartUnit(part, nextUnit));
  const canonical = unit.questions[0]?.options || [];
  const updateName = (optionId: string, value: string) => commit({ ...unit, questions: unit.questions.map(question => ({ ...question, options: question.options.map(option => option.id === optionId ? { ...option, text: value } : option) })) });
  return <div className="space-y-4" data-flyer-authoring={`name-placement-${part.part}`}>
    <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><h4 className="text-sm font-black text-sky-950">Sáu thẻ tên · năm vùng trả lời</h4><p className="mt-1 text-xs font-semibold text-sky-800">Part {part.part} dùng đúng thao tác Movers Listening Part 1. Một tên là nhiễu; example không chấm điểm.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{canonical.slice(0, 6).map((option, index) => <label key={option.id} className="text-xs font-black text-slate-700">Tên {index + 1}<input value={option.text} onChange={event => updateName(option.id, event.target.value)} className={`mt-1 ${fieldClass}`} /></label>)}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="grid gap-2">{unit.questions.map((question, index) => <div key={question.id} className="grid items-center gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[42px_1fr_220px]"><span className="text-xs font-black text-indigo-700">{index + 1}</span><input aria-label={`Nhãn vùng câu ${index + 1}`} value={question.prompt} onChange={event => {
      const prompt = event.target.value;
      commit({ ...unit, questions: unit.questions.map(item => item.id === question.id ? { ...item, prompt } : item), interactionLayout: { ...layout, targets: layout.targets.map(target => target.questionId === question.id ? { ...target, label: prompt } : target) } });
    }} className={fieldClass} /><select aria-label={`Đáp án tên câu ${index + 1}`} value={question.correctOptionIds[0] || ''} onChange={event => commit({ ...unit, questions: unit.questions.map(item => item.id === question.id ? { ...item, correctOptionIds: event.target.value ? [event.target.value] : [] } : item) })} className={fieldClass}><option value="">Chưa chọn đáp án</option>{canonical.slice(0, 6).map(option => <option key={option.id} value={option.id}>{option.text || option.label}</option>)}</select></div>)}</div></section>
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><label className="text-xs font-black text-indigo-900">Example không chấm điểm<input value={unit.examples?.[0]?.prompt || ''} onChange={event => commit({ ...unit, examples: [{ prompt: event.target.value, answer: unit.examples?.[0]?.answer || '' }] })} className={`mt-1 ${fieldClass}`} /></label></section>
    <section><p className="mb-1 text-xs font-black text-slate-700">Năm vùng chữ nhật cố định 1–5</p><p className="mb-2 text-[11px] font-semibold text-slate-500">Tọa độ tương đối được lấy từ JSON. Giáo viên chỉ cần soát lại và kéo ô nếu AI đặt chưa đúng; không có bước xác nhận riêng.</p>{part.imageUrl ? <FixedRegionEditor imageUrl={part.imageUrl} width={FLYER_NAME_REGION_WIDTH} height={FLYER_NAME_REGION_HEIGHT} items={layout.targets.map((target, index) => ({ id: target.id, label: `Vùng ${index + 1} · ${unit.questions[index]?.prompt || target.label}`, region: target.region }))} onChange={items => {
      const nextById = new Map(items.map(item => [item.id, item]));
      const targets = layout.targets.map((target, index) => ({ ...target, label: `Vùng ${index + 1}`, region: nextById.get(target.id)?.region || target.region, geometryConfirmedByTeacher: nextById.has(target.id) || target.geometryConfirmedByTeacher }));
      const ready = targets.every(target => target.geometryConfirmedByTeacher) && Boolean(part.imageAssetId) && Boolean(part.audioAssetId);
      commit({ ...unit, interactionLayout: { ...layout, targets }, interaction: unit.interaction ? { ...unit.interaction, importReadiness: ready ? 'ready-to-publish' : part.imageAssetId && part.audioAssetId ? 'needs-geometry' : 'needs-assets' } : unit.interaction });
    }} /> : <p className="rounded-xl bg-amber-50 p-3 text-xs font-black text-amber-900">Tải ảnh scene phía trên trước khi kiểm tra vùng.</p>}</section>
  </div>;
}

export function FlyerPart3Editor({ token, part, assets, onAssets, onChange }: { token: string; part: ExamPartContent; assets: ListeningAsset[]; onAssets: (asset: ListeningAsset) => void; onChange: (part: ExamPartContent) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const unit = examPartUnits(part)[0] || part;
  const commit = (nextUnit: ExamPartContent) => onChange(replaceExamPartUnit(part, nextUnit));
  const scene = unit.readingScenes?.[0] || { id: `flyer-p3-people-${crypto.randomUUID()}`, passage: '', questionIds: unit.questions.map(question => question.id) };
  const activeImages = assets.filter(asset => asset.kind === 'image' && asset.status === 'active');
  const attach = (asset?: ListeningAsset) => {
    if (asset) onAssets(asset);
    commit({ ...unit, readingScenes: [{ ...scene, imageAssetId: asset?.id, imageUrl: asset?.url, questionIds: unit.questions.map(question => question.id) }] });
  };
  const upload = async (files: File[]) => { if (files[0]) attach(await listeningApi.uploadAsset(token, files[0], 'image')); };
  return <div className="space-y-4" data-flyer-authoring="two-image-letter-input">
    <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="flex items-start gap-2"><ImageIcon size={18} className="text-sky-700" /><div><h4 className="text-sm font-black text-sky-950">Ảnh thứ hai · người/tên và các ô in trên đề</h4><p className="mt-1 text-xs font-semibold text-sky-800">Ảnh lựa chọn A-H dùng trường “Ảnh chung của Part” phía trên. Ảnh này là ảnh riêng ở giữa khi học sinh làm bài.</p></div></div><select value={scene.imageAssetId || ''} onChange={event => attach(activeImages.find(asset => asset.id === event.target.value))} className={`mt-3 ${fieldClass}`}><option value="">Chưa chọn ảnh người/tên</option>{activeImages.map(asset => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}</select><div className="mt-2 flex flex-wrap gap-2"><FileDropPasteInput accept="image/png,image/jpeg,image/webp" pasteImages uploadLabel="Tải/dán ảnh người và tên" onFiles={upload} /><button type="button" onClick={() => inputRef.current?.click()} className="hidden"><Upload size={14} /></button><input ref={inputRef} type="file" className="hidden" /></div></section>
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-black text-indigo-900">Tên example<input value={unit.examples?.[0]?.prompt || ''} onChange={event => commit({ ...unit, examples: [{ prompt: event.target.value, answer: unit.examples?.[0]?.answer || '' }] })} className={`mt-1 ${fieldClass}`} /></label><label className="text-xs font-black text-indigo-900">Chữ cái example A-H<input maxLength={1} value={unit.examples?.[0]?.answer || ''} onChange={event => commit({ ...unit, examples: [{ prompt: unit.examples?.[0]?.prompt || '', answer: event.target.value.toUpperCase().replace(/[^A-H]/g, '').slice(0, 1) }] })} className={`mt-1 ${fieldClass}`} /></label></div></section>
    <section className="space-y-2">{unit.questions.map((question, index) => <div key={question.id} className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[42px_1fr_160px]"><span className="text-xs font-black text-indigo-700">{index + 1}</span><input aria-label={`Tên hàng câu ${index + 1}`} value={question.prompt} onChange={event => commit({ ...unit, questions: unit.questions.map(item => item.id === question.id ? { ...item, prompt: event.target.value } : item) })} className={fieldClass} /><input aria-label={`Đáp án chữ câu ${index + 1}`} maxLength={1} value={question.acceptedAnswers[0] || ''} onChange={event => commit({ ...unit, questions: unit.questions.map(item => item.id === question.id ? { ...item, acceptedAnswers: event.target.value ? [event.target.value.toUpperCase().replace(/[^A-H]/g, '').slice(0, 1)] : [] } : item) })} className={`${fieldClass} text-center uppercase`} placeholder="A-H" /></div>)}</section>
  </div>;
}

function FlyerPart4Editor({ token, part, assets, onAssets, onChange }: { token: string; part: ExamPartContent; assets: ListeningAsset[]; onAssets: (asset: ListeningAsset) => void; onChange: (part: ExamPartContent) => void }) {
  const unit = examPartUnits(part).find(item => item.interaction?.variant === 'image-options') || examPartUnits(part)[0] || part;
  const commit = (nextUnit: ExamPartContent) => onChange(replaceExamPartUnit(part, nextUnit));
  const displayScene = unit.readingScenes?.[0] || { id: `flyer-p4-display-${crypto.randomUUID()}`, passage: '', questionIds: unit.questions.map(question => question.id) };
  const activeImages = assets.filter(asset => asset.kind === 'image' && asset.status === 'active');
  const attachDisplay = (asset?: ListeningAsset) => {
    if (asset) onAssets(asset);
    commit({
      ...unit,
      readingScenes: asset ? [{ ...displayScene, imageAssetId: asset.id, imageUrl: asset.url, questionIds: unit.questions.map(question => question.id) }] : [],
    });
  };
  const uploadDisplay = async (files: File[]) => {
    if (files[0]) attachDisplay(await listeningApi.uploadAsset(token, files[0], 'image'));
  };
  return <div className="space-y-4" data-flyer-authoring="part4-image-options">
    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4" data-flyer-part4-display-image>
      <div className="flex items-start gap-2"><ImageIcon size={18} className="text-orange-700" /><div><h4 className="text-sm font-black text-orange-950">Ảnh hiển thị chung cho học sinh</h4><p className="mt-1 text-xs font-semibold text-orange-800">Ảnh này xuất hiện phía trên năm câu khi làm bài và xem kết quả. Ảnh nguồn crop 15 đáp án được quản lý riêng và không gửi cho học sinh.</p></div></div>
      <select value={displayScene.imageAssetId || ''} onChange={event => attachDisplay(activeImages.find(asset => asset.id === event.target.value))} className={`mt-3 ${fieldClass}`}><option value="">Chưa chọn ảnh hiển thị</option>{activeImages.map(asset => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}</select>
      <div className="mt-2"><FileDropPasteInput accept="image/png,image/jpeg,image/webp" pasteImages uploadLabel="Tải/dán ảnh hiển thị" onFiles={uploadDisplay} /></div>
    </section>
    <StarterSpecialPartEditor token={token} part={unit} assets={assets} onAssets={onAssets} onChange={commit} />
  </div>;
}

function FlyerPart2Editor({ token, part, assets, onAssets, onChange }: { token: string; part: ExamPartContent; assets: ListeningAsset[]; onAssets: (asset: ListeningAsset) => void; onChange: (part: ExamPartContent) => void }) {
  const unit = examPartUnits(part)[0] || part;
  const needsMigration = unit.interaction?.family !== 'text-entry' || unit.interaction.variant !== 'single-input' || unit.questions.some(question => question.type !== 'short-answer' || question.options.length > 0);
  const interaction = { family: 'text-entry' as const, subtype: 'short-answer', variant: 'single-input', schemaVersion: 1, importReadiness: 'needs-assets' as const };
  const normalizedUnit: ExamPartContent = needsMigration ? {
    ...unit,
    interaction,
    interactionLayout: undefined,
    questions: unit.questions.map(question => ({ ...question, type: 'short-answer', options: [], correctOptionIds: [], acceptedAnswers: question.acceptedAnswers || [] })),
  } : unit;
  const commit = (nextUnit: ExamPartContent) => {
    const nextPart = replaceExamPartUnit(part, nextUnit);
    onChange({ ...nextPart, interaction, interactionLayout: undefined });
  };
  useEffect(() => {
    if (needsMigration) commit(normalizedUnit);
  }, [needsMigration, unit.id]);
  return <StarterSpecialPartEditor token={token} part={normalizedUnit} assets={assets} onAssets={onAssets} onChange={commit} />;
}

export default function FlyerListeningAuthoring({ token, part, assets, onAssets, onChange }: { token: string; part: ExamPartContent; assets: ListeningAsset[]; onAssets: (asset: ListeningAsset) => void; onChange: (part: ExamPartContent) => void }) {
  if (part.part === 1) return <FlyerNamePlacementEditor part={part} onChange={onChange} />;
  if (part.part === 2) return <FlyerPart2Editor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} />;
  if (part.part === 3) return <FlyerPart3Editor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} />;
  if (part.part === 4) return <FlyerPart4Editor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} />;
  if (part.part === 5) return <StarterListeningPart4Editor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} pasteDrawTokens />;
  return null;
}

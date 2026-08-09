import React from 'react';
import type { ListeningPart1 } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import FixedRegionEditor from '../../../../listening-editor/regions/FixedRegionEditor';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import type { ListeningSmartImportCandidate } from '../../../../listening-editor/smart-import/types';
import { smartImportSourceAssetId } from '../../../../listening-editor/smart-import/types';
import { EditorField, MoverPartBaseEditor, type MoverPartEditorProps } from './shared';
import { importPart1Analysis } from './directImport';

export default function MoverPart1Editor(props: MoverPartEditorProps<ListeningPart1>) {
  const { part, token, assets, assetUrl, aiCapability, smartImportCapability, onImportCandidateChange, onImportCandidateApplied, onUpload, onChange } = props;
  const importAnalysis = (candidate: ListeningSmartImportCandidate) => {
    if (candidate.data.part !== 1) throw new Error('Dữ liệu AI không đúng Part 1.');
    onChange(importPart1Analysis(part, candidate.data, smartImportSourceAssetId(candidate, 'question')));
    onImportCandidateChange(undefined);
    onImportCandidateApplied();
  };
  const regionItems = part.targets.map((target, index) => ({
    id: target.id,
    label: part.choices.find(choice => choice.id === target.choiceId)?.label || `Vùng ${index + 1}`,
    region: target.region,
  }));
  return <div className="space-y-5">
    <MoverPartBaseEditor {...props} />
    <SmartImportPanel token={token} part={part} assets={assets} capability={smartImportCapability} onCandidateChange={onImportCandidateChange} onAnalyzed={importAnalysis} analyzeLabel="Phân tích ba ảnh và nhập vào Part 1" onUpload={onUpload} />
    <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Tranh tình huống Part 1" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => onChange({ ...part, sceneAssetId })} />
    {part.example && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3"><EditorField label="Tên example (không nằm trong 6 choices)" value={part.example.label || ''} onChange={label => onChange({ ...part, example: part.example ? { ...part.example, label } : undefined })} /></div>}
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{part.choices.map((choice, index) => <div key={choice.id}><EditorField label={`Thẻ tên ${index + 1}${index === 5 ? ' (nhiễu)' : ''}`} value={choice.label} onChange={label => onChange({ ...part, choices: part.choices.map(item => item.id === choice.id ? { ...item, label } : item) })} /></div>)}</div>
    <div className="grid gap-3 md:grid-cols-5">{part.targets.map((target, index) => <label key={target.id} className="space-y-1"><span className="text-xs font-black text-slate-700">Đáp án vùng {index + 1}</span><select value={target.choiceId} onChange={event => onChange({ ...part, targets: part.targets.map(item => item.id === target.id ? { ...item, choiceId: event.target.value } : item) })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">{part.choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>)}</div>
    <FixedRegionEditor imageUrl={assetUrl(part.sceneAssetId)} items={regionItems} onChange={items => onChange({
      ...part,
      targets: part.targets.map(target => ({ ...target, region: items.find(item => item.id === target.id)?.region || target.region })),
    })} />
  </div>;
}

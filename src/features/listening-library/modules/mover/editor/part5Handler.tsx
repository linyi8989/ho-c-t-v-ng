import React from 'react';
import type { ListeningPart5 } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import FixedRegionEditor from '../../../../listening-editor/regions/FixedRegionEditor';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import { hashListeningPart } from '../../../../listening-editor/smart-import/hash';
import { MoverPartBaseEditor, type MoverPartEditorProps } from './shared';
import { findMoverColour, MOVER_COLOUR_CATALOG } from './colourCatalog';

const PART5_REGION_WIDTH = 0.12;
const PART5_REGION_HEIGHT = 0.11;

export default function MoverPart5Editor(props: MoverPartEditorProps<ListeningPart5>) {
  const {
    part,
    token,
    assets,
    assetUrl,
    aiCapability,
    smartImportCapability,
    importCandidate,
    onImportCandidateChange,
    onImportCandidateApplied,
    onUpload,
    onChange,
  } = props;
  const commitPart = (nextPart: ListeningPart5) => onChange({
    ...nextPart,
    targets: nextPart.targets.map(target => ({
      ...target,
      region: {
        shape: 'rect',
        x: Math.max(0, Math.min(1 - PART5_REGION_WIDTH, target.region.x)),
        y: Math.max(0, Math.min(1 - PART5_REGION_HEIGHT, target.region.y)),
        width: PART5_REGION_WIDTH,
        height: PART5_REGION_HEIGHT,
      },
    })),
  });
  const candidate = importCandidate?.part === 5 && importCandidate.data.part === 5
    ? importCandidate
    : undefined;
  const candidateData = candidate?.data.part === 5 ? candidate.data : undefined;
  const updateCandidate = (patch: Partial<NonNullable<typeof candidateData>>) => {
    if (!candidate || !candidateData) return;
    onImportCandidateChange({ ...candidate, data: { ...candidateData, ...patch } });
  };
  const applyCandidate = async () => {
    if (!candidate || !candidateData) return;
    const catalogLabels = part.colours.map(colour => findMoverColour(colour.label, colour.value)?.label);
    if (
      candidateData.anchors.length < 5
      || new Set(candidateData.confirmedTargetIndexes || []).size !== 5
      || new Set(candidateData.provisionalColourIndexes).size !== 5
      || catalogLabels.some(label => !label)
      || new Set(catalogLabels).size !== 6
    ) {
      window.alert('Cần chọn 6 màu preset không trùng, đủ 5 vùng, 5 đáp án màu không trùng và xác nhận thủ công cả 5 trước khi áp dụng.');
      return;
    }
    if (await hashListeningPart(part) !== candidate.basePartHash) {
      window.alert('Part 5 đã thay đổi sau khi phân tích. Hãy tạo lại bản đề xuất.');
      return;
    }
    commitPart({
      ...part,
      sceneAssetId: candidate.sourceImageAssetIds[0] || part.sceneAssetId,
      targets: part.targets.map((target, index) => ({
        ...target,
        label: candidateData.anchors[index]?.label || target.label,
        correctColourId: part.colours[candidateData.provisionalColourIndexes[index]]?.id || target.correctColourId,
        region: candidateData.anchors[index]?.region || target.region,
      })),
    });
    onImportCandidateChange(undefined);
    onImportCandidateApplied();
  };
  const selectedLabels = new Set(part.colours.map(colour => findMoverColour(colour.label, colour.value)?.label).filter(Boolean));

  return (
    <div className="space-y-5">
      <MoverPartBaseEditor {...props} onChange={commitPart} />
      <SmartImportPanel token={token} part={part} assets={assets} capability={smartImportCapability} candidate={candidate} onCandidateChange={onImportCandidateChange} onUpload={onUpload}>
        {candidateData && (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => {
              const confirmed = candidateData.confirmedTargetIndexes?.includes(index) || false;
              return (
                <div key={index} className="grid items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_220px_150px]">
                  <span className="text-xs font-bold text-slate-700">Vùng {index + 1}: {candidateData.anchors[index]?.label || 'Chưa nhận diện'}</span>
                  <select value={candidateData.provisionalColourIndexes[index] ?? 0} onChange={event => updateCandidate({
                    provisionalColourIndexes: Array.from({ length: 5 }, (_, itemIndex) => itemIndex === index
                      ? Number(event.target.value)
                      : candidateData.provisionalColourIndexes[itemIndex] ?? itemIndex),
                    confirmedTargetIndexes: (candidateData.confirmedTargetIndexes || []).filter(value => value !== index),
                  })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">
                    {part.colours.map((colour, colourIndex) => <option key={colour.id} value={colourIndex} disabled={candidateData.provisionalColourIndexes.some((value, itemIndex) => itemIndex !== index && value === colourIndex)}>{colour.label}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-xs font-black text-emerald-700">
                    <input type="checkbox" checked={confirmed} onChange={event => updateCandidate({
                      confirmedTargetIndexes: event.target.checked
                        ? Array.from(new Set([...(candidateData.confirmedTargetIndexes || []), index]))
                        : (candidateData.confirmedTargetIndexes || []).filter(value => value !== index),
                    })} /> Đã kiểm tra
                  </label>
                </div>
              );
            })}
            <p className="text-xs font-semibold text-amber-700">AI chỉ đề xuất vị trí. Code xáo ngẫu nhiên đáp án màu; giáo viên phải đặt lại và xác nhận từng dòng.</p>
            <button type="button" onClick={() => void applyCandidate()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Áp dụng 5 vùng đã xác nhận</button>
          </div>
        )}
      </SmartImportPanel>

      <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Tranh tô màu Part 5" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => commitPart({ ...part, sceneAssetId })} />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {part.colours.map((colour, index) => {
          const known = findMoverColour(colour.label, colour.value);
          return (
            <label key={colour.id} className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-xs font-black text-slate-700">Màu {index + 1}{index === 5 ? ' (nhiễu)' : ''}</span>
              <div className="flex items-center gap-2">
                <span className="h-9 w-12 rounded-lg border border-slate-300" style={{ backgroundColor: colour.value }} />
                <select value={known?.label || '__legacy__'} onChange={event => {
                  const selected = MOVER_COLOUR_CATALOG.find(item => item.label === event.target.value);
                  if (!selected) return;
                  commitPart({
                    ...part,
                    colours: part.colours.map(item => item.id === colour.id ? { ...item, ...selected } : item),
                  });
                }} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">
                  {!known && <option value="__legacy__">{colour.label} ({colour.value}) · dữ liệu cũ</option>}
                  {MOVER_COLOUR_CATALOG.map(item => (
                    <option key={item.label} value={item.label} disabled={item.label !== known?.label && selectedLabels.has(item.label)}>{item.label}</option>
                  ))}
                </select>
              </div>
            </label>
          );
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {part.targets.map((target, index) => (
          <div key={target.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="space-y-1">
              <span className="text-xs font-black text-slate-700">Đáp án màu {index + 1}</span>
              <select value={target.correctColourId} onChange={event => commitPart({
                ...part,
                targets: part.targets.map(item => item.id === target.id ? { ...item, correctColourId: event.target.value } : item),
              })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
                {part.colours.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>
        ))}
      </div>
      <FixedRegionEditor width={PART5_REGION_WIDTH} height={PART5_REGION_HEIGHT} imageUrl={assetUrl(part.sceneAssetId)} items={part.targets.map((target, index) => ({ id: target.id, label: `Đáp án màu ${index + 1}`, region: target.region }))} onChange={items => commitPart({
        ...part,
        targets: part.targets.map(target => ({
          ...target,
          region: items.find(item => item.id === target.id)?.region || target.region,
        })),
      })} />
    </div>
  );
}

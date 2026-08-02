import React from 'react';
import { Plus } from 'lucide-react';
import type { ListeningPart3 } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import type { ListeningSmartImportCandidate } from '../../../../listening-editor/smart-import/types';
import { createMoverEditorId } from './editorUtilities';
import { EditorField, MoverPartBaseEditor, type MoverPartEditorProps } from './shared';
import { importPart3Analysis } from './directImport';

export default function MoverPart3Editor(props: MoverPartEditorProps<ListeningPart3>) {
  const {
    part,
    token,
    assets,
    assetUrl,
    aiCapability,
    smartImportCapability,
    onImportCandidateChange,
    onImportCandidateApplied,
    onUpload,
    onChange,
  } = props;
  const composite = part.displayMode === 'composite';
  const importAnalysis = (candidate: ListeningSmartImportCandidate) => {
    if (candidate.data.part !== 3) throw new Error('Dữ liệu AI không đúng Part 3.');
    onChange(importPart3Analysis(part, candidate.data));
    onImportCandidateChange(undefined);
    onImportCandidateApplied();
  };

  return (
    <div className="space-y-5">
      <MoverPartBaseEditor {...props} />
      <SmartImportPanel
        token={token}
        part={part}
        assets={assets}
        capability={smartImportCapability}
        onCandidateChange={onImportCandidateChange}
        onAnalyzed={importAnalysis}
        analyzeLabel="Phân tích và nhập vào bài soạn"
        analyzedNotice="Đã nhập ảnh bảng A–F và các nhãn nhận được vào form Part 3. Hãy kiểm tra, bổ sung nhãn còn thiếu và tự đặt đáp án bên dưới."
        onUpload={onUpload}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-black text-slate-700">Kiểu trình bày</span>
          <select value={composite ? 'composite' : 'split'} onChange={event => {
            if (event.target.value === 'split') {
              onChange({ ...part, displayMode: 'split' });
              return;
            }
            const options = [...part.options];
            while (options.length < 6) {
              options.push({
                id: createMoverEditorId('p3-option'),
                label: String.fromCharCode(65 + options.length),
                imageAssetId: '',
              });
            }
            onChange({
              ...part,
              displayMode: 'composite',
              reuseMode: 'once',
              options: options.slice(0, 6).map((option, index) => ({
                ...option,
                label: String.fromCharCode(65 + index),
              })),
            });
          }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="composite">Một ảnh bảng tổng hợp A–F</option>
            <option value="split">Ảnh riêng từng lựa chọn (dữ liệu cũ)</option>
          </select>
        </label>
        {!composite && (
          <label className="block space-y-1">
            <span className="text-xs font-black text-slate-700">Quy tắc dùng lựa chọn</span>
            <select value={part.reuseMode} onChange={event => onChange({ ...part, reuseMode: event.target.value as ListeningPart3['reuseMode'] })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
              <option value="once">Mỗi lựa chọn tối đa một lần</option>
              <option value="multiple">Có thể dùng lại lựa chọn</option>
            </select>
          </label>
        )}
      </div>

      {composite ? (
        <ListeningAssetPicker
          assets={assets}
          aiCapability={aiCapability}
          onUpload={onUpload}
          label="Ảnh bảng tổng hợp A–F"
          kind="image"
          value={part.boardAssetId}
          onChange={boardAssetId => onChange({ ...part, boardAssetId })}
        />
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-800">Các vị trí A, B, C…</h4>
            <button type="button" onClick={() => onChange({
              ...part,
              options: [...part.options, {
                id: createMoverEditorId('p3-option'),
                label: String.fromCharCode(65 + part.options.length),
                imageAssetId: '',
              }],
            })} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
              <Plus size={13} className="inline" /> Thêm vị trí
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {part.options.map((option, index) => (
              <div key={option.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-black text-slate-600">Vị trí {String.fromCharCode(65 + index)}</p>
                <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Hình vị trí" kind="image" value={option.imageAssetId} onChange={imageAssetId => onChange({
                  ...part,
                  options: part.options.map(item => item.id === option.id ? { ...item, imageAssetId } : item),
                })} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-sm font-black text-slate-800">5 mục cần ghép</h4>
        {part.items.map((item, index) => (
          <div key={item.id} className={`grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 ${composite ? 'lg:grid-cols-[1fr_180px]' : 'lg:grid-cols-[1fr_1.4fr_180px]'}`}>
            <EditorField label={`Nhãn ${index + 1}`} value={item.label} onChange={label => onChange({
              ...part,
              items: part.items.map(entry => entry.id === item.id ? { ...entry, label } : entry),
            })} />
            {!composite && (
              <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label="Hình mục" kind="image" value={item.imageAssetId} onChange={imageAssetId => onChange({
                ...part,
                items: part.items.map(entry => entry.id === item.id ? { ...entry, imageAssetId } : entry),
              })} />
            )}
            <label className="space-y-1">
              <span className="text-xs font-black text-slate-700">Đáp án</span>
              <select value={item.correctOptionId} onChange={event => onChange({
                ...part,
                items: part.items.map(entry => entry.id === item.id ? { ...entry, correctOptionId: event.target.value } : entry),
              })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
                <option value="">— Chọn —</option>
                {part.options.map((option, optionIndex) => <option key={option.id} value={option.id}>{String.fromCharCode(65 + optionIndex)}</option>)}
              </select>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import type { ListeningPart2 } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import { cropListeningImage } from '../../../../listening-editor/smart-import/cropImage';
import VisualCropEditor from '../../../../listening-editor/smart-import/VisualCropEditor';
import type {
  ListeningSmartImportCandidate,
  SmartImportCrop,
} from '../../../../listening-editor/smart-import/types';
import {
  EditorField,
  EditorTextArea,
  MoverPartBaseEditor,
  type MoverPartEditorProps,
} from './shared';
import { importPart2Analysis } from './directImport';
import { smartImportSourceAssetId } from '../../../../listening-editor/smart-import/types';

interface PendingIllustrationCrop {
  candidateId: string;
  sourceAssetId: string;
  crop: SmartImportCrop;
}

export default function MoverPart2Editor(props: MoverPartEditorProps<ListeningPart2>) {
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
  const [applying, setApplying] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<PendingIllustrationCrop>();

  const importAnalysis = (candidate: ListeningSmartImportCandidate) => {
    if (candidate.data.part !== 2) throw new Error('Dữ liệu AI không đúng Part 2.');
    onChange(importPart2Analysis(part, candidate.data));
    const questionAssetId = smartImportSourceAssetId(candidate, 'question');
    if (candidate.data.illustrationCrop && questionAssetId) {
      setPendingCrop({
        candidateId: candidate.id,
        sourceAssetId: questionAssetId,
        crop: candidate.data.illustrationCrop,
      });
    } else {
      setPendingCrop(undefined);
    }
    onImportCandidateChange(undefined);
    onImportCandidateApplied();
  };

  const applyCrop = async () => {
    if (!pendingCrop) return;
    setApplying(true);
    try {
      const sourceUrl = assetUrl(pendingCrop.sourceAssetId);
      if (!sourceUrl) throw new Error('Không tìm thấy ảnh nguồn cho tranh minh họa Part 2.');
      const file = await cropListeningImage(
        sourceUrl,
        pendingCrop.crop,
        `part2-${pendingCrop.candidateId}-illustration.png`
      );
      const illustrationAssetId = (await onUpload(file, 'image', {
        derivedFromAssetId: pendingCrop.sourceAssetId,
        crop: pendingCrop.crop,
      })).id;
      onChange({ ...part, illustrationAssetId });
      setPendingCrop(undefined);
    } catch (reason: any) {
      window.alert(reason?.message || 'Không thể tạo tranh crop Part 2.');
    } finally {
      setApplying(false);
    }
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
        onUpload={onUpload}
      />
      {pendingCrop && (
        <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
          <div>
            <p className="text-sm font-black text-slate-900">Crop tranh minh họa trên ảnh nguồn</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">AI đã đề xuất vùng ban đầu. Hãy chỉnh trực tiếp bằng chuột rồi tạo ảnh crop.</p>
          </div>
          <VisualCropEditor
            imageUrl={assetUrl(pendingCrop.sourceAssetId)}
            crop={pendingCrop.crop}
            onChange={crop => setPendingCrop(current => current ? { ...current, crop } : current)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={applying} onClick={() => void applyCrop()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{applying ? 'Đang tạo ảnh crop…' : 'Dùng vùng crop này'}</button>
            <button type="button" disabled={applying} onClick={() => setPendingCrop(undefined)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 disabled:opacity-40">Không dùng tranh crop</button>
          </div>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <EditorField label="Tiêu đề nội dung" value={part.heading} onChange={heading => onChange({ ...part, heading })} />
        <ListeningAssetPicker
          assets={assets}
          aiCapability={aiCapability}
          onUpload={onUpload}
          label="Hình minh họa (không bắt buộc)"
          kind="image"
          value={part.illustrationAssetId}
          onChange={illustrationAssetId => onChange({ ...part, illustrationAssetId })}
        />
      </div>
      <EditorTextArea label="Ví dụ không chấm điểm (không bắt buộc)" value={part.exampleText || ''} onChange={exampleText => onChange({ ...part, exampleText })} rows={2} />
      <div className="space-y-3">
        {part.questions.map((question, index) => (
          <div key={question.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-800">Câu {index + 1}</p>
            <EditorTextArea
              label={`Nội dung — giữ ký hiệu {{${question.blanks[0]?.id}}} tại vị trí ô trống`}
              value={question.prompt}
              onChange={prompt => onChange({
                ...part,
                questions: part.questions.map(item => item.id === question.id ? { ...item, prompt } : item),
              })}
              rows={2}
            />
            {question.blanks.map((blank, blankIndex) => (
              <div key={blank.id}>
                <EditorField
                  label={`Đáp án chấp nhận ô ${blankIndex + 1} (ngăn cách bằng |)`}
                  value={blank.acceptedAnswers.join(' | ')}
                  onChange={raw => onChange({
                    ...part,
                    questions: part.questions.map(item => item.id === question.id
                      ? {
                          ...item,
                          blanks: item.blanks.map(entry => entry.id === blank.id
                            ? { ...entry, acceptedAnswers: raw.split('|').map(answer => answer.trim()) }
                            : entry),
                        }
                      : item),
                  })}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

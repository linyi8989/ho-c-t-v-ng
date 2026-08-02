import React, { useState } from 'react';
import type { ListeningPart4 } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import CropPreview from '../../../../listening-editor/smart-import/CropPreview';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import { cropListeningImage } from '../../../../listening-editor/smart-import/cropImage';
import VisualCropEditor from '../../../../listening-editor/smart-import/VisualCropEditor';
import { hashListeningPart } from '../../../../listening-editor/smart-import/hash';
import {
  detectPart4Frames,
  groupPart4Frames,
} from '../../../../listening-editor/smart-import/part4FrameDetection';
import type {
  ListeningSmartImportCandidate,
  SmartImportCrop,
} from '../../../../listening-editor/smart-import/types';
import { EditorField, MoverPartBaseEditor, type MoverPartEditorProps } from './shared';

const defaultCrop = (index: number): SmartImportCrop => ({
  x: 0.04 + index * 0.32,
  y: 0.2,
  width: 0.28,
  height: 0.28,
});

export default function MoverPart4Editor(props: MoverPartEditorProps<ListeningPart4>) {
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
  const [applying, setApplying] = useState(false);
  const [aligning, setAligning] = useState(false);
  const [alignmentNotice, setAlignmentNotice] = useState('');
  const [editingCrop, setEditingCrop] = useState<{ questionIndex: number; cropIndex: number }>();
  const candidate = importCandidate?.part === 4 && importCandidate.data.part === 4
    ? importCandidate
    : undefined;
  const candidateData = candidate?.data.part === 4 ? candidate.data : undefined;
  const reviewQuestions = Array.from({ length: 5 }, (_, index) => {
    const question = candidateData?.questions[index];
    const inferredSourceIndex = candidate?.sourceImageAssetIds.length === 5 ? index : 0;
    return {
      prompt: question?.prompt || '',
      sourceImageIndex: Math.max(0, Math.min(
        question?.sourceImageIndex ?? inferredSourceIndex,
        Math.max(0, (candidate?.sourceImageAssetIds.length || 1) - 1)
      )),
      crops: Array.from({ length: 3 }, (_, cropIndex) => question?.crops[cropIndex] || defaultCrop(cropIndex)),
      correctOptionIndex: question?.correctOptionIndex,
    };
  });
  const updateQuestion = (index: number, patch: Partial<(typeof reviewQuestions)[number]>) => {
    if (!candidate || !candidateData) return;
    onImportCandidateChange({
      ...candidate,
      data: {
        ...candidateData,
        questions: reviewQuestions.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question),
      },
    });
  };
  const alignCandidateToBlackFrames = async (incoming: ListeningSmartImportCandidate) => {
    if (incoming.data.part !== 4) throw new Error('Dữ liệu AI không đúng Part 4.');
    setAligning(true);
    setAlignmentNotice('Đang dùng code dò các khung ảnh màu đen…');
    try {
      const sourceCount = incoming.sourceImageAssetIds.length;
      const normalizedQuestions = Array.from({ length: 5 }, (_, index) => {
        const question = incoming.data.part === 4 ? incoming.data.questions[index] : undefined;
        const inferredSourceIndex = sourceCount === 5 ? index : 0;
        return {
          prompt: question?.prompt || '',
          sourceImageIndex: Math.max(0, Math.min(
            question?.sourceImageIndex ?? inferredSourceIndex,
            Math.max(0, sourceCount - 1)
          )),
          crops: Array.from({ length: 3 }, (_, cropIndex) => question?.crops[cropIndex] || defaultCrop(cropIndex)),
          correctOptionIndex: question?.correctOptionIndex,
        };
      });
      const detections = await Promise.all(incoming.sourceImageAssetIds.map(async sourceId => {
        const sourceUrl = assetUrl(sourceId);
        if (!sourceUrl) return [];
        try {
          return await detectPart4Frames(sourceUrl);
        } catch {
          return [];
        }
      }));
      let alignedQuestions = 0;
      let nextQuestions = normalizedQuestions;
      const separateQuestionPages = sourceCount === 5
        && detections.every(frames => groupPart4Frames(frames, 1).length === 1);
      if (separateQuestionPages) {
        nextQuestions = normalizedQuestions.map((question, questionIndex) => {
          const groups = groupPart4Frames(detections[questionIndex], 1);
          if (!groups.length) return question;
          alignedQuestions += 1;
          return { ...question, sourceImageIndex: questionIndex, crops: groups[0] };
        });
      } else {
        const bySource = new Map<number, number[]>();
        normalizedQuestions.forEach((question, questionIndex) => {
          const indexes = bySource.get(question.sourceImageIndex) || [];
          indexes.push(questionIndex);
          bySource.set(question.sourceImageIndex, indexes);
        });
        nextQuestions = [...normalizedQuestions];
        bySource.forEach((questionIndexes, sourceIndex) => {
          const groups = groupPart4Frames(detections[sourceIndex] || [], questionIndexes.length);
          if (groups.length !== questionIndexes.length) return;
          questionIndexes.forEach((questionIndex, groupIndex) => {
            nextQuestions[questionIndex] = { ...nextQuestions[questionIndex], crops: groups[groupIndex] };
            alignedQuestions += 1;
          });
        });
      }
      const alignedCandidate: ListeningSmartImportCandidate = {
        ...incoming,
        data: { ...incoming.data, questions: nextQuestions },
      };
      onImportCandidateChange(alignedCandidate);
      setAlignmentNotice(alignedQuestions === 5
        ? 'Code đã nhận đủ 15 khung đen và căn crop vào phía trong đường viền. Hãy xem nhanh các ảnh preview trước khi áp dụng.'
        : `Code tự căn được ${alignedQuestions * 3}/15 ảnh. Các ảnh còn lại đang giữ tọa độ AI; hãy dùng “Chỉnh bằng chuột” hoặc tải ảnh nguồn rõ hơn.`);
    } finally {
      setAligning(false);
    }
  };
  const applyCandidate = async () => {
    if (!candidate || !candidateData) return;
    const invalidCrop = (crop: SmartImportCrop) => (
      Object.values(crop).some(value => !Number.isFinite(value))
      || crop.width < 0.01 || crop.height < 0.01 || crop.x < 0 || crop.y < 0
      || crop.x + crop.width > 1 || crop.y + crop.height > 1
    );
    if (reviewQuestions.some(question => (
      !question.prompt.trim() || question.crops.length !== 3 || question.crops.some(invalidCrop)
    ))) {
      window.alert('Cần đủ 5 câu hỏi và ba vùng crop A/B/C cho mỗi câu.');
      return;
    }
    if (await hashListeningPart(part) !== candidate.basePartHash) {
      window.alert('Part 4 đã thay đổi sau khi phân tích. Hãy tạo lại bản đề xuất.');
      return;
    }
    setApplying(true);
    try {
      const uploadedIds: string[][] = [];
      for (let questionIndex = 0; questionIndex < reviewQuestions.length; questionIndex += 1) {
        const question = reviewQuestions[questionIndex];
        const sourceId = candidate.sourceImageAssetIds[Math.min(question.sourceImageIndex, candidate.sourceImageAssetIds.length - 1)];
        const sourceUrl = assetUrl(sourceId);
        if (!sourceUrl) throw new Error(`Thiếu ảnh nguồn cho câu ${questionIndex + 1}.`);
        const questionAssets: string[] = [];
        for (let optionIndex = 0; optionIndex < 3; optionIndex += 1) {
          const file = await cropListeningImage(
            sourceUrl,
            question.crops[optionIndex],
            `part4-${candidate.id}-q${questionIndex + 1}-${String.fromCharCode(65 + optionIndex)}.png`
          );
          questionAssets.push((await onUpload(file, 'image', {
            derivedFromAssetId: sourceId,
            crop: question.crops[optionIndex],
          })).id);
        }
        uploadedIds.push(questionAssets);
      }
      onChange({
        ...part,
        questions: part.questions.map((question, questionIndex) => {
          const review = reviewQuestions[questionIndex];
          return {
            ...question,
            prompt: review.prompt,
            options: question.options.map((option, optionIndex) => ({
              ...option,
              imageAssetId: uploadedIds[questionIndex][optionIndex],
            })),
            correctOptionId: review.correctOptionIndex === undefined
              ? question.correctOptionId
              : question.options[review.correctOptionIndex].id,
          };
        }),
      });
      onImportCandidateChange(undefined);
      onImportCandidateApplied();
    } catch (reason: any) {
      window.alert(reason?.message || 'Không thể crop và tải ảnh Part 4.');
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
        candidate={candidate}
        onCandidateChange={onImportCandidateChange}
        onAnalyzed={alignCandidateToBlackFrames}
        analyzeLabel="Phân tích và tự căn 15 khung ảnh"
        analyzedNotice="Đã đọc nội dung Part 4 và chạy bộ dò khung ảnh bằng code. Hãy kiểm tra các preview trước khi tạo 15 ảnh."
        onUpload={onUpload}
      >
        {candidateData && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
              <button type="button" disabled={aligning} onClick={() => void alignCandidateToBlackFrames(candidate)} className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">
                {aligning ? 'Đang dò khung đen…' : 'Tự căn lại theo khung đen'}
              </button>
              <p className="min-w-0 flex-1 text-xs font-semibold text-sky-800">{alignmentNotice || 'AI đọc câu hỏi và thứ tự; code sẽ xác định mép trong của các ô ảnh màu đen.'}</p>
            </div>
            {reviewQuestions.map((question, questionIndex) => {
              const sourceId = candidate.sourceImageAssetIds[Math.min(question.sourceImageIndex, candidate.sourceImageAssetIds.length - 1)];
              const sourceUrl = assetUrl(sourceId);
              return (
                <div key={questionIndex} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-2 lg:grid-cols-[1fr_200px_180px]">
                    <EditorField label={`Câu hỏi ${questionIndex + 1}`} value={question.prompt} onChange={prompt => updateQuestion(questionIndex, { prompt })} />
                    <label className="space-y-1">
                      <span className="text-xs font-black text-slate-700">Ảnh nguồn</span>
                      <select value={question.sourceImageIndex} onChange={event => updateQuestion(questionIndex, { sourceImageIndex: Number(event.target.value) })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold">
                        {candidate.sourceImageAssetIds.map((id, index) => <option key={id} value={index}>{assets.find(asset => asset.id === id)?.name || `Ảnh ${index + 1}`}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-black text-slate-700">Đáp án rõ trên ảnh</span>
                      <select value={question.correctOptionIndex ?? ''} onChange={event => updateQuestion(questionIndex, {
                        correctOptionIndex: event.target.value === '' ? undefined : Number(event.target.value),
                      })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold">
                        <option value="">Không rõ · giữ đáp án cũ</option>
                        {[0, 1, 2].map(index => <option key={index} value={index}>{String.fromCharCode(65 + index)}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {question.crops.map((crop, cropIndex) => (
                      <div key={cropIndex} className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
                        <CropPreview imageUrl={sourceUrl} crop={crop} label={String.fromCharCode(65 + cropIndex)} />
                        <button type="button" onClick={() => setEditingCrop({ questionIndex, cropIndex })} className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-black text-blue-700">Chỉnh bằng chuột</button>
                      </div>
                    ))}
                  </div>
                  {editingCrop?.questionIndex === questionIndex && (() => {
                    const cropIndex = editingCrop.cropIndex;
                    return (
                      <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-slate-800">Chỉnh crop câu {questionIndex + 1} · lựa chọn {String.fromCharCode(65 + cropIndex)}</p>
                          <button type="button" onClick={() => setEditingCrop(undefined)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-600">Đóng</button>
                        </div>
                        <VisualCropEditor imageUrl={sourceUrl} crop={question.crops[cropIndex]} onChange={crop => updateQuestion(questionIndex, {
                          crops: question.crops.map((item, itemIndex) => itemIndex === cropIndex ? crop : item),
                        })} />
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            <button type="button" disabled={applying} onClick={() => void applyCandidate()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{applying ? 'Đang crop và tải 15 ảnh…' : 'Áp dụng 5 câu và tạo 15 ảnh đáp án'}</button>
          </div>
        )}
      </SmartImportPanel>

      {part.questions.map((question, index) => (
        <div key={question.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <EditorField label={`Câu hỏi ${index + 1}`} value={question.prompt} onChange={prompt => onChange({
            ...part,
            questions: part.questions.map(entry => entry.id === question.id ? { ...entry, prompt } : entry),
          })} />
          <div className="grid gap-3 lg:grid-cols-3">
            {question.options.map((option, optionIndex) => (
              <div key={option.id} className={`rounded-2xl border p-3 ${question.correctOptionId === option.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                <ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label={`Lựa chọn ${String.fromCharCode(65 + optionIndex)}`} kind="image" value={option.imageAssetId} onChange={imageAssetId => onChange({
                  ...part,
                  questions: part.questions.map(entry => entry.id === question.id
                    ? { ...entry, options: entry.options.map(choice => choice.id === option.id ? { ...choice, imageAssetId } : choice) }
                    : entry),
                })} />
                <label className="mt-2 flex items-center gap-2 text-xs font-black text-emerald-700">
                  <input type="radio" checked={question.correctOptionId === option.id} onChange={() => onChange({
                    ...part,
                    questions: part.questions.map(entry => entry.id === question.id ? { ...entry, correctOptionId: option.id } : entry),
                  })} /> Đáp án đúng
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

import React, { useState } from 'react';
import type { ListeningPart4, ListeningPart4Question } from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import CropPreview from '../../../../listening-editor/smart-import/CropPreview';
import SmartImportPanel from '../../../../listening-editor/smart-import/SmartImportPanel';
import { cropListeningImage } from '../../../../listening-editor/smart-import/cropImage';
import VisualCropEditor from '../../../../listening-editor/smart-import/VisualCropEditor';
import { hashListeningPart } from '../../../../listening-editor/smart-import/hash';
import { detectPart4Frames, groupPart4Frames } from '../../../../listening-editor/smart-import/part4FrameDetection';
import type { ListeningSmartImportCandidate, SmartImportCrop } from '../../../../listening-editor/smart-import/types';
import { smartImportSourceAssetId } from '../../../../listening-editor/smart-import/types';
import { createMoverEditorId } from './editorUtilities';
import { EditorField, MoverPartBaseEditor, type MoverPartEditorProps } from './shared';
import { applyPart4Analysis } from './directImport';

const defaultCrop = (index: number): SmartImportCrop => ({ x: 0.04 + index * 0.32, y: 0.2, width: 0.28, height: 0.28 });

const createOptions = () => Array.from({ length: 3 }, (_, index) => ({
  id: createMoverEditorId('p4-option'),
  imageAssetId: '',
  alt: `Lựa chọn ${String.fromCharCode(65 + index)}`,
}));

export default function MoverPart4Editor(props: MoverPartEditorProps<ListeningPart4>) {
  const { part, token, assets, assetUrl, aiCapability, smartImportCapability, importCandidate, onImportCandidateChange, onImportCandidateApplied, onUpload, onChange } = props;
  const [applying, setApplying] = useState(false);
  const [aligning, setAligning] = useState(false);
  const [alignmentNotice, setAlignmentNotice] = useState('');
  const [editingCrop, setEditingCrop] = useState<{ block: 'example' | 'question'; questionIndex: number; cropIndex: number }>();
  const candidate = importCandidate?.part === 4 && importCandidate.data.part === 4 ? importCandidate : undefined;
  const data = candidate?.data.part === 4 ? candidate.data : undefined;
  const questionAssetId = candidate ? smartImportSourceAssetId(candidate, 'question') : undefined;
  const sourceUrl = assetUrl(questionAssetId);

  const reviewQuestions = ([1, 2, 3, 4, 5] as const).map((questionNumber, index) => {
    const found = data?.questions.find(question => question.questionNumber === questionNumber);
    return {
      questionNumber,
      prompt: found?.prompt || part.questions[index]?.prompt || '',
      crops: Array.from({ length: 3 }, (_, cropIndex) => found?.crops[cropIndex] || defaultCrop(cropIndex)),
      correctOptionIndex: found?.correctOptionIndex,
      answerSource: found?.answerSource || 'current-part' as const,
    };
  });
  const reviewExample = data?.example ? {
    prompt: data.example.prompt || part.example?.prompt || 'Example',
    crops: Array.from({ length: 3 }, (_, index) => data.example?.crops[index] || defaultCrop(index)),
    correctOptionIndex: data.example.correctOptionIndex,
  } : undefined;

  const updateQuestion = (index: number, patch: Partial<(typeof reviewQuestions)[number]>) => {
    if (!candidate || !data) return;
    onImportCandidateChange({ ...candidate, data: { ...data, questions: reviewQuestions.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question) } });
  };
  const updateExample = (patch: Partial<NonNullable<typeof reviewExample>>) => {
    if (!candidate || !data || !reviewExample) return;
    onImportCandidateChange({ ...candidate, data: { ...data, example: { ...reviewExample, ...patch } } });
  };

  const alignCandidateToBlackFrames = async (incoming: ListeningSmartImportCandidate) => {
    if (incoming.data.part !== 4) throw new Error('Dữ liệu AI không đúng Part 4.');
    const sourceId = smartImportSourceAssetId(incoming, 'question');
    const url = assetUrl(sourceId);
    if (!url) throw new Error('Thiếu ảnh đề bài Part 4.');
    setAligning(true);
    try {
      const frames = await detectPart4Frames(url);
      const sixGroups = groupPart4Frames(frames, 6);
      const fiveGroups = sixGroups.length === 6 ? [] : groupPart4Frames(frames, 5);
      const groups = sixGroups.length === 6 ? sixGroups : fiveGroups;
      const hasExample = groups.length === 6;
      const nextQuestions = ([1, 2, 3, 4, 5] as const).map((questionNumber, index) => {
        const current = incoming.data.part === 4 ? incoming.data.questions.find(question => question.questionNumber === questionNumber) : undefined;
        return {
          questionNumber,
          prompt: current?.prompt || part.questions[index]?.prompt || '',
          crops: groups[index + (hasExample ? 1 : 0)] || current?.crops || Array.from({ length: 3 }, (_, cropIndex) => defaultCrop(cropIndex)),
          correctOptionIndex: current?.correctOptionIndex,
          answerSource: current?.answerSource || 'current-part' as const,
        };
      });
      const nextExample = hasExample ? {
        prompt: incoming.data.example?.prompt || part.example?.prompt || 'Example',
        crops: groups[0],
        correctOptionIndex: incoming.data.example?.correctOptionIndex,
      } : incoming.data.example;
      onImportCandidateChange({ ...incoming, data: { ...incoming.data, example: nextExample, questions: nextQuestions } });
      setAlignmentNotice(hasExample
        ? 'Code đã tách đúng 18 hình: 3 hình example và 15 hình của câu 1–5.'
        : groups.length === 5 ? 'Code đã tách 15 hình câu 1–5; crop example giữ theo AI vì không nhận đủ khung.' : 'Không nhận đủ khung đen; giữ crop AI để giáo viên chỉnh thủ công.');
    } finally {
      setAligning(false);
    }
  };

  const cropBlock = async (crops: SmartImportCrop[], prefix: string) => {
    if (!questionAssetId || !sourceUrl) throw new Error('Thiếu ảnh đề bài Part 4.');
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const file = await cropListeningImage(sourceUrl, crops[index], `${prefix}-${String.fromCharCode(65 + index)}.png`);
      ids.push((await onUpload(file, 'image', { derivedFromAssetId: questionAssetId, crop: crops[index] })).id);
    }
    return ids;
  };

  const applyCandidate = async () => {
    if (!candidate || !data) return;
    const invalid = (crop: SmartImportCrop) => Object.values(crop).some(value => !Number.isFinite(value)) || crop.width < 0.01 || crop.height < 0.01 || crop.x < 0 || crop.y < 0 || crop.x + crop.width > 1 || crop.y + crop.height > 1;
    if (reviewQuestions.some(question => !question.prompt.trim() || question.crops.length !== 3 || question.crops.some(invalid)) || (reviewExample && reviewExample.crops.some(invalid))) {
      window.alert('Cần đủ ba crop A/B/C hợp lệ cho example và từng câu 1–5.');
      return;
    }
    if (await hashListeningPart(part) !== candidate.basePartHash) {
      window.alert('Part 4 đã thay đổi sau khi phân tích. Hãy phân tích lại để tránh ghi đè draft mới.');
      return;
    }
    setApplying(true);
    try {
      const uploadedQuestions: string[][] = [];
      for (let index = 0; index < 5; index += 1) uploadedQuestions.push(await cropBlock(reviewQuestions[index].crops, `part4-${candidate.id}-q${index + 1}`));
      let example: ListeningPart4Question | undefined = part.example;
      if (reviewExample) {
        const options = part.example?.options.length === 3 ? part.example.options : createOptions();
        const uploaded = await cropBlock(reviewExample.crops, `part4-${candidate.id}-example`);
        example = {
          id: part.example?.id || createMoverEditorId('p4-example'),
          prompt: reviewExample.prompt,
          options: options.map((option, index) => ({ ...option, imageAssetId: uploaded[index] })),
          correctOptionId: reviewExample.correctOptionIndex === undefined ? part.example?.correctOptionId || '' : options[reviewExample.correctOptionIndex].id,
        };
      }
      onChange(applyPart4Analysis(part, {
        ...data,
        ...(reviewExample ? { example: reviewExample } : {}),
        questions: reviewQuestions,
      }, uploadedQuestions, example?.options.map(option => option.imageAssetId)));
      onImportCandidateChange(undefined);
      onImportCandidateApplied();
    } catch (reason: any) {
      window.alert(reason?.message || 'Không thể crop và tải hình Part 4.');
    } finally {
      setApplying(false);
    }
  };

  const renderCropBlock = (block: 'example' | 'question', questionIndex: number, prompt: string, crops: SmartImportCrop[], correctOptionIndex: number | undefined, update: (patch: { prompt?: string; crops?: SmartImportCrop[]; correctOptionIndex?: number }) => void) => (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 lg:grid-cols-[1fr_190px]"><EditorField label={block === 'example' ? 'Example' : `Câu ${questionIndex + 1}`} value={prompt} onChange={value => update({ prompt: value })} /><label className="space-y-1"><span className="text-xs font-black">Đáp án</span><select value={correctOptionIndex ?? ''} onChange={event => update({ correctOptionIndex: event.target.value === '' ? undefined : Number(event.target.value) })} className="w-full rounded-xl border bg-white p-2.5 text-xs font-bold"><option value="">Không rõ · giữ cũ</option>{[0, 1, 2].map(index => <option key={index} value={index}>{String.fromCharCode(65 + index)}</option>)}</select></label></div>
      <div className="grid gap-3 md:grid-cols-3">{crops.map((crop, cropIndex) => <div key={cropIndex} className="space-y-2 rounded-xl border bg-white p-2"><CropPreview imageUrl={sourceUrl} crop={crop} label={String.fromCharCode(65 + cropIndex)} /><button type="button" onClick={() => setEditingCrop({ block, questionIndex, cropIndex })} className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-black text-blue-700">Chỉnh bằng chuột</button></div>)}</div>
      {editingCrop?.block === block && editingCrop.questionIndex === questionIndex && <VisualCropEditor imageUrl={sourceUrl} crop={crops[editingCrop.cropIndex]} onChange={crop => update({ crops: crops.map((item, index) => index === editingCrop.cropIndex ? crop : item) })} />}
    </div>
  );

  const renderQuestionEditor = (question: ListeningPart4Question, index: number, example = false) => <div key={question.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><EditorField label={example ? 'Example' : `Câu hỏi ${index + 1}`} value={question.prompt} onChange={prompt => onChange(example ? { ...part, example: { ...question, prompt } } : { ...part, questions: part.questions.map(entry => entry.id === question.id ? { ...entry, prompt } : entry) })} /><div className="grid gap-3 lg:grid-cols-3">{question.options.map((option, optionIndex) => <div key={option.id} className={`rounded-2xl border p-3 ${question.correctOptionId === option.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}><ListeningAssetPicker assets={assets} aiCapability={aiCapability} onUpload={onUpload} label={`Lựa chọn ${String.fromCharCode(65 + optionIndex)}`} kind="image" value={option.imageAssetId} onChange={imageAssetId => { const next = { ...question, options: question.options.map(item => item.id === option.id ? { ...item, imageAssetId } : item) }; onChange(example ? { ...part, example: next } : { ...part, questions: part.questions.map(item => item.id === question.id ? next : item) }); }} /><label className="mt-2 flex gap-2 text-xs font-black text-emerald-700"><input type="radio" checked={question.correctOptionId === option.id} onChange={() => { const next = { ...question, correctOptionId: option.id }; onChange(example ? { ...part, example: next } : { ...part, questions: part.questions.map(item => item.id === question.id ? next : item) }); }} /> Đáp án đúng</label></div>)}</div></div>;

  return <div className="space-y-5">
    <MoverPartBaseEditor {...props} />
    <SmartImportPanel token={token} part={part} assets={assets} capability={smartImportCapability} candidate={candidate} onCandidateChange={onImportCandidateChange} onAnalyzed={alignCandidateToBlackFrames} analyzeLabel="Phân tích ảnh đề + ảnh đáp án Part 4" analyzedNotice="Đã đọc answer key và tạo review; code tiếp tục tách các khung hình từ đúng ảnh đề bài." onUpload={onUpload}>
      {data && <div className="space-y-4"><div className="flex items-center gap-3"><button type="button" disabled={aligning} onClick={() => candidate && void alignCandidateToBlackFrames(candidate)} className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">{aligning ? 'Đang dò khung…' : 'Tự căn theo khung đen'}</button><p className="text-xs font-semibold text-sky-800">{alignmentNotice}</p></div>{reviewExample && renderCropBlock('example', 0, reviewExample.prompt, reviewExample.crops, reviewExample.correctOptionIndex, updateExample)}{reviewQuestions.map((question, index) => <React.Fragment key={question.questionNumber}>{renderCropBlock('question', index, question.prompt, question.crops, question.correctOptionIndex, patch => updateQuestion(index, patch))}</React.Fragment>)}<button type="button" disabled={applying} onClick={() => void applyCandidate()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{applying ? 'Đang crop và tải hình…' : `Áp dụng và tạo ${reviewExample ? 18 : 15} hình`}</button></div>}
    </SmartImportPanel>
    {part.example && renderQuestionEditor(part.example, 0, true)}
    {part.questions.map((question, index) => renderQuestionEditor(question, index))}
  </div>;
}

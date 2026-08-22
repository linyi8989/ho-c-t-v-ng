import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ListeningAsset } from '../../listening/types';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { cropListeningImage } from '../../listening-editor/smart-import/cropImage';
import VisualCropEditor from '../../listening-editor/smart-import/VisualCropEditor';
import type { SmartImportCrop } from '../../listening-editor/smart-import/types';
import { EditorField, EditorTextArea } from '../../listening-editor/shared/EditorFields';
import MoverReadingWritingSmartImportPanel from '../smart-import/MoverReadingWritingSmartImportPanel';
import {
  internalTemplateFromEditor,
  numberedTemplateForEditor,
} from '../compatibility';
import type {
  MoverReadingWritingSmartImportCandidate,
  MoverReadingWritingSmartImportCapability,
  MoverReadingWritingSmartImportSourceRole,
} from '../smart-import/types';
import type {
  MoverReadingWritingChoiceQuestion,
  MoverReadingWritingPart,
  MoverReadingWritingPart1,
  MoverReadingWritingPart2,
  MoverReadingWritingPart3,
  MoverReadingWritingPart4,
  MoverReadingWritingPart5,
  MoverReadingWritingPart6,
  MoverReadingWritingTextQuestion,
} from '../types';

interface BaseProps<TPart extends MoverReadingWritingPart> {
  part: TPart;
  token: string;
  assets: ListeningAsset[];
  smartImportCapability?: MoverReadingWritingSmartImportCapability;
  onUpload: (
    file: File,
    kind: 'image' | 'audio',
    derivative?: { derivedFromAssetId: string; crop: SmartImportCrop },
  ) => Promise<ListeningAsset>;
  onChange: (part: TPart) => void;
  onSmartImport: (candidate: MoverReadingWritingSmartImportCandidate) => Promise<void>;
}

const editorId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const newEditorTextQuestion = (prefix: string): MoverReadingWritingTextQuestion => {
  const id = editorId(prefix);
  return { id, prompt: `{{${id}}}`, acceptedAnswers: [''] };
};
const answerText = (answers: string[]) => answers.join(' | ');
const parseAnswers = (value: string) => value.split('|').map(item => item.trim()).filter(Boolean).slice(0, 20);

function PartHeader({ part, onChange }: { part: MoverReadingWritingPart; onChange: (patch: Partial<MoverReadingWritingPart>) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <EditorField label="Tiêu đề Part" value={part.title} onChange={title => onChange({ title })} />
      <EditorTextArea label="Hướng dẫn học sinh" value={part.instruction} rows={2} onChange={instruction => onChange({ instruction })} />
    </div>
  );
}

function AnswersField({ value, onChange, label = 'Đáp án chấp nhận' }: { value: string[]; onChange: (answers: string[]) => void; label?: string }) {
  return (
    <EditorField
      label={`${label} (ngăn cách bằng |)`}
      value={answerText(value)}
      placeholder="bookcase | a bookcase"
      onChange={raw => onChange(parseAnswers(raw))}
    />
  );
}

function InlineTemplatePreview({ template }: { template: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4 text-sm font-semibold leading-9 text-slate-800">
      {template.split(/(\[\[\d+\]\])/g).map((segment, index) => (
        /^\[\[\d+\]\]$/.test(segment)
          ? <span key={`${segment}-${index}`} className="mx-1 inline-block min-w-28 border-b-2 border-dotted border-blue-500 bg-blue-50 px-2 text-center font-black text-blue-700">ô trả lời {segment}</span>
          : <span key={`text-${index}`} className="whitespace-pre-wrap">{segment}</span>
      ))}
    </div>
  );
}

function InlineQuestionEditor({
  question,
  number,
  answerLabel,
  onChange,
}: {
  question: MoverReadingWritingTextQuestion;
  number: number;
  answerLabel?: string;
  onChange: (question: MoverReadingWritingTextQuestion) => void;
}) {
  const numbered = question.prompt.split(`{{${question.id}}}`).join(`[[${number}]]`);
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <EditorTextArea
        label={`Câu ${number} (giữ marker [[${number}]] tại vị trí ô trả lời)`}
        value={numbered}
        rows={2}
        onChange={value => onChange({
          ...question,
          prompt: value.split(`[[${number}]]`).join(`{{${question.id}}}`),
        })}
      />
      <InlineTemplatePreview template={numbered} />
      <AnswersField label={answerLabel} value={question.acceptedAnswers} onChange={acceptedAnswers => onChange({ ...question, acceptedAnswers })} />
    </div>
  );
}

function ChoiceQuestionEditor({
  question,
  label,
  onChange,
}: {
  question: MoverReadingWritingChoiceQuestion;
  label: string;
  onChange: (question: MoverReadingWritingChoiceQuestion) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <EditorTextArea label={label} value={question.prompt} rows={2} onChange={prompt => onChange({ ...question, prompt })} />
      <div className="grid gap-3 lg:grid-cols-3">
        {question.options.map((option, index) => (
          <div key={option.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <EditorField
              label={`Lựa chọn ${String.fromCharCode(65 + index)}`}
              value={option.text}
              onChange={text => onChange({
                ...question,
                options: question.options.map(item => item.id === option.id ? { ...item, text } : item) as MoverReadingWritingChoiceQuestion['options'],
              })}
            />
            <label className="mt-3 flex items-center gap-2 text-xs font-black text-slate-700">
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correctOptionId === option.id}
                onChange={() => onChange({ ...question, correctOptionId: option.id })}
              />
              Đáp án đúng
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

const imagePickerProps = (assets: ListeningAsset[], onUpload: BaseProps<any>['onUpload']) => ({
  assets,
  onUpload,
  aiCapability: { enabled: false, reason: 'Smart Import Reading & Writing được triển khai theo bước riêng; ảnh hiện dùng upload/thư viện an toàn.' },
});

function SmartImportBlock({
  part,
  token,
  assets,
  smartImportCapability,
  assetSourceByRole,
  onUpload,
  onAssetSourceChange,
  onSmartImport,
}: Pick<BaseProps<MoverReadingWritingPart>, 'part' | 'token' | 'assets' | 'smartImportCapability' | 'onUpload' | 'onSmartImport'> & {
  assetSourceByRole?: Partial<Record<MoverReadingWritingSmartImportSourceRole, string>>;
  onAssetSourceChange?: (role: MoverReadingWritingSmartImportSourceRole, assetId: string) => void;
}) {
  return (
    <MoverReadingWritingSmartImportPanel
      token={token}
      part={part}
      assets={assets}
      capability={smartImportCapability}
      assetSourceByRole={assetSourceByRole}
      onUpload={onUpload}
      onAssetSourceChange={onAssetSourceChange}
      onAnalyzed={onSmartImport}
    />
  );
}

export function ReadingPart1Editor({ part, token, assets, smartImportCapability, onUpload, onChange, onSmartImport }: BaseProps<MoverReadingWritingPart1>) {
  return (
    <div className="space-y-5">
      <PartHeader part={part} onChange={patch => onChange({ ...part, ...patch } as MoverReadingWritingPart1)} />
      <ListeningAssetPicker {...imagePickerProps(assets, onUpload)} label="Ảnh ngân hàng từ/hình (bên trái)" kind="image" value={part.wordBankAssetId} onChange={wordBankAssetId => onChange({ ...part, wordBankAssetId })} />
      <SmartImportBlock part={part} token={token} assets={assets} smartImportCapability={smartImportCapability} assetSourceByRole={{ word_bank: part.wordBankAssetId }} onUpload={onUpload} onSmartImport={onSmartImport} />
      <div className="space-y-4">
        {part.questions.map((question, index) => (
          <div key={question.id} className="contents">
            <InlineQuestionEditor
              question={question}
              number={index + 1}
              onChange={next => onChange({ ...part, questions: part.questions.map(item => item.id === question.id ? next : item) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReadingPart2Editor({ part, token, assets, smartImportCapability, onUpload, onChange, onSmartImport }: BaseProps<MoverReadingWritingPart2>) {
  return (
    <div className="space-y-5">
      <PartHeader part={part} onChange={patch => onChange({ ...part, ...patch } as MoverReadingWritingPart2)} />
      <ListeningAssetPicker {...imagePickerProps(assets, onUpload)} label="Ảnh tình huống (bên trái)" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => onChange({ ...part, sceneAssetId })} />
      <SmartImportBlock part={part} token={token} assets={assets} smartImportCapability={smartImportCapability} assetSourceByRole={{ scene: part.sceneAssetId }} onUpload={onUpload} onSmartImport={onSmartImport} />
      <div className="grid gap-4 md:grid-cols-2">
        {part.questions.map((question, index) => (
          <div key={question.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <EditorTextArea label={`Nhận định ${index + 1}`} value={question.statement} rows={2} onChange={statement => onChange({ ...part, questions: part.questions.map(item => item.id === question.id ? { ...item, statement } : item) })} />
            <div className="flex gap-3" role="radiogroup" aria-label={`Đáp án câu ${index + 1}`}>
              {(['yes', 'no'] as const).map(answer => (
                <label key={answer} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase text-slate-700">
                  <input type="radio" name={`p2-${question.id}`} checked={question.correctAnswer === answer} onChange={() => onChange({ ...part, questions: part.questions.map(item => item.id === question.id ? { ...item, correctAnswer: answer } : item) })} />
                  {answer}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReadingPart3Editor({ part, token, assets, smartImportCapability, onUpload, onChange, onSmartImport }: BaseProps<MoverReadingWritingPart3>) {
  return (
    <div className="space-y-5">
      <PartHeader part={part} onChange={patch => onChange({ ...part, ...patch } as MoverReadingWritingPart3)} />
      <ListeningAssetPicker {...imagePickerProps(assets, onUpload)} label="Ảnh hội thoại (bên trái)" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => onChange({ ...part, sceneAssetId })} />
      <SmartImportBlock part={part} token={token} assets={assets} smartImportCapability={smartImportCapability} assetSourceByRole={{ scene: part.sceneAssetId }} onUpload={onUpload} onSmartImport={onSmartImport} />
      {part.questions.map((question, index) => (
        <div key={question.id} className="contents">
          <ChoiceQuestionEditor question={question} label={`Câu hội thoại ${index + 1}`} onChange={next => onChange({ ...part, questions: part.questions.map(item => item.id === question.id ? { ...item, ...next } : item) })} />
        </div>
      ))}
    </div>
  );
}

export function ReadingPart4Editor({ part, token, assets, smartImportCapability, onUpload, onChange, onSmartImport }: BaseProps<MoverReadingWritingPart4>) {
  return (
    <div className="space-y-5">
      <PartHeader part={part} onChange={patch => onChange({ ...part, ...patch } as MoverReadingWritingPart4)} />
      <ListeningAssetPicker {...imagePickerProps(assets, onUpload)} label="Ảnh ngân hàng từ/hình (bên trái)" kind="image" value={part.wordBankAssetId} onChange={wordBankAssetId => onChange({ ...part, wordBankAssetId })} />
      <SmartImportBlock part={part} token={token} assets={assets} smartImportCapability={smartImportCapability} assetSourceByRole={{ word_bank: part.wordBankAssetId }} onUpload={onUpload} onSmartImport={onSmartImport} />
      <EditorTextArea
        label="Nội dung truyện (giữ marker [[1]] đến [[6]] tại vị trí ô trống)"
        value={numberedTemplateForEditor(part.storyTemplate, part.gaps)}
        rows={10}
        onChange={storyTemplate => onChange({ ...part, storyTemplate: internalTemplateFromEditor(storyTemplate, part.gaps) })}
      />
      <InlineTemplatePreview template={numberedTemplateForEditor(part.storyTemplate, part.gaps)} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {part.gaps.map((gap, index) => (
          <div key={gap.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-black text-blue-700">Chỗ trống {index + 1}: {`[[${index + 1}]]`}</p>
            <AnswersField value={gap.acceptedAnswers} onChange={acceptedAnswers => onChange({ ...part, gaps: part.gaps.map(item => item.id === gap.id ? { ...item, acceptedAnswers } : item) })} />
          </div>
        ))}
      </div>
      <ChoiceQuestionEditor question={part.titleQuestion} label="Câu 7: Chọn tiêu đề phù hợp nhất" onChange={titleQuestion => onChange({ ...part, titleQuestion })} />
    </div>
  );
}

export function ReadingPart5Editor({ part, token, assets, smartImportCapability, onUpload, onChange, onSmartImport }: BaseProps<MoverReadingWritingPart5>) {
  const totalQuestions = part.scenes.reduce((total, scene) => total + scene.questions.length, 0);
  return (
    <div className="space-y-5">
      <PartHeader part={part} onChange={patch => onChange({ ...part, ...patch } as MoverReadingWritingPart5)} />
      <div className={`rounded-2xl border p-3 text-xs font-black ${totalQuestions === 10 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        Tổng số câu Part 5: {totalQuestions}/10. Có thể phân bổ khác nhau giữa ba tranh nhưng phải đúng 10 trước khi xuất bản.
      </div>
      <SmartImportBlock
        part={part}
        token={token}
        assets={assets}
        smartImportCapability={smartImportCapability}
        assetSourceByRole={{
          scene_1: part.scenes[0].imageAssetId,
          scene_2: part.scenes[1].imageAssetId,
          scene_3: part.scenes[2].imageAssetId,
        }}
        onUpload={onUpload}
        onAssetSourceChange={(role, imageAssetId) => {
          const sceneIndex = ({ scene_1: 0, scene_2: 1, scene_3: 2 } as const)[role as 'scene_1' | 'scene_2' | 'scene_3'];
          if (sceneIndex === undefined) return;
          onChange({
            ...part,
            scenes: part.scenes.map((scene, index) => index === sceneIndex ? { ...scene, imageAssetId } : scene) as MoverReadingWritingPart5['scenes'],
          });
        }}
        onSmartImport={onSmartImport}
      />
      {part.scenes.map((scene, sceneIndex) => (
        <section key={scene.id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Tranh và câu chuyện {sceneIndex + 1}</h3>
            <button
              type="button"
              onClick={() => onChange({
                ...part,
                scenes: part.scenes.map(item => item.id === scene.id ? {
                  ...item,
                  questions: [...item.questions, newEditorTextQuestion('rw-p5-question')],
                } : item) as MoverReadingWritingPart5['scenes'],
              })}
              className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
            >
              <Plus size={14} /> Thêm câu
            </button>
          </div>
          <ListeningAssetPicker {...imagePickerProps(assets, onUpload)} label={`Ảnh ${sceneIndex + 1}`} kind="image" value={scene.imageAssetId} onChange={imageAssetId => onChange({ ...part, scenes: part.scenes.map(item => item.id === scene.id ? { ...item, imageAssetId } : item) as MoverReadingWritingPart5['scenes'] })} />
          <EditorTextArea label={`Nội dung câu chuyện ${sceneIndex + 1}`} value={scene.passage} rows={7} onChange={passage => onChange({ ...part, scenes: part.scenes.map(item => item.id === scene.id ? { ...item, passage } : item) as MoverReadingWritingPart5['scenes'] })} />
          <div className="space-y-3">
            {scene.questions.map((question, questionIndex) => (
              <div key={question.id} className="relative">
                <InlineQuestionEditor
                  question={question}
                  number={part.scenes.slice(0, sceneIndex).reduce((total, item) => total + item.questions.length, 0) + questionIndex + 1}
                  answerLabel="Đáp án 1–3 từ"
                  onChange={next => onChange({ ...part, scenes: part.scenes.map(item => item.id === scene.id ? { ...item, questions: item.questions.map(row => row.id === question.id ? next : row) } : item) as MoverReadingWritingPart5['scenes'] })}
                />
                <button type="button" aria-label={`Xóa câu ${questionIndex + 1}`} onClick={() => onChange({ ...part, scenes: part.scenes.map(item => item.id === scene.id ? { ...item, questions: item.questions.filter(row => row.id !== question.id) } : item) as MoverReadingWritingPart5['scenes'] })} className="absolute right-3 top-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ReadingPart6Editor({ part, token, assets, smartImportCapability, onUpload, onChange, onSmartImport }: BaseProps<MoverReadingWritingPart6>) {
  const [crop, setCrop] = useState<SmartImportCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [cropping, setCropping] = useState(false);
  const sourceAsset = assets.find(asset => asset.id === part.passageSourceAssetId);

  const applyPassageCrop = async () => {
    if (!sourceAsset?.url || !part.passageSourceAssetId) return;
    setCropping(true);
    try {
      const file = await cropListeningImage(sourceAsset.url, crop, `mover-reading-part6-passage-${Date.now()}.png`);
      const illustrationAssetId = (await onUpload(file, 'image', {
        derivedFromAssetId: part.passageSourceAssetId,
        crop,
      })).id;
      onChange({ ...part, illustrationAssetId });
    } catch (reason: any) {
      window.alert(reason?.message || 'Không thể tạo ảnh crop Part 6.');
    } finally {
      setCropping(false);
    }
  };

  return (
    <div className="space-y-5">
      <PartHeader part={part} onChange={patch => onChange({ ...part, ...patch } as MoverReadingWritingPart6)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ListeningAssetPicker {...imagePickerProps(assets, onUpload)} label="Ảnh nguồn bài đọc (để OCR và crop)" kind="image" value={part.passageSourceAssetId} onChange={passageSourceAssetId => onChange({ ...part, passageSourceAssetId })} />
        <ListeningAssetPicker {...imagePickerProps(assets, onUpload)} label="Ảnh bảng lựa chọn (học sinh sẽ nhìn thấy)" kind="image" value={part.optionsAssetId} onChange={optionsAssetId => onChange({ ...part, optionsAssetId })} />
      </div>
      {sourceAsset?.url && (
        <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
          <div>
            <p className="text-sm font-black text-slate-900">Crop ảnh bài đọc hiển thị cho học sinh</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Kéo chọn phần bài đọc cần hiển thị. Ảnh crop được lưu riêng như pipeline Part 2 Listening; ảnh nguồn vẫn dùng cho Smart Import.</p>
          </div>
          <VisualCropEditor imageUrl={sourceAsset.url} crop={crop} onChange={setCrop} />
          <button type="button" disabled={cropping} onClick={() => void applyPassageCrop()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">
            {cropping ? 'Đang tạo ảnh crop…' : part.illustrationAssetId ? 'Cập nhật ảnh crop' : 'Dùng vùng crop này'}
          </button>
        </section>
      )}
      <ListeningAssetPicker {...imagePickerProps(assets, onUpload)} label="Ảnh bài đọc đã crop (học sinh sẽ nhìn thấy)" kind="image" value={part.illustrationAssetId} onChange={illustrationAssetId => onChange({ ...part, illustrationAssetId })} />
      <SmartImportBlock
        part={part}
        token={token}
        assets={assets}
        smartImportCapability={smartImportCapability}
        assetSourceByRole={{ passage: part.passageSourceAssetId || '', options: part.optionsAssetId || '' }}
        onUpload={onUpload}
        onAssetSourceChange={(role, assetId) => {
          if (role === 'passage') onChange({ ...part, passageSourceAssetId: assetId });
          if (role === 'options') onChange({ ...part, optionsAssetId: assetId });
        }}
        onSmartImport={onSmartImport}
      />
      <EditorField label="Tiêu đề bài đọc" value={part.passageTitle} onChange={passageTitle => onChange({ ...part, passageTitle })} />
      <EditorTextArea
        label="Bài đọc (giữ marker [[1]] đến [[5]] tại vị trí ô trống)"
        value={numberedTemplateForEditor(part.passageTemplate, part.gaps)}
        rows={12}
        onChange={passageTemplate => onChange({ ...part, passageTemplate: internalTemplateFromEditor(passageTemplate, part.gaps) })}
      />
      <InlineTemplatePreview template={numberedTemplateForEditor(part.passageTemplate, part.gaps)} />
      {part.gaps.map((gap, index) => (
        <div key={gap.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-black text-blue-700">Chỗ trống {index + 1}: {`[[${index + 1}]]`}</p>
          <AnswersField
            label="Đáp án đúng (một từ)"
            value={gap.acceptedAnswers}
            onChange={acceptedAnswers => onChange({ ...part, gaps: part.gaps.map(item => item.id === gap.id ? { ...item, acceptedAnswers } : item) })}
          />
        </div>
      ))}
    </div>
  );
}

import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import { examPartUnits, replaceExamPartUnit } from '../examStructure';
import type { ExamDisplayExample, ExamPartContent, ExamQuestion, ExamReadingScene } from '../types';

interface Props {
  token: string;
  part: ExamPartContent;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const answerText = (answers: string[]) => answers.join(' | ');
const parseAnswers = (value: string) => value.split('|').map(item => item.trim()).filter(Boolean).slice(0, 20);

function ensureYesNo(question: ExamQuestion) {
  const yes = question.options.find(option => /^(yes|true)$/i.test(option.text.trim())) || question.options[0] || { id: makeId('starter-rw-yes'), label: 'YES', text: 'Yes' };
  const no = question.options.find(option => /^(no|false)$/i.test(option.text.trim())) || question.options[1] || { id: makeId('starter-rw-no'), label: 'NO', text: 'No' };
  return {
    ...question,
    type: 'true-false' as const,
    options: [{ ...yes, label: 'YES', text: 'Yes' }, { ...no, label: 'NO', text: 'No' }],
  };
}

function ImagePicker({
  label,
  value,
  assets,
  token,
  onAssets,
  onChange,
}: {
  label: string;
  value?: string;
  assets: ListeningAsset[];
  token: string;
  onAssets: (asset: ListeningAsset) => void;
  onChange: (asset?: ListeningAsset) => void;
}) {
  const upload = async (file: File, kind: ListeningAssetKind) => {
    const asset = await listeningApi.uploadAsset(token, file, kind);
    onAssets(asset);
    onChange(asset);
    return asset;
  };
  return <ListeningAssetPicker
    label={label}
    kind="image"
    value={value}
    assets={assets}
    aiCapability={{ enabled: false, reason: 'Ảnh của đề do giáo viên tải hoặc dán từ bộ nhớ đệm.' }}
    onUpload={upload}
    onChange={assetId => {
      const selected = assets.find(asset => asset.id === assetId);
      if (selected || !assetId) onChange(selected);
    }}
  />;
}

function ExamplesEditor({ examples, count, onChange }: { examples: ExamDisplayExample[]; count: number; onChange: (examples: ExamDisplayExample[]) => void }) {
  const rows = Array.from({ length: count }, (_, index) => examples[index] || { prompt: '', answer: index % 2 ? 'No' : 'Yes' });
  const update = (index: number, patch: Partial<ExamDisplayExample>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
    <p className="text-sm font-black text-indigo-950">Example không chấm điểm</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {rows.map((example, index) => <div key={index} className="rounded-xl border border-indigo-100 bg-white p-3">
        <label className="text-xs font-black text-slate-700">Nội dung example {index + 1}<input value={example.prompt} onChange={event => update(index, { prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
        <label className="mt-2 block text-xs font-black text-slate-700">Đáp án in sẵn<input value={example.answer} onChange={event => update(index, { answer: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      </div>)}
    </div>
  </section>;
}

function AnswersField({ question, label, onChange }: { question: ExamQuestion; label: string; onChange: (question: ExamQuestion) => void }) {
  return <label className="block text-xs font-black text-slate-700">{label} (ngăn cách bằng |)<input value={answerText(question.acceptedAnswers)} onChange={event => onChange({ ...question, type: 'short-answer', acceptedAnswers: parseAnswers(event.target.value) })} className={`mt-1 ${fieldClass}`} placeholder="face | a face" /></label>;
}

function InlinePreview({ value }: { value: string }) {
  return <div className="rounded-xl border border-blue-100 bg-white p-4 text-sm font-semibold leading-9 text-slate-800">
    {value.split(/(\[\[\d+\]\])/g).map((segment, index) => /^\[\[\d+\]\]$/.test(segment)
      ? <span key={`${segment}-${index}`} className="mx-1 inline-block min-w-24 border-b-2 border-dotted border-blue-500 bg-blue-50 px-2 text-center font-black text-blue-700">ô {segment}</span>
      : <span key={index} className="whitespace-pre-wrap">{segment}</span>)}
  </div>;
}

function YesNoQuestions({ unit, onChange }: { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="grid gap-3 md:grid-cols-2">
    {unit.questions.map((rawQuestion, index) => {
      const question = ensureYesNo(rawQuestion);
      return <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-black text-slate-700">Câu {index + 1}<textarea value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
        <div className="mt-3 flex gap-3" role="radiogroup" aria-label={`Đáp án câu ${index + 1}`}>
          {question.options.map(option => <label key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase text-slate-700">
            <input type="radio" name={`starter-rw-answer-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => updateQuestion(index, { ...question, correctOptionIds: [option.id] })} />
            {option.text}
          </label>)}
        </div>
      </article>;
    })}
  </div>;
}

function PartOne({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const example = unit.examples?.[0] || { prompt: '', answer: 'Yes' };
  return <div className="space-y-4">
    <ImagePicker label="Ảnh example ở phía trên" value={example.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, examples: [{ ...example, imageAssetId: asset?.id, imageUrl: asset?.url }] })} />
    <ExamplesEditor examples={[example]} count={1} onChange={examples => onChange({ ...unit, examples })} />
    <ImagePicker label="Ảnh bài làm ở cột bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <YesNoQuestions unit={unit} onChange={onChange} />
  </div>;
}

function PartTwo({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  return <div className="space-y-4">
    <ImagePicker label="Ảnh tình huống ở cột bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={2} onChange={examples => onChange({ ...unit, examples })} />
    <YesNoQuestions unit={unit} onChange={onChange} />
  </div>;
}

function PartThree({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <ImagePicker label="Ảnh nguyên trang hiển thị bên trái cho học sinh" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <div className="grid gap-3 md:grid-cols-2">
      {unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-black text-slate-700">Nhãn câu {index + 1}<input value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
        <div className="mt-3"><AnswersField question={question} label="Đáp án từ" onChange={next => updateQuestion(index, { ...next, maxWords: 1 })} /></div>
      </article>)}
    </div>
  </div>;
}

function PartFour({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <ImagePicker label="Ảnh ngân hàng từ/hình ở cột bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={1} onChange={examples => onChange({ ...unit, examples })} />
    <label className="block text-xs font-black text-slate-700">Nội dung truyện (giữ đúng marker [[1]] đến [[5]])<textarea value={unit.passage || ''} onChange={event => onChange({ ...unit, passage: event.target.value })} className={`mt-1 min-h-56 ${fieldClass}`} /></label>
    <InlinePreview value={unit.passage || ''} />
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-black text-blue-700">Chỗ trống {index + 1}: {`[[${index + 1}]]`}</p>
        <AnswersField question={question} label="Đáp án chấp nhận" onChange={next => updateQuestion(index, { ...next, maxWords: 1 })} />
      </article>)}
    </div>
  </div>;
}

function normalizedScenes(unit: ExamPartContent): ExamReadingScene[] {
  const counts = [1, 2, 2];
  let offset = 0;
  return counts.map((count, index) => {
    const previous = unit.readingScenes?.[index];
    const scene = {
      id: previous?.id || makeId(`starter-rw-scene-${index + 1}`),
      passage: previous?.passage || '',
      questionIds: unit.questions.slice(offset, offset + count).map(question => question.id),
      ...(previous?.imageAssetId ? { imageAssetId: previous.imageAssetId } : {}),
      ...(previous?.imageUrl ? { imageUrl: previous.imageUrl } : {}),
    };
    offset += count;
    return scene;
  });
}

function PartFive({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const scenes = normalizedScenes(unit);
  const questionById = new Map(unit.questions.map(question => [question.id, question]));
  const updateScene = (index: number, next: ExamReadingScene) => onChange({ ...unit, readingScenes: scenes.map((scene, sceneIndex) => sceneIndex === index ? next : scene) });
  const updateQuestion = (question: ExamQuestion) => onChange({ ...unit, readingScenes: scenes, questions: unit.questions.map(item => item.id === question.id ? question : item) });
  return <div className="space-y-5">
    {scenes.map((scene, sceneIndex) => <section key={scene.id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><p className="text-xs font-black uppercase text-indigo-600">Cảnh {sceneIndex + 1}</p><h4 className="mt-1 text-lg font-black text-slate-900">Tranh và câu chuyện {sceneIndex + 1} · {sceneIndex === 0 ? '2 example + ' : ''}{scene.questionIds.length} câu chấm điểm</h4></div>
      <ImagePicker label={`Ảnh cảnh ${sceneIndex + 1}`} value={scene.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => updateScene(sceneIndex, { ...scene, imageAssetId: asset?.id, imageUrl: asset?.url })} />
      <label className="block text-xs font-black text-slate-700">Nội dung câu chuyện {sceneIndex + 1}<textarea value={scene.passage} onChange={event => updateScene(sceneIndex, { ...scene, passage: event.target.value })} className={`mt-1 min-h-32 ${fieldClass}`} /></label>
      {sceneIndex === 0 && <ExamplesEditor examples={unit.examples || []} count={2} onChange={examples => onChange({ ...unit, examples, readingScenes: scenes })} />}
      <div className="space-y-3">{scene.questionIds.map((questionId, localIndex) => {
        const question = questionById.get(questionId);
        if (!question) return null;
        const globalIndex = unit.questions.findIndex(item => item.id === question.id);
        return <article key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="text-xs font-black text-slate-700">Câu {globalIndex + 1} (đặt ____ tại vị trí ô nhập)<textarea value={question.prompt} onChange={event => updateQuestion({ ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
          <div className="mt-3"><AnswersField question={question} label={`Đáp án câu ${globalIndex + 1}`} onChange={next => updateQuestion({ ...next, maxWords: 3 })} /></div>
          <p className="mt-2 text-[10px] font-bold text-slate-400">Cảnh {sceneIndex + 1} · câu thứ {localIndex + 1} trong cảnh</p>
        </article>;
      })}</div>
    </section>)}
  </div>;
}

export default function StarterReadingWritingAuthoring({ token, part, assets, onAssets, onChange }: Props) {
  const unit = examPartUnits(part)[0] || part;
  const commit = (nextUnit: ExamPartContent) => onChange(replaceExamPartUnit(part, nextUnit));
  const shared = { unit, assets, token, onAssets, onChange: commit };
  return <section className="space-y-4" data-starter-reading-writing-editor={part.part}>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-blue-700">Starters Reading & Writing · Part {part.part}</p>
      <p className="mt-1 text-sm font-semibold text-blue-950">Giao diện này cố định theo cấu trúc Cambridge đã chọn; JSON nhập nội dung và đáp án, còn ảnh do giáo viên tải hoặc dán tại đây.</p>
    </div>
    {part.part === 1 ? <PartOne {...shared} /> : part.part === 2 ? <PartTwo {...shared} /> : part.part === 3 ? <PartThree {...shared} /> : part.part === 4 ? <PartFour {...shared} /> : <PartFive {...shared} />}
  </section>;
}

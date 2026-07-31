import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Edit3,
  Eye,
  Headphones,
  Plus,
  Save,
  Send,
  X,
} from 'lucide-react';
import { listeningApi } from '../api';
import type {
  ListeningAsset,
  ListeningPart,
  ListeningSetContent,
  ListeningVisibility,
} from '../types';
import { ListeningAssetPicker } from './ListeningAssetPicker';
import { ListeningRegionEditor } from './ListeningRegionEditor';

interface ListeningAdminModuleProps {
  token: string;
}

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const emptyRegion = (index: number) => ({
  shape: 'rect' as const,
  x: 0.06 + (index % 3) * 0.31,
  y: 0.12 + Math.floor(index / 3) * 0.42,
  width: 0.18,
  height: 0.18,
});

export function createDefaultListeningContent(): ListeningSetContent {
  const p1Choices = Array.from({ length: 6 }, (_, index) => ({
    id: makeId('p1-choice'),
    label: `Tên ${index + 1}`,
  }));
  const p3Options = Array.from({ length: 6 }, (_, index) => ({
    id: makeId('p3-option'),
    label: String.fromCharCode(65 + index),
    imageAssetId: '',
  }));
  const colours = ['#ef4444', '#7c3aed', '#f97316', '#2563eb', '#16a34a', '#eab308'].map((value, index) => ({
    id: makeId('p5-colour'),
    label: `Màu ${index + 1}`,
    value,
  }));
  return {
    moduleId: 'mover',
    schemaVersion: 1,
    title: 'Bộ đề nghe 5 Part mới',
    description: 'Bài luyện nghe gồm 5 Part và 25 câu hỏi.',
    level: 'Movers',
    parts: [
      {
        schemaVersion: 1,
        part: 1,
        title: 'Part 1',
        instruction: 'Listen. Drag the name and drop onto the correct person in the picture.',
        audioAssetId: '',
        sceneAssetId: '',
        choices: p1Choices,
        targets: p1Choices.slice(0, 5).map((choice, index) => ({
          id: makeId('p1-target'),
          choiceId: choice.id,
          region: emptyRegion(index),
        })),
      },
      {
        schemaVersion: 1,
        part: 2,
        title: 'Part 2',
        instruction: 'Listen and write. There is one example.',
        audioAssetId: '',
        heading: 'Listening notes',
        exampleText: '',
        questions: Array.from({ length: 5 }, (_, index) => {
          const blankId = makeId('blank');
          return {
            id: makeId('p2-question'),
            prompt: `${index + 1}. Nội dung câu hỏi {{${blankId}}}`,
            blanks: [{ id: blankId, acceptedAnswers: [''] }],
          };
        }),
      },
      {
        schemaVersion: 1,
        part: 3,
        title: 'Part 3',
        instruction: 'Listen and write a letter in each box.',
        audioAssetId: '',
        reuseMode: 'once',
        options: p3Options,
        items: Array.from({ length: 5 }, (_, index) => ({
          id: makeId('p3-item'),
          label: `Đồ vật ${index + 1}`,
          imageAssetId: '',
          correctOptionId: p3Options[index].id,
        })),
      },
      {
        schemaVersion: 1,
        part: 4,
        title: 'Part 4',
        instruction: 'Listen and tick the box. There is one example.',
        audioAssetId: '',
        questions: Array.from({ length: 5 }, (_, questionIndex) => {
          const options = Array.from({ length: 3 }, (_, optionIndex) => ({
            id: makeId('p4-option'),
            imageAssetId: '',
            alt: `Lựa chọn ${String.fromCharCode(65 + optionIndex)}`,
          }));
          return {
            id: makeId('p4-question'),
            prompt: `${questionIndex + 1}. Câu hỏi`,
            options,
            correctOptionId: options[0].id,
          };
        }),
      },
      {
        schemaVersion: 1,
        part: 5,
        title: 'Part 5',
        instruction: 'Listen and colour and write. There is one example.',
        audioAssetId: '',
        sceneAssetId: '',
        colours,
        targets: colours.slice(0, 5).map((colour, index) => ({
          id: makeId('p5-target'),
          label: `Vùng ${index + 1}`,
          correctColourId: colour.id,
          region: emptyRegion(index),
        })),
      },
    ],
  };
}

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  key?: React.Key;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) => (
  <label className="block space-y-1">
    <span className="text-xs font-black text-slate-700">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={event => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
    />
  </label>
);

const TextArea = ({
  label,
  value,
  onChange,
  rows = 3,
}: {
  key?: React.Key;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) => (
  <label className="block space-y-1">
    <span className="text-xs font-black text-slate-700">{label}</span>
    <textarea
      value={value}
      rows={rows}
      onChange={event => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
    />
  </label>
);

export default function ListeningAdminModule({ token }: ListeningAdminModuleProps) {
  const [sets, setSets] = useState<any[]>([]);
  const [assets, setAssets] = useState<ListeningAsset[]>([]);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [editingId, setEditingId] = useState('');
  const [content, setContent] = useState<ListeningSetContent>(() => ({
    ...createDefaultListeningContent(),
    title: '__library__',
  }));
  const [visibility, setVisibility] = useState<ListeningVisibility>('draft');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [results, setResults] = useState<any[] | null>(null);
  const [resultsTitle, setResultsTitle] = useState('');

  const load = async () => {
    const [setRows, assetRows, capabilityRows] = await Promise.all([
      listeningApi.listSets(token),
      listeningApi.listAssets(token),
      listeningApi.capabilities(token),
    ]);
    setSets(setRows);
    setAssets(assetRows);
    setCapabilities(capabilityRows);
  };

  useEffect(() => {
    void load().catch(error => setMessage({ text: error.message, error: true }));
  }, [token]);

  const selectedAssets = useMemo(
    () => new Map(assets.map(asset => [asset.id, asset])),
    [assets]
  );
  const assetUrl = (id?: string) => id ? selectedAssets.get(id)?.url : undefined;
  const updatePart = <T extends ListeningPart>(index: number, updater: (part: T) => T) => {
    setContent(previous => {
      const parts = [...previous.parts] as ListeningSetContent['parts'];
      parts[index] = updater(parts[index] as T) as any;
      return { ...previous, parts };
    });
  };
  const upload = async (file: File, kind: 'image' | 'audio') => {
    try {
      const asset = await listeningApi.uploadAsset(token, file, kind);
      setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)]);
      return asset;
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
      throw error;
    }
  };
  const assetPickerProps = {
    assets,
    aiCapability: capabilities?.imageGeneration,
    onUpload: upload,
  };

  const startNew = () => {
    setEditingId('');
    setContent(createDefaultListeningContent());
    setVisibility('draft');
    setValidationErrors([]);
    setStep(0);
  };
  const editSet = async (id: string) => {
    setBusy(true);
    try {
      const set = await listeningApi.getAdminSet(token, id);
      setEditingId(set.id);
      setContent(set.draftContent || set.versions?.[0]?.content || createDefaultListeningContent());
      setVisibility(set.visibility || 'draft');
      setValidationErrors(set.validationErrors || []);
      setStep(0);
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let saved = editingId
        ? await listeningApi.updateSet(token, editingId, content, visibility)
        : await listeningApi.createSet(token, content);
      if (!editingId && saved.visibility !== visibility) {
        saved = await listeningApi.updateSet(token, saved.id, content, visibility);
      }
      setEditingId(saved.id);
      setVisibility(saved.visibility || visibility);
      setValidationErrors(saved.validationErrors || []);
      setMessage({ text: 'Đã lưu bản nháp bộ đề nghe.' });
      await load();
      return saved;
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
      setValidationErrors(Array.isArray(error.details) ? error.details : []);
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await save();
      const published = await listeningApi.publishSet(token, saved.id);
      setValidationErrors([]);
      setMessage({ text: `Đã xuất bản phiên bản ${published.version.versionNumber}.` });
      await load();
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
      setValidationErrors(Array.isArray(error.details) ? error.details : []);
    } finally {
      setBusy(false);
    }
  };
  const archiveSet = async (set: any) => {
    if (!window.confirm(`Lưu trữ bộ đề "${set.title}"? Kết quả cũ vẫn được giữ.`)) return;
    try {
      await listeningApi.archiveSet(token, set.id);
      await load();
      setMessage({ text: 'Đã lưu trữ bộ đề; dữ liệu có thể phục hồi trong cơ sở dữ liệu.' });
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
    }
  };
  const showResults = async (set: any) => {
    setBusy(true);
    try {
      const data = await fetch(`/api/listening/admin/sets/${encodeURIComponent(set.id)}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        return payload;
      });
      setResultsTitle(set.title);
      setResults(data.attempts || []);
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  };
  const previewUrl = (set: any) => {
    const query = set.visibility === 'assignment' && set.shareToken
      ? `?accessToken=${encodeURIComponent(set.shareToken)}`
      : '';
    return `${window.location.origin}/listening/${set.id}${query}`;
  };

  const inEditor = Boolean(editingId) || content.title !== '__library__';
  const showLibrary = !inEditor;
  const goLibrary = () => {
    setEditingId('');
    setContent({ ...createDefaultListeningContent(), title: '__library__' });
    setStep(0);
  };

  const renderGeneral = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Tên bộ đề" value={content.title} onChange={title => setContent(value => ({ ...value, title }))} />
        <TextArea label="Mô tả" value={content.description} onChange={description => setContent(value => ({ ...value, description }))} />
        <Field label="Trình độ" value={content.level} onChange={level => setContent(value => ({ ...value, level }))} />
        <label className="block space-y-1">
          <span className="text-xs font-black text-slate-700">Quyền truy cập</span>
          <select value={visibility} onChange={event => setVisibility(event.target.value as ListeningVisibility)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="draft">Bản nháp</option>
            <option value="public">Công khai</option>
            <option value="assignment">Link riêng / giao bài</option>
          </select>
        </label>
        <Field
          label="Giới hạn thời gian (phút, để trống nếu không giới hạn)"
          type="number"
          value={content.timeLimitMinutes || ''}
          onChange={value => setContent(previous => ({
            ...previous,
            timeLimitMinutes: value ? Math.max(1, Number(value)) : undefined,
          }))}
        />
      </div>
      <div className="space-y-4">
        <ListeningAssetPicker {...assetPickerProps} label="Ảnh bìa (không bắt buộc)" kind="image" value={content.coverAssetId} onChange={coverAssetId => setContent(value => ({ ...value, coverAssetId }))} />
        <ListeningAssetPicker {...assetPickerProps} label="Hình nền khung học sinh (không bắt buộc)" kind="image" value={content.backgroundAssetId} onChange={backgroundAssetId => setContent(value => ({ ...value, backgroundAssetId }))} />
      </div>
    </div>
  );

  const basePartEditor = (part: ListeningPart, index: number) => (
    <div className="grid gap-4 lg:grid-cols-2">
      <Field label="Tiêu đề Part" value={part.title} onChange={title => updatePart<any>(index, value => ({ ...value, title }))} />
      <ListeningAssetPicker {...assetPickerProps} label={`Audio Part ${part.part}`} kind="audio" value={part.audioAssetId} onChange={audioAssetId => updatePart<any>(index, value => ({ ...value, audioAssetId }))} />
      <div className="lg:col-span-2">
        <TextArea label="Hướng dẫn" value={part.instruction} onChange={instruction => updatePart<any>(index, value => ({ ...value, instruction }))} rows={2} />
      </div>
    </div>
  );

  const renderPart1 = () => {
    const part = content.parts[0];
    return (
      <div className="space-y-5">
        {basePartEditor(part, 0)}
        <ListeningAssetPicker {...assetPickerProps} label="Tranh tình huống Part 1" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => updatePart<any>(0, value => ({ ...value, sceneAssetId }))} />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {part.choices.map((choice, index) => (
            <Field key={choice.id} label={`Thẻ tên ${index + 1}${index === 5 ? ' (nhiễu)' : ''}`} value={choice.label} onChange={label => updatePart<any>(0, value => ({
              ...value,
              choices: value.choices.map((item: any) => item.id === choice.id ? { ...item, label } : item),
            }))} />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {part.targets.map((target, index) => (
            <label key={target.id} className="space-y-1">
              <span className="text-xs font-black text-slate-700">Đáp án vùng {index + 1}</span>
              <select value={target.choiceId} onChange={event => updatePart<any>(0, value => ({
                ...value,
                targets: value.targets.map((item: any) => item.id === target.id ? { ...item, choiceId: event.target.value } : item),
              }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
                {part.choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
              </select>
            </label>
          ))}
        </div>
        <ListeningRegionEditor
          imageUrl={assetUrl(part.sceneAssetId)}
          items={part.targets.map((target, index) => ({ id: target.id, label: part.choices.find(choice => choice.id === target.choiceId)?.label || `Vùng ${index + 1}`, region: target.region }))}
          onChange={items => updatePart<any>(0, value => ({
            ...value,
            targets: value.targets.map((target: any) => ({ ...target, region: items.find(item => item.id === target.id)?.region || target.region })),
          }))}
        />
      </div>
    );
  };

  const renderPart2 = () => {
    const part = content.parts[1];
    return (
      <div className="space-y-5">
        {basePartEditor(part, 1)}
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Tiêu đề nội dung" value={part.heading} onChange={heading => updatePart<any>(1, value => ({ ...value, heading }))} />
          <ListeningAssetPicker {...assetPickerProps} label="Hình minh họa (không bắt buộc)" kind="image" value={part.illustrationAssetId} onChange={illustrationAssetId => updatePart<any>(1, value => ({ ...value, illustrationAssetId }))} />
        </div>
        <TextArea label="Ví dụ không chấm điểm (không bắt buộc)" value={part.exampleText || ''} onChange={exampleText => updatePart<any>(1, value => ({ ...value, exampleText }))} rows={2} />
        <div className="space-y-3">
          {part.questions.map((question, index) => (
            <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-black text-slate-800">Câu {index + 1}</p>
              <TextArea
                label={`Nội dung — giữ ký hiệu {{${question.blanks[0]?.id}}} tại vị trí ô trống`}
                value={question.prompt}
                onChange={prompt => updatePart<any>(1, value => ({
                  ...value,
                  questions: value.questions.map((item: any) => item.id === question.id ? { ...item, prompt } : item),
                }))}
                rows={2}
              />
              {question.blanks.map((blank, blankIndex) => (
                <Field
                  key={blank.id}
                  label={`Đáp án chấp nhận ô ${blankIndex + 1} (ngăn cách bằng |)`}
                  value={blank.acceptedAnswers.join(' | ')}
                  onChange={raw => updatePart<any>(1, value => ({
                    ...value,
                    questions: value.questions.map((item: any) => item.id === question.id
                      ? { ...item, blanks: item.blanks.map((entry: any) => entry.id === blank.id ? { ...entry, acceptedAnswers: raw.split('|').map((answer: string) => answer.trim()) } : entry) }
                      : item),
                  }))}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPart3 = () => {
    const part = content.parts[2];
    return (
      <div className="space-y-5">
        {basePartEditor(part, 2)}
        <label className="block space-y-1">
          <span className="text-xs font-black text-slate-700">Quy tắc dùng lựa chọn</span>
          <select value={part.reuseMode} onChange={event => updatePart<any>(2, value => ({ ...value, reuseMode: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="once">Mỗi lựa chọn tối đa một lần</option>
            <option value="multiple">Có thể dùng lại lựa chọn</option>
          </select>
        </label>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-800">Các vị trí A, B, C…</h4>
            <button type="button" onClick={() => updatePart<any>(2, value => ({
              ...value,
              options: [...value.options, { id: makeId('p3-option'), label: String.fromCharCode(65 + value.options.length), imageAssetId: '' }],
            }))} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"><Plus size={13} className="inline" /> Thêm vị trí</button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {part.options.map((option, index) => (
              <div key={option.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-black text-slate-600">Vị trí {String.fromCharCode(65 + index)}</p>
                <ListeningAssetPicker {...assetPickerProps} label="Hình vị trí" kind="image" value={option.imageAssetId} onChange={imageAssetId => updatePart<any>(2, value => ({
                  ...value,
                  options: value.options.map((item: any) => item.id === option.id ? { ...item, imageAssetId } : item),
                }))} />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-black text-slate-800">5 đồ vật cần ghép</h4>
          {part.items.map((item, index) => (
            <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_1.4fr_180px]">
              <Field label={`Tên đồ vật ${index + 1}`} value={item.label} onChange={label => updatePart<any>(2, value => ({
                ...value,
                items: value.items.map((entry: any) => entry.id === item.id ? { ...entry, label } : entry),
              }))} />
              <ListeningAssetPicker {...assetPickerProps} label="Hình đồ vật" kind="image" value={item.imageAssetId} onChange={imageAssetId => updatePart<any>(2, value => ({
                ...value,
                items: value.items.map((entry: any) => entry.id === item.id ? { ...entry, imageAssetId } : entry),
              }))} />
              <label className="space-y-1">
                <span className="text-xs font-black text-slate-700">Đáp án</span>
                <select value={item.correctOptionId} onChange={event => updatePart<any>(2, value => ({
                  ...value,
                  items: value.items.map((entry: any) => entry.id === item.id ? { ...entry, correctOptionId: event.target.value } : entry),
                }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
                  {part.options.map((option, optionIndex) => <option key={option.id} value={option.id}>{String.fromCharCode(65 + optionIndex)}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPart4 = () => {
    const part = content.parts[3];
    return (
      <div className="space-y-5">
        {basePartEditor(part, 3)}
        {part.questions.map((question, index) => (
          <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <Field label={`Câu hỏi ${index + 1}`} value={question.prompt} onChange={prompt => updatePart<any>(3, value => ({
              ...value,
              questions: value.questions.map((entry: any) => entry.id === question.id ? { ...entry, prompt } : entry),
            }))} />
            <div className="grid gap-3 lg:grid-cols-3">
              {question.options.map((option, optionIndex) => (
                <div key={option.id} className={`rounded-2xl border p-3 ${question.correctOptionId === option.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                  <ListeningAssetPicker {...assetPickerProps} label={`Lựa chọn ${String.fromCharCode(65 + optionIndex)}`} kind="image" value={option.imageAssetId} onChange={imageAssetId => updatePart<any>(3, value => ({
                    ...value,
                    questions: value.questions.map((entry: any) => entry.id === question.id
                      ? { ...entry, options: entry.options.map((choice: any) => choice.id === option.id ? { ...choice, imageAssetId } : choice) }
                      : entry),
                  }))} />
                  <label className="mt-2 flex items-center gap-2 text-xs font-black text-emerald-700">
                    <input type="radio" checked={question.correctOptionId === option.id} onChange={() => updatePart<any>(3, value => ({
                      ...value,
                      questions: value.questions.map((entry: any) => entry.id === question.id ? { ...entry, correctOptionId: option.id } : entry),
                    }))} />
                    Đáp án đúng
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPart5 = () => {
    const part = content.parts[4];
    return (
      <div className="space-y-5">
        {basePartEditor(part, 4)}
        <ListeningAssetPicker {...assetPickerProps} label="Tranh tô màu Part 5" kind="image" value={part.sceneAssetId} onChange={sceneAssetId => updatePart<any>(4, value => ({ ...value, sceneAssetId }))} />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {part.colours.map((colour, index) => (
            <div key={colour.id} className="grid grid-cols-[1fr_64px] gap-2">
              <Field label={`Màu ${index + 1}${index === 5 ? ' (nhiễu)' : ''}`} value={colour.label} onChange={label => updatePart<any>(4, value => ({
                ...value,
                colours: value.colours.map((item: any) => item.id === colour.id ? { ...item, label } : item),
              }))} />
              <label className="space-y-1">
                <span className="text-xs font-black text-slate-700">Mã</span>
                <input type="color" value={colour.value} onChange={event => updatePart<any>(4, value => ({
                  ...value,
                  colours: value.colours.map((item: any) => item.id === colour.id ? { ...item, value: event.target.value } : item),
                }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white p-1" />
              </label>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {part.targets.map((target, index) => (
            <div key={target.id} className="space-y-2">
              <Field label={`Tên vùng ${index + 1}`} value={target.label} onChange={label => updatePart<any>(4, value => ({
                ...value,
                targets: value.targets.map((item: any) => item.id === target.id ? { ...item, label } : item),
              }))} />
              <select value={target.correctColourId} onChange={event => updatePart<any>(4, value => ({
                ...value,
                targets: value.targets.map((item: any) => item.id === target.id ? { ...item, correctColourId: event.target.value } : item),
              }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
                {part.colours.map(colour => <option key={colour.id} value={colour.id}>{colour.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <ListeningRegionEditor
          imageUrl={assetUrl(part.sceneAssetId)}
          items={part.targets.map(target => ({ id: target.id, label: target.label, region: target.region }))}
          onChange={items => updatePart<any>(4, value => ({
            ...value,
            targets: value.targets.map((target: any) => ({ ...target, region: items.find(item => item.id === target.id)?.region || target.region })),
          }))}
        />
      </div>
    );
  };

  const renderPreview = () => (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-700 p-7 text-white shadow-lg">
        <p className="text-xs font-black uppercase tracking-[.2em] text-sky-100">Bản xem trước cấu trúc</p>
        <h3 className="mt-2 text-3xl font-black">{content.title}</h3>
        <p className="mt-2 max-w-2xl text-sm text-sky-50">{content.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1">{content.level}</span>
          <span className="rounded-full bg-white/20 px-3 py-1">5 Part</span>
          <span className="rounded-full bg-white/20 px-3 py-1">25 câu chấm điểm</span>
          <span className="rounded-full bg-white/20 px-3 py-1">{content.timeLimitMinutes ? `${content.timeLimitMinutes} phút` : 'Không giới hạn giờ'}</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {content.parts.map(part => (
          <div key={part.part} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase text-blue-600">Part {part.part}</p>
            <p className="mt-1 font-black text-slate-900">{part.title}</p>
            <p className="mt-2 text-xs text-slate-500">5 câu • {part.audioAssetId ? 'Có audio' : 'Thiếu audio'}</p>
          </div>
        ))}
      </div>
      {validationErrors.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-black text-rose-800">Cần hoàn thiện trước khi xuất bản</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold text-rose-700">
            {validationErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
          </ul>
        </div>
      )}
    </div>
  );

  if (showLibrary) {
    return (
      <div className="space-y-6 animate-fade-in" id="listening-admin-module">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-sky-600">Listening Studio</p>
            <h2 className="text-2xl font-black text-slate-900">Bộ đề nghe 5 Part</h2>
            <p className="text-sm text-slate-500">Mỗi phiên bản xuất bản là bất biến; chỉnh sửa tiếp theo không đổi bài đang làm.</p>
          </div>
          <button type="button" onClick={startNew} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200">
            <Plus size={17} /> Tạo bộ đề mới
          </button>
        </div>
        {message && <div className={`rounded-2xl border p-3 text-sm font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
              <tr><th className="p-4">Bộ đề</th><th className="p-4">Trình độ</th><th className="p-4">Phiên bản</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Thao tác</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sets.filter(set => set.status !== 'archived').map(set => (
                <tr key={set.id}>
                  <td className="p-4"><p className="font-black text-slate-900">{set.title}</p><p className="max-w-sm truncate text-xs text-slate-400">{set.description}</p></td>
                  <td className="p-4 font-bold text-slate-600">{set.level}</td>
                  <td className="p-4 font-bold text-slate-600">{set.publishedVersionNumber ? `v${set.publishedVersionNumber}` : 'Chưa xuất bản'}</td>
                  <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${set.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{set.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</span></td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <button title="Sửa" onClick={() => editSet(set.id)} className="rounded-xl p-2 text-blue-700 hover:bg-blue-50"><Edit3 size={16} /></button>
                      {set.status === 'published' && <button title="Xem như học sinh" onClick={() => window.open(previewUrl(set), '_blank', 'noopener,noreferrer')} className="rounded-xl p-2 text-emerald-700 hover:bg-emerald-50"><Eye size={16} /></button>}
                      {set.visibility === 'assignment' && set.shareToken && <button title="Sao chép link" onClick={() => navigator.clipboard?.writeText(previewUrl(set))} className="rounded-xl p-2 text-violet-700 hover:bg-violet-50"><Clipboard size={16} /></button>}
                      <button title="Kết quả" onClick={() => showResults(set)} className="rounded-xl p-2 text-amber-700 hover:bg-amber-50"><BarChart3 size={16} /></button>
                      <button title="Lưu trữ" onClick={() => archiveSet(set)} className="rounded-xl p-2 text-rose-700 hover:bg-rose-50"><Archive size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!sets.filter(set => set.status !== 'archived').length && <tr><td colSpan={5} className="p-10 text-center text-sm font-semibold text-slate-400">Chưa có bộ đề nghe.</td></tr>}
            </tbody>
          </table>
        </div>
        {results && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div><p className="text-xs font-black uppercase text-blue-600">Kết quả Listening</p><h3 className="text-xl font-black text-slate-900">{resultsTitle}</h3></div>
                <button onClick={() => setResults(null)} className="rounded-xl border border-slate-200 p-2"><X size={18} /></button>
              </div>
              <div className="max-h-[68vh] overflow-auto p-5">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead><tr className="text-xs font-black uppercase text-slate-400"><th className="p-3">Học sinh</th><th className="p-3">Điểm</th><th className="p-3">Đúng</th><th className="p-3">Sai</th><th className="p-3">Bỏ trống</th><th className="p-3">Hoàn thành</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{results.map(attempt => <tr key={attempt.id}><td className="p-3 font-bold">{attempt.studentName}</td><td className="p-3 font-black text-blue-700">{attempt.score}</td><td className="p-3 text-emerald-700">{attempt.correctCount}</td><td className="p-3 text-rose-700">{attempt.incorrectCount}</td><td className="p-3 text-amber-700">{attempt.unansweredCount}</td><td className="p-3 text-xs">{new Date(attempt.completedAt).toLocaleString('vi-VN')}</td></tr>)}</tbody>
                </table>
                {!results.length && <p className="p-10 text-center text-sm text-slate-400">Chưa có lượt nộp bài.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const steps = ['Chung', 'Part 1', 'Part 2', 'Part 3', 'Part 4', 'Part 5', 'Xem trước'];
  const views = [renderGeneral, renderPart1, renderPart2, renderPart3, renderPart4, renderPart5, renderPreview];
  return (
    <div className="space-y-5 animate-fade-in" id="listening-wizard">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goLibrary} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600"><ChevronLeft size={17} /></button>
          <div><p className="text-xs font-black uppercase text-sky-600">Listening wizard</p><h2 className="text-xl font-black text-slate-900">{content.title}</h2></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-700 disabled:opacity-50"><Save size={15} /> Lưu nháp</button>
          <button disabled={busy} onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Send size={15} /> Xuất bản</button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((label, index) => (
          <button key={label} onClick={() => setStep(index)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black ${step === index ? 'bg-blue-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-500'}`}>
            {index < step ? <CheckCircle2 size={13} className="mr-1 inline" /> : null}{label}
          </button>
        ))}
      </div>
      {message && <div className={`rounded-2xl border p-3 text-sm font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{views[step]()}</div>
      <div className="flex items-center justify-between">
        <button disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-30"><ChevronLeft size={14} /> Trước</button>
        <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-400"><Headphones size={14} /> Bước {step + 1}/{steps.length}</span>
        <button disabled={step === steps.length - 1} onClick={() => setStep(value => Math.min(steps.length - 1, value + 1))} className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-30">Tiếp <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

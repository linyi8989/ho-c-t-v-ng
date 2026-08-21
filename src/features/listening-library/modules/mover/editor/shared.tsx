import React from 'react';
import {
  LISTENING_TRANSCRIPT_MAX_CHARS,
  type ListeningPart,
  type ListeningPartBase,
} from '../../../../listening/types';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import { EditorField, EditorTextArea } from '../../../../listening-editor/shared/EditorFields';
import type { ListeningPartEditorProps } from '../../../../listening-editor/contracts';

export type MoverPartEditorProps<TPart extends ListeningPart> = ListeningPartEditorProps<TPart>;

export function MoverPartBaseEditor<TPart extends ListeningPart>({
  part,
  assets,
  aiCapability,
  onUpload,
  onChange,
}: MoverPartEditorProps<TPart>) {
  const update = (patch: Partial<ListeningPartBase>) => onChange({ ...part, ...patch } as TPart);
  const importTranscript = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (file.size > 100_000) {
      window.alert('File transcript quá lớn. Vui lòng chọn file .txt nhỏ hơn 100 KB.');
      return;
    }
    const transcript = (await file.text()).replace(/\r\n?/g, '\n').trim();
    if (transcript.length > LISTENING_TRANSCRIPT_MAX_CHARS) {
      window.alert(`Transcript tối đa ${LISTENING_TRANSCRIPT_MAX_CHARS.toLocaleString('vi-VN')} ký tự cho mỗi Part.`);
      return;
    }
    update({ audioTranscript: transcript });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EditorField label="Tiêu đề Part" value={part.title} onChange={title => update({ title })} />
      <ListeningAssetPicker
        assets={assets}
        aiCapability={aiCapability}
        onUpload={onUpload}
        label={`Audio Part ${part.part}`}
        kind="audio"
        value={part.audioAssetId}
        onChange={audioAssetId => update({ audioAssetId })}
      />
      <div className="lg:col-span-2">
        <EditorTextArea label="Hướng dẫn" value={part.instruction} onChange={instruction => update({ instruction })} rows={2} />
      </div>
      <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black text-slate-700">Nội dung bài nghe / hội thoại</p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Chỉ hiển thị sau khi học sinh hoàn thành bài và được phép xem kết quả.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-black text-sky-700 hover:bg-sky-100">
            Chọn file .txt
            <input type="file" accept=".txt,text/plain" className="sr-only" onChange={event => void importTranscript(event)} />
          </label>
        </div>
        <EditorTextArea
          label="Transcript"
          value={part.audioTranscript || ''}
          onChange={audioTranscript => update({ audioTranscript })}
          rows={8}
          placeholder="Dán nội dung hội thoại tại đây, giữ nguyên tên người nói và xuống dòng..."
          maxLength={LISTENING_TRANSCRIPT_MAX_CHARS}
        />
        <p className="text-right text-[11px] font-bold text-slate-500">
          {(part.audioTranscript || '').length.toLocaleString('vi-VN')} / {LISTENING_TRANSCRIPT_MAX_CHARS.toLocaleString('vi-VN')} ký tự
        </p>
      </div>
    </div>
  );
}

export { EditorField, EditorTextArea };

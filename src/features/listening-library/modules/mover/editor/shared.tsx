import React from 'react';
import type { ListeningPart, ListeningPartBase } from '../../../../listening/types';
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
    </div>
  );
}

export { EditorField, EditorTextArea };

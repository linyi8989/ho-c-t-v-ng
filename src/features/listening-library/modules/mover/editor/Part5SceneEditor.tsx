import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { ListeningAssetPicker } from '../../../../listening/admin/ListeningAssetPicker';
import { ListeningRegionEditor } from '../../../../listening/admin/ListeningRegionEditor';
import type { ListeningPart5, ListeningPart5Action, ListeningPart5SceneColourDraw } from '../../../../listening/types';
import { createMoverDefaultRegion, createMoverEditorId } from './editorUtilities';
import { EditorField, type MoverPartEditorProps } from './shared';

type ActiveRegion = {
  actionId: string;
  type: ListeningPart5Action['type'];
} | undefined;

export function Part5SceneEditor({ part, props }: { part: ListeningPart5SceneColourDraw; props: MoverPartEditorProps<ListeningPart5> }) {
  const { assets, assetUrl, aiCapability, onUpload, onChange } = props;
  const [activeRegion, setActiveRegion] = useState<ActiveRegion>();
  const commit = (next: ListeningPart5SceneColourDraw) => onChange(next);
  const paletteColourIds = part.colourPaletteIds || [];
  const paletteColours = paletteColourIds.flatMap(id => {
    const colour = part.colours.find(item => item.id === id);
    return colour ? [colour] : [];
  });
  const correctColourIds = new Set(part.questions.flatMap(question => question.actions.flatMap(action => (
    action.type === 'colour_object' ? [action.correctColourId] : []
  ))));
  const correctPaletteIds = new Set(part.questions.flatMap(question => question.actions.flatMap(action => (
    action.type === 'place_object' ? [action.correctPaletteItemId] : []
  ))));
  const updateQuestion = (
    questionId: string,
    updater: (question: ListeningPart5SceneColourDraw['questions'][number]) => ListeningPart5SceneColourDraw['questions'][number],
  ) => commit({
    ...part,
    questions: part.questions.map(question => question.id === questionId ? updater(question) : question),
  });
  const addColourAction = (questionId: string) => {
    const objectId = createMoverEditorId('p5-object');
    const correctColourId = paletteColourIds[0] || part.colours[0]?.id || '';
    const action: ListeningPart5Action = {
      id: createMoverEditorId('p5-action'),
      type: 'colour_object',
      correctObjectId: objectId,
      correctColourId,
    };
    commit({
      ...part,
      colourPaletteIds: paletteColourIds.length || !correctColourId ? paletteColourIds : [correctColourId],
      interactiveObjects: [
        ...part.interactiveObjects,
        {
          id: objectId,
          label: 'Vật cần tô',
          geometry: createMoverDefaultRegion(part.interactiveObjects.length),
          interactionKinds: ['colour'],
          geometryConfirmedByTeacher: false,
        },
      ],
      questions: part.questions.map(question => question.id === questionId
        ? { ...question, actions: [...question.actions, action] }
        : question),
    });
  };
  const addPlaceAction = (questionId: string) => {
    const firstItem = part.objectPalette[0] || {
      id: createMoverEditorId('p5-token'),
      objectType: 'draw-object',
      label: 'Vật Draw',
    };
    commit({
      ...part,
      objectPalette: part.objectPalette.length ? part.objectPalette : [firstItem],
      questions: part.questions.map(question => question.id === questionId ? {
        ...question,
        actions: [
          ...question.actions,
          {
            id: createMoverEditorId('p5-action'),
            type: 'place_object',
            correctPaletteItemId: firstItem.id,
            targetRegion: createMoverDefaultRegion(question.actions.length),
            geometryConfirmedByTeacher: false,
          },
        ],
      } : question),
    });
  };
  const toggleStudentColour = (colourId: string) => {
    if (paletteColourIds.includes(colourId)) {
      if (correctColourIds.has(colourId)) return;
      commit({ ...part, colourPaletteIds: paletteColourIds.filter(id => id !== colourId) });
      return;
    }
    commit({ ...part, colourPaletteIds: [...paletteColourIds, colourId] });
  };
  const addPaletteItem = () => {
    const index = part.objectPalette.length + 1;
    commit({
      ...part,
      objectPalette: [...part.objectPalette, {
        id: createMoverEditorId('p5-token'),
        objectType: `draw-object-${index}`,
        label: `Vật Draw ${index}`,
      }],
    });
  };
  const removePaletteItem = (itemId: string) => {
    if (correctPaletteIds.has(itemId)) return;
    commit({ ...part, objectPalette: part.objectPalette.filter(item => item.id !== itemId) });
  };
  const removeAction = (questionId: string, action: ListeningPart5Action) => {
    const nextQuestions = part.questions.map(question => question.id === questionId
      ? { ...question, actions: question.actions.filter(item => item.id !== action.id) }
      : question);
    const referencedObjectIds = new Set(nextQuestions.flatMap(question => question.actions.flatMap(item => (
      item.type === 'colour_object' ? [item.correctObjectId] : []
    ))));
    commit({
      ...part,
      questions: nextQuestions,
      interactiveObjects: part.interactiveObjects.filter(object => referencedObjectIds.has(object.id)),
    });
    if (activeRegion?.actionId === action.id) setActiveRegion(undefined);
  };

  return (
    <div className="space-y-5" data-part5-simple-editor>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <ListeningAssetPicker
          assets={assets}
          aiCapability={aiCapability}
          onUpload={onUpload}
          label="Ảnh đề bài · hiển thị cho học sinh"
          kind="image"
          value={part.sceneAssetId}
          onChange={sceneAssetId => commit({ ...part, sceneAssetId })}
        />
      </section>

      <section className="space-y-4" data-part5-answer-table>
        <div>
          <h4 className="text-sm font-black text-slate-950">Bảng đáp án đã nhập · Part 5</h4>
          <p className="text-[11px] font-semibold text-slate-500">
            Thông số bên ngoài hoặc AI điền nội dung thô. Giáo viên kiểm tra từng dòng và khoanh lại vùng đáp án nếu cần.
          </p>
        </div>

        {part.questions.map(question => (
          <article key={question.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 md:grid-cols-[72px_1fr]">
              <span className="self-center text-xs font-black text-slate-500">Câu {question.questionNumber}</span>
              <EditorField
                label="Nội dung nhận diện hoặc đã nhập"
                value={question.staffPrompt}
                onChange={staffPrompt => updateQuestion(question.id, current => ({ ...current, staffPrompt }))}
              />
            </div>

            <div className="divide-y divide-slate-100">
              {question.actions.map((action, actionIndex) => {
                const object = action.type === 'colour_object'
                  ? part.interactiveObjects.find(item => item.id === action.correctObjectId)
                  : undefined;
                const paletteItem = action.type === 'place_object'
                  ? part.objectPalette.find(item => item.id === action.correctPaletteItemId)
                  : undefined;
                const isEditing = activeRegion?.actionId === action.id;
                const regionConfirmed = action.type === 'colour_object'
                  ? Boolean(object?.geometryConfirmedByTeacher)
                  : Boolean(action.geometryConfirmedByTeacher);

                return (
                  <div key={action.id} className="space-y-3 p-4" data-part5-answer-row>
                    <div className={`grid gap-3 ${action.type === 'place_object' ? 'lg:grid-cols-[90px_minmax(150px,.7fr)_minmax(180px,1fr)_minmax(250px,1.2fr)_auto_auto]' : 'lg:grid-cols-[90px_1fr_1fr_auto_auto]'} lg:items-end`}>
                      <div>
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-black ${action.type === 'colour_object' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>
                          {action.type === 'colour_object' ? 'Colour' : 'Draw'}{question.actions.length > 1 ? ` ${actionIndex + 1}` : ''}
                        </span>
                      </div>

                      {action.type === 'colour_object' ? (
                        <>
                          <EditorField
                            label="Vật thể cần tô"
                            value={object?.label || ''}
                            onChange={label => commit({
                              ...part,
                              interactiveObjects: part.interactiveObjects.map(item => item.id === action.correctObjectId
                                ? { ...item, label }
                                : item),
                            })}
                          />
                          <label className="space-y-1">
                            <span className="text-xs font-black">Màu đúng</span>
                            <select
                              value={action.correctColourId}
                              onChange={event => updateQuestion(question.id, current => ({
                                ...current,
                                actions: current.actions.map(item => item.id === action.id && item.type === 'colour_object'
                                  ? { ...item, correctColourId: event.target.value }
                                  : item),
                              }))}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
                            >
                              <option value="">— Chọn màu —</option>
                              {paletteColours.map(colour => <option key={colour.id} value={colour.id}>{colour.label}</option>)}
                            </select>
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="space-y-1">
                            <span className="text-xs font-black">Vật đúng</span>
                            <select
                              value={action.correctPaletteItemId}
                              onChange={event => updateQuestion(question.id, current => ({
                                ...current,
                                actions: current.actions.map(item => item.id === action.id && item.type === 'place_object'
                                  ? { ...item, correctPaletteItemId: event.target.value }
                                  : item),
                              }))}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
                            >
                              <option value="">— Chọn vật —</option>
                              {part.objectPalette.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                            </select>
                          </label>
                          <EditorField
                            label="Vị trí cần đặt"
                            value={action.relationLabel || ''}
                            onChange={relationLabel => updateQuestion(question.id, current => ({
                              ...current,
                              actions: current.actions.map(item => item.id === action.id && item.type === 'place_object'
                                ? { ...item, relationLabel }
                                : item),
                            }))}
                          />
                        </>
                      )}

                      {action.type === 'place_object' && paletteItem && (
                        <ListeningAssetPicker
                          compact
                          assets={assets}
                          aiCapability={{ enabled: false, reason: 'Icon Draw do giáo viên tải lên và xác nhận.' }}
                          onUpload={onUpload}
                          allowedMimeTypes={['image/png']}
                          label={`Ảnh ${paletteItem.label || 'vật Draw'}`}
                          kind="image"
                          value={paletteItem.tokenAssetId}
                          onChange={tokenAssetId => commit({
                            ...part,
                            objectPalette: part.objectPalette.map(item => item.id === paletteItem.id ? { ...item, tokenAssetId } : item),
                          })}
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveRegion(isEditing ? undefined : { actionId: action.id, type: action.type })}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-black ${isEditing ? 'border-blue-600 bg-blue-600 text-white' : regionConfirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
                      >
                        {isEditing ? 'Đóng vùng vẽ' : regionConfirmed ? 'Vẽ lại vùng đáp án' : 'Vẽ để chọn vùng đáp án'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAction(question.id, action)}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                        aria-label="Xóa action"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {isEditing && action.type === 'colour_object' && object && (
                      <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/40 p-3" data-part5-colour-region-editor>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[11px] font-semibold text-violet-800">
                            Khoanh tương đối quanh “{object.label || 'vật thể'}”. Hệ thống sẽ thử bám theo đường line tối để tạo vùng sát vật thể.
                          </p>
                          <button type="button" onClick={() => setActiveRegion(undefined)} className="rounded-lg p-1 text-violet-700" aria-label="Đóng vùng vẽ"><X size={15} /></button>
                        </div>
                        <ListeningRegionEditor
                          freehandOnly
                          edgeSnap
                          imageUrl={assetUrl(part.sceneAssetId)}
                          items={[{ id: object.id, label: object.label, region: object.geometry }]}
                          onChange={items => {
                            const nextRegion = items[0]?.region;
                            if (!nextRegion) return;
                            commit({
                              ...part,
                              interactiveObjects: part.interactiveObjects.map(item => item.id === object.id
                                ? { ...item, geometry: nextRegion, geometryConfirmedByTeacher: true }
                                : item),
                            });
                          }}
                        />
                      </div>
                    )}

                    {isEditing && action.type === 'place_object' && (
                      <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/40 p-3" data-part5-draw-region-editor>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[11px] font-semibold text-sky-800">
                            Kéo một hình chữ nhật hoặc hình vuông làm vùng đặt icon. Học sinh đặt tâm icon ở bất kỳ đâu bên trong đều đúng; vùng này không được gửi xuống player.
                          </p>
                          <button type="button" onClick={() => setActiveRegion(undefined)} className="rounded-lg p-1 text-sky-700" aria-label="Đóng vùng vẽ"><X size={15} /></button>
                        </div>
                        <ListeningRegionEditor
                          rectangleOnly
                          imageUrl={assetUrl(part.sceneAssetId)}
                          items={[{ id: action.id, label: action.relationLabel || `Câu ${question.questionNumber}`, region: action.targetRegion }]}
                          onChange={items => {
                            const nextRegion = items[0]?.region;
                            if (!nextRegion) return;
                            updateQuestion(question.id, current => ({
                              ...current,
                              actions: current.actions.map(item => item.id === action.id && item.type === 'place_object'
                                ? { ...item, targetRegion: nextRegion, geometryConfirmedByTeacher: true }
                                : item),
                            }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {question.actions.length === 0 && /^\s*draw\b/i.test(question.staffPrompt) && (
                <div className="grid gap-3 p-4 md:grid-cols-[90px_1fr_auto] md:items-center" data-part5-draw-recovery-row>
                  <span className="inline-flex w-fit rounded-full bg-sky-100 px-3 py-1.5 text-[11px] font-black text-sky-800">Draw</span>
                  <p className="text-xs font-semibold text-amber-700">Câu lệnh ghi rõ Draw nhưng nguồn phân tích chưa tạo action. Có thể phục hồi dòng Draw mà không đoán vị trí.</p>
                  <button type="button" onClick={() => addPlaceAction(question.id)} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs font-black text-sky-800">Tạo Draw và chọn vùng</button>
                </div>
              )}
              {question.actions.length === 0 && !/^\s*draw\b/i.test(question.staffPrompt) && (
                <p className="p-4 text-xs font-semibold text-amber-700">Nguồn phân tích chưa nhận ra action của câu này. Dữ liệu chưa được đoán; giáo viên có thể thêm thủ công bên dưới.</p>
              )}
            </div>

            <details className="border-t border-slate-100 px-4 py-3">
              <summary className="cursor-pointer text-[11px] font-black text-slate-500">Thêm action thủ công</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => addColourAction(question.id)} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700"><Plus size={13} className="inline" /> Colour</button>
                <button type="button" onClick={() => addPlaceAction(question.id)} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700"><Plus size={13} className="inline" /> Draw</button>
              </div>
            </details>
          </article>
        ))}

        <article className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm" data-part5-dynamic-colour-palette>
          <div>
            <p className="text-sm font-black text-emerald-950">Màu hiển thị cho học sinh · {paletteColourIds.length}</p>
            <p className="text-[11px] font-semibold text-emerald-800">Chọn đúng số màu bài này cần. Màu đang làm đáp án không thể bỏ; lựa chọn dư là tùy chọn, không bắt buộc.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
            {part.colours.map(colour => {
              const selected = paletteColourIds.includes(colour.id);
              const required = correctColourIds.has(colour.id);
              return (
                <button
                  key={colour.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleStudentColour(colour.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-black ${selected ? 'border-emerald-500 bg-white text-emerald-900' : 'border-slate-200 bg-white/70 text-slate-600'} ${required ? 'cursor-not-allowed ring-1 ring-emerald-300' : ''}`}
                  title={required ? 'Màu này đang được một action Colour sử dụng.' : undefined}
                >
                  <span className="h-6 w-6 shrink-0 rounded-lg border" style={{ backgroundColor: colour.value }} />
                  <span>{colour.label}{required ? ' · đang dùng' : ''}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm" data-part5-dynamic-object-palette>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-sky-950">Vật kéo thả · {part.objectPalette.length}</p>
              <p className="text-[11px] font-semibold text-sky-800">Thêm đúng số vật bài này cung cấp. Vật không được action Draw dùng sẽ tự là lựa chọn bổ sung; không bắt buộc phải có vật nhiễu.</p>
            </div>
            <button type="button" onClick={addPaletteItem} className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white"><Plus size={13} className="inline" /> Thêm vật</button>
          </div>
          {part.objectPalette.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {part.objectPalette.map(item => {
                const required = correctPaletteIds.has(item.id);
                return (
                  <div key={item.id} className="space-y-3 rounded-xl border border-sky-200 bg-white p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <EditorField
                          label={required ? 'Tên vật · đang dùng' : 'Tên vật · lựa chọn bổ sung'}
                          value={item.label}
                          onChange={label => commit({
                            ...part,
                            objectPalette: part.objectPalette.map(entry => entry.id === item.id
                              ? { ...entry, label, objectType: label.trim() || entry.objectType }
                              : entry),
                          })}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={required}
                        onClick={() => removePaletteItem(item.id)}
                        className="mt-5 rounded-lg p-2 text-rose-600 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`Xóa ${item.label}`}
                        title={required ? 'Vật này đang được một action Draw sử dụng.' : undefined}
                      ><Trash2 size={16} /></button>
                    </div>
                    <ListeningAssetPicker
                      compact
                      assets={assets}
                      aiCapability={{ enabled: false, reason: 'Icon Draw do giáo viên tải lên và xác nhận.' }}
                      onUpload={onUpload}
                      allowedMimeTypes={['image/png']}
                      label={`Icon PNG ${item.label || 'vật Draw'}`}
                      kind="image"
                      value={item.tokenAssetId}
                      onChange={tokenAssetId => commit({
                        ...part,
                        objectPalette: part.objectPalette.map(entry => entry.id === item.id ? { ...entry, tokenAssetId } : entry),
                      })}
                    />
                  </div>
                );
              })}
            </div>
          ) : <p className="rounded-xl border-2 border-dashed border-sky-200 bg-white px-4 py-8 text-center text-xs font-bold text-sky-700">Bài chưa có action Draw nên có thể để danh sách vật trống.</p>}
        </article>
      </section>
    </div>
  );
}

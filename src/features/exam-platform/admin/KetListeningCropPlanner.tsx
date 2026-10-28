import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { SmartImportCrop } from '../../listening-editor/smart-import/types';
import { drawKetCrop, moveKetCrop, normalizeKetCrop, resizeKetCropByOffset, type KetCropCorner, type KetCropPoint } from '../ketListeningCropGeometry';

export interface KetListeningCropPlannerProps {
  imageUrl: string;
  groups: (SmartImportCrop | null)[][];
  labels: string[][];
  candidates?: SmartImportCrop[];
  disabled?: boolean;
  onChange: (groups: (SmartImportCrop | null)[][]) => void;
}

type Slot = { question: number; slot: number; label: string };
type Operation = { pointerId: number; mode: 'draw' | 'move' | 'resize'; start: KetCropPoint; original: SmartImportCrop | null; target: Slot; corner?: KetCropCorner; source: string };
const boxStyle = (box: SmartImportCrop) => ({ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` });

/** Edits crop proposals only. Upload and attachment remain with the authoring controller. */
export default function KetListeningCropPlanner({ imageUrl, groups, labels, candidates = [], disabled = false, onChange }: KetListeningCropPlannerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'draw' | 'move' | 'candidate' | 'pan'>('draw');
  const [zoom, setZoom] = useState(100);
  const [loadedUrl, setLoadedUrl] = useState('');
  const [failedUrl, setFailedUrl] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const operationRef = useRef<Operation | null>(null);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const slots: Slot[] = labels.flatMap((row, question) => row.map((label, slot) => ({ question, slot, label })));
  const slotShape = JSON.stringify(labels);
  const index = Math.min(selectedIndex, Math.max(0, slots.length - 1));
  const selected = slots[index];
  const current = selected ? groups[selected.question]?.[selected.slot] || null : null;
  const ready = Boolean(imageUrl && loadedUrl === imageUrl && failedUrl !== imageUrl);
  const inactive = disabled || !ready || !selected;
  useEffect(() => { setSelectedIndex(0); setMode('draw'); }, [imageUrl, slotShape]);
  useEffect(() => {
    // Source/layout changes invalidate the gesture without writing its old crop
    // back into the replacement plan. The controller owns plan invalidation.
    const operation = operationRef.current;
    operationRef.current = null;
    if (operation && stageRef.current?.hasPointerCapture(operation.pointerId)) {
      stageRef.current.releasePointerCapture(operation.pointerId);
    }
  }, [imageUrl, slotShape, disabled]);
  const setBox = (target: Slot, value: SmartImportCrop | null) => {
    const next = labels.map((row, question) => row.map((_, slot) => question === target.question && slot === target.slot ? value : groupsRef.current[question]?.[slot] || null));
    groupsRef.current = next;
    onChange(next);
  };
  const point = (event: PointerEvent): KetCropPoint | null => {
    const bounds = imageRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return null;
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
  };
  const begin = (event: PointerEvent, action: Operation['mode'], target = selected, corner?: KetCropCorner) => {
    if (inactive || !target || event.button !== 0 || operationRef.current) return;
    const start = point(event), original = groupsRef.current[target.question]?.[target.slot] || null;
    if (!start || (action !== 'draw' && !original)) return;
    event.preventDefault(); event.stopPropagation();
    operationRef.current = { pointerId: event.pointerId, mode: action, start, original, target, corner, source: imageUrl };
    stageRef.current?.setPointerCapture(event.pointerId);
    if (action === 'draw') setBox(target, drawKetCrop(start, start));
  };
  const move = (event: PointerEvent) => {
    const operation = operationRef.current;
    if (!operation || operation.pointerId !== event.pointerId || operation.source !== imageUrl || disabled) return;
    const end = point(event);
    if (!end) return;
    const next = operation.mode === 'draw' ? drawKetCrop(operation.start, end)
      : operation.mode === 'move' ? moveKetCrop(operation.original!, { x: end.x - operation.start.x, y: end.y - operation.start.y })
        : resizeKetCropByOffset(operation.original!, operation.corner!, { x: end.x - operation.start.x, y: end.y - operation.start.y });
    if (next) setBox(operation.target, next);
  };
  const finish = (event: PointerEvent, cancelled = false) => {
    const operation = operationRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    operationRef.current = null;
    if (cancelled && operation.source === imageUrl) setBox(operation.target, operation.original);
    if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId);
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (inactive || !selected || event.target !== event.currentTarget) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); setBox(selected, null); return; }
    if (!current) return;
    const step = event.shiftKey ? .01 : .001;
    const offset = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }[event.key];
    if (offset) { event.preventDefault(); setBox(selected, moveKetCrop(current, offset)); }
  };
  const choose = (nextIndex: number) => { setSelectedIndex(nextIndex); };
  const handles: KetCropCorner[] = ['nw', 'ne', 'sw', 'se'];

  return <section className="space-y-3 min-w-0" data-ket-crop-planner aria-label="Chỉnh vùng crop hàng loạt">
    <div className="flex flex-wrap gap-2" aria-label="Vị trí ảnh cần crop">{slots.map((target, slotIndex) => <button
      key={`${target.question}-${target.slot}`} type="button" className="ket-crop-slot rounded-lg border px-3 py-2 text-xs font-black"
      data-ket-crop-slot={`${target.question}-${target.slot}`} aria-pressed={slotIndex === index} disabled={disabled}
      onClick={() => choose(slotIndex)} aria-label={`${target.label}${groups[target.question]?.[target.slot] ? ' · đã chọn vùng' : ' · chưa chọn vùng'}`}
    >{target.label} · {groups[target.question]?.[target.slot] ? '✓' : 'Chưa chọn'}</button>)}</div>
    {!slots.length && <p role="status" className="text-sm font-semibold">Chưa có vị trí ảnh. Hãy thêm câu hỏi và chọn bố cục trước.</p>}
    <div className="flex flex-wrap items-center gap-2" aria-label="Công cụ chỉnh crop">
      <button type="button" className="ket-crop-tool rounded-lg border px-3 py-2 text-xs font-black" data-ket-crop-action="draw" aria-pressed={mode === 'draw'} disabled={inactive} onClick={() => setMode('draw')}>Vẽ lại vùng</button>
      <button type="button" className="ket-crop-tool rounded-lg border px-3 py-2 text-xs font-black" data-ket-crop-action="move" aria-pressed={mode === 'move'} disabled={inactive || !current} onClick={() => setMode('move')}>Di chuyển vùng</button>
      {candidates.length > 0 && <button type="button" className="ket-crop-tool rounded-lg border px-3 py-2 text-xs font-black" data-ket-crop-action="candidate" aria-pressed={mode === 'candidate'} disabled={inactive} onClick={() => setMode('candidate')}>Chọn khung đã dò ({candidates.length})</button>}
      <button type="button" className="ket-crop-tool rounded-lg border px-3 py-2 text-xs font-black" data-ket-crop-action="pan" aria-pressed={mode === 'pan'} disabled={inactive} onClick={() => setMode('pan')}>Cuộn ảnh</button>
      <button type="button" className="ket-crop-tool rounded-lg border px-3 py-2 text-xs font-black" data-ket-crop-action="clear" disabled={inactive || !current} onClick={() => selected && setBox(selected, null)}>Xóa vùng này</button>
      <label className="text-xs font-bold">Phóng to<select className="ml-2 rounded-lg border bg-white px-2 py-2" aria-label="Phóng to ảnh nguồn crop" value={zoom} disabled={disabled} onChange={event => setZoom(Number(event.target.value))}>{[100, 150, 200].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>
    </div>
    <p className="text-xs font-semibold text-slate-800" role="status">{selected ? `Đang chỉnh ${selected.label}. ` : ''}{mode === 'candidate' ? 'Bấm vào một khung nét đứt để dùng cho vị trí đang chọn.' : mode === 'move' ? 'Kéo vùng đang chọn hoặc bốn góc để chỉnh kích thước.' : mode === 'pan' ? 'Vuốt để cuộn ảnh đã phóng to. Chọn Vẽ lại vùng hoặc Di chuyển vùng để tiếp tục chỉnh.' : 'Kéo trực tiếp trên ảnh để vẽ vùng mới, kể cả bên trong vùng cũ.'}</p>
    {!imageUrl ? <p role="status" className="rounded-lg border p-3 text-sm font-bold">Hãy gắn ảnh trang nguồn để chọn vùng.</p> : <>
      {failedUrl === imageUrl && <p role="alert" className="rounded-lg border p-3 text-sm font-bold">Không đọc được ảnh nguồn. Hãy kiểm tra ảnh đã gắn trước khi crop.</p>}
      {!ready && failedUrl !== imageUrl && <p role="status" className="text-sm font-semibold">Đang tải ảnh nguồn…</p>}
      <div className="overflow-auto rounded-xl border border-slate-300 bg-slate-100" style={{ maxHeight: '70vh' }} data-ket-crop-scroll>
        <div ref={stageRef} data-ket-crop-stage tabIndex={inactive ? -1 : 0} role="group" aria-label={`Ảnh nguồn crop${selected ? ` · ${selected.label}` : ''}`}
          className="relative select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-700" style={{ width: `${zoom}%`, minWidth: '100%', cursor: mode === 'pan' ? 'grab' : mode === 'move' ? 'move' : 'crosshair', touchAction: mode === 'pan' ? 'pan-x pan-y' : 'none' }}
          onPointerDown={event => { if (mode === 'draw') begin(event, 'draw'); }} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} onKeyDown={keyboard}
        >
          <img key={imageUrl} ref={imageRef} src={imageUrl} alt="Ảnh trang nguồn để chỉnh tất cả vùng crop" draggable={false} className="pointer-events-none block h-auto w-full"
            onLoad={() => { setLoadedUrl(imageUrl); setFailedUrl(''); }} onError={() => setFailedUrl(imageUrl)} />
          {ready && mode === 'candidate' && candidates.map((candidate, candidateIndex) => <button type="button" key={candidateIndex} className="ket-crop-candidate absolute border-2 border-dashed border-slate-700 bg-transparent p-0"
            style={boxStyle(candidate)} aria-label={`Dùng khung đã dò ${candidateIndex + 1} cho ${selected?.label || 'vị trí ảnh'}`} disabled={disabled || !selected}
            onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); const crop = normalizeKetCrop(candidate); if (selected && crop) { setBox(selected, crop); setMode('move'); } }}
          ><span className="pointer-events-none absolute left-0 top-0 bg-white px-1 text-[10px] text-slate-950">{candidateIndex + 1}</span></button>)}
          {ready && slots.map((target, slotIndex) => {
            const box = groups[target.question]?.[target.slot];
            if (!box) return null;
            const isSelected = slotIndex === index;
            return <div key={`${target.question}-${target.slot}`} className="ket-crop-region absolute border-2" data-selected={isSelected} style={{ ...boxStyle(box), pointerEvents: mode === 'move' && isSelected && !disabled ? 'auto' : 'none', borderColor: isSelected ? '#1d4ed8' : '#047857', background: isSelected ? 'rgba(29,78,216,.08)' : 'transparent' }}
              onPointerDown={event => begin(event, 'move', target)}>
              <span className="pointer-events-none absolute left-0 top-0 bg-white px-1 text-[10px] font-black text-slate-950">{target.label}</span>
              {isSelected && mode !== 'pan' && handles.map(corner => <button key={corner} type="button" className="ket-crop-handle absolute h-5 w-5 rounded-full border-2 border-white bg-blue-700 p-0" disabled={inactive}
                style={{ pointerEvents: inactive ? 'none' : 'auto', left: corner.includes('w') ? 0 : '100%', top: corner.includes('n') ? 0 : '100%', transform: `translate(${corner.includes('w') ? '0' : '-100%'},${corner.includes('n') ? '0' : '-100%'})`, cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize' }}
                aria-label={`Đổi kích thước ${target.label} góc ${corner}`} onPointerDown={event => begin(event, 'resize', target, corner)} />)}
            </div>;
          })}
        </div>
      </div>
    </>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="ket-crop-tool rounded-lg border px-3 py-2 text-xs font-black" data-ket-crop-action="previous" disabled={disabled || index === 0 || !slots.length} onClick={() => choose(index - 1)}>Vị trí trước</button>
      <button type="button" className="ket-crop-tool rounded-lg border px-3 py-2 text-xs font-black" data-ket-crop-action="next" disabled={disabled || index >= slots.length - 1} onClick={() => choose(index + 1)}>Vị trí tiếp</button>
      <span className="text-xs font-semibold text-slate-700">Tab tới ảnh rồi dùng phím mũi tên để dịch vùng; Shift để dịch nhanh; Delete để xóa vùng.</span>
    </div>
  </section>;
}

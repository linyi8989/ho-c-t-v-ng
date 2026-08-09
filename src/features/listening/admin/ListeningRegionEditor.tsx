import React, { useMemo, useRef, useState } from 'react';
import { Check, Circle, MousePointer2, Pentagon, RotateCcw, Square } from 'lucide-react';
import type { ListeningRegion, ListeningRegionShape } from '../types';
import { regionFromPolygon } from '../geometry';
import { edgeSnapPolygon, type EdgeSnapMode } from './edgeSnapPolygon';

interface RegionItem {
  id: string;
  label?: string;
  region: ListeningRegion;
}

interface ListeningRegionEditorProps {
  imageUrl?: string;
  items: RegionItem[];
  onChange: (items: RegionItem[]) => void;
  edgeSnap?: boolean;
  freehandOnly?: boolean;
  rectangleOnly?: boolean;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const convexHull = (points: Array<{ x: number; y: number }>) => {
  const unique = [...new Map(points.map(item => [`${item.x.toFixed(5)}:${item.y.toFixed(5)}`, item])).values()]
    .sort((first, second) => first.x - second.x || first.y - second.y);
  if (unique.length < 3) return unique;
  const cross = (origin: { x: number; y: number }, first: { x: number; y: number }, second: { x: number; y: number }) => (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);
  const lower: typeof unique = [];
  unique.forEach(item => { while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, item) <= 0) lower.pop(); lower.push(item); });
  const upper: typeof unique = [];
  [...unique].reverse().forEach(item => { while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, item) <= 0) upper.pop(); upper.push(item); });
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

export function ListeningRegionEditor({ imageUrl, items, onChange, edgeSnap = false, freehandOnly = false, rectangleOnly = false }: ListeningRegionEditorProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [activeId, setActiveId] = useState(items[0]?.id || '');
  const [shape, setShape] = useState<ListeningRegionShape>(edgeSnap ? 'polygon' : 'rect');
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [freehandPoints, setFreehandPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [freehandDrawing, setFreehandDrawing] = useState(false);
  const [history, setHistory] = useState<RegionItem[][]>([]);
  const [snapNotice, setSnapNotice] = useState('');
  const [snapMode, setSnapMode] = useState<EdgeSnapMode>('inner');
  const vertexDragRef = useRef<{ itemId: string; pointIndex: number } | null>(null);

  const active = useMemo(() => items.find(item => item.id === activeId), [activeId, items]);
  const point = (event: React.PointerEvent) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  };
  const commit = (next: RegionItem[]) => {
    setHistory(previous => [...previous.slice(-19), structuredClone(items)]);
    onChange(next);
  };
  const updateActive = (region: ListeningRegion) => {
    if (!activeId) return;
    commit(items.map(item => item.id === activeId ? { ...item, region } : item));
  };
  const startDraw = (event: React.PointerEvent) => {
    if (!activeId) return;
    if (freehandOnly) {
      const start = point(event);
      setFreehandPoints([start]);
      setFreehandDrawing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (shape === 'polygon') {
      setPolygonPoints(previous => [...previous, point(event)]);
      return;
    }
    setDragStart(point(event));
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const commitPolygonPoints = (inputPoints: Array<{ x: number; y: number }>) => {
    const cleanPoints = freehandOnly ? convexHull(inputPoints) : inputPoints;
    if (!activeId || cleanPoints.length < 3) return;
    const roughRegion = regionFromPolygon(cleanPoints);
    if (!roughRegion) return;
    let snappedRegion: ListeningRegion | undefined;
    if (edgeSnap && imageRef.current?.naturalWidth && imageRef.current.naturalHeight) {
      try {
        const image = imageRef.current;
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(4, Math.round(image.naturalWidth * scale));
        const height = Math.max(4, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context) {
          context.drawImage(image, 0, 0, width, height);
          snappedRegion = edgeSnapPolygon({ pixels: context.getImageData(0, 0, width, height).data, width, height, roughPoints: cleanPoints, mode: snapMode });
        }
      } catch {
        snappedRegion = undefined;
      }
    }
    updateActive(snappedRegion || roughRegion);
    setSnapNotice(edgeSnap
      ? snappedRegion ? `Đã lấy ${snapMode === 'inner' ? 'viền trong' : 'viền ngoài'}, gộp các khoang kín và bỏ đường chia nội bộ.` : 'Không đọc được đường viền kín; đang giữ vùng vẽ tương đối để giáo viên kiểm tra.'
      : 'Đã lưu vùng vẽ tự do.');
  };
  const moveDraw = (event: React.PointerEvent) => {
    if (!freehandOnly || !freehandDrawing) return;
    const next = point(event);
    setFreehandPoints(previous => {
      const last = previous.at(-1);
      return !last || Math.hypot(next.x - last.x, next.y - last.y) >= .004 ? [...previous, next] : previous;
    });
  };
  const finishDraw = (event: React.PointerEvent) => {
    if (freehandOnly) {
      if (!freehandDrawing) return;
      const end = point(event);
      const points = [...freehandPoints, end];
      setFreehandDrawing(false);
      setFreehandPoints([]);
      commitPolygonPoints(points);
      return;
    }
    if (!dragStart || !activeId || shape === 'polygon') return;
    const end = point(event);
    const x = Math.min(dragStart.x, end.x);
    const y = Math.min(dragStart.y, end.y);
    const width = Math.abs(end.x - dragStart.x);
    const height = Math.abs(end.y - dragStart.y);
    setDragStart(null);
    if (width < 0.01 || height < 0.01) return;
    updateActive({ shape, x, y, width, height });
  };
  const finishPolygon = () => {
    if (!activeId || polygonPoints.length < 3) return;
    commitPolygonPoints(polygonPoints);
    setPolygonPoints([]);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(value => value.slice(0, -1));
    onChange(previous);
  };
  const beginVertexDrag = (event: React.PointerEvent<SVGCircleElement>, itemId: string, pointIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveId(itemId);
    setHistory(previous => [...previous.slice(-19), structuredClone(items)]);
    vertexDragRef.current = { itemId, pointIndex };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveVertex = (event: React.PointerEvent<SVGCircleElement>) => {
    const dragging = vertexDragRef.current;
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
    const nextPoint = point(event);
    onChange(items.map(item => {
      if (item.id !== dragging.itemId || item.region.shape !== 'polygon' || !item.region.points) return item;
      const points = item.region.points.map((current, index) => index === dragging.pointIndex ? nextPoint : current);
      const region = regionFromPolygon(points);
      return region ? { ...item, region } : item;
    }));
  };
  const finishVertexDrag = (event: React.PointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    event.stopPropagation();
    vertexDragRef.current = null;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {items.length > 1 ? <select
          value={activeId}
          onChange={event => { setActiveId(event.target.value); setPolygonPoints([]); }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
        >
          {items.map((item, index) => <option key={item.id} value={item.id}>Vùng {index + 1}: {item.label || item.id}</option>)}
        </select> : <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">{items[0]?.label || 'Vùng đáp án'}</span>}
        {!freehandOnly && !rectangleOnly && ([
          ['rect', Square, 'Chữ nhật'],
          ['ellipse', Circle, 'Elip'],
          ['polygon', Pentagon, 'Polygon'],
        ] as const).map(([value, Icon, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => { setShape(value); setPolygonPoints([]); }}
            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${
              shape === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        {rectangleOnly && <span className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-800">Vùng Draw · chữ nhật</span>}
        {!freehandOnly && shape === 'polygon' && (
          <button type="button" onClick={finishPolygon} disabled={polygonPoints.length < 3} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
            <Check size={13} /> Khép vùng
          </button>
        )}
        <button type="button" onClick={undo} disabled={!history.length} className="ml-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40">
          <RotateCcw size={13} /> Hoàn tác
        </button>
      </div>
      {!imageUrl ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white text-xs font-bold text-slate-400">
          Chọn hình trước khi đánh dấu vùng
        </div>
      ) : (
        <div
          ref={surfaceRef}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={finishDraw}
          onPointerCancel={() => { setFreehandDrawing(false); setFreehandPoints([]); }}
          className="relative mx-auto max-w-4xl cursor-crosshair touch-none overflow-hidden rounded-xl border border-slate-300 bg-white select-none"
        >
          <img ref={imageRef} crossOrigin="anonymous" src={imageUrl} alt="Vùng tương tác" className="block h-auto w-full pointer-events-none" draggable={false} />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {items.map((item, index) => {
              const region = item.region;
              const common = {
                fill: item.id === activeId ? 'rgba(37,99,235,.22)' : 'rgba(244,63,94,.15)',
                stroke: item.id === activeId ? '#2563eb' : '#f43f5e',
                strokeWidth: 2.5,
                strokeLinejoin: 'round' as const,
                strokeLinecap: 'round' as const,
                vectorEffect: 'non-scaling-stroke' as const,
                pointerEvents: 'none' as const,
              };
              if (region.shape === 'polygon' && region.points?.length) {
                return <polygon key={item.id} points={region.points.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} {...common} />;
              }
              if (region.shape === 'ellipse') {
                return <ellipse key={item.id} cx={(region.x + region.width / 2) * 1000} cy={(region.y + region.height / 2) * 1000} rx={region.width * 500} ry={region.height * 500} {...common} />;
              }
              return <rect key={item.id} x={region.x * 1000} y={region.y * 1000} width={region.width * 1000} height={region.height * 1000} rx="8" {...common} />;
            })}
            {polygonPoints.length > 0 && (
              <polyline points={polygonPoints.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill="none" stroke="#7c3aed" strokeWidth="4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            )}
            {freehandPoints.length > 0 && (
              <polyline points={freehandPoints.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill="rgba(16,185,129,.12)" stroke="#059669" strokeWidth="6" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            )}
            {!freehandOnly && active?.region.shape === 'polygon' && active.region.points?.map((vertex, index) => (
              <circle
                key={`${active.id}-${index}`}
                cx={vertex.x * 1000}
                cy={vertex.y * 1000}
                r="10"
                fill="#ffffff"
                stroke="#1d4ed8"
                strokeWidth="5"
                vectorEffect="non-scaling-stroke"
                pointerEvents="all"
                className="cursor-move"
                onPointerDown={event => beginVertexDrag(event, active.id, index)}
                onPointerMove={moveVertex}
                onPointerUp={finishVertexDrag}
                onPointerCancel={finishVertexDrag}
              />
            ))}
          </svg>
        </div>
      )}
      <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
        <MousePointer2 size={12} /> {freehandOnly ? 'Khoanh một vòng ở phía ngoài vật thể; thả tay để hệ thống tìm đường viền nằm bên trong nét khoanh.' : rectangleOnly ? 'Kéo từ một góc tới góc đối diện để chọn vùng chữ nhật hoặc hình vuông.' : 'Chọn vùng, rồi kéo để vẽ chữ nhật/elip; với polygon, bấm từng điểm và chọn “Khép vùng”.'}
        {active && ` Tọa độ hiện tại: ${active.region.x.toFixed(3)}, ${active.region.y.toFixed(3)}.`}
      </p>
      {edgeSnap && <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-emerald-700">
        <span>Bám biên:</span>
        {(['inner', 'outer'] as const).map(mode => <button key={mode} type="button" onClick={() => setSnapMode(mode)} className={`rounded-lg border px-2 py-1 ${snapMode === mode ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-emerald-200 bg-white text-emerald-700'}`}>{mode === 'inner' ? 'Viền trong' : 'Viền ngoài'}</button>)}
        <span>{snapNotice || 'Khoanh rộng ra ngoài vật thể để hệ thống loại nền và các đường chia bên trong.'}</span>
      </div>}
    </div>
  );
}

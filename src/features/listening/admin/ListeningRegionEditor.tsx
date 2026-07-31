import React, { useMemo, useRef, useState } from 'react';
import { Check, Circle, MousePointer2, Pentagon, RotateCcw, Square } from 'lucide-react';
import type { ListeningRegion, ListeningRegionShape } from '../types';

interface RegionItem {
  id: string;
  label?: string;
  region: ListeningRegion;
}

interface ListeningRegionEditorProps {
  imageUrl?: string;
  items: RegionItem[];
  onChange: (items: RegionItem[]) => void;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function ListeningRegionEditor({ imageUrl, items, onChange }: ListeningRegionEditorProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(items[0]?.id || '');
  const [shape, setShape] = useState<ListeningRegionShape>('rect');
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [history, setHistory] = useState<RegionItem[][]>([]);

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
    if (shape === 'polygon') {
      setPolygonPoints(previous => [...previous, point(event)]);
      return;
    }
    setDragStart(point(event));
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finishDraw = (event: React.PointerEvent) => {
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
    const xs = polygonPoints.map(item => item.x);
    const ys = polygonPoints.map(item => item.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const width = Math.max(...xs) - x;
    const height = Math.max(...ys) - y;
    updateActive({
      shape: 'polygon',
      x,
      y,
      width,
      height,
      points: polygonPoints,
    });
    setPolygonPoints([]);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(value => value.slice(0, -1));
    onChange(previous);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={activeId}
          onChange={event => { setActiveId(event.target.value); setPolygonPoints([]); }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
        >
          {items.map((item, index) => <option key={item.id} value={item.id}>Vùng {index + 1}: {item.label || item.id}</option>)}
        </select>
        {([
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
        {shape === 'polygon' && (
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
          onPointerUp={finishDraw}
          className="relative mx-auto max-w-4xl cursor-crosshair touch-none overflow-hidden rounded-xl border border-slate-300 bg-white select-none"
        >
          <img src={imageUrl} alt="Vùng tương tác" className="block h-auto w-full pointer-events-none" draggable={false} />
          <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {items.map((item, index) => {
              const region = item.region;
              const common = {
                fill: item.id === activeId ? 'rgba(37,99,235,.22)' : 'rgba(244,63,94,.15)',
                stroke: item.id === activeId ? '#2563eb' : '#f43f5e',
                strokeWidth: 4,
                vectorEffect: 'non-scaling-stroke' as const,
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
              <polyline points={polygonPoints.map(p => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill="none" stroke="#7c3aed" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
        </div>
      )}
      <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
        <MousePointer2 size={12} /> Chọn vùng, rồi kéo để vẽ chữ nhật/elip; với polygon, bấm từng điểm và chọn “Khép vùng”.
        {active && ` Tọa độ hiện tại: ${active.region.x.toFixed(3)}, ${active.region.y.toFixed(3)}.`}
      </p>
    </div>
  );
}

import React, { useRef, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import type { ListeningRegion } from '../../listening/types';

export interface FixedRegionItem {
  id: string;
  label: string;
  region: ListeningRegion;
}

interface FixedRegionEditorProps {
  imageUrl?: string;
  items: FixedRegionItem[];
  onChange: (items: FixedRegionItem[]) => void;
  width?: number;
  height?: number;
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export default function FixedRegionEditor({
  imageUrl,
  items,
  onChange,
  width = 0.12,
  height = 0.055,
}: FixedRegionEditorProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: width / 2, y: height / 2 });
  const draggingIdRef = useRef('');
  const [activeId, setActiveId] = useState(items[0]?.id || '');
  const [preview, setPreview] = useState<{ id: string; region: ListeningRegion } | null>(null);
  const pointerPosition = (event: React.PointerEvent) => {
    const bounds = surfaceRef.current!.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };
  const pointerRegion = (event: React.PointerEvent): ListeningRegion => {
    const point = pointerPosition(event);
    return {
      shape: 'rect',
      x: clamp(point.x - dragOffsetRef.current.x, 1 - width),
      y: clamp(point.y - dragOffsetRef.current.y, 1 - height),
      width,
      height,
    };
  };
  const begin = (event: React.PointerEvent<HTMLDivElement>, item: FixedRegionItem) => {
    event.preventDefault();
    event.stopPropagation();
    const point = pointerPosition(event);
    const region = {
      ...item.region,
      shape: 'rect' as const,
      width,
      height,
    };
    dragOffsetRef.current = {
      x: clamp(point.x - region.x, width),
      y: clamp(point.y - region.y, height),
    };
    draggingIdRef.current = item.id;
    setActiveId(item.id);
    setPreview({ id: item.id, region });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent) => {
    const draggingId = draggingIdRef.current;
    if (draggingId) setPreview({ id: draggingId, region: pointerRegion(event) });
  };
  const finish = (event: React.PointerEvent) => {
    const draggingId = draggingIdRef.current;
    if (!draggingId) return;
    const region = pointerRegion(event);
    draggingIdRef.current = '';
    setPreview(null);
    onChange(items.map(item => {
      const nextRegion = item.id === draggingId ? region : item.region;
      return {
        ...item,
        region: {
          shape: 'rect',
          x: clamp(nextRegion.x, 1 - width),
          y: clamp(nextRegion.y, 1 - height),
          width,
          height,
        },
      };
    }));
  };

  const moveWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>, item: FixedRegionItem) => {
    const movement = event.shiftKey ? 0.05 : 0.01;
    const offsets: Partial<Record<React.KeyboardEvent['key'], { x: number; y: number }>> = {
      ArrowLeft: { x: -movement, y: 0 },
      ArrowRight: { x: movement, y: 0 },
      ArrowUp: { x: 0, y: -movement },
      ArrowDown: { x: 0, y: movement },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    setActiveId(item.id);
    onChange(items.map(current => current.id === item.id ? {
      ...current,
      region: {
        shape: 'rect',
        x: clamp(current.region.x + offset.x, 1 - width),
        y: clamp(current.region.y + offset.y, 1 - height),
        width,
        height,
      },
    } : current));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      {!imageUrl ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white text-xs font-bold text-slate-400">Chọn hình trước khi đặt vùng</div>
      ) : (
        <div
          ref={surfaceRef}
          className="relative mx-auto max-w-4xl overflow-hidden rounded-xl border border-slate-300 bg-white select-none"
        >
          <img src={imageUrl} alt="Ảnh đặt vùng cố định" className="block h-auto w-full pointer-events-none" draggable={false} />
          {items.map((item, index) => {
            const region = preview?.id === item.id ? preview.region : {
              ...item.region,
              shape: 'rect' as const,
              width,
              height,
            };
            const activeItem = item.id === activeId;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`Kéo vùng ${index + 1}: ${item.label}`}
                onFocus={() => setActiveId(item.id)}
                onKeyDown={event => moveWithKeyboard(event, item)}
                onPointerDown={event => begin(event, item)}
                onPointerMove={move}
                onPointerUp={finish}
                onPointerCancel={() => {
                  draggingIdRef.current = '';
                  setPreview(null);
                }}
                className={`absolute flex touch-none cursor-move items-center justify-center rounded-lg border-2 text-[10px] font-black shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${activeItem ? 'border-blue-700 text-white' : 'border-rose-600 text-slate-900'}`}
                style={{
                  left: `${region.x * 100}%`,
                  top: `${region.y * 100}%`,
                  width: `${width * 100}%`,
                  height: `${height * 100}%`,
                  backgroundColor: activeItem ? 'rgba(37,99,235,.38)' : 'rgba(244,63,94,.12)',
                  zIndex: activeItem ? 20 : 10,
                }}
              >
                {index + 1}
              </div>
            );
          })}
        </div>
      )}
      <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
        <MousePointer2 size={12} /> Kéo trực tiếp bất kỳ khung màu nào tới chính giữa nhân vật/đối tượng. Kích thước khóa cố định {Math.round(width * 100)}% × {Math.round(height * 100)}%; không thể thu phóng.
      </p>
    </div>
  );
}

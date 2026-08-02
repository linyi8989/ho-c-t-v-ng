import React, { useRef } from 'react';
import { Crop } from 'lucide-react';
import type { SmartImportCrop } from './types';

interface VisualCropEditorProps {
  imageUrl?: string;
  crop: SmartImportCrop;
  onChange: (crop: SmartImportCrop) => void;
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
type CropOperation = {
  mode: 'draw' | 'move' | 'resize';
  startX: number;
  startY: number;
  startCrop: SmartImportCrop;
  corner?: ResizeCorner;
};

const MIN_SIZE = 0.03;
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const precise = (value: number) => Math.round(value * 10_000) / 10_000;
const normalize = (crop: SmartImportCrop): SmartImportCrop => {
  const width = clamp(crop.width, MIN_SIZE, 1);
  const height = clamp(crop.height, MIN_SIZE, 1);
  return {
    x: precise(clamp(crop.x, 0, 1 - width)),
    y: precise(clamp(crop.y, 0, 1 - height)),
    width: precise(width),
    height: precise(height),
  };
};

export default function VisualCropEditor({ imageUrl, crop, onChange }: VisualCropEditorProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const operationRef = useRef<CropOperation | null>(null);
  const currentCrop = normalize(crop);

  const pointer = (event: React.PointerEvent) => {
    const bounds = surfaceRef.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    };
  };

  const capture = (event: React.PointerEvent, operation: CropOperation) => {
    operationRef.current = operation;
    surfaceRef.current?.setPointerCapture(event.pointerId);
  };

  const beginDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const point = pointer(event);
    capture(event, {
      mode: 'draw',
      startX: point.x,
      startY: point.y,
      startCrop: currentCrop,
    });
    onChange(normalize({ x: point.x, y: point.y, width: MIN_SIZE, height: MIN_SIZE }));
  };

  const beginMove = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const point = pointer(event);
    capture(event, {
      mode: 'move',
      startX: point.x,
      startY: point.y,
      startCrop: currentCrop,
    });
  };

  const beginResize = (event: React.PointerEvent<HTMLButtonElement>, corner: ResizeCorner) => {
    event.preventDefault();
    event.stopPropagation();
    const point = pointer(event);
    capture(event, {
      mode: 'resize',
      corner,
      startX: point.x,
      startY: point.y,
      startCrop: currentCrop,
    });
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const operation = operationRef.current;
    if (!operation) return;
    const point = pointer(event);
    if (operation.mode === 'draw') {
      const left = Math.min(operation.startX, point.x);
      const top = Math.min(operation.startY, point.y);
      const right = Math.max(operation.startX, point.x);
      const bottom = Math.max(operation.startY, point.y);
      onChange(normalize({
        x: left,
        y: top,
        width: Math.max(MIN_SIZE, right - left),
        height: Math.max(MIN_SIZE, bottom - top),
      }));
      return;
    }
    if (operation.mode === 'move') {
      onChange(normalize({
        ...operation.startCrop,
        x: operation.startCrop.x + point.x - operation.startX,
        y: operation.startCrop.y + point.y - operation.startY,
      }));
      return;
    }
    const start = operation.startCrop;
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;
    if (operation.corner?.includes('w')) left = clamp(point.x, 0, right - MIN_SIZE);
    if (operation.corner?.includes('e')) right = clamp(point.x, left + MIN_SIZE, 1);
    if (operation.corner?.includes('n')) top = clamp(point.y, 0, bottom - MIN_SIZE);
    if (operation.corner?.includes('s')) bottom = clamp(point.y, top + MIN_SIZE, 1);
    onChange(normalize({ x: left, y: top, width: right - left, height: bottom - top }));
  };

  const finish = () => {
    operationRef.current = null;
  };

  const moveWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const distance = event.shiftKey ? 0.05 : 0.01;
    const offset = {
      ArrowLeft: { x: -distance, y: 0 },
      ArrowRight: { x: distance, y: 0 },
      ArrowUp: { x: 0, y: -distance },
      ArrowDown: { x: 0, y: distance },
    }[event.key];
    if (!offset) return;
    event.preventDefault();
    onChange(normalize({ ...currentCrop, x: currentCrop.x + offset.x, y: currentCrop.y + offset.y }));
  };

  const handles: Array<{ corner: ResizeCorner; className: string }> = [
    { corner: 'nw', className: '-left-2 -top-2 cursor-nwse-resize' },
    { corner: 'ne', className: '-right-2 -top-2 cursor-nesw-resize' },
    { corner: 'sw', className: '-bottom-2 -left-2 cursor-nesw-resize' },
    { corner: 'se', className: '-bottom-2 -right-2 cursor-nwse-resize' },
  ];

  return (
    <div className="space-y-2">
      <div
        ref={surfaceRef}
        onPointerDown={beginDraw}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="relative mx-auto max-w-4xl touch-none cursor-crosshair overflow-hidden rounded-xl border border-slate-300 bg-white select-none"
      >
        {imageUrl ? <img src={imageUrl} alt="Ảnh nguồn để crop" draggable={false} className="pointer-events-none block h-auto w-full" /> : (
          <div className="flex min-h-56 items-center justify-center text-xs font-bold text-slate-400">Không tìm thấy ảnh nguồn.</div>
        )}
        {imageUrl && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Vùng crop; kéo để di chuyển, dùng bốn góc để đổi kích thước"
            onPointerDown={beginMove}
            onKeyDown={moveWithKeyboard}
            className="absolute cursor-move border-2 border-blue-600 bg-blue-400/10 outline-none shadow-[0_0_0_9999px_rgba(15,23,42,0.48)] focus-visible:ring-2 focus-visible:ring-blue-300"
            style={{
              left: `${currentCrop.x * 100}%`,
              top: `${currentCrop.y * 100}%`,
              width: `${currentCrop.width * 100}%`,
              height: `${currentCrop.height * 100}%`,
            }}
          >
            {handles.map(handle => (
              <button
                key={handle.corner}
                type="button"
                aria-label={`Đổi kích thước góc ${handle.corner}`}
                onPointerDown={event => beginResize(event, handle.corner)}
                className={`absolute h-4 w-4 rounded-full border-2 border-white bg-blue-600 p-0 ${handle.className}`}
              />
            ))}
          </div>
        )}
      </div>
      <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
        <Crop size={12} /> Kéo trên nền để vẽ vùng mới; kéo trong khung để di chuyển; kéo bốn chấm góc để đổi kích thước.
      </p>
    </div>
  );
}

import { Maximize2, Minimize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { getExamImageProfile, type ExamImageProfile } from '../../exam-media/imageProfiles';

interface ExamImageViewerProps {
  src: string;
  alt: string;
  children?: ReactNode;
  frameRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  imageClassName?: string;
  profile?: ExamImageProfile;
  maxWidth?: string;
  maxHeight?: string;
  expandable?: boolean;
  triggerOnly?: boolean;
  fillFrame?: boolean;
}

export default function ExamImageViewer({
  src,
  alt,
  children,
  frameRef,
  className = '',
  imageClassName = '',
  profile = 'default',
  maxWidth,
  maxHeight,
  expandable = true,
  triggerOnly = false,
  fillFrame = false,
}: ExamImageViewerProps) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const profileConfig = getExamImageProfile(profile);
  const resolvedMaxWidth = maxWidth || profileConfig.maxWidth;
  const resolvedMaxHeight = maxHeight || profileConfig.maxHeight;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === '+' || event.key === '=') setZoom(value => Math.min(3, value + .25));
      if (event.key === '-') setZoom(value => Math.max(.5, value - .25));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await dialogRef.current?.requestFullscreen();
    } catch {
      // Fullscreen can be unavailable in embedded browsers; the modal remains usable.
    }
  };

  return <>
    {triggerOnly ? <button type="button" onClick={event => { event.stopPropagation(); setZoom(1); setOpen(true); }} className="exam-platform-image-expand inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black" aria-label="Phóng to ảnh" title="Phóng to ảnh"><Maximize2 size={18} />Phóng to ảnh</button> : <div data-exam-image-profile={profile} className={`exam-platform-image-viewer relative mx-auto max-w-full overflow-visible rounded-2xl ${fillFrame ? 'h-full w-full' : 'w-fit'} ${className}`} style={fillFrame ? undefined : { maxWidth: resolvedMaxWidth }}>
      <div ref={frameRef} data-exam-image-stage className={`relative mx-auto max-w-full overflow-hidden rounded-[inherit] ${fillFrame ? 'h-full w-full' : 'w-fit'}`}>
        <img src={src} alt={alt} draggable={false} className={`block object-contain ${fillFrame ? 'h-full w-full max-w-none' : 'h-auto w-auto max-w-full'} ${imageClassName}`} style={fillFrame ? undefined : { maxHeight: resolvedMaxHeight, maxWidth: '100%' }} />
        {children}
      </div>
      {expandable && <button type="button" onClick={event => { event.stopPropagation(); setZoom(1); setOpen(true); }} className="exam-platform-image-expand absolute right-2 top-2 z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Phóng to ảnh" title="Phóng to ảnh"><Maximize2 size={20} /></button>}
    </div>}

    {expandable && open && <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Xem ảnh toàn màn hình: ${alt}`} onClick={event => event.stopPropagation()} className="exam-platform-image-dialog fixed inset-0 z-[1000] flex flex-col bg-slate-950/95 p-3 sm:p-5">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-white shadow-xl">
        <p className="min-w-0 flex-1 truncate text-sm font-black">{alt || 'Ảnh đề bài'}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setZoom(value => Math.max(.5, value - .25))} className="exam-platform-image-tool" aria-label="Thu nhỏ"><ZoomOut size={18} /></button>
          <span className="min-w-14 text-center text-xs font-black">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom(value => Math.min(3, value + .25))} className="exam-platform-image-tool" aria-label="Phóng to"><ZoomIn size={18} /></button>
          <button type="button" onClick={() => setZoom(1)} className="exam-platform-image-tool" aria-label="Đặt lại mức zoom"><RotateCcw size={18} /></button>
          <button type="button" onClick={() => void toggleFullscreen()} className="exam-platform-image-tool" aria-label="Bật hoặc tắt toàn màn hình"><Minimize2 size={18} /></button>
          <button type="button" onClick={() => setOpen(false)} className="exam-platform-image-close" aria-label="Đóng ảnh"><X size={20} /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-black/40 p-4">
        <div className="flex min-h-full min-w-full items-center justify-center">
          <img src={src} alt={alt} draggable={false} className="block h-auto max-w-none origin-center object-contain transition-transform" style={{ maxHeight: zoom <= 1 ? 'calc(100dvh - 8rem)' : 'none', width: zoom <= 1 ? 'auto' : `${zoom * 100}%`, transform: zoom <= 1 ? `scale(${zoom})` : undefined }} />
        </div>
      </div>
    </div>}
  </>;
}

import { Maximize2, Minimize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { getExamImageProfile, type ExamImageProfile } from './imageProfiles';

export interface ExamImageViewerProps {
  src: string;
  alt: string;
  children?: ReactNode;
  frameRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  stageClassName?: string;
  stageProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'style'>;
  imageClassName?: string;
  imageStyle?: CSSProperties;
  onImageLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  profile?: ExamImageProfile;
  maxWidth?: string;
  maxHeight?: string;
  expandable?: boolean;
  triggerOnly?: boolean;
  fillFrame?: boolean;
}

type ViewerScale = 'fit' | number;

export default function ExamImageViewer({
  src,
  alt,
  children,
  frameRef,
  className = '',
  stageClassName = '',
  stageProps,
  imageClassName = '',
  imageStyle,
  onImageLoad,
  profile = 'default',
  maxWidth,
  maxHeight,
  expandable = true,
  triggerOnly = false,
  fillFrame = false,
}: ExamImageViewerProps) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState<ViewerScale>('fit');
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageViewportRef = useRef<HTMLDivElement>(null);
  const modalImageRef = useRef<HTMLImageElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const profileConfig = getExamImageProfile(profile);
  const resolvedMaxWidth = maxWidth || profileConfig.maxWidth;
  const resolvedMaxHeight = maxHeight || profileConfig.maxHeight;
  const { className: _stageClassName, style: _stageStyle, ...safeStageProps } = stageProps || {};

  const openViewer = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setScale('fit');
    setOpen(true);
  };
  const closeViewer = () => setOpen(false);
  const currentFitScale = () => {
    const viewport = imageViewportRef.current?.getBoundingClientRect();
    const image = modalImageRef.current;
    if (!viewport || !image?.naturalWidth || !image.naturalHeight) return 1;
    return Math.min(
      1,
      Math.max(1, viewport.width - 32) / image.naturalWidth,
      Math.max(1, viewport.height - 32) / image.naturalHeight,
    );
  };
  const zoomIn = () => setScale(value => value === 'fit' ? currentFitScale() * 1.25 : value * 1.25);
  const zoomOut = () => setScale(value => value === 'fit' ? currentFitScale() / 1.25 : value / 1.25);

  useEffect(() => {
    setNaturalSize(undefined);
  }, [src]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeViewer();
      if (event.key === '+' || event.key === '=') zoomIn();
      if (event.key === '-') zoomOut();
      if (event.key === '0') setScale('fit');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
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

  const modalImageStyle: CSSProperties = scale === 'fit'
    ? {
        maxHeight: 'calc(100dvh - 8rem)',
        maxWidth: 'calc(100dvw - 3rem)',
        width: 'auto',
      }
    : {
        height: 'auto',
        maxHeight: 'none',
        maxWidth: 'none',
        width: naturalSize?.width ? `${naturalSize.width * scale}px` : 'auto',
      };

  return <>
    {triggerOnly
      ? <button type="button" onClick={event => { event.stopPropagation(); openViewer(); }} className="exam-platform-image-expand inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black" aria-label="Phóng to ảnh" title="Phóng to ảnh"><Maximize2 size={18} />Phóng to ảnh</button>
      : <div data-exam-image-profile={profile} className={`exam-platform-image-viewer relative mx-auto max-w-full overflow-visible rounded-2xl ${fillFrame ? 'h-full w-full' : 'w-fit'} ${className}`} style={fillFrame ? undefined : { maxWidth: resolvedMaxWidth }}>
          <div {...safeStageProps} ref={frameRef} data-exam-image-stage className={`relative mx-auto max-w-full overflow-hidden rounded-[inherit] ${fillFrame ? 'h-full w-full' : 'w-fit'} ${stageClassName}`}>
            <img
              src={src}
              alt={alt}
              draggable={false}
              onLoad={onImageLoad}
              className={`block object-contain ${fillFrame ? 'h-full w-full max-w-none' : 'h-auto w-auto max-w-full'} ${imageClassName}`}
              style={fillFrame ? imageStyle : { maxHeight: resolvedMaxHeight, maxWidth: '100%', ...imageStyle }}
            />
            {children}
          </div>
          {expandable && <button type="button" onClick={event => { event.stopPropagation(); openViewer(); }} className="exam-platform-image-expand absolute right-2 top-2 z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Phóng to ảnh" title="Phóng to ảnh"><Maximize2 size={20} /></button>}
        </div>}

    {expandable && open && <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Xem ảnh toàn màn hình: ${alt}`} onClick={event => event.stopPropagation()} className="exam-platform-image-dialog fixed inset-0 z-[1000] flex flex-col bg-slate-950/95 p-3 outline-none sm:p-5">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-white shadow-xl">
        <p className="min-w-0 flex-1 truncate text-sm font-black">{alt || 'Ảnh đề bài'}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={zoomOut} className="exam-platform-image-tool" aria-label="Thu nhỏ" title="Thu nhỏ"><ZoomOut size={18} /></button>
          <span className="min-w-20 text-center text-xs font-black">{scale === 'fit' ? 'Vừa màn hình' : `${Math.round(scale * 100)}%`}</span>
          <button type="button" onClick={zoomIn} className="exam-platform-image-tool" aria-label="Phóng to" title="Phóng to"><ZoomIn size={18} /></button>
          <button type="button" onClick={() => setScale('fit')} className="exam-platform-image-tool" aria-label="Đưa ảnh vừa màn hình" title="Vừa màn hình"><Minimize2 size={18} /></button>
          <button type="button" onClick={() => setScale(1)} className="exam-platform-image-tool" aria-label="Xem ảnh ở kích thước gốc" title="Kích thước gốc"><RotateCcw size={18} /></button>
          <button type="button" onClick={() => void toggleFullscreen()} className="exam-platform-image-tool" aria-label="Bật hoặc tắt toàn màn hình trình duyệt" title="Toàn màn hình"><Maximize2 size={18} /></button>
          <button type="button" onClick={closeViewer} className="exam-platform-image-close" aria-label="Đóng ảnh" title="Đóng"><X size={20} /></button>
        </div>
      </div>
      <div ref={imageViewportRef} className="min-h-0 flex-1 overflow-auto rounded-2xl bg-black/40 p-4">
        <div className={`flex min-h-full min-w-full ${scale === 'fit' ? 'items-center justify-center' : 'items-start justify-start'}`}>
          <img
            ref={modalImageRef}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={event => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            className="block shrink-0 object-contain"
            style={modalImageStyle}
          />
        </div>
      </div>
    </div>}
  </>;
}

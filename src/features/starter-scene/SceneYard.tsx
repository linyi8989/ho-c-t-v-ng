import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import SceneLessonLink from './SceneLessonLink';
import type { SceneLink, ScenePaperId } from './types';

export default function SceneYard({ paper, label, links, loading, error, preview, contour, style, onRetry, onNavigate }: {
  paper: ScenePaperId; label: string; links?: SceneLink[]; loading: boolean; error: string; preview: boolean;
  contour?: 'left' | 'right'; style?: React.CSSProperties; onRetry: () => void;
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ first: 1, last: 1, above: false, below: false });
  useEffect(() => {
    const element = list.current; if (!element) return;
    element.scrollTop = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = element.getBoundingClientRect();
      const rows = [...element.querySelectorAll('li')];
      // Five 60px rows, four 10px gaps and 5px padding at each end anchor the lawn.
      // Keep this physical span fixed even when only one published link exists.
      const height = Math.max(1, Math.min(box.height, 350));
      const visible: number[] = [];
      // Measure before writing: widths follow the visible lawn, rather than a repeating item index.
      const insets = rows.map((row, index) => {
        const rect = row.getBoundingClientRect();
        if (rect.bottom > box.top + 4 && rect.top < box.bottom - 4) visible.push(index + 1);
        const position = Math.max(0, Math.min(1, (rect.top + rect.height / 2 - box.top) / height));
        const upper = position < .52;
        const curve = ((position - .52) / (upper ? .52 : .48)) ** 2;
        const start = contour === 'right' ? (upper ? .28 : .20) : (upper ? .19 : .16);
        const end = contour === 'right' ? (upper ? .24 : .16) : (upper ? .12 : .09);
        return { row, start: (curve * start * 100).toFixed(3) + '%', end: (curve * end * 100).toFixed(3) + '%' };
      });
      if (contour) for (const { row, start, end } of insets) {
        if (row.style.getPropertyValue('--starter-contour-start') !== start) row.style.setProperty('--starter-contour-start', start);
        if (row.style.getPropertyValue('--starter-contour-end') !== end) row.style.setProperty('--starter-contour-end', end);
      }
      const next = { first: visible[0] || 1, last: visible.at(-1) || 1, above: element.scrollTop > 2, below: element.scrollTop + element.clientHeight < element.scrollHeight - 2 };
      setRange(previous => previous.first === next.first && previous.last === next.last && previous.above === next.above && previous.below === next.below ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    schedule(); element.addEventListener('scroll', schedule, { passive: true });
    const observer = new ResizeObserver(schedule); observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('scroll', schedule); };
  }, [links, loading, error, contour]);
  const scroll = (direction: number) => {
    const element = list.current; if (!element) return;
    element.scrollBy({ top: direction * element.clientHeight * .8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <section className={`starter-lawn starter-lawn-${paper}`} data-starter-lawn={paper} data-starter-contour={contour} aria-labelledby={`starter-house-${paper}`} style={style}>
    <div ref={list} className="starter-lawn-list" role="region" aria-label={`Bài ${label} — cuộn danh sách`} tabIndex={0} data-starter-list={paper} aria-busy={loading}>
      {loading ? <p className="starter-notice" role="status">Đang mở sân học…</p> : error ? <div className="starter-notice"><p role="alert">{error}</p><button type="button" onClick={onRetry}><RefreshCw size={16} /> Thử lại</button></div> : links?.length ? <ol>{links.map((link, index) => <li key={link.id}><SceneLessonLink {...{ link, index, paper, label, preview, onNavigate }} /></li>)}</ol> : null}
    </div>
    {!!links?.length && <div className="starter-yard-scroll" aria-label={`Cuộn bài ${label}`}>
      <button type="button" aria-label={`Các bài phía trên — ${label}`} disabled={!range.above} onClick={() => scroll(-1)}><ChevronUp size={20} aria-hidden="true" /></button>
      <span>{range.first}–{range.last} / {links.length} bài</span>
      <button type="button" aria-label={`Các bài tiếp theo — ${label}`} disabled={!range.below} onClick={() => scroll(1)}><ChevronDown size={20} aria-hidden="true" /></button>
    </div>}
  </section>;
}

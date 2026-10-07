import { BookOpenText, Headphones, RefreshCw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { sceneApi } from './api';
import HouseSign from './HouseSign';
import SignpostNavigation from './SignpostNavigation';
import { type SceneCatalog, type SceneModule, type ScenePaperId } from './types';
import { getSceneDefinition } from './sceneDefinition';
import './starter-scene.css';

export default function StarterScenePage({ onNavigate, moduleId = 'starter' }: { onBack: () => void; onNavigate: (href: string) => void; moduleId?: SceneModule }) {
  const definition = getSceneDefinition(moduleId), papers = definition.papers, three = definition.threeYards;
  const preview = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && new URLSearchParams(window.location.search).get('preview') === 'links';
  const [catalog, setCatalog] = useState<SceneCatalog | null>(null), [error, setError] = useState(''), [reload, setReload] = useState(0), [active, setActive] = useState<ScenePaperId>('listening');
  const viewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setCatalog(null);
    const request = preview ? import('./linkPreview').then(module => module.createLinkPreview(moduleId)) : sceneApi.catalog(controller.signal, moduleId);
    void request.then(value => { if (!controller.signal.aborted) setCatalog(value); }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được bài.'); });
    return () => controller.abort();
  }, [reload, preview, moduleId]);
  useEffect(() => { setActive('listening'); }, [moduleId]);
  useEffect(() => {
    const align = () => {
      const frame = viewport.current, scene = canvas.current; if (!frame || !scene) return;
      const index = Math.max(0, papers.findIndex(paper => paper.id === active));
      const center = three ? [.2, .5, .8][index] : frame.clientWidth < 768 ? (active === 'listening' ? .337 : .778) : (active === 'listening' ? .27 : .755);
      frame.scrollTo({ left: scene.clientWidth > frame.clientWidth ? scene.clientWidth * center - frame.clientWidth / 2 : 0 });
    };
    align(); const observer = new ResizeObserver(align); if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [active, moduleId, three]);
  const navigateLink = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); onNavigate(href);
  };
  return <main id="starter-scene-page" data-listening-module={moduleId} data-scene-yards={papers.length}>
    {preview && <aside className="starter-preview-notice" data-starter-preview role="status">Mô phỏng local · 25 bài mỗi sân. Link mẫu chỉ để xem giao diện, không mở bài thi.</aside>}
    <div className="starter-scene-frame">
    <SignpostNavigation onNavigate={onNavigate} moduleId={moduleId} />
    <nav className="starter-yard-switch" aria-label="Chọn khoảng sân">
      {papers.map(({id: paper, displayName}) => <button key={paper} type="button" aria-pressed={active === paper} data-starter-yard-switch={paper} onClick={() => setActive(paper)}>{paper === 'listening' ? <Headphones size={18} aria-hidden="true" /> : <BookOpenText size={18} aria-hidden="true" />}{displayName}</button>)}
    </nav>
    <div className="starter-scene-viewport" ref={viewport}>
      <div className="starter-scene-canvas" ref={canvas}>
        <img className="starter-background" src={three ? '/assets/backgrounds/bg-exams-three-yards-v1.webp' : '/assets/backgrounds/bg-starters-scene.webp'} alt="" fetchPriority="high" />
        <div className="starter-title-board starter-wood-board"><img src="/assets/boards/board-title-large.webp" alt="" /><div><h1 aria-label={definition.title}><span className="starter-title-word" aria-hidden="true">{definition.title.split('').map((letter, index) => <span className="starter-title-letter" key={index}>{letter}</span>)}</span></h1><p>{definition.level}</p></div></div>
        {papers.map(({id: paper, displayName}, index) => <React.Fragment key={paper}><HouseSign paper={paper} label={displayName} style={three ? {'--scene-house-x': `${[20.5,49.8,80.5][index]}%`} as React.CSSProperties : undefined} /></React.Fragment>)}
        {papers.map(({id: paper, displayName}, index) => {
          const links = catalog?.papers[paper]?.links;
          return <section key={paper} className={`starter-lawn starter-lawn-${paper}`} data-starter-lawn={paper} aria-labelledby={`starter-house-${paper}`} style={three ? {'--scene-yard-x': `${[20,50,80][index]}%`} as React.CSSProperties : undefined}>
            <div className="starter-lawn-list" role="region" aria-label={`Bài ${displayName} — cuộn danh sách`} tabIndex={0} data-starter-list={paper} aria-busy={!catalog && !error}>
              {!catalog && !error ? <p className="starter-notice" role="status">Đang mở sân học…</p> : error ? <div className="starter-notice"><p role="alert">{error}</p><button type="button" onClick={() => setReload(value => value + 1)}><RefreshCw size={16} /> Thử lại</button></div> : !links?.length ? null : <ol>{links.map((link, index) => {
                // An isolated legacy replacement character between words is an unreadable separator.
                // Improve presentation only; retain the source title and record in B.
                const title = link.title.replace(/\s+\uFFFD\s+/g, ' · ');
                const variant = index % 5;
                const badgeCenter = [63, 63, 58, 52, 48][variant];
                return <li key={link.id}>
                <a className="starter-hotspot" data-starter-link={paper} data-starter-lesson-variant={variant} style={{ '--starter-art-position': `${variant * 25}%`, '--starter-number-top': `${badgeCenter}%` } as React.CSSProperties} href={link.href} title={title} aria-label={`${preview ? 'Mô phỏng, ' : ''}${displayName}, bài ${index + 1}: ${title}`} onClick={event => { if (preview) event.preventDefault(); else navigateLink(event, link.href); }}>
                  <span className="starter-lesson-art" aria-hidden="true" />
                  <span className="starter-lesson-number" data-digits={String(index + 1).length} aria-hidden="true">{index + 1}</span>
                  <span className="starter-link-text">{title}</span>
                </a>
              </li>; })}</ol>}
            </div>
          </section>;
        })}
      </div>
    </div>
    </div>
    <p className="starter-mobile-tip">Chọn kỹ năng để chuyển sân. Cuộn trong sân để xem các bài tiếp theo.</p>
  </main>;
}

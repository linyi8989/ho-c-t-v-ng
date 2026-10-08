import { BookOpenText, Headphones } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { sceneApi } from './api';
import HouseSign from './HouseSign';
import SignpostNavigation from './SignpostNavigation';
import SceneYard from './SceneYard';
import { type SceneCatalog, type SceneModule, type ScenePaperId } from './types';
import { getSceneDefinition } from './sceneDefinition';
import './starter-scene.css';

export default function StarterScenePage({ onNavigate, moduleId = 'starter' }: { onBack: () => void; onNavigate: (href: string) => void; moduleId?: SceneModule }) {
  const definition = getSceneDefinition(moduleId), papers = definition.papers, three = definition.threeYards;
  const preview = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && new URLSearchParams(window.location.search).get('preview') === 'links';
  const requestedPreviewCount = new URLSearchParams(window.location.search).get('count');
  const previewLinkCount = requestedPreviewCount === '1' ? 1 : requestedPreviewCount === '5' ? 5 : 25;
  const [catalog, setCatalog] = useState<SceneCatalog | null>(null), [error, setError] = useState(''), [reload, setReload] = useState(0), [active, setActive] = useState<ScenePaperId>('listening');
  const viewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setCatalog(null);
    const request = preview ? import('./linkPreview').then(module => module.createLinkPreview(moduleId, previewLinkCount)) : sceneApi.catalog(controller.signal, moduleId);
    void request.then(value => { if (!controller.signal.aborted) setCatalog(value); }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được bài.'); });
    return () => controller.abort();
  }, [reload, preview, previewLinkCount, moduleId]);
  useEffect(() => { setActive('listening'); }, [moduleId]);
  useEffect(() => {
    const align = () => {
      const frame = viewport.current, scene = canvas.current; if (!frame || !scene) return;
      const index = Math.max(0, papers.findIndex(paper => paper.id === active));
      const center = three ? [.2, .5, .8][index] : frame.clientWidth < 768 ? (active === 'listening' ? .337 : .778) : (active === 'listening' ? .28 : moduleId === 'starter' ? .76 : .745);
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
    {preview && <aside className="starter-preview-notice" data-starter-preview role="status">Mô phỏng local · {previewLinkCount} bài mỗi sân. Link mẫu chỉ để xem giao diện, không mở bài thi.</aside>}
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
        {papers.map(({id: paper, displayName}, index) => <React.Fragment key={`${moduleId}-${paper}`}><SceneYard paper={paper} label={displayName}
          links={catalog?.papers[paper]?.links} loading={!catalog && !error} error={error} preview={preview} contour={moduleId === 'starter' ? (paper === 'listening' ? 'left' : 'right') : undefined}
          style={three ? {'--scene-yard-x': `${[20,50,80][index]}%`} as React.CSSProperties : undefined}
          onRetry={() => setReload(value => value + 1)} onNavigate={navigateLink} /></React.Fragment>)}
      </div>
    </div>
    </div>
    <p className="starter-mobile-tip">Chọn kỹ năng để chuyển sân. Cuộn trong sân để xem các bài tiếp theo.</p>
  </main>;
}

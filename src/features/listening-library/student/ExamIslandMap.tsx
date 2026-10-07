import type { MouseEvent } from 'react';
import { BookOpenText, History, Home } from 'lucide-react';
import { getVisibleListeningModules } from '../registry';
import { examModulePath } from '../routes';
import './exam-islands.css';

const locations: Record<string, { x: number; y: number; level: string }> = {
  starter: { x: 29.5, y: 52, level: 'Pre A1' }, mover: { x: 50, y: 48.5, level: 'A1' },
  flyer: { x: 70.5, y: 55, level: 'A2' }, ket: { x: 77, y: 82, level: 'A2 Key' },
  pet: { x: 93, y: 60, level: 'B1 Preliminary' }, fce: { x: 67.5, y: 35, level: 'B2 First' },
  ielts: { x: 46.5, y: 22.5, level: 'Academic' },
};
export default function ExamIslandMap({ onBack, onNavigate }: { onBack?: () => void; onNavigate: (path: string) => void }) {
  const modules = getVisibleListeningModules();
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onNavigate(href);
  };
  return <main id="listening-library-home" data-exam-islands>
    <header className="island-header"><div className="island-brand"><BookOpenText aria-hidden="true" /><div><p>Tiếng Anh Cô Diệu</p><h1>Hành trình luyện thi</h1></div></div>
      <nav aria-label="Điều hướng kho đề"><a href="/" onClick={event => { if (onBack && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onBack(); } else navigate(event, '/'); }}><Home size={19} />Trang chủ</a><a href="/history" onClick={event => navigate(event, '/history')}><History size={19} />Lịch sử học tập</a></nav>
    </header>
    <nav className="island-level-jumps" aria-label="Các cấp độ luyện thi">{modules.map(module => <a key={module.id} href={examModulePath(module.id)} onClick={event => navigate(event, examModulePath(module.id))}>{module.displayName}</a>)}</nav>
    <p className="island-pan-hint">Vuốt ngang để khám phá các đảo.</p>
    <div className="island-panorama" tabIndex={0} aria-label="Bản đồ các đảo luyện thi, có thể cuộn ngang">
      <div className="island-scene"><img src="/assets/backgrounds/bg-exam-islands-v1.webp" alt="" width={1672} height={941} fetchPriority="high" />
        <div className="island-welcome" aria-hidden="true">Bắt đầu<br />hành trình</div>
        {modules.map(module => { const location = locations[module.id]; if (!location) return null;
          return <a key={module.id} href={examModulePath(module.id)} data-exam-island={module.id} className="island-sign" style={{ left: `${location.x}%`, top: `${location.y}%` }} onClick={event => navigate(event, examModulePath(module.id))} aria-label={`${module.displayName} · ${location.level} — Mở kho đề`}><strong>{module.displayName}</strong><span>{location.level}</span></a>;
        })}
      </div>
    </div>
  </main>;
}

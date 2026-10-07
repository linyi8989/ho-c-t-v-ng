import type { ReactNode } from 'react';
import { Mic, Trophy } from 'lucide-react';
import './student-module-theme.css';

export default function StudentModuleHeader({ title, eyebrow, speaking = false, children }: {
  title: string; eyebrow: string; speaking?: boolean; children: ReactNode;
}) {
  const Icon = speaking ? Mic : Trophy;
  return <header className="student-module-header">
    <nav className="student-module-navigation" aria-label="Điều hướng học tập">{children}</nav>
    <div className="student-module-heading">
      <span className="student-module-emblem" aria-hidden="true"><Icon size={32} /></span>
      <div><p className="student-module-eyebrow">{eyebrow}</p><h1>{title}</h1></div>
    </div>
  </header>;
}

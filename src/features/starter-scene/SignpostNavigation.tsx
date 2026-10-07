import React from 'react';
import { examModulePath } from '../listening-library/routes';
import { getSceneDefinition } from './sceneDefinition';
import type { SceneModule } from './types';

export default function SignpostNavigation({ onNavigate, moduleId = 'starter' }: { onNavigate: (href: string) => void; moduleId?: SceneModule }) {
  const definition = getSceneDefinition(moduleId);
  const links = [
  { id: 'home', label: 'Home', description: 'Về trang chủ', href: '/' },
  ...(definition.previous ? [{ id: 'previous', label: 'Previous', description: `Về ${getSceneDefinition(definition.previous).title}`, href: examModulePath(definition.previous) }] : []),
  ...(definition.next ? [{ id: 'next', label: 'Next', description: `Sang ${getSceneDefinition(definition.next).title}`, href: examModulePath(definition.next) }] : []),
  { id: 'history', label: 'History', description: 'Lịch sử học tập', href: '/history' },
  ];
  return <nav className="starter-signpost" data-sign-count={links.length} aria-label={`Điều hướng ${definition.title}`}>
    <img className="starter-signpost-base" src="/assets/signs/signpost-double.webp" alt="" />
    {links.map(link => <a key={link.id} className={`starter-sign-${link.id}`} data-starter-nav={link.id} href={link.href} aria-label={`${link.label} — ${link.description}`} title={link.description} onClick={event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); onNavigate(link.href);
    }}>
      <span className="starter-sign-face" aria-hidden="true"><img src="/assets/signs/signpost-double.webp" alt="" /></span>
      <span className="starter-sign-label">{link.label}</span>
    </a>)}
  </nav>;
}

import React, { useId } from 'react';
import { ChevronRight } from 'lucide-react';
import type { SceneLink, ScenePaperId } from './types';

export default function SceneLessonLink({ link, index, paper, label, preview, onNavigate }: {
  link: SceneLink; index: number; paper: ScenePaperId; label: string; preview: boolean;
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const id = useId().replaceAll(':', '');
  // Preserve the complete source title; only repair the existing legacy separator.
  const title = link.title.replace(/\s+\uFFFD\s+/g, ' · ');
  return <a className="starter-hotspot" data-starter-link={paper} data-starter-lesson-variant={index % 5}
    href={link.href} title={title} aria-label={`${preview ? 'Mô phỏng, ' : ''}${label}, bài ${index + 1}: ${title}`}
    onClick={event => { if (preview) event.preventDefault(); else onNavigate(event, link.href); }}>
    <span className="starter-lesson-mascot" aria-hidden="true"><img src="/assets/lesson-cards/scene-mascots-v1.webp" alt="" loading="lazy" /></span>
    <span className="starter-lesson-plank">
      <svg className="starter-lesson-art" viewBox="0 0 600 76" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={`${id}-plank`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff0c7" /><stop offset=".48" stopColor="#fbd696" /><stop offset="1" stopColor="#edb66d" /></linearGradient></defs>
        <rect x="2" y="5" width="596" height="70" rx="20" fill="#ac692f" />
        <rect x="2" y="1" width="596" height="70" rx="20" fill={`url(#${id}-plank)`} stroke="#ba7b39" strokeWidth="2" />
        <path d="M21 7H579M20 64H580" fill="none" stroke="#fff4d7" strokeWidth="2" />
        <path d="M52 17q87-4 170 0m154 0q79-3 155 0M57 55q61 3 108 0m271 0 96 1" fill="none" stroke="#c18a4c" strokeWidth="1" opacity=".22" />
        <ellipse cx="17" cy="36" rx="3" ry="4" fill="#b9793b" /><ellipse cx="583" cy="36" rx="3" ry="4" fill="#b9793b" />
      </svg>
      <span className="starter-lesson-number" data-digits={String(index + 1).length} aria-hidden="true">{index + 1}</span>
      <span className="starter-link-text">{title}</span>
      <span className="starter-lesson-arrow" aria-hidden="true"><ChevronRight /></span>
    </span>
  </a>;
}

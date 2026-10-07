import React, { useId } from 'react';
import { paperLabel, type ScenePaperId } from './types';

export default function HouseSign({ paper, label = paperLabel(paper), style }: { paper: ScenePaperId; label?: string; style?: React.CSSProperties }) {
  const id = useId().replaceAll(':', '');
  const arched = paper !== 'listening';
  return <div className={`starter-house-sign starter-house-sign-${paper}`} data-starter-house-sign={paper} style={style}>
    <svg className="starter-house-emblem" viewBox="0 0 96 76" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#70e3ff" /><stop offset=".5" stopColor="#249deb" /><stop offset="1" stopColor="#1264bb" /></linearGradient>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fffdf1" /><stop offset="1" stopColor="#f6d8a2" /></linearGradient>
        <linearGradient id={`${id}-pencil`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#ffe67b" /><stop offset=".5" stopColor="#ffb932" /><stop offset="1" stopColor="#e7831e" /></linearGradient>
      </defs>
      {paper === 'listening' ? <>
        <path d="M19 49V35a29 29 0 0 1 58 0v14" fill="none" stroke="#104fa0" strokeWidth="12" strokeLinecap="round" />
        <path d="M19 45V33a29 29 0 0 1 58 0v12" fill="none" stroke={`url(#${id}-blue)`} strokeWidth="8" strokeLinecap="round" />
        <path d="M24 20a27 27 0 0 1 44-5" fill="none" stroke="#b6f1ff" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="9" y="36" width="21" height="33" rx="10" fill="#104e9a" />
        <rect x="7" y="33" width="20" height="32" rx="10" fill={`url(#${id}-blue)`} />
        <path d="M13 40v16" stroke="#b6efff" strokeWidth="3" strokeLinecap="round" />
        <rect x="66" y="36" width="21" height="33" rx="10" fill="#104e9a" />
        <rect x="68" y="33" width="20" height="32" rx="10" fill={`url(#${id}-blue)`} />
        <path d="M74 40v16" stroke="#b6efff" strokeWidth="3" strokeLinecap="round" />
        <path d="M29 39v20M66 39v20" stroke="#eefaff" strokeWidth="5" strokeLinecap="round" />
      </> : <>
        <path d="M6 16q22-8 41 3 21-11 43-3v51q-24-7-43 3Q27 59 6 65Z" fill="#14569e" stroke="#124580" strokeWidth="2" />
        <path d="M10 11q19-5 37 6v47Q28 54 10 60Z" fill={`url(#${id}-paper)`} stroke="#ca9565" strokeWidth="1.5" />
        <path d="M47 17q20-11 38-6v49q-21-5-38 4Z" fill={`url(#${id}-paper)`} stroke="#ca9565" strokeWidth="1.5" />
        <path d="M17 23q11-2 23 4m-23 6q11-2 23 4m-23 6q11-2 23 4m17-20q10-6 21-5m-21 15q10-6 21-5m-21 15q10-6 21-5" fill="none" stroke="#d5b58e" strokeWidth="1.5" strokeLinecap="round" />
        <path d="m62 56 17-40 9 4-17 40-10 7Z" fill={`url(#${id}-pencil)`} stroke="#b96d27" strokeWidth="1" />
        <path d="m79 16 2-5q1-3 4-2l5 2q3 1 2 4l-4 5Z" fill={`url(#${id}-blue)`} />
        <path d="m62 56-1 11 10-7Z" fill="#efc998" /><path d="m61 63 0 4 4-3Z" fill="#62412b" />
        <path d="m65 55 15-35" stroke="#fff2a2" strokeWidth="2" strokeLinecap="round" />
      </>}
    </svg>
    <div className="starter-house-plaque" data-starter-arched-plaque={arched || undefined}>
      <svg viewBox={arched ? '0 0 280 76' : '0 0 280 64'} preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff0c6" /><stop offset=".48" stopColor="#fbd797" /><stop offset="1" stopColor="#e9ad60" /></linearGradient></defs>
        <path d={arched ? 'M12 23Q140-3 268 23q8 2 8 12v29q0 10-10 12Q140 50 14 76q-10-1-10-12V36q0-11 8-13Z' : 'M12 8Q140-1 268 8q8 2 8 12v29q0 10-10 12Q140 69 14 61q-10-1-10-12V21q0-11 8-13Z'} fill="#975323" />
        <path d={arched ? 'M12 19Q140-7 268 19q8 2 8 12v29q0 10-10 12Q140 46 14 72q-10-1-10-12V32q0-11 8-13Z' : 'M12 4Q140-5 268 4q8 2 8 12v28q0 10-10 12Q140 64 14 56q-10-1-10-12V17q0-11 8-13Z'} fill={`url(#${id}-wood)`} stroke="#ae6529" strokeWidth="2" />
        <path d={arched ? 'M17 23Q140-2 262 23M16 64Q140 39 261 64' : 'M17 8Q140 0 262 8M16 48q122 7 245 0'} fill="none" stroke="#fff2d1" strokeWidth="2.5" />
        <path d={arched ? 'M22 34q38-8 68-11m107 0 53 11M20 55l29-5m184 0 27 5' : 'M22 17q38-3 68-1m107-1 53 1M20 38l29-1m184 1 27 0'} fill="none" stroke="#c58a49" strokeWidth="1" opacity=".5" />
        {[18,262].map(x => <g key={x}><circle cx={x} cy={arched ? 46 : 30} r="3.5" fill="#ae6a30" /><circle cx={x-1} cy={arched ? 45 : 29} r="2" fill="#ffe6ae" /></g>)}
      </svg>
      <h2 id={`starter-house-${paper}`} aria-label={arched ? label : undefined}>{arched ? <span className="starter-house-title-arc" aria-hidden="true">{Array.from(label).map((letter, index) => {
        const position = index / (label.length - 1) * 2 - 1;
        return <span key={index} className="starter-house-title-letter" style={{ '--starter-sign-offset': `${(.28 * position * position - .11).toFixed(3)}em`, '--starter-sign-angle': `${(position * 6).toFixed(2)}deg` } as React.CSSProperties}>{letter}</span>;
      })}</span> : label}</h2>
    </div>
  </div>;
}

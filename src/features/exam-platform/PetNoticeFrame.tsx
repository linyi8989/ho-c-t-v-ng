interface Props {
  variant: number;
  content?: string;
  label?: string;
  className?: string;
}

const join = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ');

function NoticeCopy({ content }: { content?: string }) {
  const value = String(content || '').trim();
  if (!value) {
    return <p className="text-center text-sm font-bold italic leading-6 text-slate-500">Nội dung thông báo sẽ hiển thị tại đây.</p>;
  }
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 1) return <p className="whitespace-pre-wrap text-center text-base font-extrabold leading-7 text-slate-800">{lines[0]}</p>;
  return <div className="space-y-2 text-center text-slate-800">
    <p className="whitespace-pre-wrap text-sm font-black uppercase leading-5 tracking-wide">{lines[0]}</p>
    <p className="whitespace-pre-wrap text-sm font-bold leading-6">{lines.slice(1).join('\n')}</p>
  </div>;
}

/** Five code-native PET notice frames. Text stays selectable, accessible and JSON-owned. */
export default function PetNoticeFrame({ variant, content, label = 'Nội dung thông báo', className }: Props) {
  const template = ((variant % 5) + 5) % 5;
  const common = join('relative flex h-full min-h-52 w-full items-center justify-center overflow-hidden p-6', className);

  if (template === 0) {
    return <div data-pet-notice-template="hanging-board" role="group" aria-label={label} className={join(common, 'border-0 bg-transparent p-2')}>
      <span aria-hidden className="absolute left-[18%] top-3 h-8 w-4 -rotate-6 rounded-sm border border-amber-300 bg-amber-100/95 shadow-sm" />
      <span aria-hidden className="absolute right-[18%] top-3 h-8 w-4 rotate-6 rounded-sm border border-amber-300 bg-amber-100/95 shadow-sm" />
      <div className="relative w-full rounded-sm border-[3px] border-double border-sky-700 bg-white/90 px-5 py-7 shadow-md">
        <NoticeCopy content={content} />
      </div>
    </div>;
  }

  if (template === 1) {
    return <div data-pet-notice-template="message-screen" role="group" aria-label={label} className={join(common, 'border-0 bg-transparent p-2')}>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.4rem] border-2 border-teal-500 bg-white/95 shadow-md">
        <div aria-hidden className="flex h-10 shrink-0 items-center justify-between border-b border-teal-200 bg-teal-100 px-4">
          <span className="h-2.5 w-12 rounded-full bg-teal-500" />
          <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-orange-400" /><i className="h-2.5 w-2.5 rounded-full bg-sky-500" /><i className="h-2.5 w-2.5 rounded-full bg-teal-500" /></span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-6 py-5"><NoticeCopy content={content} /></div>
      </div>
    </div>;
  }

  if (template === 2) {
    return <div data-pet-notice-template="pinned-note" role="group" aria-label={label} className={join(common, 'border-0 bg-transparent p-2')}>
      <div className="relative w-[88%] -rotate-1 rounded-sm border-2 border-orange-500 bg-[#fff8df] px-6 py-8 shadow-lg">
        <span aria-hidden className="absolute left-1/2 top-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-orange-200 bg-orange-500 shadow" />
        <span aria-hidden className="absolute right-0 top-0 h-10 w-10 border-b-2 border-l-2 border-orange-300 bg-orange-100 [clip-path:polygon(100%_0,100%_100%,0_0)]" />
        <NoticeCopy content={content} />
      </div>
    </div>;
  }

  if (template === 3) {
    return <div data-pet-notice-template="taped-letter" role="group" aria-label={label} className={join(common, 'border-0 bg-transparent p-2')}>
      <div className="relative w-[90%] rotate-[.5deg] border-2 border-blue-500 bg-white/95 px-6 py-8 shadow-lg">
        <span aria-hidden className="absolute left-8 top-0 h-5 w-16 -translate-y-1/2 -rotate-3 border border-blue-200 bg-blue-100/95" />
        <span aria-hidden className="absolute right-8 top-0 h-5 w-16 -translate-y-1/2 rotate-3 border border-blue-200 bg-blue-100/95" />
        <span aria-hidden className="absolute bottom-2 left-2 right-2 border-b border-dashed border-blue-200" />
        <NoticeCopy content={content} />
      </div>
    </div>;
  }

  return <div data-pet-notice-template="school-plaque" role="group" aria-label={label} className={join(common, 'border-0 bg-transparent p-2')}>
    <div className="relative w-full rounded-lg border-4 border-double border-emerald-600 bg-[#fff7df] px-7 py-8 shadow-md">
      {['left-2 top-2', 'right-2 top-2', 'bottom-2 left-2', 'bottom-2 right-2'].map(position => <span key={position} aria-hidden className={`absolute h-3 w-3 rounded-full border border-orange-500 bg-orange-200 ${position}`} />)}
      <NoticeCopy content={content} />
    </div>
  </div>;
}

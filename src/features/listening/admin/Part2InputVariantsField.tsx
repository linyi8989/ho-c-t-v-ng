import { useEffect, useRef, useState } from 'react';

const formattedVariants = (value: unknown) => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === 'string').join(' | ')
  : '';

/** Keep separators/spaces while typing; persist the private array independently. */
export default function Part2InputVariantsField({ value, onChange, label, ariaLabel, className = '' }: {
  value?: string[];
  onChange: (value: string[]) => void;
  label: string;
  ariaLabel?: string;
  className?: string;
}) {
  const formatted = formattedVariants(value);
  const [text, setText] = useState(formatted);
  const lastValue = useRef(formatted);
  useEffect(() => {
    if (formatted !== lastValue.current) {
      lastValue.current = formatted;
      setText(formatted);
    }
  }, [formatted]);
  return <label className="block space-y-1 text-xs font-black text-slate-700" data-listening-input-variants-field>
    <span>{label}</span>
    <input
      aria-label={ariaLabel}
      value={text}
      onChange={event => {
        const raw = event.target.value;
        const next = raw.split('|').map(entry => entry.trim()).filter(Boolean);
        lastValue.current = formattedVariants(next);
        setText(raw);
        onChange(next);
      }}
      onBlur={() => setText(lastValue.current)}
      placeholder="Ví dụ: 4 | four years | 4 years"
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 ${className}`}
    />
  </label>;
}

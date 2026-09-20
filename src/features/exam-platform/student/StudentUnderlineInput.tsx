import type { InputHTMLAttributes, Key } from 'react';
import { studentTypedAnswerGuards } from './studentTextEntryGuards';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  key?: Key;
  className?: string;
}

/** Shared learner answer line modelled after PET Writing Part 1. */
export default function StudentUnderlineInput({ className = '', ...props }: Props) {
  return <input
    {...props}
    type="text"
    {...studentTypedAnswerGuards}
    data-student-underline-answer
    className={`student-underline-answer h-8 min-h-0 max-w-full align-middle border-0 border-b border-dashed border-orange-400 bg-transparent px-2 py-0 text-center font-black leading-6 text-slate-950 outline-none focus:border-orange-600 focus:ring-0 ${className}`}
  />;
}

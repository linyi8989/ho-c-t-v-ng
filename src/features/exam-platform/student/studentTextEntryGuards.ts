import type { ClipboardEvent, DragEvent, FormEvent } from 'react';

const BLOCKED_EXTERNAL_INSERT_TYPES = new Set(['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank']);

export function blockStudentClipboard(event: ClipboardEvent<HTMLElement>) {
  event.preventDefault();
  event.currentTarget.focus();
}

export function blockStudentDrop(event: DragEvent<HTMLElement>) {
  event.preventDefault();
  event.currentTarget.focus();
}

export function blockStudentExternalInsert(event: FormEvent<HTMLElement>) {
  if (!BLOCKED_EXTERNAL_INSERT_TYPES.has((event.nativeEvent as InputEvent).inputType)) return;
  event.preventDefault();
  event.currentTarget.focus();
}

export const studentTypedAnswerGuards = {
  onCopy: blockStudentClipboard,
  onCut: blockStudentClipboard,
  onPaste: blockStudentClipboard,
  onDrop: blockStudentDrop,
  onBeforeInput: blockStudentExternalInsert,
};

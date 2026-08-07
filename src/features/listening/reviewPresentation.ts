const INTERNAL_LISTENING_ID = /\bp[1-5]-(?:target|question|item|choice|option|colour|color|blank)-[a-z0-9-]{8,}\b/i;
const LISTENING_BLANK_TOKEN = /\{\{[a-zA-Z0-9_-]+\}\}/g;

function normalizedPart(value: unknown, globalIndex: number) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  return Math.min(5, Math.max(1, Math.floor(Math.max(0, globalIndex) / 5) + 1));
}

export function defaultListeningReviewQuestion(partValue: unknown, globalIndex: number) {
  const part = normalizedPart(partValue, globalIndex);
  const position = Math.max(0, globalIndex) % 5 + 1;
  if (part === 1) return `Part 1 · Vị trí nhân vật ${position}`;
  if (part === 5) return `Part 5 · Vùng tô màu ${position}`;
  return `Part ${part} · Câu ${position}`;
}

export function formatListeningReviewQuestion(
  value: unknown,
  partValue: unknown,
  globalIndex: number
) {
  const source = String(value ?? '').trim();
  const withoutTokens = source
    .replace(LISTENING_BLANK_TOKEN, '_____')
    .replace(/\s*[•]\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!withoutTokens || INTERNAL_LISTENING_ID.test(withoutTokens)) {
    return defaultListeningReviewQuestion(partValue, globalIndex);
  }
  return withoutTokens;
}

export function formatListeningReviewAnswer(value: unknown) {
  const source = String(value ?? '').trim();
  if (!source) return '';
  return INTERNAL_LISTENING_ID.test(source) ? 'Không có dữ liệu hiển thị' : source;
}

export function containsInternalListeningDisplayValue(value: unknown) {
  const source = String(value ?? '');
  return INTERNAL_LISTENING_ID.test(source) || /\{\{[a-zA-Z0-9_-]+\}\}/.test(source);
}

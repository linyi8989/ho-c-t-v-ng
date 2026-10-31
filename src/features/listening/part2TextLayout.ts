import type { ListeningPart2Question } from './types';

const blankPattern = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
export type ListeningPart2AnswerToken = { type: 'text'; text: string } | { type: 'blank'; blankId: string };

/** Split only at a printed colon; unmarked words are never guessed to be hints. */
export function listeningPart2Layout(question: Pick<ListeningPart2Question, 'prompt'>) {
  const matches = [...question.prompt.matchAll(blankPattern)];
  if (!matches.length) return { label: question.prompt.trim(), tokens: [] as ListeningPart2AnswerToken[] };
  const leading = question.prompt.slice(0, matches[0].index);
  const colon = leading.indexOf(':');
  const label = (colon >= 0 ? leading.slice(0, colon + 1) : leading).trim();
  const tokens: ListeningPart2AnswerToken[] = [];
  if (colon >= 0 && leading.slice(colon + 1).trim()) tokens.push({ type: 'text', text: leading.slice(colon + 1).trim() });
  matches.forEach((match, index) => {
    tokens.push({ type: 'blank', blankId: match[1] });
    const text = question.prompt.slice((match.index || 0) + match[0].length, matches[index + 1]?.index ?? question.prompt.length).trim();
    if (text) tokens.push({ type: 'text', text });
  });
  return { label, tokens };
}

export function parseListeningPart2Affix(value: unknown, field: 'answerPrefix' | 'answerSuffix'): string | undefined {
  if (value === undefined) return undefined;
  const max = field === 'answerPrefix' ? 20 : 80;
  if (typeof value !== 'string') throw new Error(`${field} phải là chuỗi văn bản.`);
  const text = value.normalize('NFKC').trim();
  if (text.length > max) throw new Error(`${field} không được vượt quá ${max} ký tự.`);
  if (/\{\{|\}\}|[\r\n]/.test(text)) throw new Error(`${field} chỉ chứa chữ/ký hiệu in sẵn trên một dòng, không chứa marker ô trống.`);
  return text;
}

/** Import affixes into the existing public inline-prompt contract; grading still receives only the blank value. */
export function composeListeningPart2Prompt(input: { prompt: string; blankId: string; answerPrefix?: unknown; answerSuffix?: unknown }): string {
  const prefix = parseListeningPart2Affix(input.answerPrefix, 'answerPrefix');
  const suffix = parseListeningPart2Affix(input.answerSuffix, 'answerSuffix');
  const marker = `{{${input.blankId}}}`;
  const normalized = input.prompt.trim().replace(/_{2,}/g, '{{blank}}').replace(/\{\{blank\}\}/g, marker);
  const prompt = normalized.includes(marker) ? normalized : `${normalized} ${marker}`.trim();
  if (prefix === undefined && suffix === undefined) return prompt;
  const matches = [...prompt.matchAll(blankPattern)];
  if (matches.length !== 1 || matches[0][1] !== input.blankId) throw new Error('Chữ trước/sau ô chỉ áp dụng cho câu có đúng một ô trống.');
  const layout = listeningPart2Layout({ prompt });
  const blankIndex = layout.tokens.findIndex(token => token.type === 'blank');
  const inlinePrefix = layout.tokens.slice(0, blankIndex).map(token => token.type === 'text' ? token.text : '').join(' ');
  const inlineSuffix = layout.tokens.slice(blankIndex + 1).map(token => token.type === 'text' ? token.text : '').join(' ');
  if (prefix !== undefined && inlinePrefix && prefix !== inlinePrefix) throw new Error('answerPrefix mâu thuẫn với chữ trước ô trong prompt; chỉ giữ nhãn câu hỏi trong prompt.');
  if (suffix !== undefined && inlineSuffix && suffix !== inlineSuffix) throw new Error('answerSuffix mâu thuẫn với chữ sau ô trong prompt; chỉ giữ nhãn câu hỏi trong prompt.');
  const effectivePrefix = prefix ?? inlinePrefix;
  const label = effectivePrefix && layout.label && !layout.label.endsWith(':') ? `${layout.label}:` : layout.label;
  return [label, effectivePrefix, marker, suffix ?? inlineSuffix].filter(Boolean).join(' ');
}

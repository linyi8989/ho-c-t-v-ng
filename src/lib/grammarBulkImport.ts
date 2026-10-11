import type { GrammarQuestion, GrammarQuestionType } from '../types';

export interface GrammarBulkImportResult {
  questions: GrammarQuestion[];
  errors: string[];
  warnings: string[];
}

type Fields = Record<string, string>;
const fieldNames = 'QUESTION|ANSWER|EXPLANATION|ACCEPTED_ANSWERS|ACCEPTED|ALTERNATIVES|[A-Z]';
const fieldAtStart = new RegExp('^(' + fieldNames + ')\\s*:\\s*(.*)$', 'i');

function normalizeSource(input: string): string {
  let text = input.replace(/^\uFEFF/, '').replace(/\r\n?|[\u0085\u2028\u2029]/g, '\n').trim();
  // A copied code block is a wrapper, not part of a question or its explanation.
  const fenced = text.match(/^\x60{3}(?:text|plaintext)?[^\S\n]*\n([\s\S]*?)\n\x60{3}$/i);
  if (fenced) text = fenced[1].trim();
  // Decode only escaped line breaks immediately before a field label. Keep literal
  // backslashes inside question/answer text (e.g. teaching the escape sequence \n).
  return text.replace(new RegExp('(?:\\\\r\\\\n|\\\\[nr])+(?=[ \\t]*(?:' + fieldNames + ')\\s*:)', 'gi'), '\n');
}

function expandCollapsedLines(text: string): { text: string; expanded: boolean } {
  let expanded = false;
  const lines = text.split('\n').map(line => {
    // Prefer the original physical lines. Recover a collapsed record only when
    // its inline ANSWER and EXPLANATION labels identify the complete structure.
    // In particular, labels quoted inside a normal explanation remain content.
    if (!fieldAtStart.test(line.trim()) || !/(?:^|[^\S\n])ANSWER\s*:/i.test(line) || !/[^\S\n]EXPLANATION\s*:/i.test(line)) return line;
    const tokens = [...line.matchAll(new RegExp('(^|[^\\S\\n])(' + fieldNames + ')\\s*:', 'gi'))];
    let inExplanation = false;
    const boundaries: number[] = [];
    for (const token of tokens) {
      const key = token[2].toUpperCase();
      if (inExplanation && key !== 'QUESTION') continue;
      boundaries.push(token.index! + token[1].length);
      inExplanation = key === 'EXPLANATION';
    }
    if (boundaries.length < 2) return line;
    expanded = true;
    return boundaries.map((start, index) => line.slice(start, boundaries[index + 1]).trim()).join('\n');
  });
  return { text: lines.join('\n'), expanded };
}

function readFields(block: string, type: GrammarQuestionType): { data: Fields; error?: string } {
  const data: Fields = {};
  let currentKey = '';
  const duplicateKeys = new Set<string>();
  let unsupportedOption = '';
  let unlabeled = false;
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      if (currentKey && data[currentKey]) data[currentKey] += '\n';
      continue;
    }
    const match = line.match(fieldAtStart);
    const parsedKey = match?.[1].toUpperCase();
    const recognized = parsedKey && (type === 'multiple_choice'
      ? /^(QUESTION|[A-D]|ANSWER|EXPLANATION)$/.test(parsedKey)
      : /^(QUESTION|ANSWER|ACCEPTED|ACCEPTED_ANSWERS|ALTERNATIVES|EXPLANATION)$/.test(parsedKey));
    if (recognized && match) {
      currentKey = /^(ACCEPTED|ACCEPTED_ANSWERS|ALTERNATIVES)$/.test(parsedKey) ? 'ACCEPTED' : parsedKey;
      if (Object.hasOwn(data, currentKey)) {
        if (currentKey === 'ACCEPTED') data[currentKey] += '\n' + match[2].trim();
        else duplicateKeys.add(currentKey);
      } else data[currentKey] = match[2].trim();
    } else if (type === 'multiple_choice' && parsedKey && /^[E-Z]$/.test(parsedKey)) {
      unsupportedOption ||= parsedKey;
    } else if (currentKey) data[currentKey] += '\n' + line;
    else unlabeled = true;
  }
  if (unsupportedOption) return { data, error: 'có đáp án ' + unsupportedOption + '; mỗi câu chỉ được có tối đa 4 đáp án A, B, C, D.' };
  if (duplicateKeys.size) return { data, error: 'có nhãn ' + [...duplicateKeys].join(', ') + ' lặp lại; hãy kiểm tra ranh giới và nội dung câu hỏi.' };
  if (unlabeled) return { data, error: 'có nội dung không xác định trước nhãn QUESTION:.' };
  for (const key of Object.keys(data)) data[key] = data[key].trim();
  const required = type === 'multiple_choice' ? ['QUESTION', 'A', 'B', 'ANSWER', 'EXPLANATION'] : ['QUESTION', 'ANSWER', 'EXPLANATION'];
  const missing = required.filter(key => !data[key]);
  if (missing.length) return { data, error: 'không được nhập vì thiếu ' + missing.join(', ') + '.' };
  return { data };
}

function parseQuestions(input: string, type: GrammarQuestionType): GrammarBulkImportResult {
  const questions: GrammarQuestion[] = [], errors: string[] = [], warnings: string[] = [];
  const normalized = normalizeSource(input);
  if (!normalized) return { questions, errors: ['Chưa có nội dung câu hỏi để nhập.'], warnings };
  if (/^[\[{]/.test(normalized)) return { questions, errors: ['Ô nhập nhanh dùng mẫu QUESTION:, ANSWER:, EXPLANATION: (không phải JSON). Hãy dùng mẫu từ nút Sao chép prompt.'], warnings };
  const source = expandCollapsedLines(normalized);
  if (source.expanded) warnings.push('Đã tách các nhãn bị dồn trên cùng một dòng; hãy kiểm tra nội dung trong bảng câu hỏi trước khi lưu.');
  // A new QUESTION starts a new record, independently of blank lines. Blank
  // paragraphs within explanations/answers do not create additional questions.
  const blocks = source.text.split(/(?=^[^\S\n]*QUESTION\s*:)/im).map(block => block.trim()).filter(Boolean);
  blocks.forEach((block, blockIndex) => {
    const { data, error } = readFields(block, type);
    const fail = (message: string) => errors.push('Câu số ' + (blockIndex + 1) + ' ' + message);
    if (error) { fail(error); return; }
    const id = (type === 'rewrite' ? 'grammar-rewrite-question-' : 'grammar-question-') + Date.now() + '-' + blockIndex;
    if (type === 'rewrite') {
      questions.push({
        id, questionType: 'rewrite', questionText: data.QUESTION, options: [], correctOptionId: '',
        correctAnswer: data.ANSWER,
        acceptedAnswers: (data.ACCEPTED || '').split('\n').map(answer => answer.trim()).filter(Boolean),
        explanation: data.EXPLANATION, score: 1, position: questions.length + 1,
      });
      return;
    }
    if (data.D && !data.C) { fail('có đáp án D nhưng thiếu đáp án C.'); return; }
    const optionKeys = ['A', 'B', ...(data.C ? ['C'] : []), ...(data.D ? ['D'] : [])];
    const answerKey = data.ANSWER.toUpperCase();
    if (!optionKeys.includes(answerKey)) {
      fail('có ANSWER là ' + data.ANSWER + ', nhưng câu này chỉ có đáp án ' + optionKeys.join(', ') + '.'); return;
    }
    const values = optionKeys.map(key => data[key]);
    if (new Set(values.map(value => value.toLowerCase())).size !== values.length) warnings.push('Câu số ' + (blockIndex + 1) + ' có phương án trùng nhau.');
    const options = values.map((text, index) => ({ id: id + '-option-' + (index + 1), text, originalPosition: index + 1 }));
    questions.push({ id, questionText: data.QUESTION, options, correctOptionId: options[optionKeys.indexOf(answerKey)].id, explanation: data.EXPLANATION, score: 1, position: questions.length + 1 });
  });
  const seen = new Map<string, number>();
  questions.forEach((question, index) => {
    const key = question.questionText.toLowerCase().replace(/\s+/g, ' ').trim();
    const earlier = seen.get(key);
    if (earlier !== undefined) warnings.push('Câu số ' + (index + 1) + ' bị trùng nội dung với câu ' + earlier + '.');
    else seen.set(key, index + 1);
  });
  return { questions, errors, warnings };
}

export function parseBulkGrammarText(input: string): GrammarBulkImportResult {
  return parseQuestions(input, 'multiple_choice');
}

export function parseBulkRewriteText(input: string): GrammarBulkImportResult {
  return parseQuestions(input, 'rewrite');
}

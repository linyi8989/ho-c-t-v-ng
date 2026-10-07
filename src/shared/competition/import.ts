import { DEFAULT_ENGLISH_TEXT_NORMALIZATION, DEFAULT_VIETNAMESE_TEXT_NORMALIZATION, type AnswerSpec } from './answer';
import { isMath, isSubject, usesEnglishContent, SUBJECT_LABELS, LEVEL_LABELS, levelsFor, type Scope, type QuestionFilters, type Question, type Option, type Media } from './types';

export class CompetitionError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const fail = (message: string): never => { throw new CompetitionError(400, 'INVALID_QUESTION', message); };
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Cần một đối tượng JSON.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 20000, required = false): string {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') return fail('Nội dung phải là chữ hoặc số.');
  const result = String(value).normalize('NFC').trim();
  if (result.length > max || /\u0000/.test(result) || (required && !result)) return fail(`Nội dung trống hoặc vượt quá ${max} ký tự.`);
  return result;
}
export function parseScope(value: unknown): Scope {
  const row = record(value);
  if (!isSubject(row.subject)) return fail('Môn học không hợp lệ.');
  const grade = Number(row.grade), level = row.level;
  if (!Number.isInteger(grade) || grade < 1 || grade > 9) return fail('Lớp phải từ 1 đến 9.');
  if (level !== 'practice' && level !== 'school' && level !== 'district' && level !== 'province' && level !== 'national') return fail('Cấp không hợp lệ.');
  if (!levelsFor(row.subject).includes(level)) return fail('Cấp này không hỗ trợ môn học đã chọn.');
  return { subject: row.subject, grade, level };
}
export function parseQuestionFilters(value: unknown): QuestionFilters {
  const row = record(value), filters: QuestionFilters = {};
  if (row.subject !== undefined && row.subject !== '') {
    if (!isSubject(row.subject)) return fail('Môn học không hợp lệ.');
    filters.subject = row.subject;
  }
  if (row.grade !== undefined && row.grade !== '') {
    const grade = Number(text(row.grade, 10, true));
    if (!Number.isInteger(grade) || grade < 1 || grade > 9) return fail('Lớp phải từ 1 đến 9.');
    filters.grade = grade;
  }
  if (row.level !== undefined && row.level !== '') {
    const level = text(row.level, 20, true);
    if (!Object.hasOwn(LEVEL_LABELS, level)) return fail('Cấp không hợp lệ.');
    filters.level = level as Scope['level'];
    if (filters.subject && !levelsFor(filters.subject).includes(filters.level)) return fail('Cấp này không hỗ trợ môn học đã chọn.');
  }
  return filters;
}
export function normalizeMedia(value: unknown): Media[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 4) return fail('Mỗi vị trí có tối đa 4 media.');
  return value.map(item => {
    const row = record(item);
    if (row.kind !== 'image' && row.kind !== 'audio') return fail('Loại media không hợp lệ.');
    const url = text(row.url, 2048, true);
    if (!/^\/(?:listening-media|vocab-images|audio)\/[A-Za-z0-9._/-]+$/.test(url) || url.includes('..')) return fail('Media phải dùng dịch vụ lưu trữ của B.');
    const rate = row.playbackRate === undefined ? 1 : Number(row.playbackRate);
    if (!Number.isFinite(rate) || rate < .5 || rate > 2) return fail('Tốc độ audio không hợp lệ.');
    return { kind: row.kind, url, ...(row.assetId ? { assetId: text(row.assetId, 160, true) } : {}), playbackRate: rate };
  });
}
function options(value: unknown, prefix = 'option'): Option[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 26) return fail('Phương án phải là mảng, tối đa 26.');
  return value.map((item, i) => {
    const row = typeof item === 'string' || typeof item === 'number' ? { text: item } : record(item);
    const body = text(row.text ?? row.content ?? '', 8000).replace(/^[A-Z][.)]\s+/, '');
    const attached = normalizeMedia(row.media);
    if (!body && !attached.length) return fail(`Phương án ${i + 1} trống.`);
    return { id: `${prefix}-${i + 1}`, label: String.fromCharCode(65 + i), text: body, media: attached };
  });
}
function reference(value: unknown, opts: Option[]): string {
  const target = text(value, 160, true);
  const match = opts.find(o => o.id === target || o.label === target.toUpperCase() || o.text === target);
  if (!match) return fail('Đáp án không khớp phương án.');
  return match.id;
}
function numeric(value: unknown, kind: 'integer' | 'decimal'): string {
  const result = text(value, 120, true);
  if (!(kind === 'integer' ? /^[+-]?\d+$/ : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/).test(result)) return fail('Đáp án số không hợp lệ.');
  return result;
}
export function normalizeQuestion(value: unknown, scope: Scope): Question {
  const row = record(value), content = row.content ? record(row.content) : row;
  const opts = options(row.options);
  const spec = row.answerSpec ? record(row.answerSpec) : null;
  const kind = spec?.kind ?? (opts.length ? 'single-choice' : isMath(scope.subject) && /^[+-]?\d+$/.test(String(row.answer ?? '')) ? 'integer' : 'text');
  let answerSpec: AnswerSpec;
  let interaction: Question['interaction'] = 'text-entry';
  let pairs: Question['pairs'];
  if (kind === 'single-choice') {
    if (opts.length < 2) return fail('Trắc nghiệm cần ít nhất 2 phương án.');
    answerSpec = { kind, correctOptionId: reference(spec?.correctOptionId ?? row.answer ?? row.correctAnswer, opts) }; interaction = 'choice';
  } else if (kind === 'text') {
    const values = spec?.acceptedAnswers ?? row.acceptedAnswers ?? [row.answer ?? row.correctAnswer];
    if (!Array.isArray(values) || !values.length || values.length > 20) return fail('Cần đáp án trả lời ngắn.');
    answerSpec = { kind, acceptedAnswers: values.map(v => text(v, 2000, true)), normalization: usesEnglishContent(scope.subject) ? { ...DEFAULT_ENGLISH_TEXT_NORMALIZATION } : { ...DEFAULT_VIETNAMESE_TEXT_NORMALIZATION } };
  } else if (kind === 'integer') {
    answerSpec = { kind, value: numeric(spec?.value ?? row.answer, kind), allowLeadingPlus: true };
  } else if (kind === 'decimal') {
    const tolerance = spec?.tolerance === undefined ? undefined : numeric(spec.tolerance, 'decimal');
    if (tolerance && Number(tolerance) < 0) return fail('Sai số không được âm.');
    answerSpec = { kind, value: numeric(spec?.value ?? row.answer, kind), acceptCommaDecimal: true, ...(tolerance ? { tolerance } : {}) };
  } else if (kind === 'fraction') {
    const numerator = numeric(spec?.numerator, 'integer'), denominator = numeric(spec?.denominator, 'integer');
    if (BigInt(denominator) === 0n) return fail('Mẫu số không được bằng 0.');
    answerSpec = { kind, numerator, denominator, acceptEquivalent: spec?.acceptEquivalent !== false };
  } else if (kind === 'numeric-with-unit') {
    if (!Array.isArray(spec?.acceptedUnits) || !spec.acceptedUnits.length || spec.acceptedUnits.length > 20) return fail('Cần đơn vị được chấp nhận.');
    answerSpec = { kind, value: numeric(spec.value, 'decimal'), acceptedUnits: spec.acceptedUnits.map(v => text(v, 60, true)) };
  } else if (kind === 'ordering') {
    if (opts.length < 2 || !Array.isArray(spec?.orderedTokenIds) || spec.orderedTokenIds.length !== opts.length) return fail('Sắp xếp cần đủ thứ tự cho mọi thẻ.');
    const ids = spec.orderedTokenIds.map(v => reference(v, opts));
    if (new Set(ids).size !== opts.length) return fail('Thứ tự chứa thẻ trùng.');
    answerSpec = { kind, orderedTokenIds: ids }; interaction = 'ordering';
  } else if (kind === 'matching') {
    const pairRow = record(row.pairs), left = options(pairRow.left, 'left'), right = options(pairRow.right, 'right');
    if (left.length < 2 || left.length !== right.length) return fail('Nối cặp cần hai cột cùng số phần tử.');
    const matches = record(spec?.correctPairMatches), entries = Object.entries(matches);
    if (entries.length !== left.length) return fail('Thiếu đáp án nối cặp.');
    const mapped = Object.fromEntries(entries.map(([l, r]) => [reference(l, left), reference(r, right)]));
    if (new Set(Object.values(mapped)).size !== right.length || Object.keys(mapped).length !== left.length) return fail('Đáp án nối cặp phải một-một.');
    answerSpec = { kind, correctPairMatches: mapped }; interaction = 'matching'; pairs = { left, right };
  } else return fail('Dạng đáp án chưa được hỗ trợ ở luồng đầu tiên.');
  const prompt = text(content.prompt ?? row.question ?? row.text, 20000, true);
  const difficulty = row.difficulty === undefined ? 2 : Number(row.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) return fail('Độ khó phải từ 1 đến 5.');
  const domain = text(row.domain ?? 'vocabulary', 80, true);
  if (scope.subject === 'english' && !['vocabulary', 'grammar', 'reading', 'listening'].includes(domain)) return fail('Nhóm IOE không hợp lệ.');
  return { ...scope, id: '', ownerId: '', revision: 0, title: text(content.title, 500), prompt, passage: text(content.passage),
    sourceNumber: text(row.sourceNumber, 100), options: opts, media: normalizeMedia(content.media), answerSpec,
    explanation: text(row.explanation ?? (row.feedback ? record(row.feedback).explanation : '')), interaction, domain, difficulty, ...(pairs ? { pairs } : {}) };
}
export function importQuestions(input: string | unknown, scope: Scope): { questions: Question[]; errors: { row: number; message: string }[] } {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > 1500000) return fail('JSON vượt quá 1,5 MB. Hãy nhập từng phần.');
    try { parsed = JSON.parse(input.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch { return fail('JSON không hợp lệ.'); }
  }
  const rows = Array.isArray(parsed) ? parsed : record(parsed).questions;
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) return fail('JSON cần mảng questions từ 1 đến 500 câu.');
  const questions: Question[] = [], errors: { row: number; message: string }[] = [];
  rows.forEach((row, i) => { try { questions.push(normalizeQuestion(row, scope)); } catch (error) { errors.push({ row: i + 1, message: error instanceof Error ? error.message : 'Câu không hợp lệ.' }); } });
  return { questions, errors };
}
export function buildImportPrompt(scope: Scope): string {
  return `Đọc toàn bộ PDF/ảnh đính kèm. Chép đúng câu hỏi môn ${SUBJECT_LABELS[scope.subject]}, lớp ${scope.grade}, cấp ${scope.level}; không tạo câu mới, không đoán đáp án. ${scope.subject === 'math-english' ? 'Giữ nội dung Toán bằng tiếng Anh: tiêu đề, câu hỏi, dữ kiện, phương án, đáp án và giải thích theo nguồn; không dịch sang tiếng Việt. Dùng cùng cấu trúc đáp án số/phân số/đơn vị của Toán, không áp dụng ma trận kiến thức IOE. ' : ''}Chỉ trả một JSON {"questions":[...]}. Mỗi câu: title (giữ tiêu đề nguồn), sourceNumber, prompt, passage (nếu có), options (mảng chữ, giữ đủ mọi phương án, không ép 4), answer (nhãn A/B/... hoặc trả lời ngắn), explanation (theo nguồn, thiếu để ""), domain (vocabulary/grammar/reading/listening chỉ với IOE Tiếng Anh; môn khác giữ nhóm kiến thức theo nguồn), difficulty (1–5). Trả lời ngắn dùng options:[]; giữ dấu tiếng Việt và đơn vị. Toán phân số/thập phân/đơn vị có thể dùng answerSpec thay answer: {kind:"fraction",numerator:"1",denominator:"2",acceptEquivalent:true}, {kind:"decimal",value:"1.5"}, {kind:"numeric-with-unit",value:"2",acceptedUnits:["cm"]}. Không có đáp án thì answer:"" để giáo viên hoàn thiện. Không tạo ID, URL, media hoặc dữ liệu cá nhân. Không Markdown, không giải thích ngoài JSON.`;
}

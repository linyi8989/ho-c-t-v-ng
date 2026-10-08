import { splitTeacherFeedback } from './feedback';
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
export function text(value: unknown, max = 20000, required = false, field = 'Nội dung'): string {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') return fail(`${field} phải là chữ hoặc số.`);
  const result = String(value).normalize('NFC').trim();
  if (required && !result) return fail(`${field} đang trống.`);
  if (result.length > max) return fail(`${field} vượt quá ${max} ký tự.`);
  if (/\u0000/.test(result)) return fail(`${field} chứa ký tự không hợp lệ.`);
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
    answerSpec = { kind, acceptedAnswers: values.map(v => text(v, 2000, true, 'Đáp án trả lời ngắn')), normalization: usesEnglishContent(scope.subject) ? { ...DEFAULT_ENGLISH_TEXT_NORMALIZATION } : { ...DEFAULT_VIETNAMESE_TEXT_NORMALIZATION } };
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
  const feedback = splitTeacherFeedback(text(row.explanation ?? (row.feedback ? record(row.feedback).explanation : ''), 20000, false, 'Giải thích'), text(row.teacherNote, 5000, false, 'Ghi chú cho giáo viên'));
  const teacherNote = text(feedback.teacherNote, 5000, false, 'Ghi chú cho giáo viên');
  return { ...scope, id: '', ownerId: '', revision: 0, title: text(content.title, 500), prompt, passage: text(content.passage),
    sourceNumber: text(row.sourceNumber, 100), options: opts, media: normalizeMedia(content.media), answerSpec,
    explanation: feedback.explanation, ...(teacherNote ? { teacherNote } : {}), interaction, domain, difficulty, ...(pairs ? { pairs } : {}) };
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
const MATH_ANSWER_GUIDANCE = 'Với trả lời ngắn dạng phân số/thập phân/số có đơn vị, có thể dùng answerSpec thay answer: {"kind":"fraction","numerator":"1","denominator":"2","acceptEquivalent":true}, {"kind":"decimal","value":"1.5"}, {"kind":"numeric-with-unit","value":"2","acceptedUnits":["cm"]}. Chỉ dùng dạng phù hợp đáp án nguồn và giữ đúng đơn vị.';
const MATH_TEACHING_GUIDANCE = 'Giúp trẻ nhận ra dữ kiện và điều cần tìm, nói rõ vì sao chọn phép tính/cách suy luận, rồi tính và kiểm tra kết quả/đơn vị. Với biểu đồ, đọc chú giải và giá trị mỗi biểu tượng trong lời giải. Khi chuyển để hai nhóm bằng nhau, giải thích nhóm này giảm và nhóm kia tăng trước khi dùng nửa hiệu. Dùng tính nhẩm, sơ đồ hoặc loại trừ khi giúp giải nhanh và vừa sức; không ép mọi câu theo một công thức.';

// Only the selected subject's instructions are emitted; the shared rules cover source fidelity and JSON.
const IMPORT_SUBJECT_PROMPTS: Record<Scope['subject'], { language: string; answers?: string; metadata?: string; teaching: string }> = {
  math: {
    language: 'Giữ nguyên chữ, ký hiệu và đơn vị của đề Toán. Viết explanation bằng tiếng Việt rõ ràng.',
    answers: MATH_ANSWER_GUIDANCE,
    teaching: MATH_TEACHING_GUIDANCE,
  },
  'math-english': {
    language: 'Giữ nội dung Toán bằng tiếng Anh: tiêu đề, câu hỏi, dữ kiện, phương án và đáp án; không dịch sang tiếng Việt. Hướng dẫn explanation cũng viết bằng tiếng Anh đơn giản, phù hợp với lớp học.',
    answers: MATH_ANSWER_GUIDANCE,
    teaching: MATH_TEACHING_GUIDANCE,
  },
  vietnamese: {
    language: 'Giữ nguyên câu chữ và dấu tiếng Việt trong đề, đoạn văn, phương án và đáp án. Viết explanation bằng tiếng Việt rõ ràng.',
    teaching: 'Hướng dẫn trẻ đọc yêu cầu, tìm từ ngữ hoặc chi tiết làm bằng chứng trong câu/đoạn văn, rồi áp dụng nghĩa từ hoặc quy tắc phù hợp. Trích ngắn bằng chứng có thật và giải thích vì sao chọn/viết đáp án đó. Nêu điểm dễ nhầm khi hữu ích; không bịa chi tiết văn bản.',
  },
  english: {
    language: 'Giữ nguyên nội dung tiếng Anh của câu hỏi, đoạn văn, phương án và đáp án. Viết explanation bằng tiếng Việt dễ hiểu; chỉ chú giải nghĩa từ/cấu trúc khi cần.',
    metadata: 'Thêm domain (vocabulary/grammar/reading/listening) và difficulty (1–5 theo lớp) vì bộ chọn câu của môn này dùng hai tiêu chí đó.',
    teaching: 'Giải thích nghĩa từ, dấu hiệu ngữ pháp hoặc chi tiết làm bằng chứng đọc/nghe giúp chọn hay viết đáp án. Không bịa nội dung bài nghe hoặc đoạn văn chưa có trong nguồn; nếu thiếu thì ghi rõ phần cần giáo viên cung cấp trong teacherNote.',
  },
};

export function buildImportPrompt(scope: Scope): string {
  const subjectPrompt = IMPORT_SUBJECT_PROMPTS[scope.subject];
  return [
    `Bạn đang soạn dữ liệu câu hỏi môn ${SUBJECT_LABELS[scope.subject]} cho học sinh lớp ${scope.grade}, cấp ${LEVEL_LABELS[scope.level]}.`,
    'Đọc toàn bộ PDF/ảnh đính kèm, ghép đúng câu hỏi, phương án, đáp án và hướng dẫn dù khác trang; không tạo câu mới, không đoán đáp án. Chỉ chép chữ gốc vào title, prompt và options; bỏ quảng cáo, số trang, chân trang. Tách đáp án/lời giải khỏi nội dung đề.',
    subjectPrompt.language,
    'Chỉ trả một JSON {"questions":[...]}. Mỗi câu gồm title (yêu cầu/tiêu đề nguồn), sourceNumber (số câu nguồn), prompt (nguyên văn câu hỏi), options, answer, explanation (hướng dẫn giải cho học sinh), teacherNote (ghi chú riêng cho giáo viên; không có thì ""). passage chỉ thêm khi nguồn có đoạn văn bằng chữ dùng chung cho nhiều câu, chép nguyên văn; nếu không có thì bỏ hoặc để "". Chỉ dùng các trường được yêu cầu trong prompt này.',
    'Trắc nghiệm một đáp án: options là mảng chuỗi, giữ đủ phương án chữ theo thứ tự nguồn, không ép 4; answer là nhãn A/B/... đúng. Trả lời ngắn: options:[], answer là đáp án nguồn. Không thêm questionType.',
    ...(subjectPrompt.answers ? [subjectPrompt.answers] : []),
    ...(subjectPrompt.metadata ? [subjectPrompt.metadata] : []),
    'HÌNH ẢNH: giáo viên tự tải ảnh vào câu hỏi/phương án. Không diễn giải hình hoặc biểu đồ thành dữ kiện trong prompt/passage; không dịch hình thành text hoặc emoji/icon. Phương án chỉ có hình giữ chỗ bằng {"text":""}; có chữ và hình thì chỉ chép chữ gốc. Ví dụ options:[{"text":""},{"text":""},{"text":""},{"text":""}], answer giữ nhãn nguồn. Không bỏ phương án hình hay đổi dạng câu; giáo viên gắn ảnh trước khi lưu. Chỉ đọc hình để viết explanation; nhận xét từ hình chỉ nằm trong lời giải.',
    'explanation phải dạy trẻ tư duy và cách làm, không chỉ chép đáp án:',
    '1. Nguồn có hướng dẫn đầy đủ: kiểm tra, giữ cách làm đúng và viết rõ từng bước; bổ sung lý do hoặc bước còn thiếu.',
    '2. Nguồn chỉ có đáp án đúng: tự xây dựng hướng dẫn từ dữ kiện câu hỏi, giải độc lập rồi đối chiếu với đáp án nguồn.',
    '3. Nguồn không có hướng dẫn: vẫn xây dựng cách giải khi đủ dữ kiện; không để explanation trống chỉ vì nguồn thiếu lời giải. Nếu thiếu cả đáp án, để answer:"" để giáo viên hoàn thiện, chỉ hướng dẫn phần chắc chắn trong explanation, ghi chỗ cần xác nhận vào teacherNote.',
    `Hướng dẫn học sinh lớp ${scope.grade}: thường 2–5 bước ngắn, đánh số, tách dòng; câu đơn giản có thể 1–2 bước. Nói rõ lý do chọn cách làm, kết luận và kiểm tra; ưu tiên cách nhanh, thông minh, vừa sức. Không dùng kiến thức vượt lớp hoặc bài giảng dài.`,
    subjectPrompt.teaching,
    'Kết luận trắc nghiệm kèm nội dung đáp án đúng, không chỉ ghi nhãn A/B/... vì phương án có thể được trộn. Đáp án, lời giải và dữ kiện phải thống nhất.',
    'Nếu hình/chữ không đọc được, đề thiếu thông tin hoặc đáp án nguồn mâu thuẫn với cách giải đã kiểm chứng: không bịa hay sửa đề/khóa đáp án để khớp; ghi "Cần giáo viên kiểm tra: ..." trong teacherNote, nêu cụ thể chỗ thiếu/mâu thuẫn. Không đưa cảnh báo hay ghi chú giáo viên vào explanation, prompt hoặc passage. Thiếu đáp án nguồn thì để answer:"".',
    'explanation và teacherNote đều là chuỗi văn bản; teacherNote chỉ dành cho giáo viên, tối đa 5000 ký tự. Mã hóa xuống dòng bằng \\n hợp lệ trong JSON. Không tạo ID, URL, media hoặc dữ liệu cá nhân. Không Markdown, không giải thích ngoài JSON.',
  ].join('\n');
}

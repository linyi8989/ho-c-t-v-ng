import { splitTeacherFeedback, studentReviewRows } from '../../shared/competition/feedback';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { closeSQLiteStorage, initializeSQLiteStorage, SQLiteFirestore, sqliteImmediateTransaction, sqliteQueryOne } from '../../lib/sqliteStorage';
import { importQuestions, normalizeQuestion, parseScope, parseQuestionFilters, buildImportPrompt } from '../../shared/competition/import';
import { SUBJECT_LABELS, levelsFor, playable, type Scope, type Question, type AttemptSession, type Paper, type OverviewReport, type ResultsPage } from '../../shared/competition/types';
import type { AssessmentUserAnswer } from '../../shared/competition/answer';
import { blueprint, selectQuestions } from './selection';
import { graderRegistry } from './graderRegistry';
import { archiveQuestions, bankScope, createPaper, getBankTopic, inventory, overview, listBankTopics, listPapers, listResults, listBank, saveQuestions, updateQuestion } from './repository';
import { createCompetitionEngine } from './engine';
import { getPracticeReport, getMistakeTopic, mistakeScope } from './practice';
import { migrateCompetitionSchema } from './schema';
import { createCompetitionRouter } from './router';
import { getLearningHistory, getLearningHistoryDetail } from '../learning-history/learningHistoryService';
import { parseLearningHistoryFilters } from '../learning-history/learningHistoryValidation';
import type { LearningHistoryActor } from '../learning-history/learningHistoryTypes';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'competition-integration-'));
process.env.NODE_ENV = 'test'; process.env.STORAGE_MODE = 'sqlite'; process.env.SQLITE_DRIVER = 'better-sqlite3';
process.env.SQLITE_DB_PATH = path.join(dir, 'app.sqlite'); process.env.SQLITE_ALLOW_CREATE = 'true'; process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';
const staff = { id: 'teacher-fixture', role: 'teacher' as const }, other = { id: 'other-teacher', role: 'teacher' as const };
const actor: LearningHistoryActor = { id: 'student-fixture', kind: 'user', ownerKey: 'user:student-fixture', role: 'student', userProfile: { name: 'Học sinh kiểm thử' } };
const secondActor: LearningHistoryActor = { ...actor, id: 'student-two', ownerKey: 'user:student-two' };
const mathScope: Scope = { subject: 'math', grade: 3, level: 'school' };
const fixture = (i: number) => ({ title: `Câu ${500 + i}. Nguồn`, sourceNumber: String(500 + i), prompt: `Tính ${i}+1`, options: ['1', '2', '3', '4', String(i + 1)], answer: 'E', explanation: `Giải thích ${i}` });
after(async () => { await closeSQLiteStorage(); fs.rmSync(dir, { recursive: true, force: true }); });

test('import preserves arbitrary options, short/numeric answers, source and reports missing keys', () => {
  const input = { questions: [fixture(10), { title: 'Dấu tiếng Việt', prompt: 'Viết từ', options: [], answer: 'Học trò' }, { prompt: 'Thiếu đáp án', options: ['Một', 'Hai'], answer: '' }] };
  const result = importQuestions(input, mathScope);
  assert.equal(result.questions.length, 2); assert.equal(result.errors[0].row, 3); assert.equal(result.questions[0].options.length, 5);
  assert.equal(result.questions[0].answerSpec.kind, 'single-choice'); assert.equal(result.questions[0].sourceNumber, '510');
  assert.match(buildImportPrompt(mathScope), /không đoán đáp án/);
  assert.throws(() => parseScope({ subject: 'math', grade: 10, level: 'school' }));
  assert.throws(() => normalizeQuestion({ ...fixture(1), media: [{ kind: 'image', url: 'data:image/png;base64,abc' }] }, mathScope));
  assert.throws(() => normalizeQuestion({ ...fixture(1), media: [{ kind: 'audio', url: '/audio/../secret' }] }, mathScope));
  assert.throws(() => normalizeQuestion({ ...fixture(1), media: [null] }, mathScope));
  assert.equal(importQuestions({ questions: [null, fixture(1)] }, mathScope).errors[0].row, 1);
  assert.throws(() => importQuestions(JSON.stringify({ questions: [{ prompt: 'ộ'.repeat(510000), answer: '1' }] }), mathScope), /vượt quá 1,5 MB/);
  assert.throws(() => normalizeQuestion({ prompt: 'A', answerSpec: { kind: 'fraction', numerator: '1', denominator: '0' } }, mathScope));
  const safe = playable(result.questions[0]); assert.ok(!('answerSpec' in safe)); assert.ok(!('explanation' in safe)); assert.ok(!('ownerId' in safe));
});
test('authoring prompt requests source-aware teaching steps for each subject without changing the JSON contract', () => {
  for (const subject of ['math', 'math-english', 'vietnamese', 'english'] as const) {
    const prompt = buildImportPrompt({ subject, grade: 3, level: 'school' });
    assert.ok(prompt.includes(SUBJECT_LABELS[subject]));
    assert.match(prompt, /học sinh lớp 3/);
    assert.match(prompt, /Nguồn có hướng dẫn đầy đủ/);
    assert.match(prompt, /Nguồn chỉ có đáp án đúng/);
    assert.match(prompt, /Nguồn không có hướng dẫn/);
    assert.match(prompt, /không để explanation trống chỉ vì nguồn thiếu lời giải/);
    assert.match(prompt, /2–5 bước ngắn/);
    assert.match(prompt, /nói rõ lý do/i);
    assert.match(prompt, /đối chiếu với đáp án nguồn/);
    assert.match(prompt, /Cần giáo viên kiểm tra/);
    assert.match(prompt, /không đoán đáp án/);
    assert.match(prompt, /answer:"" để giáo viên hoàn thiện/);
    assert.match(prompt, /không chỉ ghi nhãn A\/B/);
    assert.match(prompt, /chuỗi văn bản/);
    assert.ok(prompt.includes('\\n hợp lệ trong JSON'));
    assert.doesNotMatch(prompt, /explanation \(theo nguồn, thiếu để ""\)/);
  }
  assert.match(buildImportPrompt(mathScope), /giá trị mỗi biểu tượng/);
  assert.match(buildImportPrompt(mathScope), /nhóm này giảm và nhóm kia tăng/);
  const englishMath = buildImportPrompt({ ...mathScope, subject: 'math-english' });
  assert.match(englishMath, /không dịch sang tiếng Việt/);
  assert.match(englishMath, /explanation cũng viết bằng tiếng Anh đơn giản/);
  assert.match(buildImportPrompt({ ...mathScope, subject: 'vietnamese' }), /chi tiết làm bằng chứng/);
  assert.match(buildImportPrompt({ ...mathScope, subject: 'english' }), /dấu hiệu ngữ pháp/);
  assert.match(buildImportPrompt({ ...mathScope, grade: 1 }), /học sinh lớp 1/);
  assert.match(buildImportPrompt({ ...mathScope, grade: 9 }), /học sinh lớp 9/);
  for (const subject of ['math', 'math-english', 'vietnamese'] as const) {
    const prompt = buildImportPrompt({ ...mathScope, subject });
    assert.doesNotMatch(prompt, /domain|difficulty/);
    assert.match(prompt, /không dịch hình thành text hoặc emoji\/icon/);
    assert.match(prompt, /passage chỉ thêm khi nguồn có đoạn văn bằng chữ dùng chung/);
    assert.match(prompt, /nhận xét từ hình chỉ nằm trong lời giải/);
    assert.ok(prompt.includes('options:[{"text":""},{"text":""},{"text":""},{"text":""}]'));
    assert.doesNotMatch(prompt, /difficulty \(1–5 theo lớp\)/);
  }
  assert.match(buildImportPrompt({ ...mathScope, subject: 'english' }), /thêm domain.*difficulty/i);
});

test('selected subject prompts isolate language, answer formats and metadata while retaining source and teaching safeguards', () => {
  const subjects = ['math', 'math-english', 'vietnamese', 'english'] as const;
  const prompts = Object.fromEntries(subjects.map(subject => [subject, buildImportPrompt({ subject, grade: 7, level: 'province' })]));
  assert.equal(new Set(Object.values(prompts)).size, 4);
  for (const subject of subjects) {
    const prompt = prompts[subject];
    assert.equal(prompt.split('\n')[0], `Bạn đang soạn dữ liệu câu hỏi môn ${SUBJECT_LABELS[subject]} cho học sinh lớp 7, cấp Tỉnh/Thành phố.`);
    assert.match(prompt, /title.*sourceNumber.*prompt.*options.*answer.*explanation/);
    assert.match(prompt, /Chỉ chép chữ gốc/);
    assert.match(prompt, /không ép 4/);
    assert.match(prompt, /Không thêm questionType/);
    assert.match(prompt, /giáo viên tự tải ảnh/);
    assert.match(prompt, /không dịch hình thành text hoặc emoji\/icon/);
    assert.match(prompt, /Cần giáo viên kiểm tra/);
    assert.match(prompt, /Không tạo ID, URL, media hoặc dữ liệu cá nhân/);
    if (subject !== 'english') assert.doesNotMatch(prompt, /domain|difficulty|vocabulary|grammar|reading|listening|IOE/);
    if (subject === 'math' || subject === 'math-english') {
      assert.match(prompt, /answerSpec.*fraction.*decimal.*numeric-with-unit/);
      assert.match(prompt, /vì sao chọn phép tính/);
      assert.match(prompt, /nhóm này giảm và nhóm kia tăng/);
      assert.doesNotMatch(prompt, /dấu hiệu ngữ pháp|bằng chứng đọc\/nghe|chi tiết làm bằng chứng trong câu\/đoạn văn/);
    } else {
      assert.doesNotMatch(prompt, /answerSpec|fraction|decimal|numeric-with-unit|phép tính|nửa hiệu|đơn vị/);
    }
  }
  assert.doesNotMatch(prompts.math, /tiếng Anh|nghĩa từ|ngữ pháp/i);
  assert.match(prompts.math, /explanation bằng tiếng Việt/);
  assert.match(prompts['math-english'], /không dịch sang tiếng Việt/);
  assert.match(prompts['math-english'], /explanation cũng viết bằng tiếng Anh đơn giản/);
  assert.doesNotMatch(prompts['math-english'], /explanation bằng tiếng Việt/);
  assert.match(prompts.vietnamese, /dấu tiếng Việt/);
  assert.match(prompts.vietnamese, /chi tiết làm bằng chứng.*nghĩa từ/);
  assert.doesNotMatch(prompts.vietnamese, /tiếng Anh|bài nghe/i);
  assert.match(prompts.english, /domain \(vocabulary\/grammar\/reading\/listening\).*difficulty \(1–5 theo lớp\)/);
  assert.match(prompts.english, /dấu hiệu ngữ pháp/);
  assert.match(prompts.english, /Không bịa nội dung bài nghe/);
  assert.match(prompts.english, /explanation bằng tiếng Việt/);
  assert.doesNotMatch(prompts.english, /đề Toán|dấu tiếng Việt|explanation cũng viết bằng tiếng Anh/);
});

test('short-answer errors identify empty answers separately from the 2000-character limit on each accepted answer', () => {
  for (const answer of ['', '   ', undefined]) assert.throws(() => normalizeQuestion({ prompt: '358 − □ = 156 − 27', options: [], answer, explanation: 'Tính được số cần điền.' }, mathScope), /Đáp án trả lời ngắn đang trống/);
  assert.throws(() => normalizeQuestion({ prompt: 'Viết đáp án', options: [], answer: 'x'.repeat(2001) }, mathScope), /Đáp án trả lời ngắn vượt quá 2000 ký tự/);
  assert.throws(() => normalizeQuestion({ prompt: 'Viết đáp án', acceptedAnswers: ['229', ''] }, mathScope), /Đáp án trả lời ngắn đang trống/);
  assert.equal(normalizeQuestion({ prompt: 'Viết đáp án', answer: 'x'.repeat(2000), explanation: 'a'.repeat(2100) }, mathScope).explanation.length, 2100);
  assert.equal(normalizeQuestion({ prompt: 'Viết số không', answer: '0' }, mathScope).answerSpec.kind, 'integer');
});

test('teacher-only notes split from old explanation markers without losing teaching steps and are requested in all four prompts', () => {
  const steps = '1. Tính vế phải: 156 − 27 = 129.\n2. Số cần điền: 358 − 129 = 229.\n3. Kiểm tra hai vế bằng nhau.';
  const warning = 'Cần giáo viên kiểm tra: Ảnh nguồn chưa có đáp án chính thức.';
  assert.deepEqual(splitTeacherFeedback(steps), { explanation: steps, teacherNote: '' });
  assert.deepEqual(splitTeacherFeedback(steps + '\n4. ' + warning + '\nĐối chiếu trang đáp án gốc.'), { explanation: steps, teacherNote: warning + '\nĐối chiếu trang đáp án gốc.' });
  assert.deepEqual(splitTeacherFeedback('1. Đọc yêu cầu.\n2. ' + warning + '\n3. Tìm dữ kiện.'), { explanation: '1. Đọc yêu cầu.\n3. Tìm dữ kiện.', teacherNote: warning });
  assert.deepEqual(splitTeacherFeedback('Kết quả là 229. ' + warning), { explanation: 'Kết quả là 229.', teacherNote: warning });
  assert.deepEqual(splitTeacherFeedback(steps + '\n' + warning, warning), { explanation: steps, teacherNote: warning });
  for (const subject of ['math', 'math-english', 'vietnamese', 'english'] as const) {
    const scope = { ...mathScope, subject };
    const question = normalizeQuestion({ prompt: 'Câu hỏi nguồn', answer: '229', explanation: steps + '\n' + warning, teacherNote: 'Ghi chú riêng có sẵn.' }, scope);
    assert.equal(question.explanation, steps); assert.equal(question.teacherNote, 'Ghi chú riêng có sẵn.\n' + warning);
    assert.deepEqual(normalizeQuestion(question, scope), question);
    assert.doesNotMatch(JSON.stringify(playable(question)), /teacherNote|Cần giáo viên kiểm tra|Ghi chú riêng/);
    const prompt = buildImportPrompt(scope);
    assert.match(prompt, /teacherNote \(ghi chú riêng cho giáo viên/);
    assert.match(prompt, /ghi "Cần giáo viên kiểm tra: \.\.\." trong teacherNote/);
    assert.match(prompt, /Không đưa cảnh báo hay ghi chú giáo viên vào explanation/);
    assert.doesNotMatch(prompt, /ghi "Cần giáo viên kiểm tra: \.\.\." trong explanation/);
  }
  assert.throws(() => normalizeQuestion({ prompt: 'Câu hỏi', answer: '1', teacherNote: {} }, mathScope), /Ghi chú cho giáo viên phải là chữ hoặc số/);
  assert.throws(() => normalizeQuestion({ prompt: 'Câu hỏi', answer: '1', teacherNote: 'x'.repeat(5001) }, mathScope), /Ghi chú cho giáo viên vượt quá 5000 ký tự/);
  assert.equal(normalizeQuestion({ prompt: 'Câu hỏi', answer: '1', teacherNote: 'x'.repeat(5000) }, mathScope).teacherNote?.length, 5000);
  const question = normalizeQuestion({ prompt: 'Câu hỏi', answer: '1', teacherNote: 'PRIVATE_NOTE' }, mathScope);
  const rows = [{ question, studentAnswer: '1', correctAnswer: '1', isCorrect: true, unanswered: false, pointsAwarded: 10, explanation: steps + '\n' + warning, teacherNote: 'PRIVATE_ROW_NOTE' }];
  const safe = studentReviewRows(rows);
  assert.equal(safe[0].explanation, steps); assert.doesNotMatch(JSON.stringify(safe), /teacherNote|PRIVATE|Cần giáo viên kiểm tra/);
});

test('image-only options remain empty draft slots until teacher media is attached, with no invented passage or metadata required', () => {
  const row = { title: 'Chọn đáp án đúng', sourceNumber: '2', prompt: 'Hình nào là tam giác?', options: [{ text: '' }, { text: '' }], answer: 'B', explanation: 'Quan sát số cạnh. Tam giác có 3 cạnh.' };
  assert.throws(() => normalizeQuestion(row, mathScope), /Phương án 1 trống/);
  const completed = { ...row, options: row.options.map((option, i) => ({ ...option, media: [{ kind: 'image', url: `/listening-media/teacher-option-${i + 1}.png` }] })) };
  for (const subject of ['math', 'math-english', 'vietnamese'] as const) {
    const scope = { ...mathScope, subject }, result = importQuestions(JSON.stringify({ questions: [completed] }), scope);
    assert.deepEqual(result.errors, []);
    const question = result.questions[0];
    assert.equal(question.passage, ''); assert.equal(question.explanation, row.explanation);
    assert.ok(question.options.every(option => option.text === '' && option.media.length === 1));
    assert.equal(graderRegistry.grade(question.answerSpec, { selectedOptionId: 'option-2' }).isCorrect, true);
    assert.deepEqual(blueprint(scope).domains, {}); assert.deepEqual(blueprint(scope).difficulties, {});
  }
});

test('teaching explanations round-trip through JSON import while answers remain gradable and private before submission', () => {
  const samples = [
    { subject: 'math' as const, row: { title: 'Điền số thích hợp', sourceNumber: '3', prompt: 'Tủ A có 345 quyển sách, tủ B có 497 quyển. Chuyển bao nhiêu quyển từ B sang A để hai tủ bằng nhau?', options: [], answer: '76', domain: 'arithmetic', explanation: '1. Tủ B nhiều hơn tủ A: 497 − 345 = 152 quyển.\n2. Chuyển 1 quyển thì B giảm 1, A tăng 1; chênh lệch giảm 2 quyển. Vậy cần chuyển 152 : 2 = 76 quyển.\n3. Kiểm tra: 497 − 76 = 421 và 345 + 76 = 421. Hai tủ bằng nhau.' }, response: { textAnswer: '76' } },
    { subject: 'math' as const, row: { title: 'Hãy chọn đáp án đúng', sourceNumber: '1', prompt: 'Jerry được 112 ngày tuổi. Tom gấp 3 lần số ngày tuổi của Jerry. Tom được bao nhiêu ngày tuổi?', options: ['115 ngày', '336 ngày', '333 ngày', '335 ngày'], answer: 'B', domain: 'arithmetic', explanation: '1. Gấp 3 lần nghĩa là lấy 3 phần, mỗi phần 112 ngày.\n2. Tính 112 × 3 = 336. Vậy Tom được 336 ngày tuổi.' }, response: { selectedOptionId: 'option-2' } },
    { subject: 'math-english' as const, row: { title: 'Read the chart', sourceNumber: '4', prompt: 'How many cakes are in box C?', passage: 'Box C has five cake symbols. Each symbol represents two cakes.', options: [], answer: '10', domain: 'arithmetic', explanation: '1. Count the five symbols in box C.\n2. Each symbol means two cakes, so calculate 5 × 2 = 10.\n3. Check by counting in twos: 2, 4, 6, 8, 10. There are 10 cakes.' }, response: { textAnswer: '10' } },
    { subject: 'vietnamese' as const, row: { title: 'Đọc hiểu', sourceNumber: '2', prompt: 'Lan che ô cho ai?', passage: 'Trời mưa. Lan che ô cho em nhỏ.', options: ['Em nhỏ', 'Bà'], answer: 'A', domain: 'reading', explanation: '1. Đọc câu “Lan che ô cho em nhỏ.”\n2. Cụm từ “cho em nhỏ” cho biết người được che ô. Vậy đáp án là em nhỏ.' }, response: { selectedOptionId: 'option-1' } },
  ];
  for (const { subject, row, response } of samples) {
    const imported = importQuestions(JSON.stringify({ questions: [row] }), { ...mathScope, subject });
    assert.deepEqual(imported.errors, []); assert.equal(imported.questions.length, 1);
    const question = imported.questions[0];
    assert.equal(question.explanation, row.explanation);
    assert.equal(question.prompt, row.prompt); assert.equal(question.sourceNumber, row.sourceNumber);
    assert.deepEqual(question.options.map(option => option.text), row.options);
    assert.equal(graderRegistry.grade(question.answerSpec, response).isCorrect, true);
    assert.doesNotMatch(JSON.stringify(playable(question)), /explanation|answerSpec|correctOptionId/);
  }
});

test('ported grader handles Unicode, exact fractions, decimal comma and units', () => {
  const q = normalizeQuestion({ prompt: 'Viết từ', answer: 'Học trò' }, { ...mathScope, subject: 'vietnamese' });
  assert.equal(graderRegistry.grade(q.answerSpec, { textAnswer: '  HỌC  TRÒ ' }).isCorrect, true);
  assert.equal(graderRegistry.grade(q.answerSpec, { textAnswer: 'hoc tro' }).isCorrect, false);
  assert.equal(graderRegistry.grade({ kind: 'fraction', numerator: '1', denominator: '2', acceptEquivalent: true }, { textAnswer: '2/4' }).isCorrect, true);
  assert.equal(graderRegistry.grade({ kind: 'decimal', value: '1.5', acceptCommaDecimal: true }, { textAnswer: '1,50' }).isCorrect, true);
  assert.equal(graderRegistry.grade({ kind: 'numeric-with-unit', value: '2', acceptedUnits: ['cm'] }, { textAnswer: '2 cm' }).isCorrect, true);
  assert.equal(graderRegistry.grade({ kind: 'integer', value: '9007199254740993' }, { textAnswer: '9007199254740992' }).isCorrect, false);
});
test('bank filters allow blank/partial scopes while authoring still requires a complete valid scope', () => {
  assert.deepEqual(parseQuestionFilters({}), {});
  assert.deepEqual(parseQuestionFilters({ subject: '', grade: '', level: '' }), {});
  assert.deepEqual(parseQuestionFilters({ grade: '3' }), { grade: 3 });
  assert.deepEqual(parseQuestionFilters({ subject: 'math', level: 'school' }), { subject: 'math', level: 'school' });
  assert.deepEqual(parseQuestionFilters({ level: 'practice' }), { level: 'practice' });
  for (const filters of [{ subject: '__proto__' }, { grade: '0' }, { grade: '10' }, { grade: ['3'] }, { level: 'bad' }, { level: 'toString' }, { subject: ['math'] }, { subject: 'math', level: 'practice' }]) assert.throws(() => parseQuestionFilters(filters));
  assert.throws(() => parseScope({})); assert.throws(() => parseScope({ subject: '', grade: '', level: '' }));
});

test('English Math shares Math import/blueprint/grading while retaining English content and its own bank', () => {
  const scope: Scope = { subject: 'math-english', grade: 3, level: 'district' };
  assert.equal(SUBJECT_LABELS.math, 'Toán'); assert.equal(SUBJECT_LABELS['math-english'], 'Toán Tiếng Anh');
  for (const subject of ['math', 'math-english', 'vietnamese'] as const) {
    assert.deepEqual(levelsFor(subject), ['school', 'district', 'province', 'national']);
    for (let grade = 1; grade <= 9; grade++) for (const level of levelsFor(subject)) {
      const b = blueprint(parseScope({ subject, grade, level })); assert.equal(b.total, 30); assert.equal(b.durationMinutes, 30); assert.deepEqual(b.domains, {}); assert.deepEqual(b.difficulties, {});
    }
  }
  assert.throws(() => parseScope({ ...scope, subject: 'english-math-typo' }));
  const source = { title: 'Find the total', prompt: 'How many apples are there?', answer: '12', explanation: 'Add six and six.', domain: 'arithmetic' };
  const q = normalizeQuestion(source, scope), math = normalizeQuestion(source, { ...scope, subject: 'math' });
  assert.deepEqual(q.answerSpec, math.answerSpec); assert.equal(q.answerSpec.kind, 'integer'); assert.equal(q.prompt, source.prompt); assert.equal(q.explanation, source.explanation);
  assert.equal(graderRegistry.grade(q.answerSpec, { textAnswer: '+012' }).isCorrect, true);
  const english = normalizeQuestion({ prompt: 'Name the shape', answer: 'triangle' }, scope);
  assert.deepEqual(english.answerSpec, normalizeQuestion({ prompt: 'Name the shape', answer: 'triangle' }, { ...scope, subject: 'english' }).answerSpec);
  assert.equal(graderRegistry.grade(english.answerSpec, { textAnswer: ' TRIANGLE ' }).isCorrect, true);
  assert.match(buildImportPrompt(scope), /Toán Tiếng Anh/); assert.match(buildImportPrompt(scope), /không dịch sang tiếng Việt/);
  const rows = Array.from({ length: 30 }, (_, i) => ({ ...normalizeQuestion({ ...source, prompt: `${source.prompt} ${i}` }, scope), id: String(i) }));
  assert.equal(selectQuestions([...rows, ...rows.map(q => ({ ...q, subject: 'math' as const }))], blueprint(scope)).questions.length, 30);
  assert.throws(() => selectQuestions(rows.slice(0, 29), blueprint(scope)), /còn thiếu 1/);
});
test('IOE blueprint honors joint quotas when possible and relaxes without reducing total; math ignores quotas', () => {
  const scope: Scope = { subject: 'english', grade: 1, level: 'school' }, b = blueprint(scope);
  assert.equal(b.total, 100); assert.equal(blueprint({ ...scope, grade: 3 }).total, 200);
  const qs: Question[] = [];
  Object.keys(b.domains).forEach(domain => Object.keys(b.difficulties).forEach(difficulty => {
    for (let i = 0; i < 100; i++) qs.push({ ...normalizeQuestion({ prompt: `${domain}/${difficulty}/${i}`, options: ['a', 'b'], answer: 'A', domain, difficulty: Number(difficulty) }, scope), id: `${domain}-${difficulty}-${i}` });
  }));
  const exact = selectQuestions(qs, b); assert.equal(exact.questions.length, 100); assert.equal(exact.relaxed, false);
  Object.entries(b.domains).forEach(([d, n]) => assert.equal(exact.questions.filter(q => q.domain === d).length, n));
  Object.entries(b.difficulties).forEach(([d, n]) => assert.equal(exact.questions.filter(q => q.difficulty === Number(d)).length, n));
  const flexible = selectQuestions(qs.filter(q => q.domain === 'vocabulary' && q.difficulty === 1), b);
  assert.equal(flexible.questions.length, 100); assert.equal(flexible.relaxed, true);
  const thirty = Array.from({ length: 30 }, (_, i) => ({ ...normalizeQuestion(fixture(i), mathScope), id: String(i) }));
  assert.equal(selectQuestions(thirty, blueprint(mathScope)).questions.length, 30);
  assert.throws(() => selectQuestions([...thirty.slice(0, 29), thirty[0]], blueprint(mathScope)), /còn thiếu 1/);
});
test('real B SQLite: immutable flow, ownership, CAS, signed tickets, deadline, history and migration', async t => {
  await initializeSQLiteStorage(); const db = new SQLiteFirestore();
  await db.collection('vocab_sets').doc('existing-vocab').set({ id: 'existing-vocab', ownerId: staff.id, title: 'Legacy untouched', items: [{ id: 'old-item', term: 'apple', meaning: 'táo' }] });
  const legacyBefore = (await db.collection('vocab_sets').doc('existing-vocab').get()).data();
  await sqliteImmediateTransaction(migrateCompetitionSchema); await sqliteImmediateTransaction(migrateCompetitionSchema);
  assert.deepEqual((await db.collection('vocab_sets').doc('existing-vocab').get()).data(), legacyBefore);
  const bankFixtures = Array.from({ length: 35 }, (_, i) => ({ ...fixture(i), explanation: `Giải thích ${i}\n1. Cộng thêm 1 vào ${i}.\n2. Kết quả là ${i + 1}.` }));
  const saved = await saveQuestions(staff, mathScope, bankFixtures, 'fixture-save-key');
  assert.deepEqual(await saveQuestions(staff, mathScope, bankFixtures, 'fixture-save-key'), saved);
  await assert.rejects(saveQuestions(staff, mathScope, [fixture(80)], 'fixture-save-key'), /nội dung khác/);
  assert.equal((await listBank(other, mathScope, '', 1)).total, 0);
  assert.equal((await inventory(staff))[0].ready, true);
  const paper = await createPaper(staff, mathScope, 'Đề kiểm thử', 'public');
  let now = Date.parse('2026-10-04T12:00:00Z'); const engine = createCompetitionEngine('fixture-only-signing-secret-competition', () => now);
  const prepared = await engine.prepare(actor, 'Học sinh kiểm thử', paper.id, 'unique-run-fixture');
  const rawPayload = JSON.stringify(prepared); assert.doesNotMatch(rawPayload, /answerSpec|correctOptionId|explanation|sourceNumber|ownerId/);
  assert.equal(prepared.deadline, null); assert.equal(prepared.status, 'prepared');
  assert.deepEqual(await engine.prepare(actor, 'Học sinh kiểm thử', paper.id, 'unique-run-fixture'), prepared);
  await assert.rejects(engine.review(actor, prepared.id, prepared.ticket), /sau khi nộp/);
  await assert.rejects(engine.activate(secondActor, prepared.id, prepared.ticket), /Không tìm thấy/);
  await assert.rejects(engine.activate(actor, prepared.id, prepared.ticket + 'forged'), /Không tìm thấy/);
  const active = await engine.activate(actor, prepared.id, prepared.ticket);
  now += 30000; assert.equal((await engine.activate(actor, prepared.id, prepared.ticket)).deadline, active.deadline);
  const old = (await listBank(staff, mathScope, '', 1)).items[0];
  await assert.rejects(updateQuestion(other, old.id, mathScope, fixture(999), old.revision), /Không tìm thấy/);
  const edited = { ...old, explanation: 'New explanation', answerSpec: { kind: 'single-choice', correctOptionId: 'A' } };
  const savedEdit = await updateQuestion(staff, old.id, mathScope, edited, old.revision);
  assert.deepEqual(await updateQuestion(staff, old.id, mathScope, edited, old.revision), savedEdit);
  await assert.rejects(updateQuestion(staff, old.id, mathScope, { ...edited, explanation: 'Concurrent edit' }, old.revision), /sửa ở nơi khác/);
  await archiveQuestions(staff, saved.ids); // Existing paper and attempt remain self-contained.
  const answers = Object.fromEntries(active.questions.map(q => [q.id, { selectedOptionId: 'option-5' }])) as Record<string, AssessmentUserAnswer>;
  await assert.rejects(engine.save(actor, active.id, active.ticket, active.revision, { evil: { textAnswer: '1' } }), /không thuộc/);
  const outcomes = await Promise.allSettled([
    engine.save(actor, active.id, active.ticket, active.revision, answers),
    engine.save(actor, active.id, active.ticket, active.revision, {}),
  ]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1); assert.equal(outcomes.filter(r => r.status === 'rejected').length, 1);
  const resumed = await engine.resume(actor, active.id, active.ticket);
  const submits = await Promise.all([engine.submit(actor, active.id, active.ticket, resumed.revision, answers), engine.submit(actor, active.id, active.ticket, resumed.revision, {})]);
  assert.equal(submits[0].result?.rawScore, 300); assert.equal(submits[0].result?.score, 100); assert.deepEqual(submits[0].result, submits[1].result);
  assert.equal((await sqliteQueryOne<{ count: number }>('SELECT COUNT(*) AS count FROM competition_attempt_details WHERE attempt_id=?', [active.id]))?.count, 1);
  const review = await engine.review(actor, active.id, active.ticket);
  assert.equal(review.rows.length, 30); assert.ok(review.rows.every(q => q.question.options.length === 5 && q.explanation.startsWith('Giải thích')));
  for (const row of review.rows) assert.equal(row.explanation, bankFixtures.find(source => source.prompt === row.question.prompt)!.explanation);
  const filters = parseLearningHistoryFilters({ sourceType: 'competition' });
  const history = await getLearningHistory(actor, filters); assert.equal(history.items[0].attemptId, active.id); assert.equal(history.items[0].rawScore, 300); assert.equal(history.items[0].score, 100);
  const detail = await getLearningHistoryDetail(actor, active.id); assert.equal(detail.detailStatus, 'available'); assert.ok(detail.detail?.extraDetails.competitionReview);
  assert.deepEqual(detail.detail?.extraDetails.competitionReview, { version: 1, rows: review.rows });
  await assert.rejects(getLearningHistoryDetail(secondActor, active.id), /Không tìm thấy/);
  await t.test('expiry finalizes saved answers after tab closes and ignores late client writes', async () => {
    const next = await engine.prepare(actor, 'Học sinh kiểm thử', paper.id, 'expired-run-fixture'), started = await engine.activate(actor, next.id, next.ticket);
    const first = started.questions[0]; await engine.save(actor, started.id, started.ticket, started.revision, { [first.id]: { selectedOptionId: 'option-5' } });
    now = Date.parse(started.deadline!) + 1000; assert.equal(await engine.finalizeExpired(), 1);
    const late = await engine.submit(actor, started.id, started.ticket, started.revision + 1, answers);
    assert.equal(late.status, 'completed'); assert.equal(late.result?.rawScore, 10); assert.equal(late.result?.durationSeconds, 1800);
    assert.equal(late.result?.unansweredCount, 29);
  });
  assert.deepEqual((await db.collection('vocab_sets').doc('existing-vocab').get()).data(), legacyBefore);
});
test('overview and all-result pagination use real SQLite, omit prepared runs, and preserve ownership and archived history', async () => {
  const scope: Scope = { subject: 'math-english', grade: 2, level: 'district' };
  const before = await overview(staff);
  const empty = await overview(other); assert.equal(empty.totals.questions, 0); assert.equal(empty.totals.players, 0); assert.equal(Object.keys(empty.subjects).length, 4);
  const questions = Array.from({ length: 30 }, (_, i) => ({ prompt: `Find ${i} plus one`, answer: String(i + 1), explanation: 'Add one.', domain: 'arithmetic' }));
  const rows: unknown[] = [...questions];
  rows[0] = { prompt: 'Write one half', answerSpec: { kind: 'fraction', numerator: '1', denominator: '2', acceptEquivalent: true } };
  rows[1] = { prompt: 'Write one and a half', answerSpec: { kind: 'decimal', value: '1.5' } };
  rows[2] = { prompt: 'Write two centimetres', answerSpec: { kind: 'numeric-with-unit', value: '2', acceptedUnits: ['cm'] } };
  rows[3] = { prompt: 'Name a shape with three sides', answer: 'triangle' };
  await saveQuestions(staff, scope, rows, 'math-english-overview-fixture');
  assert.equal((await listBank(staff, scope, '', 1)).total, 30);
  assert.equal((await listBank(staff, { ...scope, subject: 'math' }, '', 1)).total, 0);
  const paper = await createPaper(staff, scope, 'English Math district fixture', 'public');
  const engine = createCompetitionEngine('fixture-only-overview-secret-at-least-24');
  const prepared = await engine.prepare(actor, 'Học sinh', paper.id, 'overview-prepared-fixture');
  const stock = await overview(staff); assert.equal(stock.totals.questions, before.totals.questions + 30); assert.equal(stock.subjects['math-english'].completed, 0); assert.equal(stock.subjects['math-english'].players, 0);
  assert.equal(stock.inventory.find(row => row.subject === scope.subject)?.count, 30);
  const active = await engine.activate(actor, prepared.id, prepared.ticket);
  assert.equal((await overview(staff)).subjects['math-english'].players, 1);
  const answers = Object.fromEntries(active.questions.map(q => [q.id, { textAnswer: q.prompt === 'Write one half' ? '2/4' : q.prompt === 'Write one and a half' ? '1,50' : q.prompt === 'Write two centimetres' ? '2 cm' : q.prompt === 'Name a shape with three sides' ? ' TRIANGLE ' : String(Number(q.prompt.match(/\d+/)![0]) + 1) }]));
  const completed = await engine.submit(actor, active.id, active.ticket, active.revision, answers); assert.equal(completed.result?.score, 100);
  for (let i = 0; i < 200; i++) {
    const next = await engine.prepare(actor, 'Học sinh', paper.id, `overview-pagination-fixture-${i}`);
    const started = await engine.activate(actor, next.id, next.ticket); await engine.submit(actor, next.id, next.ticket, started.revision, {});
  }
  await engine.prepare(actor, 'Học sinh', paper.id, 'overview-unstarted-fixture');
  const own = await overview(staff); assert.equal(own.subjects['math-english'].completed, 201); assert.equal(own.subjects['math-english'].attempts, 201); assert.equal(own.subjects['math-english'].players, 1);
  const all = await listResults(staff, {}); assert.ok(all.total > 201); assert.equal(all.pageSize, 50);
  const ids: string[] = [];
  for (let page = 1; page <= 5; page++) { const result = await listResults(staff, { subject: scope.subject }, page); assert.equal(result.total, 201); ids.push(...result.items.map(item => item.id)); }
  assert.equal(ids.length, 201); assert.equal(new Set(ids).size, 201); assert.ok(ids.includes(active.id));
  assert.equal((await listResults(staff, { grade: 2 })).total, 201); assert.equal((await listResults(staff, { level: 'district' })).total, 201);
  assert.equal((await listResults(staff, { subject: scope.subject, grade: 3 })).total, 0);
  await saveQuestions(other, scope, questions, 'other-teacher-bank-fixture');
  const otherPaper = await createPaper(other, scope, 'Other teacher paper', 'public');
  const otherRun = await engine.prepare(actor, 'Học sinh', otherPaper.id, 'other-teacher-attempt-fixture');
  const otherActive = await engine.activate(actor, otherRun.id, otherRun.ticket); await engine.submit(actor, otherRun.id, otherRun.ticket, otherActive.revision, {});
  assert.equal((await listResults(staff, { subject: scope.subject })).total, 201); assert.equal((await listResults(other, {})).total, 1);
  const admin = { id: 'admin-fixture', role: 'super_admin' as const };
  const adminReport = await overview(admin); assert.equal(adminReport.subjects[scope.subject].questions, 60); assert.equal(adminReport.subjects[scope.subject].players, 1); assert.equal(adminReport.subjects[scope.subject].completed, 202);
  assert.equal((await listResults(admin, { subject: scope.subject })).total, 202);
  await sqliteImmediateTransaction(db => db.run("UPDATE competition_papers SET status='archived',data_json=? WHERE id=?", [JSON.stringify({ ...paper, status: 'archived' }), paper.id]));
  assert.equal((await listResults(staff, { subject: scope.subject })).total, 201);
  assert.equal((await overview(staff)).subjects[scope.subject].completed, 201);
  assert.equal((await getLearningHistoryDetail(actor, active.id)).detailStatus, 'available');
});

test('actual HTTP module protects staff/private routes and supports larger JSON without changing old parser', async () => {
  const db = new SQLiteFirestore();
  const app = express(); app.use('/api/ioe-violympic', express.json({ limit: '2mb' })); app.use(express.json({ limit: '100kb' }));
  const authenticate: express.RequestHandler = (req, res, next) => { const value = req.headers.authorization; if (value === 'Bearer teacher-fixture') req.user = { ...staff, name: 'Giáo viên', email: '', status: 'active', createdAt: '' }; else if (value === 'Bearer student-fixture') req.user = { id: actor.id, role: 'student', name: 'Học sinh', email: '', status: 'active', createdAt: '' }; else return res.status(401).json({ error: 'Authentication required' }); next(); };
  const optional: express.RequestHandler = (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next();
  const requireStaff: express.RequestHandler = (req, res, next) => req.user?.role === 'teacher' ? next() : res.status(403).json({ error: 'Staff required' });
  app.use('/api/ioe-violympic', createCompetitionRouter({ enabled: true, db, ticketSecret: 'fixture-only-http-signing-secret', authenticateUser: authenticate, authenticateOptionalUser: optional, requireStaff, rateLimit: (_req, _res, next) => next() }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ioe-violympic`;
  try {
    const call = (url: string, token = '', method = 'GET', body?: unknown) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal((await call('/admin/questions?subject=math&grade=3&level=school')).status, 401);
    assert.equal((await call('/admin/questions')).status, 401);
    assert.equal((await call('/admin/questions', actor.id)).status, 403);
    assert.equal((await call('/admin/prompt', '', 'POST', mathScope)).status, 401);
    assert.equal((await call('/admin/prompt', actor.id, 'POST', mathScope)).status, 403);
    for (const subject of ['math', 'math-english', 'vietnamese', 'english'] as const) {
      const scope = { ...mathScope, subject };
      const response = await call('/admin/prompt', staff.id, 'POST', scope);
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), { prompt: buildImportPrompt(scope) });
    }
    for (const suffix of ['', '?subject=&grade=&level=', '?grade=3', '?subject=math', '?level=school']) {
      const response = await call('/admin/questions' + suffix, staff.id); assert.equal(response.status, 200);
      const data = await response.json(); assert.ok(data.items.every((q: Question) => q.ownerId === staff.id));
      assert.equal(data.total, (await listBank(staff, parseQuestionFilters(Object.fromEntries(new URLSearchParams(suffix.replace(/^\?/, '')))), '', 1)).total);
    }
    for (const suffix of ['?subject=bad', '?grade=0', '?grade=3&grade=4', '?level=__proto__', '?subject=math&level=practice', '?page=0']) assert.equal((await call('/admin/questions' + suffix, staff.id)).status, 400);
    assert.equal((await call('/admin/questions', staff.id, 'POST', { requestId: 'missing-scope-regression', questions: [fixture(90)] })).status, 400);
    assert.equal((await call('/admin/inventory', 'student-fixture')).status, 403);
    assert.equal((await call('/admin/overview')).status, 401); assert.equal((await call('/admin/results-page', 'student-fixture')).status, 403);
    const report: OverviewReport = await (await call('/admin/overview', staff.id)).json(); assert.equal(report.subjects['math-english'].questions, 30); assert.equal(report.subjects['math-english'].completed, 201);
    const allResults: ResultsPage = await (await call('/admin/results-page?subject=&grade=&level=', staff.id)).json(); assert.ok(allResults.total > 201);
    const filtered: ResultsPage = await (await call('/admin/results-page?subject=math-english&grade=2&level=district&page=5', staff.id)).json(); assert.equal(filtered.total, 201); assert.equal(filtered.items.length, 1);
    assert.equal((await call('/admin/results-page?subject=__proto__', staff.id)).status, 400); assert.equal((await call('/admin/results-page?level=bad', staff.id)).status, 400);
    assert.equal((await call('/admin/results-page?grade=0', staff.id)).status, 400); assert.equal((await call('/admin/results-page?page=0', staff.id)).status, 400);
    const payload = Array.from({ length: 10 }, (_, i) => ({ ...fixture(i + 80), passage: 'x'.repeat(16000) }));
    const saved = await call('/admin/questions', staff.id, 'POST', { ...mathScope, requestId: 'http-large-json-fixture', questions: payload, ownerId: other.id });
    assert.equal(saved.status, 201, await saved.text());
    const privateResponse = await call('/admin/papers', staff.id, 'POST', { ...mathScope, title: 'Private fixture', visibility: 'assignment' });
    // Only ten unique new questions after the previous test archived the original bank.
    assert.equal(privateResponse.status, 409);
    const otherScope = { ...mathScope, grade: 4 };
    await saveQuestions(staff, otherScope, Array.from({ length: 30 }, (_, i) => fixture(i + 400)), 'private-bank-fixture');
    const paper = await createPaper(staff, otherScope, 'Private paper', 'assignment');
    assert.equal((await call(`/papers/${paper.id}`)).status, 404);
    const publicList: Array<Omit<Paper, 'ownerId'>> = await (await call('/papers')).json(); assert.ok(publicList.every(p => !('ownerId' in p) && !('questions' in p))); assert.ok(!publicList.some(p => p.id === paper.id));
    assert.equal((await call('/attempts/prepare', actor.id, 'POST', { paperId: paper.id, clientRunId: 'private-run-fixture', access: 'forged-token' })).status, 404);
    await db.collection('classes').doc('class-fixture').set({ id: 'class-fixture', name: 'Lớp B', ownerId: staff.id });
    await db.collection('assignments').doc('assignment-fixture').set({ id: 'assignment-fixture', shareToken: 'valid-assignment-fixture', classId: 'class-fixture', resourceType: 'competition', resourceId: paper.id, title: 'Bài giao B', createdBy: staff.id });
    const prepared = await call('/attempts/prepare', actor.id, 'POST', { paperId: paper.id, clientRunId: 'private-valid-run-fixture', access: 'valid-assignment-fixture', studentName: 'Forged name', classId: 'forged-class' });
    assert.equal(prepared.status, 201); const session: AttemptSession = await prepared.json();
    assert.doesNotMatch(JSON.stringify(session), /answerSpec|correctOptionId|explanation/);
    const stored = await sqliteQueryOne<{ student_name: string; class_id: string }>('SELECT student_name,class_id FROM competition_attempts WHERE id=?', [session.id]);
    assert.equal(stored?.student_name, 'Học sinh'); assert.equal(stored?.class_id, 'class-fixture');
    await db.collection('assignments').doc('assignment-fixture').update({ status: 'archived' });
    assert.equal((await call('/attempts/prepare', actor.id, 'POST', { paperId: paper.id, clientRunId: 'revoked-run-fixture', access: 'valid-assignment-fixture' })).status, 404);
    await db.collection('assignments').doc('assignment-fixture').update({ status: 'active' });
    const guestId = 'b-guest-fixture', guestToken = 'b-fixture-capability-token-at-least-32-characters';
    await db.collection('guest_profiles').doc(guestId).set({ id: guestId, displayName: 'Học sinh khách B', status: 'active', accessTokenHash: crypto.createHash('sha256').update(guestToken).digest('hex'), accessTokenVersion: 1 });
    const guestCall = (url: string, method = 'GET', body?: unknown, ticket = '', credential = guestToken) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Guest-Id': guestId, 'X-Guest-Access-Token': credential, ...(ticket ? { 'X-Attempt-Ticket': ticket } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const guestBody = { paperId: paper.id, clientRunId: 'b-guest-run-fixture', access: 'valid-assignment-fixture', studentName: 'Tên giả', userId: actor.id };
    assert.equal((await guestCall('/attempts/prepare', 'POST', guestBody, '', 'forged-credential')).status, 401);
    const guestPrepared = await guestCall('/attempts/prepare', 'POST', guestBody); assert.equal(guestPrepared.status, 201);
    const guestRun: AttemptSession = await guestPrepared.json();
    assert.equal((await call('/practice')).status, 401);
    assert.equal((await guestCall('/practice', 'GET', undefined, '', 'forged-credential')).status, 401);
    assert.equal((await call('/papers/mistakes-math-4-school')).status, 401);
    assert.equal((await call('/papers/mistakes-math-10-school', actor.id)).status, 400);
    const guestStored = await sqliteQueryOne<{ student_name: string; guest_id: string; user_id: null; owner_key: string }>('SELECT student_name,guest_id,user_id,owner_key FROM competition_attempts WHERE id=?', [guestRun.id]);
    assert.equal(guestStored?.student_name, 'Học sinh khách B'); assert.equal(guestStored?.owner_key, `guest:${guestId}`); assert.equal(guestStored?.user_id, null);
    const guestActive: AttemptSession = await (await guestCall(`/attempts/${guestRun.id}/activate`, 'POST', {}, guestRun.ticket)).json();
    const guestSubmitted = await guestCall(`/attempts/${guestRun.id}/submit`, 'POST', { revision: guestActive.revision, answers: {} }, guestRun.ticket); assert.equal(guestSubmitted.status, 200);
    const guestActor: LearningHistoryActor = { id: guestId, kind: 'guest', role: 'student', ownerKey: `guest:${guestId}` };
    const guestHistory = await getLearningHistory(guestActor, parseLearningHistoryFilters({ sourceType: 'competition' })); assert.ok(guestHistory.items.some(i => i.attemptId === guestRun.id));
    const detail = await getLearningHistoryDetail(guestActor, guestRun.id);
    const reviewData = detail.detail?.extraDetails.competitionReview;
    assert.ok(reviewData && typeof reviewData === 'object' && 'rows' in reviewData && Array.isArray(reviewData.rows)); assert.equal(reviewData.rows.length, 30);
    await assert.rejects(getLearningHistoryDetail(actor, guestRun.id), /Không tìm thấy/);
    // A saved bank is playable without calling the staff paper-publication API.
    const bankId = 'bank-math-4-school';
    const catalogResponse = await call('/bank-topics'); assert.equal(catalogResponse.status, 200);
    const catalog = await catalogResponse.json(); assert.equal(catalog.find((row: { id: string }) => row.id === bankId).ready, true);
    assert.doesNotMatch(JSON.stringify(catalog), /answerSpec|correctOptionId|explanation|ownerId|sourceNumber|questions/);
    const bankInfo = await (await call(`/papers/${bankId}`)).json(); assert.equal(bankInfo.available, 30); assert.equal(bankInfo.total, 30);
    assert.equal((await call('/papers/bank-math-10-school')).status, 400);
    assert.equal((await call('/papers/bank-math-4-practice')).status, 400);
    assert.equal((await call('/attempts/prepare', '', 'POST', { paperId: bankId, clientRunId: 'bank-no-identity' })).status, 401);
    assert.equal((await call('/attempts/prepare', actor.id, 'POST', { paperId: bankId, clientRunId: 'bank-bad-context', access: 'forged' })).status, 400);
    const bankBody = { paperId: bankId, clientRunId: 'bank-public-prepare', ownerId: other.id, studentName: 'Tên giả', total: 1, durationMinutes: 999, classId: 'forged' };
    const bankPrepared = await guestCall('/attempts/prepare', 'POST', bankBody); assert.equal(bankPrepared.status, 201);
    const bankRun: AttemptSession = await bankPrepared.json(); assert.equal(bankRun.questions.length, 30); assert.equal(bankRun.durationMinutes, 30);
    assert.doesNotMatch(JSON.stringify(bankRun), /answerSpec|correctOptionId|explanation|ownerId|sourceNumber/);
    const bankStored = await sqliteQueryOne<{ student_name: string; class_id: string | null }>('SELECT student_name,class_id FROM competition_attempts WHERE id=?', [bankRun.id]);
    assert.equal(bankStored?.student_name, 'Học sinh khách B'); assert.equal(bankStored?.class_id, null);
    assert.equal((await guestCall(`/attempts/${bankRun.id}/review`, 'GET', undefined, bankRun.ticket)).status, 409);
    assert.equal((await guestCall(`/attempts/${bankRun.id}/activate`, 'POST', {}, bankRun.ticket + 'forged')).status, 404);
    const bankActive = await (await guestCall(`/attempts/${bankRun.id}/activate`, 'POST', {}, bankRun.ticket)).json();
    const bankAnswers = Object.fromEntries(bankRun.questions.map(q => [q.id, { selectedOptionId: 'option-5' }]));
    const bankSaved = await (await guestCall(`/attempts/${bankRun.id}/answers`, 'PUT', { revision: bankActive.revision, answers: bankAnswers }, bankRun.ticket)).json();
    assert.ok(!('questions' in bankSaved));
    const bankSubmitted = await (await guestCall(`/attempts/${bankRun.id}/submit`, 'POST', { revision: bankSaved.revision, answers: bankAnswers }, bankRun.ticket)).json();
    assert.equal(bankSubmitted.result.rawScore, 300);
    const bankReview = await (await guestCall(`/attempts/${bankRun.id}/review`, 'GET', undefined, bankRun.ticket)).json(); assert.equal(bankReview.rows.length, 30);
    assert.equal((await getLearningHistoryDetail(guestActor, bankRun.id)).detailStatus, 'available');
    assert.equal((await call(`/admin/results/${bankRun.id}`, staff.id)).status, 404, 'Shared bank does not grant teachers access to unrelated students');
    const shortage = await call('/attempts/prepare', actor.id, 'POST', { paperId: 'bank-math-9-national', clientRunId: 'bank-insufficient' });
    assert.equal(shortage.status, 409); assert.equal((await shortage.json()).code, 'BANK_INSUFFICIENT');
    // Wrong practice metadata and sampled snapshots are tied to B's verified
    // guest, not ownerId/question IDs supplied by a browser.
    const wrongRun: AttemptSession = await (await guestCall('/attempts/prepare', 'POST', { paperId: bankId, clientRunId: 'guest-wrong-bank' })).json();
    const wrongActive: AttemptSession = await (await guestCall(`/attempts/${wrongRun.id}/activate`, 'POST', {}, wrongRun.ticket)).json();
    await guestCall(`/attempts/${wrongRun.id}/submit`, 'POST', { revision: wrongActive.revision, answers: { [wrongRun.questions[0].id]: { selectedOptionId: 'option-1' } } }, wrongRun.ticket);
    const mine = await (await guestCall('/practice')).json(); assert.equal(mine.pendingCount, 1);
    assert.doesNotMatch(JSON.stringify(mine), /answerSpec|correctOptionId|explanation|ownerId|sourceNumber/);
    const privateId = 'mistakes-math-4-school';
    assert.equal((await (await guestCall(`/papers/${privateId}`)).json()).available, 1);
    assert.equal((await (await call(`/papers/${privateId}`, actor.id)).json()).available, 0);
    assert.equal((await guestCall('/attempts/prepare', 'POST', { paperId: privateId, clientRunId: 'practice-forged-context', access: 'valid-assignment-fixture' })).status, 400);
    const retry = await guestCall('/attempts/prepare', 'POST', { paperId: privateId, clientRunId: 'guest-private-practice', ownerKey: actor.ownerKey, questions: wrongRun.questions, total: 200 });
    assert.equal(retry.status, 201); const practice: AttemptSession = await retry.json();
    assert.equal(practice.questions.length, 1); assert.equal(practice.questions[0].id, wrongRun.questions[0].id);
    assert.doesNotMatch(JSON.stringify(practice), /answerSpec|correctOptionId|explanation/);
    assert.equal((await guestCall(`/attempts/${practice.id}/review`, 'GET', undefined, practice.ticket)).status, 409);
    assert.ok(!(await (await call('/papers')).json()).some((p: { id: string }) => p.id === privateId));
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});

test('wrong practice keeps frozen snapshots, excludes unanswered, clears mastered questions and shares normal History', async () => {
  const scope: Scope = { subject: 'math', grade: 8, level: 'district' };
  const student: LearningHistoryActor = { ...actor, id: 'practice-student', ownerKey: 'user:practice-student' };
  const stranger: LearningHistoryActor = { ...actor, id: 'practice-stranger', ownerKey: 'user:practice-stranger' };
  const engine = createCompetitionEngine('fixture-only-private-practice-secret');
  const saved = await saveQuestions(staff, scope, Array.from({ length: 30 }, (_, i) => ({ ...fixture(i + 3000), media: [{ kind: 'audio', url: '/audio/practice-fixture.mp3' }] })), 'practice-source-bank');
  assert.deepEqual(mistakeScope('mistakes-math-english-3-school'), { subject: 'math-english', grade: 3, level: 'school' });
  const original = await engine.prepare(student, 'Học sinh', 'bank-math-8-district', 'practice-origin-run');
  const active = await engine.activate(student, original.id, original.ticket);
  const wrong = Object.fromEntries(active.questions.slice(0, 13).map(q => [q.id, { selectedOptionId: 'option-1' }]));
  const completed = await engine.submit(student, active.id, active.ticket, active.revision, wrong);
  assert.equal(completed.result?.incorrectCount, 13); assert.equal(completed.result?.unansweredCount, 17);
  const originalReview = await engine.review(student, original.id, original.ticket);
  const paperId = 'mistakes-math-8-district';
  const beforeRead = await sqliteQueryOne('SELECT COUNT(*) AS n FROM competition_paper_versions');
  assert.equal((await getPracticeReport(student.ownerKey)).pendingCount, 13);
  assert.deepEqual(await sqliteQueryOne('SELECT COUNT(*) AS n FROM competition_paper_versions'), beforeRead);
  assert.equal((await getPracticeReport(stranger.ownerKey)).pendingCount, 0);
  await assert.rejects(engine.prepare(stranger, 'Other', paperId, 'practice-other-run'), /Không còn câu sai/);
  await archiveQuestions(staff, saved.ids);
  const info = await getMistakeTopic(student.ownerKey, scope); assert.equal(info.available, 13); assert.equal(info.total, 10);
  const [first, retry] = await Promise.all([engine.prepare(student, 'Student', paperId, 'practice-retry-run'), engine.prepare(student, 'Student', paperId, 'practice-retry-run')]);
  assert.equal(first.id, retry.id); assert.equal(first.ticket, retry.ticket); assert.deepEqual(first.questions, retry.questions);
  assert.equal(first.source, 'mistakes'); assert.equal(first.questions.length, 10);
  assert.ok(first.questions.every(q => q.media[0].url === '/audio/practice-fixture.mp3' && wrong[q.id]));
  assert.doesNotMatch(JSON.stringify(first), /answerSpec|correctOptionId|explanation/);
  await assert.rejects(engine.resume(stranger, first.id, first.ticket), /Không tìm thấy/);
  const firstActive = await engine.activate(student, first.id, first.ticket);
  const answers = Object.fromEntries(firstActive.questions.slice(0, 9).map((q, i) => [q.id, { selectedOptionId: i < 6 ? 'option-5' : 'option-1' }]));
  await engine.submit(student, first.id, first.ticket, firstActive.revision, answers);
  assert.equal((await getPracticeReport(student.ownerKey)).pendingCount, 7, 'Six correct answers clear; wrong and unanswered remain pending');
  const last = await engine.prepare(student, 'Student', paperId, 'practice-last-run'); assert.equal(last.questions.length, 7);
  const lastActive = await engine.activate(student, last.id, last.ticket);
  await engine.submit(student, last.id, last.ticket, lastActive.revision, Object.fromEntries(last.questions.map(q => [q.id, { selectedOptionId: 'option-5' }])));
  const report = await getPracticeReport(student.ownerKey); assert.equal(report.pendingCount, 0); assert.equal(report.completedCount, 3); assert.equal(report.lastScore, 100);
  assert.equal((await getMistakeTopic(student.ownerKey, scope)).ready, false);
  await assert.rejects(engine.prepare(student, 'Student', paperId, 'practice-empty-run'), /Không còn câu sai/);
  assert.deepEqual((await engine.prepare(student, 'Student', paperId, 'practice-last-run')).questions, last.questions, 'Retry of a completed run survives mastery');
  assert.deepEqual(await engine.review(student, original.id, original.ticket), originalReview);
  const history = await getLearningHistory(student, parseLearningHistoryFilters({ sourceType: 'competition' }));
  assert.equal(history.items.length, 3); assert.ok(history.items.some(item => item.attemptId === last.id));
  assert.equal((await getLearningHistoryDetail(student, last.id)).detailStatus, 'available');
  const usage = await sqliteQueryOne<{ n: number }>("SELECT COUNT(*) AS n FROM competition_asset_usages WHERE resource_type='paper-version' AND url='/audio/practice-fixture.mp3'");
  assert.ok(usage && usage.n >= 3);
  assert.ok(!(await listPapers()).some(p => p.id === paperId));
});

test('shared bank readiness and per-run sampling need no public paper, preserve retries and frozen History', async () => {
  const scope: Scope = { subject: 'math', grade: 9, level: 'national' }, bankId = 'bank-math-9-national';
  const admin = { id: 'admin-fixture', role: 'super_admin' as const };
  assert.deepEqual(bankScope('bank-math-english-3-school'), { subject: 'math-english', grade: 3, level: 'school' });
  const engine = createCompetitionEngine('fixture-only-shared-bank-secret');
  const before = await sqliteQueryOne<{ n: number }>('SELECT COUNT(*) AS n FROM competition_papers');
  const catalog = await listBankTopics(); assert.equal(catalog.length, 153);
  assert.equal(catalog.find(row => row.id === bankId)?.available, 0);
  assert.deepEqual(await sqliteQueryOne('SELECT COUNT(*) AS n FROM competition_papers'), before, 'Catalog reads never create papers');
  const left = await saveQuestions(staff, scope, Array.from({ length: 15 }, (_, i) => fixture(i + 1000)), 'bank-shared-left');
  const right = await saveQuestions(other, scope, Array.from({ length: 14 }, (_, i) => fixture(i + 1015)), 'bank-shared-right');
  await saveQuestions(other, scope, [fixture(1000)], 'bank-shared-duplicate');
  const almost = await getBankTopic(scope); assert.equal(almost.storedCount, 30); assert.equal(almost.available, 29); assert.equal(almost.ready, false);
  await assert.rejects(engine.prepare(actor, 'Học sinh', bankId, 'bank-too-short'), /còn thiếu 1/);
  assert.deepEqual(await sqliteQueryOne('SELECT COUNT(*) AS n FROM competition_papers'), before, 'Failure rolls back all writes');
  const last = await saveQuestions(other, scope, [fixture(1029)], 'bank-shared-last');
  assert.equal((await getBankTopic(scope)).ready, true);
  const runs = await Promise.all(Array.from({ length: 3 }, () => engine.prepare(actor, 'Học sinh', bankId, 'bank-shared-run')));
  assert.ok(runs.every(run => run.id === runs[0].id)); assert.deepEqual(runs[0].questions, runs[1].questions);
  assert.equal(runs[0].questions.length, 30); assert.equal(new Set(runs[0].questions.map(q => q.prompt)).size, 30);
  assert.ok(runs[0].questions.some(q => left.ids.includes(q.id))); assert.ok(runs[0].questions.some(q => right.ids.includes(q.id)));
  assert.equal((await sqliteQueryOne<{ n: number }>('SELECT COUNT(*) AS n FROM competition_paper_versions WHERE paper_id=?', [bankId]))?.n, 1);
  assert.ok(!(await listPapers()).some(paper => paper.id === bankId), 'Scope metadata is not a fixed public paper');
  await assert.rejects(engine.prepare(actor, 'Học sinh', 'bank-math-8-national', 'bank-shared-run'), /bài khác/);
  const current = (await listBank(staff, scope, '', 1)).items[0];
  await assert.rejects(updateQuestion(other, current.id, scope, current, current.revision), /Không tìm thấy/);
  await updateQuestion(staff, current.id, scope, { ...current, prompt: 'Changed bank content', answer: 'A', answerSpec: { kind: 'single-choice', correctOptionId: 'option-1' } }, current.revision);
  await archiveQuestions(staff, left.ids); await archiveQuestions(other, [...right.ids, ...last.ids]);
  assert.equal((await getBankTopic(scope)).ready, false);
  assert.deepEqual((await engine.prepare(actor, 'Học sinh', bankId, 'bank-shared-run')).questions, runs[0].questions, 'Retry survives depleted/edited bank');
  const active = await engine.activate(actor, runs[0].id, runs[0].ticket);
  const answers = Object.fromEntries(active.questions.map(q => [q.id, { selectedOptionId: 'option-5' }]));
  const completed = await engine.submit(actor, active.id, active.ticket, active.revision, answers); assert.equal(completed.result?.rawScore, 300);
  const review = await engine.review(actor, active.id, active.ticket); assert.ok(review.rows.every(row => row.isCorrect && row.explanation.startsWith('Giải thích')));
  assert.equal((await getLearningHistoryDetail(actor, active.id)).detailStatus, 'available');
  assert.ok((await listResults(admin, { grade: 9 })).items.some(row => row.id === active.id));
  assert.ok(!(await listResults(other, { grade: 9 })).items.some(row => row.id === active.id));
  const remaining = (await listBank(other, scope, '', 1)).items; await archiveQuestions(other, remaining.map(q => q.id));
  const fresh = await saveQuestions(other, scope, Array.from({ length: 45 }, (_, i) => fixture(2000 + i)), 'bank-shared-fresh');
  const next = await engine.prepare(actor, 'Học sinh', bankId, 'bank-shared-new-run'); assert.notEqual(next.id, active.id);
  assert.equal(next.questions.length, 30); assert.ok(next.questions.every(q => fresh.ids.includes(q.id)), 'New run samples current bank, not first published version');
  assert.equal((await sqliteQueryOne<{ n: number }>('SELECT COUNT(*) AS n FROM competition_paper_versions WHERE paper_id=?', [bankId]))?.n, 2);
  assert.deepEqual((await engine.review(actor, active.id, active.ticket)).rows, review.rows);
  await assert.rejects(engine.prepare(actor, 'Học sinh', 'bank-math-8-national', 'bank-wrong-scope'), /còn thiếu 30/);
});

test('unfiltered and partial bank queries preserve ownership, pagination, archives and literal search', async () => {
  const teacher = { id: 'filter-teacher', role: 'teacher' as const }, foreign = { id: 'filter-other', role: 'teacher' as const };
  const scope: Scope = { subject: 'math', grade: 8, level: 'province' };
  const math = await saveQuestions(teacher, scope, Array.from({ length: 35 }, (_, i) => ({ ...fixture(900 + i), title: 'Filter regression', prompt: i ? `Filter regression math ${i}` : 'Filter regression literal 50%_\\path' })), 'filter-math-fixture');
  const english = await saveQuestions(teacher, { subject: 'english', grade: 2, level: 'school' }, Array.from({ length: 3 }, (_, i) => ({ ...fixture(960 + i), title: 'Filter regression', prompt: `Filter regression English ${i}` })), 'filter-english-fixture');
  const otherRows = await saveQuestions(foreign, scope, Array.from({ length: 2 }, (_, i) => ({ ...fixture(980 + i), title: 'Filter regression', prompt: `Filter regression foreign ${i}` })), 'filter-foreign-fixture');
  try {
    await archiveQuestions(teacher, [math.ids[34]]);
    const first = await listBank(teacher, {}, '', 1), second = await listBank(teacher, {}, '', 2);
    assert.equal(first.total, 37); assert.equal(first.items.length, 30); assert.equal(second.total, 37); assert.equal(second.items.length, 7);
    assert.equal(new Set([...first.items, ...second.items].map(q => q.id)).size, 37);
    assert.ok([...first.items, ...second.items].every(q => q.ownerId === teacher.id && !q.archived));
    assert.ok(![...first.items, ...second.items].some(q => q.id === math.ids[34]));
    for (const filters of [{ subject: 'math' as const }, { grade: 8 }, { level: 'province' as const }, scope]) assert.equal((await listBank(teacher, filters, '', 1)).total, 34);
    assert.equal((await listBank(teacher, { grade: 2 }, '', 1)).total, 3);
    assert.equal((await listBank(teacher, { subject: 'math', grade: 2 }, '', 1)).total, 0);
    assert.equal((await listBank(teacher, {}, '50%_\\path', 1)).total, 1);
    assert.equal((await listBank(teacher, {}, '50%Z', 1)).total, 0);
    const admin = await listBank({ id: 'filter-admin', role: 'super_admin' }, {}, 'Filter regression', 1);
    assert.equal(admin.total, 39);
    assert.equal((await listBank(foreign, {}, '', 1)).total, 2);
  } finally {
    await archiveQuestions(teacher, [...math.ids, ...english.ids]); await archiveQuestions(foreign, otherRows.ids);
  }
});
test('media maintenance dry-run protects TTS used by archived competition versions', async () => {
  const mediaDir = path.join(dir, 'tts'); fs.mkdirSync(mediaDir);
  const referenced = `${'c'.repeat(64)}.mp3`, orphan = `${'d'.repeat(64)}.mp3`;
  for (const name of [referenced, orphan]) { const file = path.join(mediaDir, name); fs.writeFileSync(file, 'fixture'); fs.utimesSync(file, new Date('2020-01-01'), new Date('2020-01-01')); }
  const scope: Scope = { subject: 'vietnamese', grade: 4, level: 'school' };
  const saved = await saveQuestions(staff, scope, [{ prompt: 'Đọc từ', answer: 'ngày', media: [{ kind: 'audio', url: `/audio/${referenced}` }] }], 'media-maintenance-fixture');
  await archiveQuestions(staff, saved.ids);
  const result = spawnSync(process.execPath, ['scripts/media-orphan-maintenance.mjs', '--db', process.env.SQLITE_DB_PATH!, '--tts-dir', mediaDir], { cwd: process.cwd(), encoding: 'utf8', env: process.env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout); assert.equal(report.mode, 'dry-run'); assert.equal(report.report.tts.referenced, 1); assert.deepEqual(report.report.tts.candidates.map((f: { name: string }) => f.name), [orphan]);
  assert.ok(fs.existsSync(path.join(mediaDir, orphan))); assert.ok(fs.existsSync(path.join(mediaDir, referenced)));
});

test('teacher notes persist through bank edits but stay private in attempts, frozen reviews and History, including legacy warnings', async () => {
  const scope: Scope = { subject: 'math', grade: 6, level: 'national' };
  const explanation = '1. Đọc dữ kiện.\n2. Chọn phép tính và kiểm tra.';
  const privateNote = 'PRIVATE_TEACHER_NOTE_CHECK_ORIGINAL';
  const saved = await saveQuestions(staff, scope, Array.from({ length: 30 }, (_, i) => ({ prompt: `Tính tổng ${i} + 1`, options: [], answer: String(i + 1), explanation, teacherNote: privateNote })), 'teacher-note-roundtrip');
  const bank = await listBank(staff, scope, '', 1);
  assert.equal(bank.items.length, 30); assert.ok(bank.items.every(question => question.teacherNote === privateNote));
  const paper = await createPaper(staff, scope, 'Teacher note privacy fixture', 'public');
  const source = bank.items.find(question => question.id === saved.ids[0])!;
  const updated = await updateQuestion(staff, source.id, scope, { ...source, teacherNote: 'UPDATED_TEACHER_NOTE' }, source.revision);
  assert.equal(updated.teacherNote, 'UPDATED_TEACHER_NOTE');
  const cleared = await updateQuestion(staff, source.id, scope, { ...updated, teacherNote: '' }, updated.revision);
  assert.equal(cleared.teacherNote, undefined);
  const engine = createCompetitionEngine('teacher-note-fixture-signing-secret');
  const prepared = await engine.prepare(actor, 'Student fixture', paper.id, 'teacher-note-private-run');
  assert.doesNotMatch(JSON.stringify(prepared), /teacherNote|PRIVATE_TEACHER|UPDATED_TEACHER/);
  const attempt = await sqliteQueryOne<{ data_json: string }>('SELECT data_json FROM competition_attempts WHERE id=?', [prepared.id]);
  const frozen = JSON.parse(attempt!.data_json);
  assert.ok(frozen.questions.every((question: Question) => question.teacherNote === privateNote), 'Bank note edits do not rewrite frozen versions.');
  // Simulate an older snapshot whose teacher warning was mixed into the explanation.
  const legacyWarning = 'Cần giáo viên kiểm tra: LEGACY_TEACHER_ONLY_WARNING';
  frozen.questions[0].explanation += '\n' + legacyWarning;
  await sqliteImmediateTransaction(db => db.run('UPDATE competition_attempts SET data_json=? WHERE id=?', [JSON.stringify(frozen), prepared.id]));
  const active = await engine.activate(actor, prepared.id, prepared.ticket);
  await engine.submit(actor, active.id, active.ticket, active.revision, {});
  const review = await engine.review(actor, active.id, active.ticket);
  assert.ok(review.rows.every(row => row.explanation === explanation));
  assert.doesNotMatch(JSON.stringify(review), /teacherNote|PRIVATE_TEACHER|UPDATED_TEACHER|LEGACY_TEACHER|Cần giáo viên kiểm tra/);
  const detail = await sqliteQueryOne<{ data_json: string }>('SELECT data_json FROM competition_attempt_details WHERE attempt_id=?', [active.id]);
  const historical = JSON.parse(detail!.data_json);
  historical.rows[0].explanation += '\n' + legacyWarning;
  historical.rows[0].question.teacherNote = privateNote;
  historical.rows[0].teacherNote = privateNote;
  historical.answerDetails[0].explanation += '\n' + legacyWarning;
  historical.extraDetails.competitionReview.rows[0].explanation += '\n' + legacyWarning;
  historical.extraDetails.competitionReview.rows[0].question.teacherNote = privateNote;
  const originalDetail = JSON.stringify(historical);
  await sqliteImmediateTransaction(db => db.run('UPDATE competition_attempt_details SET data_json=? WHERE attempt_id=?', [originalDetail, active.id]));
  const legacyReview = await engine.review(actor, active.id, active.ticket);
  const history = await getLearningHistoryDetail(actor, active.id);
  assert.equal(history.detailStatus, 'available');
  for (const payload of [legacyReview, history]) assert.doesNotMatch(JSON.stringify(payload), /teacherNote|PRIVATE_TEACHER|UPDATED_TEACHER|LEGACY_TEACHER|Cần giáo viên kiểm tra/);
  assert.equal((await sqliteQueryOne<{ data_json: string }>('SELECT data_json FROM competition_attempt_details WHERE attempt_id=?', [active.id]))!.data_json, originalDetail, 'Reading sanitizes responses without rewriting History.');
  await assert.rejects(getLearningHistoryDetail(secondActor, active.id), /Không tìm thấy/);
});

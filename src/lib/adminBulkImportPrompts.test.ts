import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMultipleChoiceGrammarBulkImportPrompt,
  buildRewriteGrammarBulkImportPrompt,
  buildVocabularyBulkImportPrompt,
} from './adminBulkImportPrompts';

const context = {
  title: 'Unit 3: Traffic',
  grade: 'Lớp 6',
  subject: 'English',
  topic: 'Road safety',
  tags: ['traffic', 'safety'],
  description: 'Từ và câu hỏi phù hợp học sinh Việt Nam.',
};

test('vocabulary prompt owns the exact four-column paste contract', () => {
  const prompt = buildVocabularyBulkImportPrompt(context);
  assert.match(prompt, /word \| meaning \| ipa \| partOfSpeech/);
  assert.match(prompt, /Tối đa 500 dòng/);
  assert.match(prompt, /Không được dùng ký tự \| bên trong/);
  assert.match(prompt, /Tên bài\/bộ dữ liệu: Unit 3: Traffic/);
  assert.match(prompt, /Tags: traffic, safety/);
  assert.doesNotMatch(prompt, /QUESTION:/);
});

test('multiple-choice prompt matches the existing two-to-four-option grammar parser', () => {
  const prompt = buildMultipleChoiceGrammarBulkImportPrompt(context);
  for (const field of ['QUESTION:', 'A:', 'B:', 'C:', 'D:', 'ANSWER:', 'EXPLANATION:']) {
    assert.ok(prompt.includes(field), `Missing ${field}`);
  }
  assert.match(prompt, /ANSWER chỉ là đúng một chữ cái in hoa/);
  assert.match(prompt, /nếu có D thì bắt buộc phải có C/);
  assert.match(prompt, /Giữa hai câu có đúng một dòng trống/);
  assert.doesNotMatch(prompt, /ACCEPTED:/);
});

test('rewrite prompt keeps ACCEPTED optional and one alternative per line', () => {
  const prompt = buildRewriteGrammarBulkImportPrompt(context);
  for (const field of ['QUESTION:', 'ANSWER:', 'ACCEPTED:', 'EXPLANATION:']) {
    assert.ok(prompt.includes(field), `Missing ${field}`);
  }
  assert.match(prompt, /ACCEPTED là tùy chọn/);
  assert.match(prompt, /mỗi đáp án tiếp theo trên một dòng riêng/);
  assert.match(prompt, /không tạo đề bài luận mở/);
  assert.doesNotMatch(prompt, /\nA: lựa chọn A/);
});

test('prompt context drops empty rows instead of emitting fake values', () => {
  const prompt = buildVocabularyBulkImportPrompt({ title: '  Animals  ', topic: '   ' });
  assert.match(prompt, /Tên bài\/bộ dữ liệu: Animals/);
  assert.doesNotMatch(prompt, /Topic:/);
  assert.doesNotMatch(prompt, /undefined|null/);
});

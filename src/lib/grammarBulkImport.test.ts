import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBulkGrammarText, parseBulkRewriteText } from './grammarBulkImport';

const first = 'QUESTION: She _____ to school every day.\nA: go\nB: goes\nC: going\nANSWER: B\nEXPLANATION: Chủ ngữ She dùng goes.';
const second = 'QUESTION: They _____ watching TV now.\nA: is\nB: are\nANSWER: B\nEXPLANATION: Chủ ngữ They dùng are.';
const rewrite = "QUESTION: Expand It's Monday.\nANSWER: It is Monday.\nACCEPTED: It's Monday.\nALTERNATIVES: It is Monday\nEXPLANATION: It's means It is.";
const rewrite2 = 'QUESTION: She _____ a teacher.\nANSWER: is\nEXPLANATION: She đi với is.';

function assertBoth(input: string) {
  const result = parseBulkGrammarText(input);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.questions.map(q => q.questionText), ['She _____ to school every day.', 'They _____ watching TV now.']);
  assert.deepEqual(result.questions.map(q => q.options.find(o => o.id === q.correctOptionId)?.text), ['goes', 'are']);
  assert.deepEqual(result.questions.map(q => q.position), [1, 2]);
  return result;
}

test('legacy blank-line input keeps options, answer IDs and explanations', () => {
  const result = assertBoth(first + '\n\n' + second);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.questions[0].options.map(o => o.originalPosition), [1, 2, 3]);
  assert.equal(result.questions[0].explanation, 'Chủ ngữ She dùng goes.');
});

test('QUESTION boundaries retain every record without blank lines (regression)', () => {
  assertBoth(first + '\n' + second);
});

for (const [name, separator] of Object.entries({ CRLF: '\r\n', CR: '\r', NEL: '\u0085', LS: '\u2028', PS: '\u2029' })) {
  test('recognizes ' + name + ' line endings with no blank separator', () => {
    assertBoth((first + '\n' + second).replace(/\n/g, separator));
  });
}

test('supports BOM, case-insensitive indented labels and whitespace-only paragraphs', () => {
  assertBoth('\uFEFF' + (first + '\n\u00A0\n' + second).replace(/^QUESTION:/gm, '  question :'));
});

test('recovers all labels collapsed into one physical line and asks for review', () => {
  const result = assertBoth((first + '\n' + second).replace(/\n/g, ' '));
  assert.match(result.warnings[0], /dồn trên cùng một dòng/);
  assert.equal(result.questions[0].explanation, 'Chủ ngữ She dùng goes.');
});

test('recovers collapsed records mixed with normally formatted questions', () => {
  assertBoth(first.replace(/\n/g, ' ') + '\n' + second);
});

test('decodes literal escaped line breaks only before reserved field labels', () => {
  const result = assertBoth((first + '\n\n' + second).replace(/\n/g, '\\n'));
  assert.deepEqual(result.warnings, []);
  const literal = parseBulkGrammarText(first.replace('goes.', 'goes. Ký hiệu \\n và C:\\new phải được giữ.'));
  assert.ok(literal.questions[0].explanation.includes('\\n và C:\\new'));
});

test('blank paragraphs inside an explanation do not split the record', () => {
  const result = assertBoth(first + '\n\nĐây là đoạn thứ hai.\n\n' + second);
  assert.equal(result.questions[0].explanation, 'Chủ ngữ She dùng goes.\n\nĐây là đoạn thứ hai.');
});

test('normal multi-line questions/options preserve wrapped content and inline labels', () => {
  const result = parseBulkGrammarText('QUESTION: Choose A: or B: as shown.\nKeep this instruction.\nA: first\noption\nB: second\nANSWER: B\nEXPLANATION: Nội dung có QUESTION: trong câu văn.\nA: được dùng như ví dụ.');
  // A label at the start of a physical line is reserved and must not overwrite.
  assert.equal(result.questions.length, 0);
  assert.match(result.errors[0], /nhãn A lặp lại/);
  const valid = parseBulkGrammarText('QUESTION: Choose A: or B: as shown.\nKeep this instruction.\nA: first\noption\nB: second\nANSWER: B\nEXPLANATION: Nội dung có QUESTION: và A: trong câu văn.');
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.questions[0].questionText, 'Choose A: or B: as shown.\nKeep this instruction.');
  assert.equal(valid.questions[0].options[0].text, 'first\noption');
  assert.equal(valid.questions[0].explanation, 'Nội dung có QUESTION: và A: trong câu văn.');
});

test('inline option/answer labels inside a collapsed explanation remain content', () => {
  const result = parseBulkGrammarText(first.replace(/\n/g, ' ') + ' Ví dụ A: go; ANSWER: B.');
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions[0].explanation, 'Chủ ngữ She dùng goes. Ví dụ A: go; ANSWER: B.');
});

test('a malformed middle record reports its number while keeping its valid neighbors', () => {
  const bad = 'QUESTION: Broken.\nA: one\nB: two\nEXPLANATION: Missing answer.';
  for (const input of [first + '\n' + bad + '\n' + second, (first + '\n' + bad + '\n' + second).replace(/\n/g, ' ')]) {
    const result = assertBothWithError(input);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Câu số 2.*thiếu ANSWER/);
  }
});

function assertBothWithError(input: string) {
  const result = parseBulkGrammarText(input);
  assert.deepEqual(result.questions.map(q => q.questionText), ['She _____ to school every day.', 'They _____ watching TV now.']);
  assert.deepEqual(result.questions.map(q => q.position), [1, 2]);
  return result;
}

test('duplicate singleton fields are errors instead of silently overwriting content', () => {
  for (const key of ['A', 'B', 'ANSWER', 'EXPLANATION']) {
    const result = parseBulkGrammarText(first + '\n' + key + ': overwritten');
    assert.equal(result.questions.length, 0);
    assert.match(result.errors[0], new RegExp('nhãn ' + key + ' lặp lại'));
  }
});

test('missing fields, unsupported options and invalid correct answers remain rejected', () => {
  for (const [input, error] of [
    [first.replace('B: goes\n', ''), /thiếu B/],
    [first.replace('C: going', 'D: going'), /thiếu đáp án C/],
    [first.replace('ANSWER: B', 'ANSWER: D'), /ANSWER là D/],
    [first.replace('ANSWER: B', 'E: went\nANSWER: B'), /đáp án E/],
    [first.replace('ANSWER: B', 'E: went\nANSWER: B').replace(/\n/g, ' '), /đáp án E/],
  ] as const) {
    const result = parseBulkGrammarText(input);
    assert.equal(result.questions.length, 0);
    assert.match(result.errors[0], error);
  }
});

test('two-to-four options and duplicate warnings retain legacy validation', () => {
  const result = parseBulkGrammarText(first.replace('ANSWER: B', 'D: went\nANSWER: D'));
  assert.equal(result.questions[0].options.length, 4);
  assert.equal(result.questions[0].options.find(o => o.id === result.questions[0].correctOptionId)?.text, 'went');
  const duplicate = parseBulkGrammarText(first.replace('A: go', 'A: goes') + '\n' + first);
  assert.equal(duplicate.questions.length, 2);
  assert.ok(duplicate.warnings.some(w => w.includes('phương án trùng')));
  assert.ok(duplicate.warnings.some(w => w.includes('trùng nội dung')));
});

test('rewrite imports all records without blank lines and retains accepted aliases', () => {
  const result = parseBulkRewriteText(rewrite + '\n' + rewrite2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 2);
  assert.deepEqual(result.questions[0].acceptedAnswers, ["It's Monday.", 'It is Monday']);
  assert.equal(result.questions[0].correctAnswer, 'It is Monday.');
  assert.equal(result.questions[1].correctAnswer, 'is');
  assert.ok(result.questions.every(q => q.questionType === 'rewrite' && q.options.length === 0));
});

test('rewrite retains multiline answers/accepted alternatives and explanation paragraphs', () => {
  const result = parseBulkRewriteText(rewrite.replace('ANSWER: It is Monday.', 'ANSWER: It is\nMonday.').replace('ALTERNATIVES:', 'ACCEPTED_ANSWERS:') + '\n\nSecond paragraph.\n' + rewrite2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions[0].correctAnswer, 'It is\nMonday.');
  assert.deepEqual(result.questions[0].acceptedAnswers, ["It's Monday.", 'It is Monday']);
  assert.equal(result.questions[0].explanation, "It's means It is.\n\nSecond paragraph.");
});

test('rewrite recovers collapsed/CR/escaped-label input without changing text grading', () => {
  for (const input of [(rewrite + '\n' + rewrite2).replace(/\n/g, ' '), (rewrite + '\n' + rewrite2).replace(/\n/g, '\r'), (rewrite + '\n' + rewrite2).replace(/\n/g, '\\r\\n')]) {
    const result = parseBulkRewriteText(input);
    assert.deepEqual(result.errors, []);
    assert.equal(result.questions.length, 2);
    assert.deepEqual(result.questions[0].acceptedAnswers, ["It's Monday.", 'It is Monday']);
  }
});

test('empty input and actual JSON give clear format errors, never zero-count success', () => {
  assert.match(parseBulkGrammarText(' \n ').errors[0], /Chưa có nội dung/);
  assert.match(parseBulkGrammarText('[{"question":"example"}]').errors[0], /không phải JSON/);
  assert.match(parseBulkRewriteText('{}').errors[0], /không phải JSON/);
});

test('a plain-text code fence is accepted without becoming part of the question', () => {
  const fence = String.fromCharCode(96).repeat(3);
  assertBoth(fence + 'text\n' + first + '\n' + second + '\n' + fence);
});


test('recognizes nonbreaking indentation/separators from copied rich text', () => {
  assertBoth((first + '\n' + second).replace(/^QUESTION:/gm, '\u00A0QUESTION:'));
  assertBoth('\u00A0' + (first + '\n' + second).replace(/\n/g, '\u00A0'));
});

test('recovers ANSWER and EXPLANATION packed together after normal option lines', () => {
  assertBoth((first + '\n' + second).replace(/\nEXPLANATION:/g, ' EXPLANATION:'));
});

test('rewrite malformed/duplicate fields remain explicit errors between valid records', () => {
  const result = parseBulkRewriteText(rewrite + '\nQUESTION: Broken.\nEXPLANATION: Missing answer.\n' + rewrite2);
  assert.equal(result.questions.length, 2);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Câu số 2.*thiếu ANSWER/);
  assert.equal(parseBulkRewriteText(rewrite + '\nANSWER: overwritten').questions.length, 0);
});

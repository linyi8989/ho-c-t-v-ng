import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExamContent, getExamPaperDefinition } from './definitions';
import { importUniversalExamBundle, importUniversalExamPart } from './universalImport';
import { buildUniversalExamImportPrompt, buildUniversalExamPartImportPrompt } from './universalImportPrompt';
import { importStarterSinglePart } from './starterImport';
import { buildStarterListeningBundlePrompt } from './starterImportPrompt';
import { isYoungListeningPart2, parseYoungListeningAffixes } from './youngListeningPart2';
import type { ExamPaperContent } from './types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StarterTextEntryView } from './student/StarterInteractions';

interface SampleQuestion { questionNumber: number; prompt: string; answerPrefix?: unknown; answerSuffix?: unknown; type: string; answerSource: string; answerKey: { acceptedAnswers: string[] } }
interface SampleBlock { content: { questions: SampleQuestion[] } }
interface SamplePart { partNumber: number; blocks: SampleBlock[] }
interface SampleBundle { papers: { parts: SamplePart[] }[] }

function promptSample(prompt: string): SampleBundle {
  const start = prompt.indexOf('{\n  "format": "exam-bundle-import-v2"');
  assert.ok(start >= 0);
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < prompt.length; index++) {
    const character = prompt[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) return JSON.parse(prompt.slice(start, index + 1));
  }
  throw new Error('Missing sample envelope');
}

function draft(moduleId: 'starter' | 'flyer') { return createDefaultExamContent(getExamPaperDefinition(moduleId, 'listening')!); }
function part2(bundle: SampleBundle) { return bundle.papers[0].parts.find(part => part.partNumber === 2)!; }
function fillQuestions(bundle: SampleBundle) {
  const block = part2(bundle).blocks[0];
  block.content.questions = Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: 'Address:', answerPrefix: index ? '' : '17', answerSuffix: index ? '' : 'Street', type: 'short-answer', answerSource: 'official-answer-key', answerKey: { acceptedAnswers: ['Green'] } }));
  return bundle;
}
function withOldHints(content: ExamPaperContent) {
  content.parts[1].questions.forEach(question => { question.answerPrefix = 'OLD'; question.answerSuffix = 'Old Street'; });
  return content;
}

test('Starters and Flyers whole/focused prompt samples teach printed hints and gap-only answers', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const content = draft(moduleId);
    for (const prompt of [buildUniversalExamImportPrompt(content), buildUniversalExamPartImportPrompt(content, 1)]) {
      assert.match(prompt, /answerPrefix/);
      assert.match(prompt, /answerSuffix/);
      assert.match(prompt, /không gồm answerPrefix\/answerSuffix|không kèm chữ gợi ý/);
      const question = part2(promptSample(prompt)).blocks[0].content.questions[0];
      assert.equal(question.prompt, 'Address:');
      assert.equal(question.answerPrefix, '17');
      assert.equal(question.answerSuffix, 'Street');
      assert.deepEqual(question.answerKey.acceptedAnswers, ['Green']);
    }
  }
  assert.match(buildStarterListeningBundlePrompt(), /"answerPrefix":"17","answerSuffix":"Street"/);
});

test('whole/focused imports keep printed hint positions, IDs/media, and only the gap answer', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const content = draft(moduleId);
    content.parts[1].imageAssetId = 'illustration-kept';
    content.parts[1].audioAssetId = 'audio-kept';
    const id = content.parts[1].questions[0].id;
    const whole = fillQuestions(promptSample(buildUniversalExamImportPrompt(content)));
    const focused = fillQuestions(promptSample(buildUniversalExamPartImportPrompt(content, 1)));
    for (const part of [importUniversalExamBundle(content, JSON.stringify(whole)).content.parts[1], importUniversalExamPart(content, 1, JSON.stringify(focused)).part]) {
      assert.equal(part.questions[0].id, id);
      assert.equal(part.imageAssetId, 'illustration-kept');
      assert.equal(part.audioAssetId, 'audio-kept');
      assert.equal(part.questions[0].answerPrefix, '17');
      assert.equal(part.questions[0].answerSuffix, 'Street');
      assert.deepEqual(part.questions[0].acceptedAnswers, ['Green']);
      assert.equal(part.questions[0].prompt, 'Address:');
    }
  }
});

test('re-importing omitted or explicitly empty hints clears stale fields rather than inheriting by index', () => {
  for (const moduleId of ['starter', 'flyer'] as const) for (const empty of [false, true]) {
    const content = withOldHints(draft(moduleId));
    for (const focused of [false, true]) {
      const source = fillQuestions(promptSample(focused ? buildUniversalExamPartImportPrompt(content, 1) : buildUniversalExamImportPrompt(content)));
      part2(source).blocks[0].content.questions.forEach(question => {
        if (empty) { question.answerPrefix = ''; question.answerSuffix = '   '; }
        else { delete question.answerPrefix; delete question.answerSuffix; }
      });
      const result = focused ? importUniversalExamPart(content, 1, JSON.stringify(source)).part : importUniversalExamBundle(content, JSON.stringify(source)).content.parts[1];
      assert.ok(result.questions.every(question => question.answerPrefix === undefined && question.answerSuffix === undefined));
    }
    assert.equal(content.parts[1].questions[0].answerPrefix, 'OLD');
  }
});

test('malformed hint fields reject whole/focused imports atomically without altering the draft', () => {
  const malformed = [null, 17, {}, [], 'x'.repeat(81), 'a\nb', '{{answer}}'];
  for (const moduleId of ['starter', 'flyer'] as const) for (const value of malformed) for (const focused of [false, true]) {
    const content = draft(moduleId);
    const before = JSON.stringify(content);
    const sample = fillQuestions(promptSample(focused ? buildUniversalExamPartImportPrompt(content, 1) : buildUniversalExamImportPrompt(content)));
    part2(sample).blocks[0].content.questions[0].answerSuffix = value;
    assert.throws(() => focused ? importUniversalExamPart(content, 1, JSON.stringify(sample)) : importUniversalExamBundle(content, JSON.stringify(sample)), /answerSuffix/);
    assert.equal(JSON.stringify(content), before);
  }
  assert.throws(() => parseYoungListeningAffixes({ answerPrefix: 'x'.repeat(21) }), /20/);
});

test('legacy Starters Part2 import accepts separate printed hints and preserves inline-only templates', () => {
  const definition = getExamPaperDefinition('starter', 'listening')!;
  const content = withOldHints(draft('starter'));
  const section = { slot: 'part-2', instruction: 'Listen and write.', interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'single-input', schemaVersion: 1 }, payload: { questions: Array.from({ length: 5 }, (_, index) => ({ number: index + 1, prompt: 'Address:', template: 'Address: ____', answerPrefix: '17' as unknown, answerSuffix: 'Street' as unknown, gaps: [{ gapNumber: 1, acceptedAnswers: ['Green'], source: 'official-answer-key' }] })) } };
  const imported = importStarterSinglePart(content, 1, JSON.stringify(section), definition).part;
  assert.equal(imported.questions[0].answerPrefix, '17');
  assert.equal(imported.questions[0].answerSuffix, 'Street');
  section.payload.questions.forEach(question => { question.template = 'Address: 17 ____ Street'; delete question.answerPrefix; delete question.answerSuffix; });
  const legacy = importStarterSinglePart(content, 1, JSON.stringify(section), definition).part;
  assert.equal(legacy.questions[0].prompt, 'Address: 17 ____ Street');
  assert.equal(legacy.questions[0].answerPrefix, undefined);
  assert.equal(legacy.questions[0].answerSuffix, undefined);
  section.payload.questions[0].answerPrefix = 17;
  assert.throws(() => importStarterSinglePart(content, 1, JSON.stringify(section), definition), /answerPrefix/);
});

test('printed-hint scope excludes all other papers and parts', () => {
  assert.ok(isYoungListeningPart2(draft('starter'), 2));
  assert.ok(isYoungListeningPart2(draft('flyer'), 2));
  for (const identity of [{ moduleId: 'starter', paperId: 'reading-writing' }, { moduleId: 'flyer', paperId: 'reading-writing' }, { moduleId: 'ket', paperId: 'listening' }] as const) assert.equal(isYoungListeningPart2(identity, 2), false);
  assert.equal(isYoungListeningPart2(draft('starter'), 1), false);
});

test('young Listening renderer keeps inline legacy hints despite empty, conflicting or invalid old metadata', () => {
  const part = draft('starter').parts[1];
  part.questions[0].prompt = 'Address: 17 ____ Street';
  for (const metadata of [
    { answerPrefix: '', answerSuffix: '' },
    { answerPrefix: 'OLD', answerSuffix: 'Old Road' },
    { answerPrefix: null, answerSuffix: {} },
  ]) {
    Object.assign(part.questions[0], metadata);
    const markup = renderToStaticMarkup(createElement(StarterTextEntryView, { part, answers: {}, onAnswer: () => {}, printedAnswerHints: true }));
    const firstRow = markup.slice(markup.indexOf('data-listening-part2-right-row'));
    assert.match(firstRow, /data-listening-part2-printed-hint="true">17<\/span>/);
    assert.ok(firstRow.indexOf('17</span>') < firstRow.indexOf('<input'));
    assert.ok(firstRow.indexOf('<input') < firstRow.indexOf('Street</span>'));
    assert.doesNotMatch(markup, /OLD|Old Road/);
  }
});

test('printed-hint rendering is enabled explicitly for Listening and stays unchanged outside scope', () => {
  const part = draft('starter').parts[1];
  part.questions[0].prompt = 'Address:';
  part.questions[0].answerPrefix = '17';
  part.questions[0].answerSuffix = 'Street';
  const render = (printedAnswerHints?: boolean) => renderToStaticMarkup(createElement(StarterTextEntryView, { part, answers: {}, onAnswer: () => {}, printedAnswerHints }));
  const enabled = render(true);
  assert.match(enabled, /data-listening-part2-printed-hint/);
  assert.match(enabled, />17<\/span>/);
  assert.match(enabled, />Street<\/span>/);
  assert.doesNotMatch(render(), /data-listening-part2-printed-hint/);
  assert.doesNotMatch(render(false), /data-listening-part2-printed-hint/);
  part.questions[0].prompt = 'Address: 17 ____ Street';
  assert.match(render(), /Address: 17 Street/);
  assert.match(render(), /w-44/);
});

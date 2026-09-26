import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readCssBundle } from '../../../styles/cssTestUtils.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultMoverReadingWritingContent } from '../defaultContent';
import { createEmptyMoverReadingWritingAnswers } from '../types';
import { ReadingPart1View, ReadingPart2View, ReadingPart3View, ReadingPart4View, ReadingPart5View, ReadingPart6View } from './MoverReadingWritingPartViews';

const playerSource = readFileSync(new URL('./MoverReadingWritingLearningArea.tsx', import.meta.url), 'utf8');
const partViewsSource = readFileSync(new URL('./MoverReadingWritingPartViews.tsx', import.meta.url), 'utf8');
const visualReviewSource = readFileSync(new URL('../review/MoverReadingWritingVisualReview.tsx', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../admin/MoverReadingWritingAdmin.tsx', import.meta.url), 'utf8');
const globalCss = readCssBundle(new URL('../../../index.css', import.meta.url));

const rgb = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const luminance = (hex: string) => rgb(hex)
  .map(channel => channel / 255)
  .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test('Mover Reading & Writing controls keep scoped semantic contrast hooks', () => {
  for (const hook of [
    'mover-reading-writing-player',
    'mover-reading-primary-action',
    'mover-reading-secondary-action',
    'mover-reading-submit-action',
    'mover-reading-part-step',
  ]) {
    assert.ok(playerSource.includes(hook), `Missing player hook: ${hook}`);
  }
  assert.ok(adminSource.includes('mover-reading-writing-admin'));
  assert.ok(adminSource.includes('mover-reading-writing-wizard'));
  for (const selector of [
    '#mover-reading-writing-player button.mover-reading-primary-action',
    '#mover-reading-writing-player button.mover-reading-submit-action',
    '#mover-reading-writing-player button.mover-reading-part-step',
    '#mover-reading-writing-wizard button.listening-editor-publish-action',
  ]) {
    assert.ok(globalCss.includes(selector), `Missing scoped CSS selector: ${selector}`);
  }
  assert.ok(contrast('#ffffff', '#4338ca') >= 4.5);
  assert.ok(contrast('#ffffff', '#047857') >= 4.5);
  assert.ok(contrast('#312e81', '#eef2ff') >= 4.5);
});

test('answer review is rendered only when the immutable paper policy allows it', () => {
  assert.match(playerSource, /playable\.content\.showReviewAfterSubmit && <button/);
  assert.match(playerSource, /moverReadingWritingApi\.review\(/);
  assert.match(playerSource, /isMoverReadingWritingVisualReviewSnapshot\(review\.visualReview\)/);
  assert.match(visualReviewSource, /data-mover-reading-visual-review/);
  assert.match(visualReviewSource, /mover-reading-review-part-tab/);
  assert.match(visualReviewSource, /mover-reading-review-part-nav/);
  assert.match(visualReviewSource, /Đáp án đúng:/);
  assert.match(visualReviewSource, /Đúng: \{item\.correctAnswer\}/);
  assert.ok(globalCss.includes('[data-mover-reading-visual-review] button.mover-reading-review-part-tab[data-active="true"]'));
  assert.ok(globalCss.includes('[data-mover-reading-visual-review] button.mover-reading-review-part-nav:not(:disabled)'));
});

test('Part 2/5 and legacy Part 6 keep their released presentation contracts', () => {
  assert.match(partViewsSource, /<Examples items=\{part\.examples\}/);
  assert.doesNotMatch(partViewsSource, /divide-y divide-indigo-200/);
  assert.match(partViewsSource, /const EXAMPLE_BLANK/);
  assert.match(partViewsSource, /source\.slice\(0, blankIndex\)/);
  assert.match(partViewsSource, /source\.slice\(blankIndex \+ blankToken\.length\)/);
  assert.doesNotMatch(partViewsSource, /Nhập tối đa \$\{maxWords\} từ/);
  assert.match(partViewsSource, /part\.illustrationUrl/);
  assert.match(partViewsSource, /part\.optionsUrl/);
  assert.match(partViewsSource, /ExamImageViewer/);
  assert.match(visualReviewSource, /ExamImageViewer/);
  assert.ok(globalCss.includes('#mover-reading-writing-player button.exam-platform-image-expand'));
  assert.ok(globalCss.includes('[data-mover-reading-visual-review] button.exam-platform-image-expand'));
  assert.match(partViewsSource, /Bảng lựa chọn Part 6/);
  assert.match(partViewsSource, /function InlineAnswerInput/);
  assert.doesNotMatch(partViewsSource, /<select/);
  assert.doesNotMatch(partViewsSource, /Chọn\.\.\./);
});

test('Part 6 image-choice mode renders one student image and five three-option questions', () => {
  const answers = createEmptyMoverReadingWritingAnswers();
  const part6 = createDefaultMoverReadingWritingContent().parts[5];
  part6.studentImageUrl = '/media/part-6-reading.png';
  part6.questions.forEach((question, questionIndex) => {
    question.options.forEach((option, optionIndex) => { option.text = `Choice ${questionIndex + 1}.${optionIndex + 1}`; });
  });
  const markup = renderToStaticMarkup(createElement(ReadingPart6View, { part: part6, answers, onAnswers: () => undefined }));
  assert.equal((markup.match(/<img/g) || []).length, 1);
  assert.equal((markup.match(/type="radio"/g) || []).length, 15);
  assert.equal((markup.match(/data-choice-layout="horizontal"/g) || []).length, 5);
  assert.equal((markup.match(/data-mover-rw-part6-inline-row=/g) || []).length, 5);
  assert.equal((markup.match(/grid-cols-\[2\.75rem_repeat\(3,minmax\(0,1fr\)\)\]/g) || []).length, 5);
  assert.match(markup, /data-mover-rw-balanced-media="true"/);
  assert.match(markup, /lg:self-stretch/);
  assert.match(markup, /data-exam-image-profile="page-scan"/);
  assert.match(markup, /h-full w-full/);
  assert.match(markup, /Choice 1\.1/);
  assert.doesNotMatch(markup, /Bảng lựa chọn Part 6/);
});

test('requested Movers answer fields use PET-style underlines and the specified row alignment', () => {
  const content = createDefaultMoverReadingWritingContent();
  const answers = createEmptyMoverReadingWritingAnswers();
  const onAnswers = () => undefined;
  const [part1, part2, , part4, part5] = content.parts;
  part1.questions.forEach((question, index) => { question.prompt = `Definition ${index + 1}: {{${question.id}}}`; });
  part2.questions.forEach((question, index) => { question.statement = `Statement ${index + 1}`; });
  part5.scenes.forEach(scene => scene.questions.forEach((question, index) => { question.prompt = `Answer ${index + 1}: {{${question.id}}}`; }));

  const part1Markup = renderToStaticMarkup(createElement(ReadingPart1View, { part: part1, answers, onAnswers }));
  assert.equal((part1Markup.match(/data-mover-rw-right-answer-row/g) || []).length, part1.questions.length);
  assert.equal((part1Markup.match(/data-student-underline-answer/g) || []).length, part1.questions.length);

  const part2Markup = renderToStaticMarkup(createElement(ReadingPart2View, { part: part2, answers, onAnswers }));
  assert.equal((part2Markup.match(/data-mover-rw-part2-row=/g) || []).length, part2.questions.length);
  assert.equal((part2Markup.match(/type="radio"/g) || []).length, part2.questions.length * 2);
  assert.match(part2Markup, /grid-cols-\[minmax\(0,1fr\)_4\.5rem_4\.5rem\]/);

  const part4Markup = renderToStaticMarkup(createElement(ReadingPart4View, { part: part4, answers, onAnswers }));
  assert.equal((part4Markup.match(/data-student-underline-answer/g) || []).length, part4.gaps.length);

  const part5Markup = renderToStaticMarkup(createElement(ReadingPart5View, { part: part5, answers, onAnswers }));
  assert.equal((part5Markup.match(/data-student-underline-answer/g) || []).length, part5.scenes.flatMap(scene => scene.questions).length);
});

test('Movers Parts 1/4 balance the image column and Part 3 distributes questions across two lanes', () => {
  const content = createDefaultMoverReadingWritingContent();
  const answers = createEmptyMoverReadingWritingAnswers();
  const onAnswers = () => undefined;
  const [part1, , part3, part4] = content.parts;
  part1.wordBankUrl = '/media/movers-part-1.png';
  part4.wordBankUrl = '/media/movers-part-4.png';
  part3.sceneUrl = '/media/movers-part-3.png';
  part3.example = {
    ...part3.questions[0],
    id: 'part-3-example',
    prompt: 'Hello. Did you have a good day at school?',
  };

  const part1Markup = renderToStaticMarkup(createElement(ReadingPart1View, { part: part1, answers, onAnswers }));
  const part4Markup = renderToStaticMarkup(createElement(ReadingPart4View, { part: part4, answers, onAnswers }));
  for (const markup of [part1Markup, part4Markup]) {
    assert.match(markup, /data-mover-rw-balanced-media="true"/);
    assert.match(markup, /data-exam-image-profile="word-bank"/);
    assert.match(markup, /lg:self-stretch/);
    assert.match(markup, /h-full w-full/);
  }

  const part3Markup = renderToStaticMarkup(createElement(ReadingPart3View, { part: part3, answers, onAnswers }));
  assert.match(part3Markup, /data-mover-rw-part3-layout/);
  assert.match(part3Markup, /data-mover-rw-part3-centered-media/);
  assert.doesNotMatch(part3Markup, /data-mover-rw-part3-example/);
  assert.ok(part3Markup.indexOf('data-mover-rw-part3-centered-media') < part3Markup.indexOf('data-mover-rw-part3-question-grid'));
  assert.match(part3Markup, /data-mover-rw-part3-question-grid/);
  assert.match(part3Markup, /lg:grid-cols-2/);
  assert.equal((part3Markup.match(/data-mover-rw-part3-question="/g) || []).length, 6);
  assert.match(part3Markup, /data-mover-rw-part3-question="1"[\s\S]*data-mover-rw-part3-question="2"[\s\S]*data-mover-rw-part3-question="3"[\s\S]*data-mover-rw-part3-question="4"[\s\S]*data-mover-rw-part3-question="5"[\s\S]*data-mover-rw-part3-question="6"/);
});

test('Part 2 uses one uninterrupted Examples panel and Part 6 inserts the example answer at the printed blank', () => {
  const answers = createEmptyMoverReadingWritingAnswers();
  const onAnswers = () => undefined;
  const part2Markup = renderToStaticMarkup(createElement(ReadingPart2View, {
    part: {
      part: 2,
      title: 'Part 2',
      instruction: '',
      sceneAssetId: '',
      examples: [
        { prompt: 'The monkey is eating some fruit.', answer: 'yes' },
        { prompt: 'The bird is sitting on a tree.', answer: 'no' },
      ],
      questions: [],
    },
    answers,
    onAnswers,
  }));
  assert.equal((part2Markup.match(/text-xs font-black uppercase text-indigo-700/g) || []).length, 1);
  assert.doesNotMatch(part2Markup, /divide-y/);

  const part6Markup = renderToStaticMarkup(createElement(ReadingPart6View, {
    part: {
      part: 6,
      title: 'Part 6',
      instruction: '',
      passageSourceAssetId: '',
      illustrationAssetId: '',
      optionsAssetId: '',
      passageTitle: 'Dolphins',
      example: { prompt: 'Example: Dolphins live in the sea. __________ can swim very quickly', answer: 'They' },
      passageTemplate: 'Dolphins live in the sea. [[Example]] can swim very quickly. {{gap-1}} catch a lot of fish.',
      gaps: [{ id: 'gap-1', acceptedAnswers: ['and'] }],
    },
    answers,
    onAnswers,
  }));
  const visibleText = part6Markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.match(visibleText, /Example Example: Dolphins live in the sea\. They can swim very quickly/);
  assert.doesNotMatch(visibleText, /can swim very quickly They/);
  assert.doesNotMatch(visibleText, /_{3,}/);
});

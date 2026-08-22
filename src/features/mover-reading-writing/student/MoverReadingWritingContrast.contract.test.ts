import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyMoverReadingWritingAnswers } from '../types';
import { ReadingPart2View, ReadingPart6View } from './MoverReadingWritingPartViews';

const playerSource = readFileSync(new URL('./MoverReadingWritingLearningArea.tsx', import.meta.url), 'utf8');
const partViewsSource = readFileSync(new URL('./MoverReadingWritingPartViews.tsx', import.meta.url), 'utf8');
const visualReviewSource = readFileSync(new URL('../review/MoverReadingWritingVisualReview.tsx', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../admin/MoverReadingWritingAdmin.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

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

test('Part 2/5/6 student layout keeps the requested examples, inputs and two-image contract', () => {
  assert.match(partViewsSource, /<Examples items=\{part\.examples\}/);
  assert.doesNotMatch(partViewsSource, /divide-y divide-indigo-200/);
  assert.match(partViewsSource, /const EXAMPLE_BLANK/);
  assert.match(partViewsSource, /source\.slice\(0, blankIndex\)/);
  assert.match(partViewsSource, /source\.slice\(blankIndex \+ blankToken\.length\)/);
  assert.doesNotMatch(partViewsSource, /Nhập tối đa \$\{maxWords\} từ/);
  assert.match(partViewsSource, /part\.illustrationUrl/);
  assert.match(partViewsSource, /part\.optionsUrl/);
  assert.match(partViewsSource, /Bảng lựa chọn Part 6/);
  assert.match(partViewsSource, /function InlineAnswerInput/);
  assert.doesNotMatch(partViewsSource, /<select/);
  assert.doesNotMatch(partViewsSource, /Chọn\.\.\./);
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

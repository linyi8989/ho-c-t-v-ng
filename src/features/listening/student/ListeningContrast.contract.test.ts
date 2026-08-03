import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const learningAreaSource = readFileSync(new URL('./ListeningLearningArea.tsx', import.meta.url), 'utf8');
const partViewsSource = readFileSync(new URL('./ListeningPartViews.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

const hexToRgb = (hex: string) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const luminance = (hex: string) => hexToRgb(hex)
  .map(channel => channel / 255)
  .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrastRatio = (foreground: string, background: string) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

const requiredPlayerHooks = [
  'listening-error-screen',
  'listening-error-home-btn',
  'listening-name-screen',
  'listening-confirm-name-btn',
  'listening-start-screen',
  'listening-prestart-back-btn',
  'listening-start-btn',
  'listening-result-screen',
  'listening-result-home-btn',
  'listening-exam-root',
  'listening-fullscreen-btn',
  'listening-prev-part-btn',
  'listening-next-part-btn',
  'listening-submit-btn',
];

test('Listening player controls keep stable feature-scoped contrast hooks', () => {
  for (const hook of requiredPlayerHooks) {
    assert.ok(learningAreaSource.includes(`id="${hook}"`), `Missing UI hook: ${hook}`);
  }

  const requiredScopedSelectors = [
    '#listening-error-screen #listening-error-home-btn',
    '#listening-name-screen #listening-confirm-name-btn',
    '#listening-start-screen #listening-prestart-back-btn',
    '#listening-start-screen #listening-start-btn',
    '#listening-result-screen #listening-result-home-btn',
    '#listening-exam-root #listening-fullscreen-btn',
    '#listening-exam-root button.listening-part1-choice',
    '#listening-exam-root .listening-part1-target-answer',
    '#listening-exam-root button.listening-part-arrow',
    '#listening-exam-root button.listening-part-step',
    '#listening-exam-root #listening-submit-btn',
    '#listening-exam-root button.listening-part5-colour-choice',
  ];
  for (const selector of requiredScopedSelectors) {
    assert.ok(globalCss.includes(selector), `Missing scoped CSS contract: ${selector}`);
  }

  assert.ok(learningAreaSource.includes('className={`listening-part-step'));
  assert.ok(learningAreaSource.includes("data-active={currentPart === index ? 'true' : 'false'}"));
  assert.ok(partViewsSource.includes('listening-part1-choice'));
  assert.ok(partViewsSource.includes("data-state={selectedChoice === choice.id ? 'selected' : 'available'}"));

  const globalOverrideIndex = globalCss.indexOf('button:not(:disabled) {');
  const playerContractIndex = globalCss.indexOf('/* Listening player contrast contract');
  assert.ok(globalOverrideIndex >= 0);
  assert.ok(playerContractIndex > globalOverrideIndex, 'Player contract must come after the legacy global override');
});

test('Part 5 palette is visual-only while retaining an accessible colour name', () => {
  const part5Source = partViewsSource.slice(partViewsSource.indexOf('export function ListeningPart5View'));
  assert.match(part5Source, /aria-label=\{`Chọn màu \$\{colour\.label\}`\}/);
  assert.match(part5Source, /aria-pressed=\{selectedColour === colour\.id\}/);
  assert.match(part5Source, /listening-part5-colour-swatch/);
  assert.doesNotMatch(part5Source, />\s*\{colour\.label\}\s*</, 'Colour name must not be rendered visibly inside the palette button');
});

test('Part 5 supports both click-to-colour and drag-and-drop play modes', () => {
  const part5Source = partViewsSource.slice(partViewsSource.indexOf('export function ListeningPart5View'));
  assert.match(part5Source, /draggable/);
  assert.match(part5Source, /setData\('text\/listening-colour', colour\.id\)/);
  assert.match(part5Source, /getData\('text\/listening-colour'\)/);
  assert.match(part5Source, /onDragOver=\{event =>/);
  assert.match(part5Source, /onDrop=\{event =>/);
  assert.match(part5Source, /onClick=\{\(\) => selectedColour \? assign\(target\.id, selectedColour\) : answer \? clear\(target\.id\) : undefined\}/);
  assert.match(part5Source, /filter\(colour => availableColourIds\.includes\(colour\.id\)\)/);
  assert.match(part5Source, /compactRegionHeightStyle\(target\.region\)/);
  assert.match(part5Source, />\{index \+ 1\}<\/span>/);
  assert.doesNotMatch(part5Source, />\{target\.label\}<\/span>/, 'Stored region labels must not be rendered in the student target marker');
  assert.match(part5Source, /Kéo màu vào vùng cần tô, hoặc chọn một màu rồi chạm vùng/);
});

test('Listening control colour pairs meet the WCAG AA text contrast threshold', () => {
  const colourPairs = [
    ['#ffffff', '#2563eb'], // primary action
    ['#1e40af', '#ffffff'], // secondary action
    ['#ffffff', '#e11d48'], // start and previous/next
    ['#ffffff', '#0369a1'], // fullscreen
    ['#0f172a', '#ffffff'], // available Part 1 answer
    ['#075985', '#e0f2fe'], // used Part 1 answer
    ['#ffffff', '#6d28d9'], // selected Part 1 answer
    ['#1d4ed8', '#ffffff'], // inactive Part number
    ['#ffffff', '#1d4ed8'], // active Part number
    ['#ffffff', '#047857'], // submit
    ['#065f46', '#d1fae5'], // disabled submit
  ] as const;

  for (const [foreground, background] of colourPairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet a 4.5:1 contrast ratio`,
    );
  }
});

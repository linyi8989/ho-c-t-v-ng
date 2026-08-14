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
  'listening-result-review-btn',
  'listening-result-retry-btn',
  'listening-review-screen',
  'listening-review-back-btn',
  'listening-review-retry-btn',
  'listening-exam-root',
  'listening-fullscreen-btn',
  'listening-prev-part-btn',
  'listening-next-part-btn',
  'listening-submit-btn',
];

const transparentListeningHitboxes = [
  'listening-part1-target',
  'listening-part3-answer-hitbox',
  'listening-part3-picture-hitbox',
  'listening-part5-object-hitbox',
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
    '#listening-result-screen #listening-result-review-btn',
    '#listening-result-screen #listening-result-retry-btn',
    '#listening-review-screen #listening-review-back-btn',
    '#listening-review-screen #listening-review-retry-btn',
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
  assert.match(learningAreaSource, /listeningApi\.getAttemptReview\(setId, result\.id/);
  assert.match(learningAreaSource, /onClick=\{\(\) => void start\(true\)\}/);
  assert.match(learningAreaSource, /if \(replaceCompletedAttempt\) setResult\(null\)/);

  const globalOverrideIndex = globalCss.indexOf('button:not(:disabled) {');
  const playerContractIndex = globalCss.indexOf('/* Listening player contrast contract');
  assert.ok(globalOverrideIndex >= 0);
  assert.ok(playerContractIndex > globalOverrideIndex, 'Player contract must come after the legacy global override');
});

test('Legacy glass-button rules never blur transparent Listening scene hitboxes', () => {
  const glassButtonSelectors = globalCss.match(/button:not\(\.bg-indigo-600\)[^{]+(?=\s*\{)/g) ?? [];
  assert.equal(glassButtonSelectors.length, 2, 'Expected the normal and hover glass-button selectors');

  for (const selector of glassButtonSelectors) {
    for (const className of transparentListeningHitboxes) {
      assert.ok(
        selector.includes(`:not(.${className})`),
        `Glass-button selector must exclude .${className}`,
      );
    }
  }
});

test('Part 1 keeps its answer dock outside the image scroller and uses transparent target hitboxes', () => {
  const start = partViewsSource.indexOf('export function ListeningPart1View');
  const end = partViewsSource.indexOf('function renderPrompt');
  const part1Source = partViewsSource.slice(start, end);
  const dockIndex = part1Source.indexOf('listening-part1-answer-dock');
  const scrollerIndex = part1Source.indexOf('listening-part1-image-scroller');

  assert.ok(dockIndex >= 0 && scrollerIndex > dockIndex, 'Answer dock must render before and outside the image scroller');
  assert.match(part1Source, /listening-part1-layout flex h-full min-h-0 flex-col/);
  assert.match(part1Source, /listening-part1-answer-dock shrink-0/);
  assert.match(part1Source, /listening-part1-image-scroller min-h-0 flex-1 overflow-y-auto/);
  assert.match(learningAreaSource, /currentPart === 0[\s\S]*overflow-hidden[\s\S]*overflow-y-auto/);
  assert.match(part1Source, /data-state=\{answer \? 'filled' : activeChoice \? 'eligible' : 'idle'\}/);
  assert.doesNotMatch(part1Source, /bg-emerald-100|bg-rose-100/, 'Target regions must not tint the source image');
  assert.doesNotMatch(part1Source, /correctConnections|correctAnswer/, 'Part 1 target state must not consult the answer key');
  assert.match(globalCss, /button\.listening-part1-target:not\(:disabled\)[\s\S]*background: transparent !important/);
  assert.match(globalCss, /button\.listening-part1-target:not\(:disabled\)[\s\S]*backdrop-filter: none !important/);
  assert.match(globalCss, /button\.listening-part1-target\[data-state="eligible"\]/);
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

test('Part 5 scene mode uses one fixed consumable palette and transparent image hitboxes', () => {
  const start = partViewsSource.indexOf('function ListeningPart5SceneView');
  const end = partViewsSource.indexOf('export function ListeningPart5View');
  const part5SceneSource = partViewsSource.slice(start, end);
  const dockIndex = part5SceneSource.indexOf('listening-part5-answer-dock');
  const scrollerIndex = part5SceneSource.indexOf('listening-part5-image-scroller');

  assert.ok(dockIndex >= 0 && scrollerIndex > dockIndex, 'Part 5 answer dock must stay outside the image scroller');
  assert.match(part5SceneSource, /listening-part5-layout flex h-full min-h-0 flex-col/);
  assert.match(part5SceneSource, /listening-part5-answer-dock shrink-0/);
  assert.match(part5SceneSource, /listening-part5-image-scroller min-h-0 flex-1 overflow-y-auto/);
  assert.match(learningAreaSource, /currentPart === 4[\s\S]*displayMode === 'scene-colour-draw'/);
  assert.doesNotMatch(part5SceneSource, /activeActionId|setActiveActionId|part\.questions\.map/);
  assert.match(part5SceneSource, /availableColours = visibleColours\.filter\(colour => !usedColourIds\.has\(colour\.id\)\)/);
  assert.match(part5SceneSource, /availablePaletteItems = part\.objectPalette\.filter\(item => !usedPaletteItemIds\.has\(item\.id\)\)/);
  assert.match(part5SceneSource, /setData\('text\/listening-colour', colour\.id\)/);
  assert.match(part5SceneSource, /setData\('text\/listening-palette', item\.id\)/);
  assert.match(part5SceneSource, /listening-part5-object-hitbox absolute z-20 border-0 bg-transparent/);
  assert.match(part5SceneSource, /opacity: 0\.48, mixBlendMode: 'multiply'/);
  assert.doesNotMatch(part5SceneSource, /bg-blue-50|bg-blue-200\/70/, 'Idle interaction geometry must not wash out the source image');
  assert.match(globalCss, /button\.listening-part5-object-hitbox:not\(:disabled\)[\s\S]*background: transparent !important/);
});

test('Part 3 supports clean click/drag connections, removal, and never consults the private answer key', () => {
  const start = partViewsSource.indexOf('function ListeningPart3ConnectView');
  const end = partViewsSource.indexOf('export function ListeningPart3View');
  const part3Source = partViewsSource.slice(start, end);
  assert.match(partViewsSource, /const part3ConnectionPath/);
  assert.match(part3Source, /<React\.Fragment key=\{line\.id\}>/);
  assert.match(part3Source, /strokeLinecap="round"/);
  assert.match(part3Source, /strokeWidth="3"/);
  assert.match(part3Source, /strokeWidth="16" pointerEvents="stroke"/);
  assert.match(part3Source, /strokeWidth="2\.5" strokeDasharray="8 6"/);
  assert.match(part3Source, /<svg className="pointer-events-none absolute inset-0 z-30/);
  assert.match(part3Source, /onPointerDown=\{event => startPointerConnection\(event, answer\)\}/);
  assert.match(part3Source, /onPointerMove=\{movePointerConnection\}/);
  assert.match(part3Source, /onPointerUp=\{finishPointerConnection\}/);
  assert.match(part3Source, /onClick=\{\(\) => assign\(picture\.id, selected \? \{ \.\.\.selected, side: picture\.side \} : selected\)\}/);
  assert.match(part3Source, /onClick=\{\(\) => removeConnection\(line\.id\)\}/);
  assert.match(part3Source, /removeSingleUseAnswer\(answers\.part3, answerId\)/);
  assert.match(part3Source, /listening-part3-answer-hitbox/);
  assert.match(part3Source, /listening-part3-picture-hitbox/);
  assert.doesNotMatch(part3Source, /renderOverlayLine/, 'The example line is already printed on the source image');
  assert.doesNotMatch(part3Source, /h-4 w-4|h-5 w-5/, 'Visible endpoint dots must not be rendered');
  assert.doesNotMatch(part3Source, /bg-slate-100\/20/, 'Part 3 overlays must not wash out the source image');
  assert.doesNotMatch(part3Source, /correctConnections/);
  assert.match(part3Source, /const sideForPointer/);
  assert.match(part3Source, /if \(hoveredPicture\) return hoveredPicture\.side/);
  assert.match(part3Source, /assign\(picture\.id, \{ \.\.\.drag\.source, side: picture\.side \}\)/);
  assert.doesNotMatch(part3Source, /picture\.side !== source\.side|selected\.side === picture\.side/);
  assert.match(part3Source, /boardNaturalWidth && boardNaturalWidth < 400/);
  assert.match(part3Source, /Math\.min\(boardNaturalWidth \* 1\.5, 480\)/);
  assert.match(part3Source, /listening-part3-board relative isolate mx-auto w-fit max-w-full/);
  assert.match(part3Source, /width: boardDisplayWidth \? `\$\{boardDisplayWidth\}px` : undefined/);
  assert.match(part3Source, /!assignedPictureIds\.has\(picture\.id\)/);
  assert.match(globalCss, /button\.listening-part3-answer-hitbox:not\(:disabled\)[\s\S]*background: transparent !important/);
  assert.match(globalCss, /button\.listening-part3-answer-hitbox:not\(:disabled\)[\s\S]*backdrop-filter: none !important/);
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

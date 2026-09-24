import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readCssBundle } from '../../styles/cssTestUtils.js';

const indexUrl = new URL('../../index.css', import.meta.url);
const indexSource = readFileSync(indexUrl, 'utf8');
const cssSource = readCssBundle(indexUrl);
const homeMarker = '/* Home surface palette */';

function rgb(hex: string) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex: string) {
  const channels = rgb(hex).map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('Phase 3 palette keeps normal text and primary controls at WCAG AA contrast', () => {
  const expectedPairs = [
    ['#172554', '#ffffff'],
    ['#52606d', '#ffffff'],
    ['#ffffff', '#1d4ed8'],
    ['#ffffff', '#0f766e'],
    ['#ffffff', '#b45309'],
    ['#ffffff', '#c2413b'],
  ];
  for (const [foreground, background] of expectedPairs) {
    assert.ok(
      contrast(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet WCAG AA`,
    );
  }
});

test('visual override is scope-bound and contains no layout mutation', () => {
  const homeSource = readFileSync(new URL('../../styles/home.css', import.meta.url), 'utf8');
  const start = homeSource.indexOf(homeMarker);
  assert.notEqual(start, -1, 'missing Home theme marker');
  const themeCss = homeSource.slice(start);

  assert.match(themeCss, /#app-root\s*\{/);
  assert.doesNotMatch(themeCss, /#admin-dashboard-container|#student-area-root/);
  assert.doesNotMatch(themeCss, /#generic-exam-player|#listening-exam-root|#mover-reading-writing-player/);
  assert.doesNotMatch(
    themeCss,
    /(?:^|\n)\s*(?:display|position|inset|top|right|bottom|left|width|min-width|max-width|height|min-height|max-height|padding|margin|gap|grid-template-columns|grid-template-rows|order|overflow)\s*:/m,
  );
});

test('student leaderboard toggle has explicit readable normal, hover and focus states', () => {
  assert.match(cssSource, /#learning-golden-toggle\s*\{[^}]*background:\s*#b45309\s*!important;[^}]*color:\s*#ffffff\s*!important;/s);
  assert.match(cssSource, /#learning-golden-toggle:hover\s*\{[^}]*background:\s*#92400e\s*!important;/s);
  assert.match(cssSource, /#learning-golden-toggle:focus-visible/);
});

test('CSS entrypoint owns one ordered surface stack without the legacy Dark Glass layer', () => {
  const expectedImports = [
    './styles/tokens-base.css',
    './styles/shared-components.css',
    './styles/home.css',
    './styles/admin.css',
    './styles/student.css',
    './styles/exam-listening.css',
  ];
  const localImports = [...indexSource.matchAll(/^@import\s+["'](\.\/[^"']+\.css)["'];/gm)]
    .map(match => match[1]);
  assert.deepEqual(localImports, expectedImports);
  assert.equal(indexSource.replace(/^@import[^\n]+;\s*$/gm, '').trim(), '');
  assert.doesNotMatch(cssSource, /Global Dark Base|Global Glass Utility|\.glass-(?:panel|button|input)/);
  assert.doesNotMatch(cssSource, /Global Light Theme Override|Contrast & Accessibility Final Pass/);
  assert.doesNotMatch(cssSource, /button:not\(\.bg-indigo-600\)/);
  assert.doesNotMatch(cssSource, /body::before/);
  assert.ok((cssSource.match(/!important/g) ?? []).length < 1850);
  assert.ok((cssSource.match(/backdrop-filter/g) ?? []).length < 140);
});

test('surface owners do not reach into sibling application roots', () => {
  const homeCss = readFileSync(new URL('../../styles/home.css', import.meta.url), 'utf8');
  const adminCss = readFileSync(new URL('../../styles/admin.css', import.meta.url), 'utf8');
  const studentCss = readFileSync(new URL('../../styles/student.css', import.meta.url), 'utf8');

  assert.doesNotMatch(homeCss, /#admin-dashboard-container|#student-area-root|#generic-exam-player|#listening-exam-root/);
  assert.doesNotMatch(adminCss, /#app-root|#student-area-root|#generic-exam-player|#listening-exam-root/);
  assert.doesNotMatch(studentCss, /#app-root|#admin-dashboard-container|#generic-exam-player|#listening-exam-root/);
  assert.doesNotMatch(`${homeCss}\n${adminCss}\n${studentCss}`, /backdrop-filter/);
});

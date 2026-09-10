import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fillBlankSource = readFileSync(new URL('./FillBlankGame.tsx', import.meta.url), 'utf8');
const matchingSource = readFileSync(new URL('./MatchingGame.tsx', import.meta.url), 'utf8');

test('FillBlank moves keyboard focus through the existing check and continue actions', () => {
  assert.match(fillBlankSource, /<form onSubmit=\{handleCheckAnswer\}/);
  assert.match(fillBlankSource, /const continueButtonRef = useRef<HTMLButtonElement>\(null\)/);
  assert.match(fillBlankSource, /if \(isSubmitted\) \{\s*continueButtonRef\.current\?\.focus\(\);/s);
  assert.match(fillBlankSource, /ref=\{continueButtonRef\}\s*type="button"\s*onClick=\{handleNext\}/s);
  assert.doesNotMatch(fillBlankSource, /addEventListener\(['"]keydown['"]/);
});

test('FillBlank rejects pasted and dropped answers while preserving typed input', () => {
  assert.match(fillBlankSource, /'insertFromPaste'/);
  assert.match(fillBlankSource, /'insertFromPasteAsQuotation'/);
  assert.match(fillBlankSource, /'insertFromDrop'/);
  assert.match(fillBlankSource, /onBeforeInput=\{handleAnswerBeforeInput\}/);
  assert.match(fillBlankSource, /onPaste=\{handleBlockedAnswerPaste\}/);
  assert.match(fillBlankSource, /onDrop=\{handleBlockedAnswerDrop\}/);
  assert.match(fillBlankSource, /onChange=\{\(e\) => \{\s*setInputRestrictionMessage\(''\);\s*setUserInput\(e\.target\.value\);/s);
  assert.match(fillBlankSource, /role="alert"/);
});

test('Matching uses amber only for the first selected card and preserves result colors', () => {
  assert.match(matchingSource, /if \(isSelected\) \{\s*borderStyle = "border-amber-400 bg-amber-50 ring-4 ring-amber-100 text-amber-900 font-bold scale-102";/s);
  assert.match(matchingSource, /else if \(isFailed\) \{\s*borderStyle = "border-rose-400 bg-rose-50 text-rose-800 animate-shake";/s);
  assert.match(matchingSource, /else if \(isMatched\) \{\s*borderStyle = "border-emerald-500 bg-emerald-100 text-emerald-900 font-black ring-2 ring-emerald-200 pointer-events-none";/s);
});

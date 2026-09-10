import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gameSources = [
  ['MemoryGame', readFileSync(new URL('./MemoryGame.tsx', import.meta.url), 'utf8')],
  ['MatchingGame', readFileSync(new URL('./MatchingGame.tsx', import.meta.url), 'utf8')]
] as const;

for (const [gameName, source] of gameSources) {
  test(`${gameName} prefers saved vocabulary audio before browser speech fallback`, () => {
    assert.doesNotMatch(source, /\bspeakEnglish\s*\(/);
    assert.match(source, /import \{ playVocabAudio \} from '\.\.\/\.\.\/lib\/game-engine\/speech';/);
    assert.match(source, /new Map\(items\.map\(item => \[item\.id, item\]\)\)/);
    assert.match(source, /playVocabAudio\(vocabItemById\.get\(card\.itemId\), card\.text\)/);
  });
}

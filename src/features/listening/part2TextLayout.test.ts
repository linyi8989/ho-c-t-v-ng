import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { composeListeningPart2Prompt, listeningPart2Layout, parseListeningPart2Affix } from './part2TextLayout';
import { createEmptyListeningAnswers } from './types';
import { createDefaultMoverListeningContent } from '../listening-library/modules/mover/editor/moduleDefinition';
import { ListeningPart2View } from './student/ListeningPartViews';

test('legacy printed prefix/suffix stay with the blank while the label remains separate', () => {
  assert.deepEqual(listeningPart2Layout({ prompt: 'Address: 17 {{blank-1}} Street' }), {
    label: 'Address:',
    tokens: [{ type: 'text', text: '17' }, { type: 'blank', blankId: 'blank-1' }, { type: 'text', text: 'Street' }],
  });
  assert.deepEqual(listeningPart2Layout({ prompt: 'Lives at: {{blank-1}} Street' }).tokens, [
    { type: 'blank', blankId: 'blank-1' }, { type: 'text', text: 'Street' },
  ]);
  assert.equal(listeningPart2Layout({ prompt: 'Class number {{blank-1}}' }).label, 'Class number');
  assert.deepEqual(listeningPart2Layout({ prompt: 'Time: 9: {{blank-1}} am' }), {
    label: 'Time:',
    tokens: [{ type: 'text', text: '9:' }, { type: 'blank', blankId: 'blank-1' }, { type: 'text', text: 'am' }],
  });
  assert.deepEqual(listeningPart2Layout({ prompt: 'Unmarked Address: 17 Street' }), { label: 'Unmarked Address: 17 Street', tokens: [] });
});

test('multiple blanks retain all ordered text without inferring unmarked prefixes', () => {
  assert.deepEqual(listeningPart2Layout({ prompt: 'Hours: from {{start}} to {{end}} pm' }), {
    label: 'Hours:', tokens: [{ type: 'text', text: 'from' }, { type: 'blank', blankId: 'start' }, { type: 'text', text: 'to' }, { type: 'blank', blankId: 'end' }, { type: 'text', text: 'pm' }],
  });
  assert.deepEqual(listeningPart2Layout({ prompt: 'The number 17 {{answer}} Street' }), {
    label: 'The number 17', tokens: [{ type: 'blank', blankId: 'answer' }, { type: 'text', text: 'Street' }],
  });
});

test('explicit external affixes compose into the existing inline schema and legacy prompts remain compatible', () => {
  for (const prompt of ['Address:', 'Address: {{blank}}', 'Address: ____', 'Address: 17 {{blank}} Street']) {
    assert.equal(composeListeningPart2Prompt({ prompt, blankId: 'actual', answerPrefix: '17', answerSuffix: 'Street' }), 'Address: 17 {{actual}} Street');
  }
  assert.equal(composeListeningPart2Prompt({ prompt: 'Address', blankId: 'actual', answerPrefix: '17', answerSuffix: 'Street' }), 'Address: 17 {{actual}} Street');
  assert.equal(composeListeningPart2Prompt({ prompt: 'Lives at: {{blank}} Street', blankId: 'actual' }), 'Lives at: {{actual}} Street');
  assert.equal(composeListeningPart2Prompt({ prompt: 'Age:', blankId: 'actual', answerPrefix: '', answerSuffix: '' }), 'Age: {{actual}}');
  assert.equal(composeListeningPart2Prompt({ prompt: 'Time:', blankId: 'actual', answerPrefix: '9:', answerSuffix: 'am' }), 'Time: 9: {{actual}} am');
  assert.throws(() => composeListeningPart2Prompt({ prompt: 'Address: 17 {{blank}} Road', blankId: 'actual', answerSuffix: 'Street' }), /mâu thuẫn/);
  assert.throws(() => composeListeningPart2Prompt({ prompt: 'Hours: {{actual}} to {{end}}', blankId: 'actual', answerPrefix: 'from' }), /đúng một ô/);
});

test('affixes reject wrong types, oversized or marker-bearing text without truncating it', () => {
  for (const invalid of [null, 17, [], {}, true]) assert.throws(() => parseListeningPart2Affix(invalid, 'answerPrefix'), /chuỗi/);
  assert.throws(() => parseListeningPart2Affix('x'.repeat(21), 'answerPrefix'), /20/);
  assert.throws(() => parseListeningPart2Affix('x'.repeat(81), 'answerSuffix'), /80/);
  assert.throws(() => parseListeningPart2Affix('{{answer}}', 'answerSuffix'), /marker/);
  assert.throws(() => parseListeningPart2Affix('Street\nRoad', 'answerSuffix'), /một dòng/);
  assert.equal(parseListeningPart2Affix(undefined, 'answerPrefix'), undefined);
  assert.equal(parseListeningPart2Affix(' 17 ', 'answerPrefix'), '17');
});

for (const mode of ['balanced', 'right', 'inline'] as const) test(`real Part 2 ${mode} renderer retains prefix, input and suffix in order`, () => {
  const part = createDefaultMoverListeningContent().parts[1];
  part.questions[0].prompt = `Address: 17 {{${part.questions[0].blanks[0].id}}} Street`;
  const markup = renderToStaticMarkup(React.createElement(ListeningPart2View, {
    part, answers: createEmptyListeningAnswers(), onAnswers: () => {},
    balanceMediaColumn: mode === 'balanced', alignAnswersRight: mode === 'right',
  }));
  const firstRow = markup.slice(markup.indexOf('Address:'));
  assert.ok(firstRow.indexOf('17') < firstRow.indexOf('<input'));
  assert.ok(firstRow.indexOf('<input') < firstRow.indexOf('Street'));
  assert.equal((markup.match(/data-student-underline-answer/g) || []).length, 5);
  if (mode !== 'inline') {
    assert.ok(markup.includes('data-listening-part2-printed-hint'));
    assert.doesNotMatch(markup, /Address: 17 Street/);
  }
});

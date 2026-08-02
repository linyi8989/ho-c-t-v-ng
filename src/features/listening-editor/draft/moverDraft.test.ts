import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverListeningContent } from '../../listening-library/modules/mover/editor/moduleDefinition';
import { replaceMoverListeningPart } from './moverDraft';

test('merging a Part leaves all four sibling Parts byte-for-byte unchanged', () => {
  for (let index = 0; index < 5; index += 1) {
    const original = createDefaultMoverListeningContent();
    const before = original.parts.map(part => JSON.stringify(part));
    const changedPart = { ...original.parts[index], title: `Changed Part ${index + 1}` };
    const merged = replaceMoverListeningPart(original, index, changedPart as never);
    merged.parts.forEach((part, partIndex) => {
      if (partIndex === index) assert.equal(part.title, `Changed Part ${index + 1}`);
      else assert.equal(JSON.stringify(part), before[partIndex]);
    });
  }
});

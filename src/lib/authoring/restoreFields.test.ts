import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreFields } from './restoreFields';
test('malformed nested settings never partly overwrite current authoring', () => {
  const template = { title: '', settings: { enabled: false, speed: 1 }, items: [] as string[] };
  const changed: string[] = [];
  const setters = { title: (_value: string) => changed.push('title'), settings: (_value: typeof template.settings) => changed.push('settings'), items: (_value: string[]) => changed.push('items') };
  for (const settings of [null, [], { enabled: 'yes', speed: 1 }, { enabled: false, speed: Infinity }, {}]) {
    assert.throws(() => restoreFields({ ...template, title: 'unsaved', settings } as typeof template, template, setters), /không hợp lệ/);
    assert.deepEqual(changed, []);
  }
});
test('incomplete content is recoverable without requiring publish validation', () => {
  const template = { title: '', settings: { enabled: false, speed: 1 }, items: [] as string[] };
  const restored = { ...template };
  restoreFields({ title: '', settings: { enabled: true, speed: 0.8 }, items: ['unfinished'] }, template, { title: value => { restored.title = value; }, settings: value => { restored.settings = value; }, items: value => { restored.items = value; } });
  assert.deepEqual(restored, { title: '', settings: { enabled: true, speed: 0.8 }, items: ['unfinished'] });
});

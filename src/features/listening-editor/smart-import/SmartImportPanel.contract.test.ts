import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panelSource = readFileSync(new URL('./SmartImportPanel.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../../listening/admin/ListeningAdminModule.tsx', import.meta.url), 'utf8');

test('whole-exam Resource Tray stays hidden while per-Part Smart Import remains available', () => {
  assert.match(adminSource, /const SHOW_WHOLE_EXAM_RESOURCE_TRAY = false;/);
  assert.match(adminSource, /\{SHOW_WHOLE_EXAM_RESOURCE_TRAY && \(/);
  assert.match(panelSource, /Smart Import · Part \{part\.part\}/);
});

test('selected role source can be detached independently without archiving shared media', () => {
  assert.match(panelSource, /const setSource = \(role: ListeningSmartImportSourceRole, assetId\?: string\) =>/);
  assert.match(panelSource, /onClick=\{\(\) => setSource\(definition\.role\)\}/);
  assert.match(panelSource, /className="smart-import-remove-source/);
  assert.match(panelSource, /title="Bỏ khỏi lần phân tích này"/);
  assert.doesNotMatch(panelSource, /archiveAsset|deleteAsset/);
});

test('role slots are explicit, use FileDropPasteInput, and exclude assets selected by another role', () => {
  assert.match(typesSource, /role: 'question'/);
  assert.match(typesSource, /role: 'answer_key'/);
  assert.match(typesSource, /role: 'position_key'/);
  assert.match(panelSource, /data-smart-import-role=\{definition\.role\}/);
  assert.match(panelSource, /usedByAnotherRole/);
  assert.match(panelSource, /maxFiles=\{1\}/);
  assert.match(panelSource, /<FileDropPasteInput/);
});

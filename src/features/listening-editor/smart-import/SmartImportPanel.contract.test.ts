import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panelSource = readFileSync(new URL('./SmartImportPanel.tsx', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../../listening/admin/ListeningAdminModule.tsx', import.meta.url), 'utf8');

test('whole-exam Resource Tray stays hidden while per-Part Smart Import remains available', () => {
  assert.match(adminSource, /const SHOW_WHOLE_EXAM_RESOURCE_TRAY = false;/);
  assert.match(adminSource, /\{SHOW_WHOLE_EXAM_RESOURCE_TRAY && \(/);
  assert.match(panelSource, /Smart Import · Part \{part\.part\}/);
});

test('selected Smart Import sources can be removed without archiving shared media', () => {
  assert.match(panelSource, /const removeSource = \(assetId: string\) =>/);
  assert.match(panelSource, /previous\.filter\(id => id !== assetId\)/);
  assert.match(panelSource, /onClick=\{\(\) => removeSource\(id\)\}/);
  assert.match(panelSource, /className="smart-import-remove-source/);
  assert.match(panelSource, /title="Bỏ khỏi lần phân tích này"/);
  assert.doesNotMatch(panelSource, /archiveAsset|deleteAsset/);
});

test('source picker only shows unselected library assets and enforces the five-image limit', () => {
  assert.match(panelSource, /imageAssets\.filter\(asset => !sourceIds\.includes\(asset\.id\)\)/);
  assert.match(panelSource, /disabled=\{busy \|\| sourceIds\.length >= 5\}/);
  assert.match(panelSource, /Math\.max\(1, 5 - sourceIds\.length\)/);
});


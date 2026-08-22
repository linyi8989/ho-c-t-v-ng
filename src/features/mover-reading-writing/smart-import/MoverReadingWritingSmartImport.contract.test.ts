import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panelSource = readFileSync(new URL('./MoverReadingWritingSmartImportPanel.tsx', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('../admin/MoverReadingWritingPartEditors.tsx', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../admin/MoverReadingWritingAdmin.tsx', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../../../server/mover-reading-writing/moverReadingWritingRouter.ts', import.meta.url), 'utf8');

test('all six Reading & Writing editors expose the dedicated two-mode Smart Import panel', () => {
  assert.equal((editorSource.match(/<SmartImportBlock\b/g) || []).length, 6);
  for (const contract of [
    'Thông số bên ngoài',
    'Stali · ChatGPT 5.6 Sol',
    'DevQuota · ChatGPT 5.6 Sol',
    'parseMoverReadingWritingExternalImport',
    'moverReadingWritingApi.analyzeSmartImport',
    'hashMoverReadingWritingPart(latestPartRef.current)',
    'setTemporaryByRole({})',
  ]) assert.ok(panelSource.includes(contract), `Smart Import panel is missing: ${contract}`);
});

test('direct import persists through revision-aware draft storage and never publishes', () => {
  for (const contract of [
    'mergeMoverReadingWritingSmartImport',
    'moverReadingWritingApi.createSet',
    'moverReadingWritingApi.autosaveSet',
    'draft.markSaved(document, revision)',
    "error?.status === 409",
  ]) assert.ok(adminSource.includes(contract), `Admin direct-save contract is missing: ${contract}`);
  assert.equal(panelSource.includes('publishSet'), false);
});

test('server keeps Smart Import staff-only, bounded, role-aware and transient', () => {
  for (const contract of [
    "'/admin/smart-import/sources'",
    "'/admin/smart-import/analyze'",
    'authenticateUser, requireStaff',
    'getMoverReadingWritingSmartImportRoleDefinitions(part)',
    'SMART_IMPORT_TOTAL_MAX_BYTES',
    'sha256(JSON.stringify(currentPart))',
    'recentUsage.length >= 20',
    'Promise.allSettled(removers.map(remove => remove()))',
  ]) assert.ok(routerSource.includes(contract), `Smart Import server contract is missing: ${contract}`);
});

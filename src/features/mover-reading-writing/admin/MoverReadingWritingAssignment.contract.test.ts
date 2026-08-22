import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminSource = readFileSync(new URL('../../../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../../../../server.ts', import.meta.url), 'utf8');

test('assignment scheduler and server share the dedicated Reading & Writing resource contract', () => {
  for (const contract of [
    "resourceType === 'mover_reading_writing'",
    "moverReadingWritingSetId",
    '/api/mover-reading-writing/admin/sets',
    "examPaperExamPath('mover', 'reading-writing'",
    'mover-reading-writing',
  ]) {
    assert.ok(adminSource.includes(contract), `Admin assignment contract is missing: ${contract}`);
  }
  for (const contract of [
    'payload.resourceType === "mover_reading_writing"',
    'collection("mover_reading_sets")',
    'resource.status !== "published"',
    'resource.visibility === "draft"',
    'moverReadingWritingSetTitle',
    'gameId: "mover-reading-writing"',
  ]) {
    assert.ok(serverSource.includes(contract), `Server assignment contract is missing: ${contract}`);
  }
});

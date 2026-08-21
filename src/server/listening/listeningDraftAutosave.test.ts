import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createDefaultMoverListeningContent } from '../../features/listening-library/modules/mover/editor/moduleDefinition';
import { createListeningRouter } from './listeningRouter';

test('draft autosave increments revision and rejects a stale editor session', async t => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-listening-draft-'));
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'sqljs';
  process.env.SQLITE_DB_PATH = path.join(temporaryDirectory, 'app.sqlite');
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';

  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const authenticate: express.RequestHandler = (req, _res, next) => {
    req.user = {
      id: 'teacher-autosave',
      role: 'teacher',
      name: 'Teacher',
      email: 'teacher@example.com',
    } as any;
    next();
  };
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/listening', createListeningRouter({
    db,
    authenticateUser: authenticate,
    authenticateOptionalUser: authenticate,
    requireStaff: (_req, _res, next) => next(),
    mediaDir: path.join(temporaryDirectory, 'media'),
    mediaPublicPrefix: '/listening-media',
    ticketSecret: 'draft-autosave-test-secret-with-sufficient-length',
    resolveGuestProfile: async () => null,
  }));

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
    await storage.closeSQLiteStorage();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/listening`;
  const headers = { 'Content-Type': 'application/json' };

  const content = createDefaultMoverListeningContent();
  const createResponse = await fetch(`${baseUrl}/admin/sets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as any;
  assert.equal(created.draftRevision, 1);

  const changed = structuredClone(content);
  changed.title = 'Autosaved title';
  changed.parts[0].audioTranscript = 'Man: This transcript is saved with the working draft.';
  const autosaveResponse = await fetch(`${baseUrl}/admin/sets/${created.id}/draft/autosave`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: changed, visibility: 'draft', baseRevision: 1 }),
  });
  assert.equal(autosaveResponse.status, 200);
  const autosaved = await autosaveResponse.json() as any;
  assert.equal(autosaved.draftRevision, 2);

  const staleResponse = await fetch(`${baseUrl}/admin/sets/${created.id}/draft/autosave`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, visibility: 'draft', baseRevision: 1 }),
  });
  assert.equal(staleResponse.status, 409);
  const stale = await staleResponse.json() as any;
  assert.equal(stale.details.code, 'LISTENING_DRAFT_REVISION_CONFLICT');
  assert.equal(stale.details.currentRevision, 2);

  const savedDocument = await db.collection('listening_sets').doc(created.id).get();
  assert.equal(savedDocument.data()?.title, 'Autosaved title');
  assert.equal(
    savedDocument.data()?.draftContent?.parts?.[0]?.audioTranscript,
    'Man: This transcript is saved with the working draft.',
  );
});

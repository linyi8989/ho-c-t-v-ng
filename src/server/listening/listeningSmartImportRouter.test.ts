import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createDefaultMoverListeningContent } from '../../features/listening-library/modules/mover/editor/moduleDefinition';
import { createListeningRouter } from './listeningRouter';

test('Smart Import accepts owned images and explicitly rejects audio assets', async t => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-listening-import-'));
  const mediaDir = path.join(temporaryDirectory, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.writeFileSync(path.join(mediaDir, 'source.png'), Buffer.from('fixture-image'));
  fs.writeFileSync(path.join(mediaDir, 'source.mp3'), Buffer.from('fixture-audio'));
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'sqljs';
  process.env.SQLITE_DB_PATH = path.join(temporaryDirectory, 'app.sqlite');
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';

  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const now = new Date().toISOString();
  await db.collection('listening_assets').doc('owned-image').set({
    id: 'owned-image', ownerId: 'teacher-import', kind: 'image', mimeType: 'image/png',
    name: 'source.png', size: 13, storageKey: 'source.png', url: '/listening-media/source.png',
    status: 'active', createdAt: now, updatedAt: now,
  });
  await db.collection('listening_assets').doc('owned-audio').set({
    id: 'owned-audio', ownerId: 'teacher-import', kind: 'audio', mimeType: 'audio/mpeg',
    name: 'source.mp3', size: 13, storageKey: 'source.mp3', url: '/listening-media/source.mp3',
    status: 'active', createdAt: now, updatedAt: now,
  });
  let analyzedKinds: string[] = [];
  const authenticate: express.RequestHandler = (req, _res, next) => {
    req.user = { id: 'teacher-import', role: 'teacher', name: 'Teacher', email: 'teacher@example.com' } as any;
    next();
  };
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/listening', createListeningRouter({
    db,
    authenticateUser: authenticate,
    authenticateOptionalUser: authenticate,
    requireStaff: (_req, _res, next) => next(),
    mediaDir,
    mediaPublicPrefix: '/listening-media',
    ticketSecret: 'smart-import-test-secret-with-sufficient-length',
    resolveGuestProfile: async () => null,
    smartImport: {
      enabled: true,
      analyzeVision: async (_prompt, images) => {
        analyzedKinds = images.map(image => image.mimeType);
        return {
          provider: 'gemini',
          text: JSON.stringify({
            heading: 'ABC',
            questions: Array.from({ length: 5 }, (_, index) => ({
              prompt: `Question ${index + 1} {{blank}}`,
              acceptedAnswers: [`answer ${index + 1}`],
            })),
          }),
        };
      },
    },
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
  const url = `http://127.0.0.1:${address.port}/api/listening/admin/smart-import/analyze`;
  const part = createDefaultMoverListeningContent().parts[1];
  const basePartHash = crypto.createHash('sha256').update(JSON.stringify(part)).digest('hex');
  const body = (assetId: string) => JSON.stringify({
    moduleId: 'mover', part: 2, sourceImageAssetIds: [assetId], currentPart: part, basePartHash,
  });

  const rejected = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body('owned-audio') });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json() as any).error, /chỉ nhận ảnh/);
  assert.deepEqual(analyzedKinds, []);

  const stale = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleId: 'mover', part: 2, sourceImageAssetIds: ['owned-image'], currentPart: part,
      basePartHash: '0'.repeat(64),
    }),
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json() as any).details.code, 'LISTENING_IMPORT_BASE_CHANGED');
  assert.deepEqual(analyzedKinds, []);

  const accepted = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body('owned-image') });
  assert.equal(accepted.status, 200);
  const candidate = await accepted.json() as any;
  assert.equal(candidate.part, 2);
  assert.equal(candidate.data.questions.length, 5);
  assert.deepEqual(analyzedKinds, ['image/png']);

  const derivedResponse = await fetch(`http://127.0.0.1:${address.port}/api/listening/admin/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'X-File-Name': 'derived.png',
      'X-Asset-Kind': 'image',
      'X-Derived-From-Asset-Id': 'owned-image',
      'X-Crop-Metadata': JSON.stringify({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }),
    },
    body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]),
  });
  assert.equal(derivedResponse.status, 201);
  const derived = await derivedResponse.json() as any;
  assert.equal(derived.derivedFromAssetId, 'owned-image');
  assert.deepEqual(derived.crop, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });

  const sameBytesDifferentCropResponse = await fetch(`http://127.0.0.1:${address.port}/api/listening/admin/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'X-File-Name': 'derived-second-region.png',
      'X-Asset-Kind': 'image',
      'X-Derived-From-Asset-Id': 'owned-image',
      'X-Crop-Metadata': JSON.stringify({ x: 0.5, y: 0.2, width: 0.3, height: 0.4 }),
    },
    body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]),
  });
  assert.equal(sameBytesDifferentCropResponse.status, 201);
  const sameBytesDifferentCrop = await sameBytesDifferentCropResponse.json() as any;
  assert.notEqual(sameBytesDifferentCrop.id, derived.id);
  assert.equal(sameBytesDifferentCrop.storageKey, derived.storageKey);
  assert.deepEqual(sameBytesDifferentCrop.crop, { x: 0.5, y: 0.2, width: 0.3, height: 0.4 });
});

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
  fs.writeFileSync(path.join(mediaDir, 'answer.png'), Buffer.from('fixture-answer'));
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
  await db.collection('listening_assets').doc('owned-answer').set({
    id: 'owned-answer', ownerId: 'teacher-import', kind: 'image', mimeType: 'image/png',
    name: 'answer.png', size: 14, storageKey: 'answer.png', url: '/listening-media/answer.png',
    status: 'active', createdAt: now, updatedAt: now,
  });
  await db.collection('listening_assets').doc('owned-audio').set({
    id: 'owned-audio', ownerId: 'teacher-import', kind: 'audio', mimeType: 'audio/mpeg',
    name: 'source.mp3', size: 13, storageKey: 'source.mp3', url: '/listening-media/source.mp3',
    status: 'active', createdAt: now, updatedAt: now,
  });
  let analyzedKinds: string[] = [];
  let analyzedProvider = '';
  let analyzerFailure: any;
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
      providers: [
        { id: 'stali:gpt-5.6-sol', label: 'Stali · ChatGPT 5.6 Sol', enabled: true, visionEnabled: true, model: 'gpt-5.6-sol' },
        { id: 'devquota:gpt-5.6-sol', label: 'DevQuota · ChatGPT 5.6 Sol', enabled: true, visionEnabled: true, model: 'gpt-5.6-sol' },
      ],
      analyzeVision: async (_prompt, images, options) => {
        analyzedKinds = images.map(image => image.mimeType);
        analyzedProvider = options.preferredProvider;
        if (analyzerFailure) throw analyzerFailure;
        if (options.schemaName === 'listening_pdf_manifest_v1') {
          return {
            provider: options.preferredProvider,
            text: JSON.stringify({
              tests: [{
                testNumber: 1,
                title: 'Test 1',
                part1Pages: [1],
                part2Pages: [2],
                part3Pages: [3],
                part4Pages: [4, 5],
                part5Pages: [6],
                keySummaryPage: 2,
              }],
              warnings: [],
            }),
          };
        }
        return {
          provider: options.preferredProvider,
          text: JSON.stringify({
            heading: 'ABC',
            questions: Array.from({ length: 5 }, (_, index) => ({
              questionNumber: index + 1,
              prompt: `Question ${index + 1} {{blank}}`,
            })),
            answers: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, answer: `answer ${index + 1}` })),
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
  const body = (answerAssetId: string, preferredProvider = 'stali:gpt-5.6-sol') => JSON.stringify({
    moduleId: 'mover', part: 2, sources: [
      { role: 'question', assetId: 'owned-image' },
      { role: 'answer_key', assetId: answerAssetId },
    ], currentPart: part, basePartHash,
    preferredProvider,
  });

  const rejected = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body('owned-audio') });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json() as any).error, /chỉ nhận ảnh/);
  assert.deepEqual(analyzedKinds, []);

  const stale = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleId: 'mover', part: 2, sources: [
        { role: 'question', assetId: 'owned-image' },
        { role: 'answer_key', assetId: 'owned-answer' },
      ], currentPart: part,
      basePartHash: '0'.repeat(64),
    }),
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json() as any).details.code, 'LISTENING_IMPORT_BASE_CHANGED');
  assert.deepEqual(analyzedKinds, []);

  const accepted = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body('owned-answer') });
  assert.equal(accepted.status, 200);
  const candidate = await accepted.json() as any;
  assert.equal(candidate.part, 2);
  assert.equal(candidate.data.questions.length, 5);
  assert.deepEqual(analyzedKinds, ['image/png', 'image/png']);
  assert.equal(analyzedProvider, 'stali:gpt-5.6-sol');

  const devQuotaAccepted = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body('owned-answer', 'devquota:gpt-5.6-sol') });
  assert.equal(devQuotaAccepted.status, 200);
  assert.equal(analyzedProvider, 'devquota:gpt-5.6-sol');

  const uploadTemporary = async () => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/listening/admin/pdf-import/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]),
    });
    assert.equal(response.status, 201);
    return (await response.json() as any).token as string;
  };
  const transientQuestion = await uploadTemporary();
  const transientAnswer = await uploadTemporary();
  const transientAccepted = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleId: 'mover', part: 2,
      sources: [
        { role: 'question', transientToken: transientQuestion },
        { role: 'answer_key', transientToken: transientAnswer },
      ],
      currentPart: part,
      basePartHash,
      preferredProvider: 'stali:gpt-5.6-sol',
    }),
  });
  assert.equal(transientAccepted.status, 200);
  assert.deepEqual(analyzedKinds, ['image/png', 'image/png']);
  assert.deepEqual(fs.readdirSync(path.join(mediaDir, '.tmp-pdf-import')), []);

  const manifestBookToken = await uploadTemporary();
  const manifestKeyToken = await uploadTemporary();
  const manifestResponse = await fetch(`http://127.0.0.1:${address.port}/api/listening/admin/pdf-import/manifest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookSourceTokens: [manifestBookToken],
      keySourceTokens: [manifestKeyToken],
      bookPageCount: 10,
      keyPageCount: 5,
      preferredProvider: 'stali:gpt-5.6-sol',
    }),
  });
  assert.equal(manifestResponse.status, 200);
  assert.deepEqual((await manifestResponse.json() as any).tests[0].bookPages[4], [4, 5]);
  assert.deepEqual(fs.readdirSync(path.join(mediaDir, '.tmp-pdf-import')), []);

  const removedProviderRejected = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body('owned-answer', 'gemini') });
  assert.equal(removedProviderRejected.status, 400);
  assert.match((await removedProviderRejected.json() as any).error, /không tồn tại/);

  analyzerFailure = Object.assign(new Error('Không có nhà cung cấp AI thị giác khả dụng.'), {
    status: 503,
    details: ['Stali: fetch failed'],
  });
  const providerFailed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body('owned-answer') });
  assert.equal(providerFailed.status, 503);
  const providerFailureBody = await providerFailed.json() as any;
  assert.match(providerFailureBody.error, /Draft chưa được thay đổi/);
  assert.deepEqual(providerFailureBody.details, ['Stali: fetch failed']);
  analyzerFailure = undefined;

  const capabilities = await fetch(`http://127.0.0.1:${address.port}/api/listening/capabilities`);
  assert.equal(capabilities.status, 200);
  assert.deepEqual((await capabilities.json() as any).smartImport.providers.map((provider: any) => provider.label), [
    'Stali · ChatGPT 5.6 Sol',
    'DevQuota · ChatGPT 5.6 Sol',
  ]);

  const unknownProvider = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleId: 'mover', part: 2, sources: [{ role: 'question', assetId: 'owned-image' }, { role: 'answer_key', assetId: 'owned-answer' }],
      currentPart: part, basePartHash, preferredProvider: 'future-provider',
    }),
  });
  assert.equal(unknownProvider.status, 400);

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

import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { LISTENING_GRADING_VERSION } from '../listening/listeningGrader';
import { createListeningLibraryRouter } from './router';

test('listening library API exposes safe module metadata and only activates Mover', async t => {
  const app = express();
  app.use('/api/listening-library', createListeningLibraryRouter());
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/listening-library`;

  const modulesResponse = await fetch(`${baseUrl}/modules`);
  assert.equal(modulesResponse.status, 200);
  const modules = await modulesResponse.json() as any[];
  assert.deepEqual(modules.map(module => module.id), [
    'starter', 'mover', 'flyer', 'ket', 'pet', 'fce', 'ielts',
  ]);
  assert.deepEqual(modules.filter(module => module.status === 'active').map(module => module.id), ['mover']);
  assert.equal(modules.find(module => module.id === 'starter')?.parts.length, 0);
  assert.equal(modules.find(module => module.id === 'pet')?.levelLabel, 'B1 Preliminary');
  assert.equal(modules.find(module => module.id === 'fce')?.levelLabel, 'B2 First');
  assert.equal(modules.find(module => module.id === 'ielts')?.levelLabel, 'Academic & General');

  const moverResponse = await fetch(`${baseUrl}/modules/mover`);
  assert.equal(moverResponse.status, 200);
  const mover = await moverResponse.json() as any;
  assert.equal(mover.available, true);
  assert.equal(mover.gradingVersion, LISTENING_GRADING_VERSION);

  const starterResponse = await fetch(`${baseUrl}/modules/starter`);
  assert.equal(starterResponse.status, 200);
  const starter = await starterResponse.json() as any;
  assert.equal(starter.available, false);
  assert.equal('gradingVersion' in starter, false);

  const unknownResponse = await fetch(`${baseUrl}/modules/unknown`);
  assert.equal(unknownResponse.status, 404);
});

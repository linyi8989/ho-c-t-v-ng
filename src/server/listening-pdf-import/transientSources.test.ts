import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createListeningPdfTransientSourceStore } from './transientSources';

test('temporary PDF sources are owner-bound, signed and removable', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'listening-pdf-source-'));
  try {
    const store = createListeningPdfTransientSourceStore({ directory, secret: 'test-secret', ttlMs: 60_000 });
    const created = await store.create('teacher-1', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    await assert.rejects(store.resolve(created.token, 'teacher-2'), /không hợp lệ/);
    await assert.rejects(store.resolve(`${created.token}x`, 'teacher-1'), /không hợp lệ/);
    const resolved = await store.resolve(created.token, 'teacher-1');
    assert.equal(resolved.mimeType, 'image/jpeg');
    assert.equal(resolved.data.length, 4);
    await resolved.remove();
    await assert.rejects(store.resolve(created.token, 'teacher-1'), /không còn tồn tại/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


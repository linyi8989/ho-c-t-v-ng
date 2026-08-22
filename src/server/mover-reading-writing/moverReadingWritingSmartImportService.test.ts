import assert from 'node:assert/strict';
import test from 'node:test';
import { moverReadingWritingExternalTemplate } from '../../features/mover-reading-writing/smart-import/contracts';
import type { MoverReadingWritingSmartImportSourceRole } from '../../features/mover-reading-writing/smart-import/types';
import { createMoverReadingWritingSmartImportCandidate } from './moverReadingWritingSmartImportService';

test('provider Smart Import normalizes every Reading & Writing Part with the shared external contract', async () => {
  for (const part of [1, 2, 3, 4, 5, 6] as const) {
    const candidate = await createMoverReadingWritingSmartImportCandidate({
      part,
      basePartHash: 'a'.repeat(64),
      preferredProvider: 'stali:gpt-5.6-sol',
      images: [{ assetId: 'answer', role: 'answer_key' as MoverReadingWritingSmartImportSourceRole, mimeType: 'image/png', data: Buffer.from('image') }],
      analyzeVision: async (prompt, _images, options) => {
        assert.match(prompt, /Never solve the exercise/);
        assert.equal(options.schemaName, `mover_rw_part_${part}_v${part === 1 || part === 5 || part === 6 ? 2 : 1}`);
        return { provider: 'stali:gpt-5.6-sol', text: moverReadingWritingExternalTemplate(part) };
      },
    });
    assert.equal(candidate.part, part);
    assert.equal(candidate.data.part, part);
    assert.equal(candidate.basePartHash, 'a'.repeat(64));
  }
});

test('provider gets one bounded correction attempt and invalid output never creates a candidate', async () => {
  let calls = 0;
  await assert.rejects(
    createMoverReadingWritingSmartImportCandidate({
      part: 2,
      basePartHash: 'b'.repeat(64),
      preferredProvider: 'devquota:gpt-5.6-sol',
      images: [{ assetId: 'answer', role: 'answer_key', mimeType: 'image/png', data: Buffer.from('image') }],
      analyzeVision: async prompt => {
        calls += 1;
        if (calls === 2) assert.match(prompt, /previous response failed runtime validation/);
        return { provider: 'devquota:gpt-5.6-sol', text: '{"invalid":true}' };
      },
    }),
    /chưa trả dữ liệu Reading & Writing đúng cấu trúc/,
  );
  assert.equal(calls, 2);
});

test('provider availability errors are not mislabeled as invalid Reading & Writing JSON', async () => {
  let calls = 0;
  const providerError: any = new Error('Không có nhà cung cấp AI thị giác khả dụng.');
  providerError.status = 503;
  providerError.code = 'AI_PROVIDER_UNAVAILABLE';
  providerError.details = ['Stali 401: invalid credential'];

  await assert.rejects(
    createMoverReadingWritingSmartImportCandidate({
      part: 1,
      basePartHash: 'c'.repeat(64),
      preferredProvider: 'stali:gpt-5.6-sol',
      images: [{ assetId: 'answer', role: 'answer_key', mimeType: 'image/png', data: Buffer.from('image') }],
      analyzeVision: async () => {
        calls += 1;
        throw providerError;
      },
    }),
    (reason: any) => {
      assert.equal(reason.status, 503);
      assert.equal(reason.code, 'AI_PROVIDER_UNAVAILABLE');
      assert.deepEqual(reason.details, ['Stali 401: invalid credential']);
      assert.doesNotMatch(reason.message, /đúng cấu trúc/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

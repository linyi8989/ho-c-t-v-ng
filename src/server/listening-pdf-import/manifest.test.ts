import assert from 'node:assert/strict';
import test from 'node:test';
import { createListeningPdfManifest, normalizeListeningPdfManifest } from './manifest';

const fixture = {
  tests: [
    { testNumber: 1, title: 'Test 1', part1Pages: [4], part2Pages: [5], part3Pages: [6], part4Pages: [7, 8], part5Pages: [9], keySummaryPage: 6 },
    { testNumber: 2, title: 'Test 2', part1Pages: [23], part2Pages: [24], part3Pages: [25], part4Pages: [26, 27], part5Pages: [28], keySummaryPage: 12 },
    { testNumber: 3, title: 'Test 3', part1Pages: [42], part2Pages: [43], part3Pages: [44], part4Pages: [45, 46], part5Pages: [47], keySummaryPage: 18 },
  ],
  warnings: [],
};

test('normalizes the verified Movers 1 book/key page manifest', () => {
  const manifest = normalizeListeningPdfManifest(fixture, 70, 31);
  assert.equal(manifest.tests.length, 3);
  assert.deepEqual(manifest.tests[0].bookPages[4], [7, 8]);
  assert.deepEqual(manifest.tests.map(row => row.keySummaryPage), [6, 12, 18]);
});

test('rejects non-consecutive Part 4 pages and out-of-range key pages', () => {
  assert.throws(() => normalizeListeningPdfManifest({
    ...fixture,
    tests: [{ ...fixture.tests[0], part4Pages: [7, 9] }],
  }, 70, 31), /hai trang liên tiếp/);
  assert.throws(() => normalizeListeningPdfManifest({
    ...fixture,
    tests: [{ ...fixture.tests[0], keySummaryPage: 32 }],
  }, 70, 31), /trang tổng hợp đáp án/);
  assert.throws(() => normalizeListeningPdfManifest({
    ...fixture,
    tests: [fixture.tests[0], { ...fixture.tests[1], part1Pages: [9] }],
  }, 70, 31), /bị trùng hoặc sai thứ tự/);
});

test('manifest analysis retries one malformed response and then validates the result', async () => {
  let calls = 0;
  const manifest = await createListeningPdfManifest({
    bookPageCount: 70,
    keyPageCount: 31,
    images: [],
    preferredProvider: 'stali:gpt-5.6-sol',
    analyzeVision: async () => ({
      provider: 'stali:gpt-5.6-sol',
      text: ++calls === 1 ? '{bad json' : JSON.stringify(fixture),
    }),
  });
  assert.equal(calls, 2);
  assert.equal(manifest.tests[2].bookPages[5][0], 47);
});

test('manifest failure preserves sanitized provider details for diagnosis', async () => {
  await assert.rejects(createListeningPdfManifest({
    bookPageCount: 70,
    keyPageCount: 31,
    images: [],
    preferredProvider: 'stali:gpt-5.6-sol',
    analyzeVision: async () => {
      const error: any = new Error('Không có nhà cung cấp AI thị giác khả dụng.');
      error.status = 503;
      error.details = ['Stali: fetch failed'];
      throw error;
    },
  }), (reason: any) => {
    assert.equal(reason.status, 503);
    assert.deepEqual(reason.details, [
      'Stali: fetch failed',
      'Không có nhà cung cấp AI thị giác khả dụng.',
    ]);
    return true;
  });
});

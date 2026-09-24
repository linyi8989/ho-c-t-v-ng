import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createTtsService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');

function fixture() {
  let generations = 0;
  const service = createTtsService({
    normalizeSettings: value => ({ provider: 'ai33', voice: 'voice', lang: 'en-US', speed: 1, ...value }),
    sanitizeInput: value => ({ text: String(value || '').trim(), warnings: [] }),
    createAudioHash: text => `hash:${text}`,
    generateCachedAudio: async text => {
      generations += 1;
      return { audioUrl: `/audio/${text}.mp3`, audioHash: `hash:${text}`, cached: false, ttsText: text, warnings: [] };
    },
    runWithConcurrency: async (items, _limit, worker) => Promise.all(items.map(worker)),
    concurrency: 5,
    voiceProvider: { async listVoices() { return { status: 200, data: { voices: [] } }; } },
  });
  return { get generations() { return generations; }, service };
}

test('TTS URLs keep staff authentication and the cost-aware rate limiter', () => {
  assert.match(serverSource, /createTtsRouter/);
  assert.doesNotMatch(serverSource, /app\.(?:get|post)\("\/api\/tts\//);
  for (const route of [
    'router.post("/tts/preview", options.authenticateUser, options.requireStaff, options.rateLimit',
    'router.post("/tts/batch-preview", options.authenticateUser, options.requireStaff, options.rateLimit',
    'router.get("/tts/voices", options.authenticateUser, options.requireStaff, options.rateLimit',
  ]) assert.ok(routerSource.includes(route), `missing middleware contract: ${route}`);
});

test('batch preview deduplicates identical text by audio hash', async () => {
  const fixtureValue = fixture();
  const result = await fixtureValue.service.batchPreview({
    items: [{ id: '1', text: 'apple' }, { id: '2', text: 'apple' }],
    settings: {},
  });
  assert.equal(fixtureValue.generations, 1);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].audioUrl, '/audio/apple.mp3');
  assert.equal(result.concurrency, 5);
});

test('preview and missing batch input retain validation errors', async () => {
  const { service } = fixture();
  await assert.rejects(service.preview({ text: '  ' }), (error: any) => error.status === 400);
  await assert.rejects(service.batchPreview({ items: [] }), (error: any) => error.status === 400);
});

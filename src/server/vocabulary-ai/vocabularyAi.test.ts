import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createVocabularyAiService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');

test('AI URLs retain authentication, staff guard, and rate limiter', () => {
  assert.match(serverSource, /createVocabularyAiRouter/);
  assert.doesNotMatch(serverSource, /app\.post\("\/api\/ai\//);
  assert.match(routerSource, /router\.post\("\/ai\/ipa", options\.authenticateUser, options\.rateLimit/);
  assert.match(routerSource, /router\.post\("\/ai\/vocab-detail", options\.authenticateUser, options\.rateLimit/);
  assert.match(routerSource, /router\.post\("\/ai\/generate", options\.authenticateUser, options\.requireStaff, options\.rateLimit/);
});

test('IPA keeps local fallback metadata when every provider is unavailable', async () => {
  const service = createVocabularyAiService({
    provider: {
      async generateText() { return { text: '', provider: 'fallback', errors: ['no provider'] }; },
      sanitizeError: (_provider: string, error: any) => String(error.message || error),
    },
  });
  assert.deepEqual(await service.generateIpa('Apple'), {
    ipa: '/apple/',
    aiProvider: 'fallback',
    isFallback: true,
    aiErrors: ['no provider'],
  });
});

test('vocabulary detail repairs weak examples and normalizes part of speech', async () => {
  const service = createVocabularyAiService({
    provider: {
      async generateText() {
        return {
          text: JSON.stringify({
            meaning: 'quả táo',
            ipa: '/ˈæpəl/',
            pos: 'word/phrase',
            example: 'The word apple appears often in everyday English.',
            exampleMeaning: '',
            audioUrl: '',
          }),
          provider: 'test-provider',
          errors: [],
        };
      },
      sanitizeError: (_provider: string, error: any) => String(error.message || error),
    },
  });
  const result = await service.generateVocabDetail('apple', 'quả táo', 'primary');
  assert.equal(result.term, 'apple');
  assert.equal(result.pos, 'Noun');
  assert.notEqual(result.example, 'The word apple appears often in everyday English.');
  assert.equal(result.aiProvider, 'test-provider');
});

test('batch generation returns deterministic local fallback on provider failure', async () => {
  const service = createVocabularyAiService({
    provider: {
      async generateText() { throw new Error('offline'); },
      sanitizeError: (provider: string, error: any) => `${provider}: ${error.message}`,
    },
  });
  const result = await service.generateVocabulary('animals', 'primary', 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].isFallback, true);
  assert.equal(result[0].aiProvider, 'fallback');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GoogleGenAI } from '@google/genai';
import { createSpeakingFeedbackConfiguration } from './feedback';
import { SpeakingError, type Assessment } from '../../shared/speaking/types';

const assessment: Assessment = { schemaVersion: 1, provider: 'azure', providerVersion: 'fixture', rubricVersion: 'reading-v1', score: 82, accuracy: 85, providerOverall: null, fluency: 80, completeness: 75, prosody: null, rhythm: null, transcript: 'Read this sentence.', words: [], warnings: [], elapsedMs: 100 };
const attempt = { lesson: { referenceText: 'Read this sentence.', locale: 'en-US' as const }, assessment };
const valid = { summary: 'Luyện đọc rõ từng từ.', strengths: ['Đọc rõ.'], improvements: ['Chú ý âm cuối.'], practice: ['Lặp lại câu.'], holisticScore: null };
const noGemini = () => { throw new Error('Unexpected Gemini invocation'); };
const forbiddenFetch: typeof fetch = async () => { throw new Error('Unexpected network invocation'); };
const config = (provider: string, fetchImpl: typeof fetch = forbiddenFetch, extra: Record<string, string> = {}) => createSpeakingFeedbackConfiguration({ env: { SPEAKING_FEEDBACK_PROVIDER: provider, ...extra }, getGeminiClient: noGemini, devQuotaApiKey: 'fixture-only-devquota', staliApiKey: 'fixture-only-stali', fetchImpl });

test('DevQuota uses B Responses contract with only grading evidence, never audio or student identity', async () => {
  let calls = 0;
  const before = structuredClone(assessment);
  const selected = config('devquota', async (url, init) => {
    calls++; assert.equal(url, 'https://sv.devquote.shop/v1/responses');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer fixture-only-devquota');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'gpt-5.6-sol'); assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.properties.holisticScore.type, 'null');
    assert.deepEqual(body.input[0].content.map((v: { type: string }) => v.type), ['input_text']);
    assert.ok(!String(init?.body).includes('private-student-name')); assert.ok(!String(init?.body).includes('private-wav'));
    return Response.json({ output: [{ content: [{ text: JSON.stringify(valid) }] }] });
  });
  assert.equal(selected.capability.configured, true); assert.equal(selected.capability.provider, 'devquota');
  const evidenceWithPrivateFields = { ...attempt, studentName: 'private-student-name' };
  const result = await selected.feedback!(evidenceWithPrivateFields, Buffer.from('private-wav'));
  assert.deepEqual(result, { ...valid, evidenceMode: 'metrics' }); assert.deepEqual(assessment, before); assert.equal(calls, 1);
});

test('Stali uses B Chat Completions contract and its own selected key/model/base URL', async () => {
  let calls = 0;
  const selected = createSpeakingFeedbackConfiguration({ env: { SPEAKING_FEEDBACK_PROVIDER: 'stali', SPEAKING_FEEDBACK_MODEL: 'fixture-authorized-model' }, getGeminiClient: noGemini, staliApiKey: 'fixture-only-stali', staliBaseUrl: 'https://stali.fixture.invalid/v1/', fetchImpl: async (url, init) => {
    calls++; assert.equal(url, 'https://stali.fixture.invalid/v1/chat/completions');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer fixture-only-stali');
    const body = JSON.parse(String(init?.body)); assert.equal(body.model, 'fixture-authorized-model'); assert.equal(body.stream, false);
    assert.equal(body.messages[0].role, 'system'); assert.equal(body.messages[1].role, 'user');
    assert.match(body.messages[1].content, /Read this sentence/); assert.match(body.messages[1].content, /JSON SCHEMA/);
    return Response.json({ choices: [{ message: { content: [{ type: 'text', text: JSON.stringify({ ...valid, holisticScore: 100 }) }] } }] });
  } });
  assert.equal((await selected.feedback!(attempt, Buffer.alloc(10))).holisticScore, null); assert.equal(calls, 1);
});

test('Gateway errors do not expose vendor bodies, change Azure grade, retry or silently call another provider', async () => {
  let calls = 0;
  const selected = config('devquota', async () => { calls++; return new Response('fixture-only-vendor-private-data', { status: 401 }); });
  await assert.rejects(selected.feedback!(attempt, Buffer.alloc(0)), (e: unknown) => e instanceof SpeakingError && e.code === 'FEEDBACK_PROVIDER' && !e.message.includes('private-data'));
  assert.equal(calls, 1); assert.equal(assessment.score, 82);
});

test('Feedback runtime validation rejects malformed JSON, null/object/arrays and invalid bounded fields', async () => {
  for (const raw of ['not-json', 'null', '[]', '{}', JSON.stringify({ ...valid, summary: ' ' }), JSON.stringify({ ...valid, improvements: Array(6).fill('x') }), JSON.stringify({ ...valid, practice: [3] }), JSON.stringify({ ...valid, holisticScore: 101 }), JSON.stringify({ ...valid, summary: 'x'.repeat(33000) })]) {
    const selected = config('stali', async () => Response.json({ choices: [{ message: { content: raw } }] }));
    await assert.rejects(selected.feedback!(attempt, Buffer.alloc(0)), (e: unknown) => e instanceof SpeakingError && e.code === 'FEEDBACK_RESPONSE');
  }
});

test('Gateway request is aborted at the configured deadline without a second billed call', async () => {
  let calls = 0;
  const selected = createSpeakingFeedbackConfiguration({ env: { SPEAKING_FEEDBACK_PROVIDER: 'devquota' }, getGeminiClient: noGemini, devQuotaApiKey: 'fixture-only-devquota', timeoutMs: 10, fetchImpl: async (_url, init) => {
    calls++; await new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('fixture timeout')), { once: true })); return Response.json({});
  } });
  await assert.rejects(selected.feedback!(attempt, Buffer.alloc(0)), (e: unknown) => e instanceof SpeakingError && /hết thời gian/.test(e.message));
  assert.equal(calls, 1);
});

test('Only the explicitly selected credentials configure feedback; none/unknown/audio gateway remain disabled', () => {
  for (const id of ['devquota', 'stali']) {
    const missing = createSpeakingFeedbackConfiguration({ env: { SPEAKING_FEEDBACK_PROVIDER: id, GEMINI_API_KEY: 'fixture-only-gemini' }, getGeminiClient: noGemini });
    assert.equal(missing.capability.configured, false); assert.equal(missing.feedback, undefined);
    const audio = config(id, forbiddenFetch, { SPEAKING_FEEDBACK_MODE: 'audio' });
    assert.equal(audio.capability.configured, false); assert.equal(audio.feedback, undefined); assert.match(audio.capability.reason!, /metrics/);
  }
  for (const id of ['none', 'unknown']) { const disabled = config(id); assert.equal(disabled.capability.configured, false); assert.equal(disabled.feedback, undefined); }
  assert.equal(config('devquota', forbiddenFetch, { SPEAKING_FEEDBACK_MODE: 'unknown' }).capability.configured, false);
  const publicConfig = JSON.stringify(config('stali').capability); assert.ok(!publicConfig.includes('fixture-only-')); assert.ok(!publicConfig.includes('https://'));
});

test('Unsafe gateway configuration and invalid model are reported without sending a request', () => {
  for (const baseUrl of ['http://gateway.invalid/v1', 'https://user:pass@gateway.invalid/v1', 'https://gateway.invalid/v1?key=fixture-only-value', 'not-a-url']) {
    const selected = createSpeakingFeedbackConfiguration({ env: { SPEAKING_FEEDBACK_PROVIDER: 'stali' }, getGeminiClient: noGemini, staliApiKey: 'fixture-only-stali', staliBaseUrl: baseUrl, fetchImpl: forbiddenFetch });
    assert.equal(selected.capability.configured, false); assert.equal(selected.feedback, undefined); assert.ok(!JSON.stringify(selected.capability).includes('fixture-only-value'));
  }
  assert.equal(config('devquota', forbiddenFetch, { SPEAKING_FEEDBACK_MODEL: 'invalid\nmodel' }).capability.configured, false);
});

test('Missing and oversized assessment evidence fail before any paid request', async () => {
  const selected = config('devquota');
  await assert.rejects(selected.feedback!({ ...attempt, assessment: null }, Buffer.alloc(0)), (e: unknown) => e instanceof SpeakingError && e.status === 409);
  await assert.rejects(selected.feedback!({ ...attempt, assessment: { ...assessment, transcript: 'x'.repeat(512 * 1024) } }, Buffer.alloc(0)), (e: unknown) => e instanceof SpeakingError && e.status === 413);
});

test('Existing explicit Gemini audio setup remains compatible when provider flag is omitted', async () => {
  let calls = 0;
  const gemini = { models: { generateContent: async (input: { contents: { parts: unknown[] }[] }) => { calls++; assert.equal(input.contents[0].parts.length, 2); return { text: JSON.stringify({ ...valid, holisticScore: 90 }) }; } } } as unknown as GoogleGenAI;
  const selected = createSpeakingFeedbackConfiguration({ env: { GEMINI_API_KEY: 'fixture-only-gemini', SPEAKING_FEEDBACK_MODEL: 'fixture-gemini-model', SPEAKING_FEEDBACK_MODE: 'audio' }, getGeminiClient: () => gemini, fetchImpl: forbiddenFetch });
  assert.equal(selected.capability.provider, 'gemini'); assert.equal((await selected.feedback!(attempt, Buffer.from('fixture-wav'))).holisticScore, 90); assert.equal(calls, 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStaliVisionRequest,
  extractStaliChatCompletionText,
  generateWithStaliVision,
  getStaliSmartImportProviders,
  resolveStaliVisionModel,
  STALI_DEFAULT_BASE_URL,
} from './staliProvider';

const options = {
  preferredProvider: 'stali:gpt-5.6-luna',
  responseJsonSchema: {
    type: 'object',
    properties: { warnings: { type: 'array', items: { type: 'string' } } },
    required: ['warnings'],
  },
  schemaName: 'listening_test_schema',
  requestId: 'request-test',
  attempt: 1,
};

const images = [{
  assetId: 'asset-question',
  role: 'question' as const,
  mimeType: 'image/png',
  data: Buffer.from('fixture-image'),
}];

test('Stali Smart Import registry exposes the requested models and enables only configured Vision models', () => {
  const withoutKey = getStaliSmartImportProviders(undefined);
  assert.deepEqual(withoutKey.map(provider => provider.model), [
    'deepseek-v4-pro',
    'gpt-5.6-luna',
    'gpt-5.6-sol',
    'gpt-5.6-terra',
  ]);
  assert.ok(withoutKey.every(provider => !provider.enabled));

  const withKey = getStaliSmartImportProviders('server-only-key');
  assert.equal(withKey.find(provider => provider.model === 'deepseek-v4-pro')?.enabled, false);
  assert.match(withKey.find(provider => provider.model === 'deepseek-v4-pro')?.reason || '', /không hỗ trợ ảnh/);
  assert.equal(withKey.find(provider => provider.model === 'gpt-5.6-luna')?.enabled, true);
  assert.equal(withKey.find(provider => provider.model === 'gpt-5.6-sol')?.enabled, true);
  assert.equal(withKey.find(provider => provider.model === 'gpt-5.6-terra')?.enabled, true);
  assert.equal(resolveStaliVisionModel('stali:deepseek-v4-pro'), undefined);
});

test('Stali vision request keeps role-labelled images and the required JSON schema', () => {
  const payload = buildStaliVisionRequest('gpt-5.6-luna', 'Analyze these sources.', images, options);
  assert.equal(payload.model, 'gpt-5.6-luna');
  const content = payload.messages[1].content as Array<any>;
  assert.equal(content[1].text, 'IMAGE ROLE: question');
  assert.match(content[2].image_url.url, /^data:image\/png;base64,/);
  assert.match(content[0].text, /REQUIRED JSON SCHEMA \(listening_test_schema\)/);
  assert.match(content[0].text, /"required":\["warnings"\]/);
});

test('Stali adapter calls the documented OpenAI-compatible endpoint and returns selected model metadata', async () => {
  let calledUrl = '';
  let authorization = '';
  let postedModel = '';
  const result = await generateWithStaliVision({
    providerId: 'stali:gpt-5.6-terra',
    prompt: 'Analyze.',
    images,
    options: { ...options, preferredProvider: 'stali:gpt-5.6-terra' },
    apiKey: 'server-only-key',
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      calledUrl = String(url);
      authorization = String((init?.headers as Record<string, string>)?.Authorization || '');
      postedModel = JSON.parse(String(init?.body)).model;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"warnings":[]}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
  });

  assert.equal(calledUrl, `${STALI_DEFAULT_BASE_URL}/chat/completions`);
  assert.equal(authorization, 'Bearer server-only-key');
  assert.equal(postedModel, 'gpt-5.6-terra');
  assert.deepEqual(result, {
    text: '{"warnings":[]}',
    provider: 'stali:gpt-5.6-terra',
    model: 'gpt-5.6-terra',
  });
});

test('Stali text extraction accepts string and OpenAI content-part responses', () => {
  assert.equal(extractStaliChatCompletionText({ choices: [{ message: { content: '  {"ok":true}  ' } }] }), '{"ok":true}');
  assert.equal(extractStaliChatCompletionText({ choices: [{ message: { content: [{ type: 'text', text: '{"ok":' }, { type: 'text', text: 'true}' }] } }] }), '{"ok":\ntrue}');
});

test('Stali adapter rejects non-Vision models before making a request', async () => {
  let called = false;
  await assert.rejects(() => generateWithStaliVision({
    providerId: 'stali:deepseek-v4-pro',
    prompt: 'Analyze.',
    images,
    options,
    apiKey: 'server-only-key',
    fetchImpl: (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch,
  }), /không hỗ trợ Smart Import bằng ảnh/);
  assert.equal(called, false);
});

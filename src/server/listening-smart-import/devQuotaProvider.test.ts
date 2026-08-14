import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDevQuotaVisionRequest,
  DEVQUOTA_DEFAULT_BASE_URL,
  DEVQUOTA_PROVIDER_ID,
  extractDevQuotaResponseText,
  generateWithDevQuotaVision,
  getDevQuotaSmartImportProviders,
} from './devQuotaProvider';

const options = {
  preferredProvider: DEVQUOTA_PROVIDER_ID,
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

test('DevQuota registry exposes only ChatGPT 5.6 Sol and keeps the key server-side', () => {
  assert.deepEqual(getDevQuotaSmartImportProviders(undefined).map(provider => ({
    id: provider.id,
    model: provider.model,
    enabled: provider.enabled,
  })), [{ id: DEVQUOTA_PROVIDER_ID, model: 'gpt-5.6-sol', enabled: false }]);
  assert.deepEqual(getDevQuotaSmartImportProviders('server-only-key').map(provider => [provider.id, provider.enabled]), [
    [DEVQUOTA_PROVIDER_ID, true],
  ]);
  assert.equal(JSON.stringify(getDevQuotaSmartImportProviders('server-only-key')).includes('server-only-key'), false);
});

test('DevQuota Responses request keeps role-labelled image input and JSON schema', () => {
  const payload = buildDevQuotaVisionRequest('Analyze these sources.', images, options);
  assert.equal(payload.model, 'gpt-5.6-sol');
  const content = payload.input[0].content as Array<any>;
  assert.equal(content[1].text, 'IMAGE ROLE: question');
  assert.match(content[2].image_url, /^data:image\/png;base64,/);
  assert.equal(content[2].detail, 'high');
  assert.equal(payload.text.format.name, 'listening_test_schema');
  assert.deepEqual(payload.text.format.schema, options.responseJsonSchema);
});

test('DevQuota adapter calls the documented Responses endpoint with bearer auth', async () => {
  let calledUrl = '';
  let authorization = '';
  let postedModel = '';
  const result = await generateWithDevQuotaVision({
    providerId: DEVQUOTA_PROVIDER_ID,
    prompt: 'Analyze.',
    images,
    options,
    apiKey: 'server-only-key',
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      calledUrl = String(url);
      authorization = String((init?.headers as Record<string, string>)?.Authorization || '');
      postedModel = JSON.parse(String(init?.body)).model;
      return new Response(JSON.stringify({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{"warnings":[]}' }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch,
  });

  assert.equal(calledUrl, `${DEVQUOTA_DEFAULT_BASE_URL}/responses`);
  assert.equal(authorization, 'Bearer server-only-key');
  assert.equal(postedModel, 'gpt-5.6-sol');
  assert.deepEqual(result, {
    text: '{"warnings":[]}',
    provider: DEVQUOTA_PROVIDER_ID,
    model: 'gpt-5.6-sol',
  });
});

test('DevQuota text extraction accepts output_text shortcut and response content parts', () => {
  assert.equal(extractDevQuotaResponseText({ output_text: '  {"ok":true}  ' }), '{"ok":true}');
  assert.equal(extractDevQuotaResponseText({ output: [{ content: [{ text: '{"ok":' }, { text: 'true}' }] }] }), '{"ok":\ntrue}');
});

test('DevQuota adapter rejects unknown provider IDs before making a request', async () => {
  let called = false;
  await assert.rejects(() => generateWithDevQuotaVision({
    providerId: 'devquota:gpt-5.6-terra',
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

test('DevQuota adapter rejects a non-HTTPS base URL', async () => {
  await assert.rejects(() => generateWithDevQuotaVision({
    providerId: DEVQUOTA_PROVIDER_ID,
    prompt: 'Analyze.',
    images,
    options,
    apiKey: 'server-only-key',
    baseUrl: 'http://devquota.invalid/v1',
  }), /phải dùng HTTPS/);
});

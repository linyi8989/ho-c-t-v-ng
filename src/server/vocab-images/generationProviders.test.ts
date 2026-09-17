import assert from "node:assert/strict";
import test from "node:test";
import {
  createVocabImageGenerationProviders,
  DEVQUOTA_IMAGE_MODEL,
  SEEDVIS_NANO_BANANA_2_MODEL,
  SEEDVIS_NANO_BANANA_PRO_MODEL,
  STALI_IMAGE_MODEL,
} from "./generationProviders";

const pngBase64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString("base64");

test("generation provider registry uses only the requested exact models and keeps keys private", () => {
  const providers = createVocabImageGenerationProviders({ STALI_API_KEY: "stali-secret", DEVQUOTA_API_KEY: "dev-secret", SEEDVIS_API_KEY: "seedvis-secret" });
  assert.equal(providers.stali.model, "req/gpt-image-2");
  assert.equal(providers.devquota.model, "gpt-image-2");
  assert.equal(STALI_IMAGE_MODEL, "req/gpt-image-2");
  assert.equal(DEVQUOTA_IMAGE_MODEL, "gpt-image-2");
  assert.equal(providers["seedvis-nano-banana-2"].model, "NARWHAL");
  assert.equal(providers["seedvis-nano-banana-pro"].model, "GEM_PIX_2");
  assert.equal(SEEDVIS_NANO_BANANA_2_MODEL, "NARWHAL");
  assert.equal(SEEDVIS_NANO_BANANA_PRO_MODEL, "GEM_PIX_2");
  assert.deepEqual(Object.keys(providers), ["stali", "devquota", "seedvis-nano-banana-2", "seedvis-nano-banana-pro"]);
  assert.equal(JSON.stringify(Object.values(providers).map(({ id, label, model, configured }) => ({ id, label, model, configured }))).includes("secret"), false);
});

test("Seedvis uses native generation lifecycle with fixed 4:3, one output and no resubmission", async () => {
  const calls: Array<{ url: string; method: string; authorization: string; idempotency: string; body?: any }> = [];
  const providers = createVocabImageGenerationProviders({ SEEDVIS_API_KEY: "seedvis-secret" }, (async (url, init) => {
    calls.push({
      url: String(url),
      method: String(init?.method || "GET"),
      authorization: String((init?.headers as Record<string, string>)?.Authorization || ""),
      idempotency: String((init?.headers as Record<string, string>)?.["Idempotency-Key"] || ""),
      ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
    });
    if (String(init?.method) === "POST") {
      return new Response(JSON.stringify({
        success: true,
        status: 202,
        data: {
          id: "seedvis-request-1",
          status: "queued",
          is_final: false,
          next: { action: "poll", url: "https://seedvis.com/api/v1/developer/generations/seedvis-request-1?wait=60" },
          outputs: [],
        },
      }), { status: 202, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      success: true,
      status: 200,
      data: {
        id: "seedvis-request-1",
        status: "completed",
        is_final: true,
        next: { action: "done" },
        outputs: [{ type: "image", url: "https://cdn.seedvis.com/results/bully.png" }],
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch);

  const generated = await providers["seedvis-nano-banana-2"].generate("Create bully flashcard");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://seedvis.com/api/v1/developer/generations");
  assert.equal(calls[0].authorization, "Bearer seedvis-secret");
  assert.match(calls[0].idempotency, /^[0-9a-f-]{36}$/);
  assert.deepEqual(calls[0].body, {
    model: "NARWHAL",
    prompt: "Create bully flashcard",
    aspect_ratio: "4:3",
    count: 1,
  });
  assert.equal(calls[1].method, "GET");
  assert.equal(calls[1].idempotency, "");
  assert.equal(generated.remoteUrl, "https://cdn.seedvis.com/results/bully.png");
  assert.equal(generated.requestId, "seedvis-request-1");
});

test("Seedvis blocks poll and output URLs outside its documented boundaries", async () => {
  const providers = createVocabImageGenerationProviders({ SEEDVIS_API_KEY: "seedvis-secret" }, (async () => new Response(JSON.stringify({
    data: { id: "bad", status: "queued", is_final: false, next: { url: "https://attacker.test/poll" }, outputs: [] },
  }), { status: 202 })) as typeof fetch);
  await assert.rejects(() => providers["seedvis-nano-banana-pro"].generate("Draw"), /outside its API boundary/);
});

test("both providers call the OpenAI-compatible image generation endpoint with bearer auth", async () => {
  const calls: Array<{ url: string; authorization: string; body: any }> = [];
  const providers = createVocabImageGenerationProviders({
    STALI_API_KEY: "stali-secret",
    STALI_BASE_URL: "https://api.stali.vn/v1/",
    DEVQUOTA_API_KEY: "dev-secret",
    DEVQUOTA_BASE_URL: "https://sv.devquote.shop/v1/",
  }, (async (url, init) => {
    calls.push({
      url: String(url),
      authorization: String((init?.headers as Record<string, string>)?.Authorization || ""),
      body: JSON.parse(String(init?.body)),
    });
    return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch);

  const stali = await providers.stali.generate("Draw an apple");
  const devquota = await providers.devquota.generate("Draw a book");
  assert.equal(calls[0].url, "https://api.stali.vn/v1/images/generations");
  assert.equal(calls[0].authorization, "Bearer stali-secret");
  assert.deepEqual(calls[0].body, { model: "req/gpt-image-2", prompt: "Draw an apple", size: "1024x1024", n: 1 });
  assert.equal(calls[1].url, "https://sv.devquote.shop/v1/images/generations");
  assert.equal(calls[1].authorization, "Bearer dev-secret");
  assert.equal(calls[1].body.model, "gpt-image-2");
  assert.ok(stali.bytes);
  assert.ok(devquota.bytes);
  assert.equal(stali.bytes.toString("base64"), pngBase64);
  assert.equal(devquota.bytes.toString("base64"), pngBase64);
});

test("generation adapters reject missing keys, unsafe base URLs and malformed payloads", async () => {
  const withoutKeys = createVocabImageGenerationProviders({});
  assert.equal(withoutKeys.stali.configured, false);
  await assert.rejects(() => withoutKeys.stali.generate("Draw"), /STALI_API_KEY/);

  const unsafe = createVocabImageGenerationProviders({ STALI_API_KEY: "key", STALI_BASE_URL: "http://localhost:3000" });
  await assert.rejects(() => unsafe.stali.generate("Draw"), /HTTPS/);

  const malformed = createVocabImageGenerationProviders({ DEVQUOTA_API_KEY: "key" }, (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as typeof fetch);
  await assert.rejects(() => malformed.devquota.generate("Draw"), /image data/);
});

test("generation adapters replace raw fetch failures with an actionable server-network error", async () => {
  const providers = createVocabImageGenerationProviders({ STALI_API_KEY: "stali-secret" }, (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch);
  await assert.rejects(
    () => providers.stali.generate("Create one image"),
    /Không kết nối được tới Stali.*DNS, firewall hoặc quyền truy cập mạng của máy chủ/
  );
});

test("generation adapters unwrap provider JSON errors while preserving the request id", async () => {
  const providers = createVocabImageGenerationProviders({ DEVQUOTA_API_KEY: "dev-secret" }, (async () => new Response(JSON.stringify({
    error: {
      message: "Lỗi model hiện tại, thử lại sau hoặc liên hệ admin (request id: request-123)",
      type: "upstream_error",
    },
  }), { status: 503, headers: { "content-type": "application/json" } })) as typeof fetch);

  await assert.rejects(
    () => providers.devquota.generate("Create one image"),
    error => error instanceof Error
      && error.message === "DevQuota · GPT Image 2: Lỗi model hiện tại, thử lại sau hoặc liên hệ admin (request id: request-123)"
  );
});

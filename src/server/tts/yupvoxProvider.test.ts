import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeYupVoxAudioUrl,
  generateYupVoxAudioUrl,
  normalizeYupVoxBaseUrl
} from "./yupvoxProvider.js";

test("YupVox adapter creates a job, polls it, and returns the completed audio URL", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    new Response(JSON.stringify({ data: { jobId: "job 123" } }), { status: 200 }),
    new Response(JSON.stringify({ data: { status: "processing" } }), { status: 200 }),
    new Response(JSON.stringify({ data: { status: "completed", audioUrl: "https://cdn.yupvox.com/audio/job-123.mp3" } }), { status: 200 })
  ];
  const waits: number[] = [];

  const audioUrl = await generateYupVoxAudioUrl({
    apiKey: "test-secret",
    baseUrl: "https://api.yupvox.com/",
    voiceId: "EBF147",
    text: "Hello",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const response = responses.shift();
      if (!response) throw new Error("Unexpected fetch call");
      return response;
    },
    wait: async ms => { waits.push(ms); }
  });

  assert.equal(audioUrl, "https://cdn.yupvox.com/audio/job-123.mp3");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://api.yupvox.com/v1/tts");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer test-secret");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { voiceId: "EBF147", text: "Hello" });
  assert.equal(calls[1].url, "https://api.yupvox.com/v1/tts/job%20123");
  assert.deepEqual(waits, [1500]);
});

test("YupVox adapter surfaces a failed job without leaking the API key", async () => {
  const responses = [
    new Response(JSON.stringify({ data: { jobId: "failed-job" } }), { status: 200 }),
    new Response(JSON.stringify({ data: { status: "failed", message: "Voice unavailable" } }), { status: 200 })
  ];

  await assert.rejects(
    generateYupVoxAudioUrl({
      apiKey: "do-not-leak",
      voiceId: "EBF147",
      text: "Hello",
      fetchImpl: async () => responses.shift() as Response,
      wait: async () => undefined
    }),
    error => {
      assert.match(String(error), /Voice unavailable/);
      assert.doesNotMatch(String(error), /do-not-leak/);
      return true;
    }
  );
});

test("YupVox adapter stops polling after the configured maximum", async () => {
  let statusCalls = 0;
  const waits: number[] = [];
  await assert.rejects(
    generateYupVoxAudioUrl({
      apiKey: "test-secret",
      voiceId: "EBF147",
      text: "Hello",
      maxPollAttempts: 2,
      pollIntervalMs: 250,
      fetchImpl: async url => {
        if (url.endsWith("/v1/tts")) {
          return new Response(JSON.stringify({ data: { jobId: "slow-job" } }), { status: 200 });
        }
        statusCalls += 1;
        return new Response(JSON.stringify({ data: { status: "processing" } }), { status: 200 });
      },
      wait: async ms => { waits.push(ms); }
    }),
    /timed out/
  );
  assert.equal(statusCalls, 2);
  assert.deepEqual(waits, [250]);
});

test("YupVox URL validation requires public credential-free HTTPS URLs", () => {
  assert.equal(normalizeYupVoxBaseUrl(), "https://api.yupvox.com");
  assert.equal(
    assertSafeYupVoxAudioUrl("https://cdn.example.com/audio.mp3?token=1"),
    "https://cdn.example.com/audio.mp3?token=1"
  );
  assert.throws(() => normalizeYupVoxBaseUrl("http://api.yupvox.com"), /HTTPS/);
  assert.throws(() => assertSafeYupVoxAudioUrl("http://cdn.example.com/audio.mp3"), /HTTPS/);
  assert.throws(() => assertSafeYupVoxAudioUrl("https://127.0.0.1/audio.mp3"), /unsafe/);
  assert.throws(() => assertSafeYupVoxAudioUrl("https://[::1]/audio.mp3"), /unsafe/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { VocabImageLibraryService } from "./service";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const pngBase64 = png.toString("base64");

function createMemoryDb() {
  const values = new Map<string, any>();
  return {
    values,
    collection(name: string) {
      return {
        doc(id: string) {
          const key = `${name}/${id}`;
          return {
            async get() { return { exists: values.has(key), data: () => values.get(key) }; },
            async set(value: any) { values.set(key, value); },
          };
        },
        where(field: string, operator: string, expected: unknown) {
          assert.equal(operator, "==");
          return {
            async get() {
              const prefix = `${name}/`;
              const docs = Array.from(values.entries())
                .filter(([key, value]) => key.startsWith(prefix) && value?.[field] === expected)
                .map(([key, value]) => ({ id: key.slice(prefix.length), data: () => value }));
              return { empty: docs.length === 0, docs };
            },
          };
        },
      };
    },
  };
}

test("single generation persists a content-addressed managed asset", async () => {
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-generated-images-"));
  const db = createMemoryDb();
  const requests: any[] = [];
  const service = new VocabImageLibraryService({
    db,
    imageDir,
    publicPrefix: "/vocab-images",
    env: { STALI_API_KEY: "server-key" },
    fetchImpl: (async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), { status: 200 });
    }) as typeof fetch,
  });

  try {
    const result = await service.generate("stali", { term: "apple", meaning: "quả táo", partOfSpeech: "noun" }, "teacher-1");
    assert.equal(requests[0].model, "req/gpt-image-2");
    assert.match(requests[0].prompt, /English vocabulary term: "apple"/);
    assert.match(result.asset.id, /^vimg-[a-f0-9]{40}$/);
    assert.match(result.asset.storageKey, /^[a-f0-9]{64}\.png$/);
    assert.equal(result.asset.publicUrl, `/vocab-images/${result.asset.storageKey}`);
    assert.equal(result.asset.provider, "stali");
    assert.equal(result.asset.model, "req/gpt-image-2");
    assert.equal(fs.existsSync(path.join(imageDir, result.asset.storageKey)), true);
    assert.equal(db.values.get(`vocab_image_assets/${result.asset.id}`).createdBy, "teacher-1");
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

test("single generation sends the validated teacher-edited prompt unchanged to the selected provider", async () => {
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-custom-prompt-"));
  const requests: any[] = [];
  const service = new VocabImageLibraryService({
    db: createMemoryDb(),
    imageDir,
    publicPrefix: "/vocab-images",
    env: { STALI_API_KEY: "server-key" },
    fetchImpl: (async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), { status: 200 });
    }) as typeof fetch,
  });
  try {
    const defaultPrompt = service.getDefaultPrompt({ term: "truck", meaning: "xe tải", partOfSpeech: "noun" });
    assert.match(defaultPrompt, /English vocabulary term: "truck"/);
    const customPrompt = "  Create one blue delivery truck.\r\nNo text or watermark.  ";
    const result = await service.generate("stali", {
      term: "truck",
      meaning: "xe tải",
      partOfSpeech: "noun",
    }, "teacher-1", customPrompt);
    assert.equal(requests[0].prompt, "Create one blue delivery truck.\nNo text or watermark.");
    assert.equal(result.prompt, requests[0].prompt);
    assert.equal(result.asset.prompt, requests[0].prompt);
    await assert.rejects(
      () => service.generate("stali", { term: "truck" }, "teacher-1", "   "),
      /không được để trống/
    );
    assert.equal(requests.length, 1);
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

test("upload validates rights and image bytes before storing a local file", async () => {
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-upload-images-"));
  const service = new VocabImageLibraryService({
    db: createMemoryDb(),
    imageDir,
    publicPrefix: "/vocab-images",
    env: {},
  });
  try {
    await assert.rejects(() => service.upload({ bytes: png, declaredMimeType: "image/png", fileName: "apple.png", rightsConfirmed: false }, "teacher-1"), /quyền sử dụng/);
    await assert.rejects(() => service.upload({ bytes: Buffer.from("not-an-image"), declaredMimeType: "image/png", fileName: "bad.png", rightsConfirmed: true }, "teacher-1"), /định dạng ảnh/);
    const asset = await service.upload({ bytes: png, declaredMimeType: "image/png", fileName: "Ảnh quả táo.png", rightsConfirmed: true }, "teacher-1");
    assert.equal(asset.provider, "upload");
    assert.equal(asset.sourcePageUrl, undefined);
    assert.equal(asset.originalFileName, "Ảnh quả táo.png");
    assert.equal(asset.license, "Giáo viên xác nhận quyền sử dụng");
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

test("automatic batch generation alternates providers and preserves row-level errors", async () => {
  let request = 0;
  const service = new VocabImageLibraryService({
    db: createMemoryDb(),
    imageDir: fs.mkdtempSync(path.join(os.tmpdir(), "vocab-batch-images-")),
    publicPrefix: "/vocab-images",
    env: { STALI_API_KEY: "stali-key", DEVQUOTA_API_KEY: "dev-key", VOCAB_IMAGE_BATCH_CONCURRENCY_PER_PROVIDER: "2" },
    fetchImpl: (async () => {
      request += 1;
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), { status: 200 });
    }) as typeof fetch,
  });
  const rows = await service.batchGenerate("auto", [
    { id: "one", term: "apple", meaning: "quả táo", pos: "noun", prompt: "Batch must ignore this override" },
    { id: "two", term: "book", meaning: "quyển sách", pos: "noun" },
    { id: "bad", term: "", meaning: "trống", pos: "noun" },
  ], "teacher-1");
  assert.equal(request, 2);
  assert.equal(rows[0].provider, "stali");
  assert.equal(rows[1].provider, "devquota");
  assert.ok(rows[0].asset && rows[1].asset);
  assert.match(rows[0].prompt || "", /English vocabulary term: "apple"/);
  assert.doesNotMatch(rows[0].prompt || "", /ignore this override/);
  assert.match(rows[2].error || "", /Từ tiếng Anh/);
});

test("automatic batch uses an independent concurrency ceiling for each configured provider", async () => {
  const active = { stali: 0, devquota: 0 };
  const maximum = { stali: 0, devquota: 0 };
  let started = 0;
  let signalStarted!: () => void;
  let release!: () => void;
  const firstWaveStarted = new Promise<void>(resolve => { signalStarted = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-provider-concurrency-"));
  const service = new VocabImageLibraryService({
    db: createMemoryDb(),
    imageDir,
    publicPrefix: "/vocab-images",
    env: {
      STALI_API_KEY: "stali-key",
      DEVQUOTA_API_KEY: "dev-key",
      VOCAB_IMAGE_BATCH_CONCURRENCY_PER_PROVIDER: "2",
    },
    fetchImpl: (async input => {
      const provider = String(input).includes("api.stali.vn") ? "stali" : "devquota";
      active[provider] += 1;
      maximum[provider] = Math.max(maximum[provider], active[provider]);
      started += 1;
      if (started === 4) signalStarted();
      await gate;
      active[provider] -= 1;
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), { status: 200 });
    }) as typeof fetch,
  });

  try {
    const pending = service.batchGenerate("auto", Array.from({ length: 6 }, (_, index) => ({
      id: `word-${index + 1}`,
      term: `word-${index + 1}`,
      meaning: `nghĩa ${index + 1}`,
      pos: "noun",
    })), "teacher-1");
    await firstWaveStarted;
    assert.deepEqual(maximum, { stali: 2, devquota: 2 });
    release();
    const rows = await pending;
    assert.equal(rows.length, 6);
    assert.deepEqual(rows.map(row => row.provider), ["stali", "devquota", "stali", "devquota", "stali", "devquota"]);
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

test("automatic batch also applies a hosting-safe total concurrency ceiling", async () => {
  let active = 0;
  let maximum = 0;
  let started = 0;
  let signalStarted!: () => void;
  let release!: () => void;
  const firstWaveStarted = new Promise<void>(resolve => { signalStarted = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-total-concurrency-"));
  const service = new VocabImageLibraryService({
    db: createMemoryDb(),
    imageDir,
    publicPrefix: "/vocab-images",
    env: {
      STALI_API_KEY: "stali-key",
      DEVQUOTA_API_KEY: "dev-key",
      VOCAB_IMAGE_BATCH_CONCURRENCY_PER_PROVIDER: "50",
      VOCAB_IMAGE_BATCH_TOTAL_CONCURRENCY: "3",
    },
    fetchImpl: (async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      started += 1;
      if (started === 3) signalStarted();
      await gate;
      active -= 1;
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), { status: 200 });
    }) as typeof fetch,
  });

  try {
    const pending = service.batchGenerate("auto", Array.from({ length: 8 }, (_, index) => ({
      id: `word-${index + 1}`,
      term: `word-${index + 1}`,
      meaning: `nghĩa ${index + 1}`,
      pos: "noun",
    })), "teacher-1");
    await firstWaveStarted;
    assert.equal(maximum, 3);
    assert.equal(service.batchConcurrencyPerProvider, 50);
    assert.equal(service.batchTotalConcurrency, 3);
    release();
    assert.equal((await pending).length, 8);
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

test("background batch returns immediately and exposes durable incremental results to its owner", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-background-job-"));
  const service = new VocabImageLibraryService({
    db: createMemoryDb(),
    imageDir,
    publicPrefix: "/vocab-images",
    env: {
      STALI_API_KEY: "stali-key",
      VOCAB_IMAGE_BATCH_TOTAL_CONCURRENCY: "1",
    },
    fetchImpl: (async () => {
      await gate;
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), { status: 200 });
    }) as typeof fetch,
  });

  try {
    const started = await service.startBatchGenerationJob("auto", [
      { id: "apple", term: "apple", meaning: "quả táo", pos: "noun" },
      { id: "book", term: "book", meaning: "quyển sách", pos: "noun" },
    ], "teacher-1");
    assert.match(started.jobId, /^vimgjob-/);
    assert.equal(started.status, "queued");
    assert.equal(started.completed, 0);
    await assert.rejects(() => service.getBatchGenerationJob(started.jobId, "teacher-2"), /Không tìm thấy/);

    release();
    let completed = await service.getBatchGenerationJob(started.jobId, "teacher-1");
    for (let attempt = 0; attempt < 50 && completed.status !== "completed"; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
      completed = await service.getBatchGenerationJob(started.jobId, "teacher-1");
    }
    assert.equal(completed.status, "completed");
    assert.equal(completed.completed, 2);
    assert.equal(completed.succeeded, 2);
    assert.equal(completed.failed, 0);
    assert.deepEqual(completed.items.map((item: any) => item.id), ["apple", "book"]);
    assert.ok(completed.items.every((item: any) => item.asset?.publicUrl?.startsWith("/vocab-images/")));
    assert.ok(completed.items.every((item: any) => item.asset?.prompt === undefined));
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

test("an expired hosting worker lease resumes only unfinished batch rows", async () => {
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-resumed-job-"));
  const db = createMemoryDb();
  let requestCount = 0;
  const service = new VocabImageLibraryService({
    db,
    imageDir,
    publicPrefix: "/vocab-images",
    env: { STALI_API_KEY: "stali-key", VOCAB_IMAGE_BATCH_TOTAL_CONCURRENCY: "1" },
    fetchImpl: (async () => {
      requestCount += 1;
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), { status: 200 });
    }) as typeof fetch,
  });
  const jobId = "vimgjob-hosting-restart";
  const createdAt = new Date(Date.now() - 120_000).toISOString();
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
  db.values.set(`vocab_image_batch_jobs/${jobId}`, {
    id: jobId,
    actorId: "teacher-1",
    provider: "auto",
    status: "running",
    total: 2,
    completed: 1,
    succeeded: 1,
    failed: 0,
    inputs: [
      { id: "apple", term: "apple", meaning: "qua tao", pos: "noun" },
      { id: "book", term: "book", meaning: "quyen sach", pos: "noun" },
    ],
    leaseOwner: "worker-before-passenger-restart",
    leaseExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  });
  db.values.set(`vocab_image_batch_job_results/${jobId}:0`, {
    id: `${jobId}:0`,
    jobId,
    index: 0,
    result: {
      id: "apple",
      provider: "stali",
      asset: {
        id: "vimg-existing",
        provider: "stali",
        externalId: "existing",
        title: "apple",
        author: "AI",
        license: "generated",
        publicUrl: "/vocab-images/existing.png",
      },
    },
    createdAt,
    expiresAt,
  });

  try {
    let resumed = await service.getBatchGenerationJob(jobId, "teacher-1");
    for (let attempt = 0; attempt < 50 && resumed.status !== "completed"; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
      resumed = await service.getBatchGenerationJob(jobId, "teacher-1");
    }
    assert.equal(resumed.status, "completed");
    assert.equal(resumed.completed, 2);
    assert.equal(resumed.succeeded, 2);
    assert.equal(requestCount, 1);
    assert.deepEqual(resumed.items.map((item: any) => item.id), ["apple", "book"]);
    assert.equal(resumed.items[0].asset.publicUrl, "/vocab-images/existing.png");
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

test("batch accepts the whole vocabulary list beyond the former 100-item cutoff", async () => {
  let requestCount = 0;
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-full-batch-"));
  const service = new VocabImageLibraryService({
    db: createMemoryDb(),
    imageDir,
    publicPrefix: "/vocab-images",
    env: {
      STALI_API_KEY: "stali-key",
      DEVQUOTA_API_KEY: "dev-key",
      VOCAB_IMAGE_BATCH_CONCURRENCY_PER_PROVIDER: "50",
      VOCAB_IMAGE_BATCH_MAX_ITEMS: "500",
    },
    fetchImpl: (async () => {
      requestCount += 1;
      return new Response(JSON.stringify({ data: [{ b64_json: pngBase64 }] }), { status: 200 });
    }) as typeof fetch,
  });

  try {
    const input = Array.from({ length: 101 }, (_, index) => ({ id: `word-${index}`, term: `word-${index}`, pos: "noun" }));
    const rows = await service.batchGenerate("auto", input, "teacher-1");
    assert.equal(rows.length, 101);
    assert.equal(requestCount, 101);
    assert.equal(service.batchConcurrencyPerProvider, 50);
    assert.equal(service.batchTotalConcurrency, 8);
    assert.equal(service.batchMaxItems, 500);
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

test("Seedvis final CDN output is securely downloaded into managed storage", async () => {
  const imageDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-seedvis-images-"));
  const service = new VocabImageLibraryService({
    db: createMemoryDb(),
    imageDir,
    publicPrefix: "/vocab-images",
    env: { SEEDVIS_API_KEY: "seedvis-key" },
    resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchImpl: (async (input, init) => {
      const url = String(input);
      if (url === "https://seedvis.com/api/v1/developer/generations") {
        const request = JSON.parse(String(init?.body));
        assert.deepEqual({ model: request.model, aspect_ratio: request.aspect_ratio, count: request.count }, {
          model: "GEM_PIX_2",
          aspect_ratio: "4:3",
          count: 1,
        });
        return new Response(JSON.stringify({ data: {
          id: "seedvis-pro-1",
          status: "completed",
          is_final: true,
          outputs: [{ type: "image", url: "https://cdn.seedvis.com/results/bully.png" }],
        } }), { status: 200 });
      }
      assert.equal(url, "https://cdn.seedvis.com/results/bully.png");
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    }) as typeof fetch,
  });
  try {
    const result = await service.generate("seedvis-nano-banana-pro", {
      term: "bully",
      meaning: "bắt nạt",
      partOfSpeech: "động từ - v",
    }, "teacher-1");
    assert.equal(result.provider, "seedvis-nano-banana-pro");
    assert.equal(result.model, "GEM_PIX_2");
    assert.equal(result.asset.mimeType, "image/png");
    assert.equal(fs.existsSync(path.join(imageDir, result.asset.storageKey)), true);
  } finally {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }
});

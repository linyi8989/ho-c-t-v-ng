import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routerSource = readFileSync(new URL("./router.ts", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
const providerSource = readFileSync(new URL("./generationProviders.ts", import.meta.url), "utf8");
const saveSource = readFileSync(new URL("./saveReferences.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../../../server.ts", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../../lib/sqliteStorage.ts", import.meta.url), "utf8");

test("image generation and upload routes are staff-only and old search routes are gone", () => {
  assert.match(routerSource, /router\.use\(options\.authenticateUser, options\.requireStaff\)/);
  for (const route of ["/providers", "/prompt", "/generate", "/batch-generate", "/upload"]) {
    assert.ok(routerSource.includes(`"${route}"`), `missing route ${route}`);
  }
  assert.match(routerSource, /router\.get\("\/batch-generate\/:jobId", jobStatusRateLimit/);
  assert.match(routerSource, /startBatchGenerationJob/);
  assert.match(routerSource, /res\.status\(202\)\.json\(job\)/);
  for (const removed of ["/search", "/preview/:token", "/batch-preview", "/import", "/batch-import"]) {
    assert.equal(routerSource.includes(`"${removed}"`), false, `obsolete route remains: ${removed}`);
  }
  assert.match(routerSource, /express\.raw/);
  assert.match(routerSource, /GENERATE_VOCAB_IMAGE/);
  assert.match(routerSource, /UPLOAD_VOCAB_IMAGE/);
  assert.match(routerSource, /getDefaultPrompt\(req\.body\)/);
  assert.match(routerSource, /req\.body\?\.prompt/);
});

test("generation uses only Stali and DevQuota exact requested models then stores managed bytes", () => {
  assert.match(providerSource, /req\/gpt-image-2/);
  assert.match(providerSource, /DEVQUOTA_IMAGE_MODEL = "gpt-image-2"/);
  assert.match(providerSource, /SEEDVIS_NANO_BANANA_2_MODEL = "NARWHAL"/);
  assert.match(providerSource, /SEEDVIS_NANO_BANANA_PRO_MODEL = "GEM_PIX_2"/);
  assert.match(providerSource, /aspect_ratio: "4:3"/);
  assert.match(providerSource, /count: 1/);
  assert.match(providerSource, /Idempotency-Key/);
  assert.match(providerSource, /is_final/);
  assert.match(providerSource, /\/images\/generations/);
  assert.doesNotMatch(providerSource, /Wikimedia|Pixabay|Pexels/i);
  assert.match(serviceSource, /createHash\("sha256"\)\.update\(input\.bytes\)/);
  assert.match(serviceSource, /\.tmp-/);
  assert.match(serviceSource, /VOCAB_IMAGE_BATCH_CONCURRENCY_PER_PROVIDER, 50, 1, 50/);
  assert.match(serviceSource, /VOCAB_IMAGE_BATCH_TOTAL_CONCURRENCY, 8, 1, 100/);
  assert.match(serviceSource, /createConcurrencyLimiter\(this\.batchConcurrencyPerProvider\)/);
  assert.match(serviceSource, /createConcurrencyLimiter\(this\.batchTotalConcurrency\)/);
  assert.match(serviceSource, /Promise\.all\(items\.map/);
  assert.match(serviceSource, /vocab_image_batch_jobs/);
  assert.match(serviceSource, /vocab_image_batch_job_results/);
  assert.match(serverSource, /app\.use\(VOCAB_IMAGE_PUBLIC_PREFIX, express\.static\(VOCAB_IMAGE_DIR/);
});

test("vocabulary saves resolve new and legacy managed asset IDs server-side", () => {
  assert.match(serverSource, /resolveVocabImageReferencesForSave/);
  assert.match(saveSource, /db\.collection\("vocab_image_assets"\)\.doc\(imageAssetId\)\.get\(\)/);
  assert.match(saveSource, /external image URLs cannot be added directly/);
  assert.match(storageSource, /VOCAB_IMAGE_PROVIDER_SCHEMA_MIGRATION_ID/);
  assert.match(storageSource, /VOCAB_IMAGE_SEEDVIS_PROVIDER_SCHEMA_MIGRATION_ID/);
  assert.match(storageSource, /INSERT INTO vocab_image_assets_v2/);
});

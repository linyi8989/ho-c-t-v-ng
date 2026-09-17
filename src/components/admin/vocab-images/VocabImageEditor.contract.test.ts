import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardSource = readFileSync(new URL("../AdminDashboard.tsx", import.meta.url), "utf8");
const thumbnailSource = readFileSync(new URL("./VocabImageThumbnail.tsx", import.meta.url), "utf8");
const generateSource = readFileSync(new URL("./VocabImageGenerateDialog.tsx", import.meta.url), "utf8");

test("editor exposes automatic batch, single regenerate, clipboard and local-upload image workflows", () => {
  assert.match(dashboardSource, /id="batch-generate-vocab-images-btn"/);
  assert.match(dashboardSource, /\/api\/image-library\/generate/);
  assert.match(dashboardSource, /\/api\/image-library\/batch-generate/);
  assert.match(dashboardSource, /\/api\/image-library\/upload/);
  assert.match(dashboardSource, /navigator\.clipboard\.read/);
  assert.doesNotMatch(dashboardSource, /xác nhận có quyền sử dụng ảnh (?:này|đang có trong clipboard)/);
  assert.match(thumbnailSource, /item\.imageUrl \? "Tạo lại" : "Tạo"/);
  assert.match(thumbnailSource, />Dán</);
  assert.match(thumbnailSource, />Tải</);
  assert.match(thumbnailSource, /accept="image\/jpeg,image\/png,image\/webp,image\/gif"/);
  assert.match(generateSource, /Tạo ảnh cho/);
  assert.match(generateSource, /Prompt gửi tới AI/);
  assert.match(generateSource, /onLoadPrompt\(item\)/);
  assert.match(generateSource, /onGenerate\(providerId, item, prompt\)/);
  assert.match(generateSource, /Khôi phục mặc định/);
  assert.match(generateSource, /maxLength=\{8000\}/);
  assert.match(dashboardSource, /\/api\/image-library\/prompt/);
  assert.match(dashboardSource, /prompt,/);
  assert.match(dashboardSource, /handleGenerateAllVocabImages/);
  assert.match(dashboardSource, /generateVocabImagesBatch\('auto', targetItems\)/);
  assert.match(dashboardSource, /applyVocabImageBatchResults\(results\)/);
  assert.doesNotMatch(dashboardSource, /VocabImageBatchGenerationDialog/);
});

test("new UI contains only AI generation providers and no image-search services", () => {
  for (const source of [dashboardSource, generateSource]) {
    assert.doesNotMatch(source, /\/api\/image-library\/search/);
    assert.doesNotMatch(source, /image-library\/(?:batch-preview|batch-import)/);
    assert.doesNotMatch(source, /Wikimedia|Pixabay|Pexels/i);
  }
  assert.match(generateSource, /provider\.model/);
  assert.match(generateSource, /Seedvis|provider\.label/);
});

test("editor image previews keep consistent 4:3 contain frames and term changes detach metadata", () => {
  assert.match(thumbnailSource, /h-\[72px\] w-\[96px\]/);
  assert.match(thumbnailSource, /object-contain/);
  assert.match(generateSource, /h-72 w-96/);
  assert.match(dashboardSource, /delete updated\.imageAssetId/);
  assert.match(dashboardSource, /delete updated\.imageAttribution/);
  assert.match(dashboardSource, /if \(!asset\) return item/);
});

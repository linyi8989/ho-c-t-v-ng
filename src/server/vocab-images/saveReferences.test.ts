import assert from "node:assert/strict";
import test from "node:test";
import { resolveVocabImageReferencesForSave } from "./saveReferences";

const assetId = `vimg-${"a".repeat(40)}`;
const imageUrl = `/vocab-images/${"b".repeat(64)}.png`;
const asset = {
  id: assetId,
  provider: "wikimedia",
  externalId: "File:Apple.png",
  title: "Apple",
  author: "Author",
  license: "CC BY 4.0",
  sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Apple.png",
  publicUrl: imageUrl,
};

function dbWithAsset(value: any = asset) {
  return {
    collection(name: string) {
      assert.equal(name, "vocab_image_assets");
      return {
        doc(id: string) {
          return { async get() { return { exists: Boolean(value) && id === assetId, data: () => value }; } };
        },
      };
    },
  };
}

test("managed asset metadata is resolved authoritatively instead of trusting browser fields", async () => {
  const result = await resolveVocabImageReferencesForSave({ items: [{
    id: "word-1",
    term: "apple",
    imageAssetId: assetId,
    imageUrl: "https://attacker.test/fake.png",
    imageAttribution: { provider: "pexels", author: "forged" },
  }] }, {}, dbWithAsset(), () => new Date("2026-09-14T00:00:00.000Z"));
  assert.equal(result.items[0].imageUrl, imageUrl);
  assert.equal(result.items[0].imageAttribution.provider, "wikimedia");
  assert.equal(result.items[0].imageAttribution.author, "Author");
  assert.equal(result.items[0].imageAttachedAt, "2026-09-14T00:00:00.000Z");
});

test("new direct URLs are rejected while unchanged legacy URLs remain compatible", async () => {
  await assert.rejects(() => resolveVocabImageReferencesForSave({
    items: [{ id: "word-1", term: "apple", imageUrl: "https://external.test/apple.jpg" }],
  }, {}, dbWithAsset()), /cannot be added directly/);

  const legacy = await resolveVocabImageReferencesForSave({
    items: [{ id: "word-1", term: "apple", imageUrl: "https://legacy.example/apple.jpg" }],
  }, {
    items: [{ id: "word-1", term: "apple", imageUrl: "https://legacy.example/apple.jpg" }],
  }, dbWithAsset());
  assert.equal(legacy.items[0].imageUrl, "https://legacy.example/apple.jpg");
});

test("removal drops every image field without deleting the underlying asset", async () => {
  const result = await resolveVocabImageReferencesForSave({ items: [{ id: "word-1", term: "apple" }] }, {
    items: [{ id: "word-1", term: "apple", imageAssetId: assetId, imageUrl }],
  }, dbWithAsset());
  assert.equal(result.items[0].imageAssetId, undefined);
  assert.equal(result.items[0].imageUrl, undefined);
  assert.equal(result.items[0].imageAttribution, undefined);
});

test("generated and uploaded asset metadata are accepted without trusting the browser", async () => {
  const generated = { ...asset, provider: "stali", model: "req/gpt-image-2", sourcePageUrl: "https://api.stali.vn/docs" };
  const generatedResult = await resolveVocabImageReferencesForSave({ items: [{ id: "word-1", imageAssetId: assetId }] }, {}, dbWithAsset(generated));
  assert.equal(generatedResult.items[0].imageAttribution.provider, "stali");

  const uploaded = { ...asset, provider: "upload", sourcePageUrl: undefined, author: "Giáo viên tải lên", license: "Giáo viên xác nhận quyền sử dụng" };
  const uploadedResult = await resolveVocabImageReferencesForSave({ items: [{ id: "word-1", imageAssetId: assetId }] }, {}, dbWithAsset(uploaded));
  assert.equal(uploadedResult.items[0].imageAttribution.provider, "upload");
  assert.equal(uploadedResult.items[0].imageAttribution.sourcePageUrl, undefined);

  const seedvis = { ...asset, provider: "seedvis-nano-banana-2", model: "NARWHAL", sourcePageUrl: "https://seedvis.com/api-docs" };
  const seedvisResult = await resolveVocabImageReferencesForSave({ items: [{ id: "word-1", imageAssetId: assetId }] }, {}, dbWithAsset(seedvis));
  assert.equal(seedvisResult.items[0].imageAttribution.provider, "seedvis-nano-banana-2");
});

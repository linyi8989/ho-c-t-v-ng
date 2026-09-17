import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import {
  closeSQLiteStorage,
  getSQLiteDiagnostics,
  initializeSQLiteStorage,
  sqliteQueryOne,
  SQLiteFirestore,
} from "./sqliteStorage";

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-image-storage-"));
const databasePath = path.join(temporaryDirectory, "image-assets.sqlite");

process.env.STORAGE_MODE = "sqlite";
process.env.SQLITE_DRIVER = "sqljs";
process.env.SQLITE_DB_PATH = databasePath;
process.env.SQLITE_ALLOW_CREATE = "true";
process.env.SQLITE_ALLOW_JSON_IMPORT = "false";
process.env.SQLITE_BUSY_TIMEOUT_MS = "2000";
process.env.NODE_ENV = "test";

after(async () => {
  await closeSQLiteStorage();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("vocabulary image asset migration and facade work with metadata-only SQLite rows", async () => {
  await initializeSQLiteStorage();
  const table = await sqliteQueryOne<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    ["vocab_image_assets"]
  );
  assert.equal(table?.name, "vocab_image_assets");

  const db = new SQLiteFirestore();
  const asset = {
    id: `vimg-${"a".repeat(40)}`,
    provider: "wikimedia",
    externalId: "File:Apple.png",
    sha256: "b".repeat(64),
    mimeType: "image/png",
    storageKey: `${"b".repeat(64)}.png`,
    publicUrl: `/vocab-images/${"b".repeat(64)}.png`,
    title: "Apple",
    author: "Author",
    license: "CC BY 4.0",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Apple.png",
    createdBy: "teacher-1",
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  };
  await db.collection("vocab_image_assets").doc(asset.id).set(asset);
  const stored = await db.collection("vocab_image_assets").doc(asset.id).get();
  assert.equal(stored.exists, true);
  assert.equal(stored.data().storageKey, asset.storageKey);
  assert.equal("bytes" in stored.data(), false);

  const generatedAsset = {
    ...asset,
    id: `vimg-${"c".repeat(40)}`,
    provider: "stali",
    externalId: "request-generated",
    sha256: "d".repeat(64),
    storageKey: `${"d".repeat(64)}.png`,
    publicUrl: `/vocab-images/${"d".repeat(64)}.png`,
    model: "req/gpt-image-2",
  };
  await db.collection("vocab_image_assets").doc(generatedAsset.id).set(generatedAsset);
  const generatedStored = await db.collection("vocab_image_assets").doc(generatedAsset.id).get();
  assert.equal(generatedStored.data().provider, "stali");

  const seedvisAsset = {
    ...asset,
    id: `vimg-${"e".repeat(40)}`,
    provider: "seedvis-nano-banana-2",
    externalId: "seedvis-request-1",
    sha256: "f".repeat(64),
    storageKey: `${"f".repeat(64)}.png`,
    publicUrl: `/vocab-images/${"f".repeat(64)}.png`,
    model: "NARWHAL",
  };
  await db.collection("vocab_image_assets").doc(seedvisAsset.id).set(seedvisAsset);
  const seedvisStored = await db.collection("vocab_image_assets").doc(seedvisAsset.id).get();
  assert.equal(seedvisStored.data().provider, "seedvis-nano-banana-2");

  const diagnostics = await getSQLiteDiagnostics();
  assert.equal(diagnostics.tableCounts.vocab_image_assets, 3);
});

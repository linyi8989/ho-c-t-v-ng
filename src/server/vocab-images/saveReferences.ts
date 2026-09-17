export const MANAGED_VOCAB_IMAGE_ASSET_ID = /^vimg-[a-f0-9]{40}$/;
export const MANAGED_VOCAB_IMAGE_URL = /^\/vocab-images\/[a-f0-9]{64}\.(?:jpg|png|webp|gif)$/;

interface DocumentDatabase {
  collection(name: string): any;
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function safeText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

export function vocabImageAttributionFromAsset(asset: any) {
  const provider = safeText(asset?.provider, 40).toLowerCase();
  const externalId = safeText(asset?.externalId, 500);
  const title = safeText(asset?.title, 500);
  const author = safeText(asset?.author, 500);
  const license = safeText(asset?.license, 300);
  const sourcePageUrl = safeText(asset?.sourcePageUrl, 1000);
  const providersRequiringSource = [
    "wikimedia",
    "pixabay",
    "pexels",
    "stali",
    "devquota",
    "seedvis-nano-banana-2",
    "seedvis-nano-banana-pro",
  ];
  if (![...providersRequiringSource, "upload"].includes(provider)
    || !externalId
    || !title
    || !author
    || !license
    || (providersRequiringSource.includes(provider) && !/^https:\/\//i.test(sourcePageUrl))) {
    throw httpError(400, "Managed vocabulary image metadata is invalid.");
  }
  return {
    provider,
    externalId,
    title,
    author,
    license,
    ...(asset?.licenseUrl && /^https:\/\//i.test(String(asset.licenseUrl))
      ? { licenseUrl: safeText(asset.licenseUrl, 1000) }
      : {}),
    ...(sourcePageUrl ? { sourcePageUrl } : {}),
  };
}

export async function resolveVocabImageReferencesForSave(
  payload: any,
  existing: any,
  db: DocumentDatabase,
  now: () => Date = () => new Date()
) {
  if (!Array.isArray(payload?.items)) return payload;
  const existingItems = new Map(
    (Array.isArray(existing?.items) ? existing.items : []).map((item: any) => [String(item?.id || ""), item])
  );
  const items = await Promise.all(payload.items.slice(0, 500).map(async (rawItem: any, index: number) => {
    const item = { ...(rawItem || {}) };
    const previous: any = existingItems.get(String(item.id || ""));
    const imageAssetId = safeText(item.imageAssetId, 80);
    if (imageAssetId) {
      if (!MANAGED_VOCAB_IMAGE_ASSET_ID.test(imageAssetId)) {
        throw httpError(400, `Dong ${index + 1}: invalid managed image reference.`);
      }
      const assetDoc = await db.collection("vocab_image_assets").doc(imageAssetId).get();
      if (!assetDoc.exists) {
        throw httpError(400, `Dong ${index + 1}: managed image does not exist.`);
      }
      const asset = assetDoc.data() || {};
      const imageUrl = safeText(asset.publicUrl, 1000);
      if (asset.id !== imageAssetId || !MANAGED_VOCAB_IMAGE_URL.test(imageUrl)) {
        throw httpError(400, `Dong ${index + 1}: managed image storage metadata is invalid.`);
      }
      return {
        ...item,
        imageAssetId,
        imageUrl,
        imageAttribution: vocabImageAttributionFromAsset(asset),
        imageAttachedAt: previous?.imageAssetId === imageAssetId && previous?.imageAttachedAt
          ? safeText(previous.imageAttachedAt, 80)
          : now().toISOString(),
      };
    }

    const requestedLegacyUrl = safeText(item.imageUrl, 1000);
    if (requestedLegacyUrl) {
      if (!previous?.imageAssetId && previous?.imageUrl === requestedLegacyUrl) {
        delete item.imageAssetId;
        delete item.imageAttribution;
        delete item.imageAttachedAt;
        return item;
      }
      throw httpError(
        400,
        `Dong ${index + 1}: external image URLs cannot be added directly; import an image from the managed library.`
      );
    }

    delete item.imageAssetId;
    delete item.imageUrl;
    delete item.imageAttribution;
    delete item.imageAttachedAt;
    return item;
  }));
  return { ...payload, items };
}

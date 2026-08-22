const bytesToHex = (bytes: Uint8Array) => Array.from(bytes)
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('');

export async function hashMoverReadingWritingPart(value: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
}

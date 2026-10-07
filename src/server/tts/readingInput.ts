// Reading retains complete sentences and pauses; vocabulary cleanup remains unchanged.
export function normalizeReadingTtsInput(value: unknown) {
  if (typeof value !== 'string') throw Object.assign(new Error('Reading TTS text must be a string.'), { status: 400 });
  const text = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!text || text.length > 6000) throw Object.assign(new Error('Reading TTS text must contain 1–6000 characters.'), { status: 400 });
  return { text, warnings: [] as string[] };
}

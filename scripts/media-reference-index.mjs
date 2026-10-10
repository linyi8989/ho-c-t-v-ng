import path from 'node:path';
const MEDIA_FILE_NAME = /^[a-f0-9]{64}\.(?:gif|jpe?g|m4a|mp3|ogg|png|wav|webp)$/i;
const TTS_FILE_NAME = /^[a-f0-9]{64}\.mp3$/i;
function tableExists(db, name) { return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)); }
function fileNameFromPublicUrl(value, publicPrefix) {
  const text = String(value || '').trim();
  const marker = `${publicPrefix}/`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return '';
  const withoutQuery = text.slice(markerIndex + marker.length).split(/[?#]/, 1)[0];
  try {
    const decoded = decodeURIComponent(withoutQuery);
    return path.basename(decoded) === decoded ? decoded : '';
  } catch {
    return '';
  }
}

function addTtsReferencesFromJson(references, value) {
  let data;
  try {
    data = JSON.parse(String(value || ''));
  } catch {
    throw new Error('Malformed media JSON; refusing orphan classification.');
  }
  const visit = current => {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    const audioFileName = fileNameFromPublicUrl(
      current.audioUrl || current.audio_url,
      '/audio'
    );
    if (TTS_FILE_NAME.test(audioFileName)) references.add(audioFileName);
    const audioHash = String(current.audioHash || current.audio_hash || '').trim();
    if (/^[a-f0-9]{64}$/i.test(audioHash)) references.add(`${audioHash}.mp3`);
    Object.values(current).forEach(visit);
  };
  visit(data);
}

export function loadMediaReferences(db) {
  if (!tableExists(db, 'listening_assets')) {
    throw new Error('Required table listening_assets is missing; refusing media maintenance.');
  }
  if (!tableExists(db, 'vocab_items') || !tableExists(db, 'vocab_sets')) {
    throw new Error('Required vocabulary tables are missing; refusing media maintenance.');
  }

  const listening = new Set();
  for (const row of db.prepare(
    'SELECT storage_key, public_url FROM listening_assets'
  ).all()) {
    const storageKey = String(row.storage_key || '').trim();
    if (path.basename(storageKey) === storageKey && MEDIA_FILE_NAME.test(storageKey)) {
      listening.add(storageKey);
    }
    const publicFileName = fileNameFromPublicUrl(row.public_url, '/listening-media');
    if (MEDIA_FILE_NAME.test(publicFileName)) listening.add(publicFileName);
  }

  const tts = new Set();
  for (const row of db.prepare(
    'SELECT audio_url, data_json FROM vocab_items'
  ).all()) {
    const audioFileName = fileNameFromPublicUrl(row.audio_url, '/audio');
    if (TTS_FILE_NAME.test(audioFileName)) tts.add(audioFileName);
    addTtsReferencesFromJson(tts, row.data_json);
  }
  for (const row of db.prepare('SELECT data_json FROM vocab_sets').all()) {
    addTtsReferencesFromJson(tts, row.data_json);
  }
  // Competition snapshots reuse B's TTS cache. Archived questions and completed
  // attempts still need these assets for historical review.
  if (tableExists(db, 'competition_asset_usages')) {
    for (const row of db.prepare('SELECT url FROM competition_asset_usages').iterate()) {
      const ttsName = fileNameFromPublicUrl(row.url, '/audio');
      if (TTS_FILE_NAME.test(ttsName)) tts.add(ttsName);
      const listeningName = fileNameFromPublicUrl(row.url, '/listening-media');
      if (MEDIA_FILE_NAME.test(listeningName)) listening.add(listeningName);
    }
  }
  // Speaking reference audio remains live in drafts, frozen versions and old attempts.
  for (const [table, jsonPath] of [['speaking_lessons', '$.sampleAudioUrl'], ['speaking_versions', '$.sampleAudioUrl'], ['speaking_attempts', '$.lesson.sampleAudioUrl'], ['speaking_sessions', '$.lesson.sampleAudioUrl']]) {
    if (!tableExists(db, table)) continue;
    for (const row of db.prepare(`SELECT json_extract(data_json, '${jsonPath}') AS sample_url FROM ${table}`).iterate()) {
      const name = fileNameFromPublicUrl(row.sample_url, '/audio');
      if (TTS_FILE_NAME.test(name)) tts.add(name);
    }
  }
  for (const [table, itemsPath] of [['speaking_lessons', '$.items'], ['speaking_versions', '$.items'], ['speaking_sessions', '$.lesson.items']]) {
    if (!tableExists(db, table)) continue;
    for (const row of db.prepare(`SELECT json_extract(item.value,'$.sampleAudioUrl') AS sample_url FROM ${table},json_each(json_extract(data_json,'${itemsPath}')) item`).iterate()) {
      const name = fileNameFromPublicUrl(row.sample_url, '/audio');
      if (TTS_FILE_NAME.test(name)) tts.add(name);
    }
  }
  const vocab = new Set();
  if (tableExists(db, 'vocab_image_assets')) {
    for (const row of db.prepare('SELECT storage_key,public_url FROM vocab_image_assets').iterate()) {
      const key = String(row.storage_key || '');
      if (path.basename(key) === key) vocab.add(key);
      const name = fileNameFromPublicUrl(row.public_url, '/vocab-images');
      if (name) vocab.add(name);
    }
  }
  return { listening, tts, vocab };
}


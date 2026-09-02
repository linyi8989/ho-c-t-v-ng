import fs from 'node:fs';
import path from 'node:path';
import {
  assertExistingFile,
  assertQuickCheck,
  createTimestamp,
  createVerifiedBackup,
  hasFlag,
  printJson,
  readArg,
  redactPath,
  resolveDatabasePath,
  Database,
} from './sqlite-cli-common.mjs';

const MEDIA_FILE_NAME = /^[a-f0-9]{64}\.(?:gif|jpe?g|m4a|mp3|ogg|png|wav|webp)$/i;
const TTS_FILE_NAME = /^[a-f0-9]{64}\.mp3$/i;
const DEFAULT_MINIMUM_AGE_DAYS = 7;

function resolveDirectory(argument, environmentVariable) {
  const value = readArg(argument) || process.env[environmentVariable];
  return value ? path.resolve(value) : '';
}

function requireExistingDirectory(directoryPath, label) {
  if (!directoryPath) return;
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`${label} does not exist or is not a directory.`);
  }
}

function parseMinimumAgeDays() {
  const raw = readArg('--older-than-days');
  const value = raw === undefined ? DEFAULT_MINIMUM_AGE_DAYS : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 3650) {
    throw new Error('--older-than-days must be an integer from 1 to 3650.');
  }
  return value;
}

function tableExists(db, tableName) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(tableName));
}

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
    return;
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

function loadReferences(db) {
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
  return { listening, tts };
}

function inspectDirectory(directoryPath, references, fileNamePattern, cutoffMs) {
  if (!directoryPath) return { configured: false, files: 0, referenced: 0, candidates: [] };
  const candidates = [];
  let files = 0;
  let referenced = 0;
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (!entry.isFile() || !fileNamePattern.test(entry.name)) continue;
    files += 1;
    if (references.has(entry.name)) {
      referenced += 1;
      continue;
    }
    const filePath = path.join(directoryPath, entry.name);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs <= cutoffMs) {
      candidates.push({ name: entry.name, bytes: stat.size, modifiedAt: stat.mtime.toISOString() });
    }
  }
  return { configured: true, files, referenced, candidates };
}

function assertContainedFile(rootDirectory, filePath) {
  const root = path.resolve(rootDirectory);
  const target = path.resolve(filePath);
  if (path.dirname(target) !== root || !fs.statSync(target).isFile()) {
    throw new Error(`Unsafe media target rejected: ${path.basename(target)}`);
  }
  return target;
}

function quarantineCandidates(sourceDirectory, candidates, destinationDirectory) {
  if (!sourceDirectory || !candidates.length) return [];
  fs.mkdirSync(destinationDirectory, { recursive: true });
  return candidates.map(candidate => {
    const source = assertContainedFile(sourceDirectory, path.join(sourceDirectory, candidate.name));
    const destination = path.resolve(destinationDirectory, candidate.name);
    if (path.dirname(destination) !== path.resolve(destinationDirectory)) {
      throw new Error(`Unsafe quarantine target rejected: ${candidate.name}`);
    }
    if (fs.existsSync(destination)) {
      throw new Error(`Refusing to overwrite quarantined media: ${candidate.name}`);
    }
    fs.renameSync(source, destination);
    return candidate.name;
  });
}

function safeErrorMessage(error, databasePath) {
  let message = String(error?.message || error || 'Unknown media maintenance error');
  if (databasePath) {
    message = message
      .split(databasePath).join('<sqlite-db>')
      .split(databasePath.replaceAll('\\', '/')).join('<sqlite-db>');
  }
  return message;
}

let databasePath = '';
let db;

try {
  const execute = hasFlag('--execute');
  databasePath = resolveDatabasePath();
  assertExistingFile(databasePath);
  const ttsDirectory = resolveDirectory('--tts-dir', 'TTS_AUDIO_DIR');
  const listeningDirectory = resolveDirectory('--listening-dir', 'LISTENING_MEDIA_DIR');
  if (!ttsDirectory && !listeningDirectory) {
    throw new Error('Configure --tts-dir/--listening-dir or their environment variables.');
  }
  requireExistingDirectory(ttsDirectory, 'TTS media directory');
  requireExistingDirectory(listeningDirectory, 'Listening media directory');

  const minimumAgeDays = parseMinimumAgeDays();
  const cutoff = new Date(Date.now() - minimumAgeDays * 24 * 60 * 60 * 1000);
  db = new Database(databasePath, { readonly: true, fileMustExist: true });
  assertQuickCheck(db);
  const references = loadReferences(db);
  const report = {
    tts: inspectDirectory(ttsDirectory, references.tts, TTS_FILE_NAME, cutoff.getTime()),
    listening: inspectDirectory(
      listeningDirectory,
      references.listening,
      MEDIA_FILE_NAME,
      cutoff.getTime()
    ),
  };
  db.close();
  db = undefined;

  if (!execute) {
    printJson({
      ok: true,
      mode: 'dry-run',
      database: redactPath(databasePath),
      minimumAgeDays,
      cutoff: cutoff.toISOString(),
      report,
      quarantined: { tts: 0, listening: 0 },
      note: 'Read-only report. Re-run with --execute after review to move candidates into quarantine.',
    });
  } else {
    const backupDirectory = readArg('--backup-dir')
      || process.env.SQLITE_BACKUP_DIR
      || path.join(path.dirname(databasePath), 'backups');
    const backupPath = await createVerifiedBackup(databasePath, backupDirectory);
    const quarantineRoot = path.resolve(
      readArg('--quarantine-dir')
      || path.join(path.dirname(databasePath), 'media-quarantine', createTimestamp())
    );
    const movedTts = quarantineCandidates(
      ttsDirectory,
      report.tts.candidates,
      path.join(quarantineRoot, 'tts')
    );
    const movedListening = quarantineCandidates(
      listeningDirectory,
      report.listening.candidates,
      path.join(quarantineRoot, 'listening')
    );
    printJson({
      ok: true,
      mode: 'execute',
      database: redactPath(databasePath),
      backup: redactPath(backupPath),
      quarantine: redactPath(quarantineRoot),
      minimumAgeDays,
      cutoff: cutoff.toISOString(),
      report,
      quarantined: { tts: movedTts.length, listening: movedListening.length },
      deleted: 0,
      note: 'Candidates were moved, not deleted. Restore them from quarantine if needed.',
    });
  }
} catch (error) {
  printJson({
    ok: false,
    database: databasePath ? redactPath(databasePath) : null,
    error: safeErrorMessage(error, databasePath),
  });
  process.exitCode = 1;
} finally {
  if (db?.open) db.close();
}

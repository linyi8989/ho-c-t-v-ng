import fs from 'node:fs/promises';
import path from 'node:path';
import { createDefaultExamContent, getExamPaperDefinition } from '../src/features/exam-platform/definitions';
import { STARTER_PAPERS } from '../src/features/starter-scene/types';
import { initializeSQLiteStorage, closeSQLiteStorage, SQLiteFirestore } from '../src/lib/sqliteStorage';

if (process.env.NODE_ENV !== 'test' || process.env.STARTER_SCENE_QA !== 'true' || !process.env.SQLITE_DB_PATH) throw Error('Isolated Starter fixture requires explicit test opt-in.');
try { await fs.stat(process.env.SQLITE_DB_PATH); throw Error('Refusing to seed an existing database.'); } catch (reason: any) { if (reason.code !== 'ENOENT') throw reason; }
await initializeSQLiteStorage();
try {
  const db = new SQLiteFirestore();
  const root = path.dirname(process.env.SQLITE_DB_PATH);
  await fs.mkdir(path.join(root, 'audio'), { recursive: true });
  await fs.mkdir(path.join(root, 'listening-media'), { recursive: true });
  const sampleRate = 16_000, samples = sampleRate * 5, wave = Buffer.alloc(44 + samples * 2);
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8); wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22); wave.writeUInt32LE(sampleRate, 24); wave.writeUInt32LE(sampleRate * 2, 28);
  wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(samples * 2, 40);
  for (let n = 0; n < samples; n++) wave.writeInt16LE(Math.round(Math.sin(n * 2 * Math.PI * 440 / sampleRate) * 3000), 44 + n * 2);
  await fs.writeFile(path.join(root, 'audio', 'starter-player-qa.wav'), wave);
  const boardUrl = '/listening-media/starter-player-qa.svg';
  await fs.writeFile(path.join(root, 'listening-media', 'starter-player-qa.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="620" viewBox="0 0 600 620"><rect width="600" height="620" fill="white"/><text x="300" y="32" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#142d5a">Isolated QA · listen and draw lines</text>${Array.from({length: 7}, (_, i) => `<circle cx="${(0.04+i*.14+.04)*600}" cy="74" r="23" fill="${['#ffc25b','#88bafa','#a8d578'][i%3]}"/><text x="${(0.04+i*.14+.04)*600}" y="80" text-anchor="middle" font-family="sans-serif" font-size="18">${i+1}</text><rect x="${(0.04+i*.14)*600}" y="450" width="48" height="48" rx="12" fill="#d8edff"/><text x="${(0.04+i*.14+.04)*600}" y="481" text-anchor="middle" font-family="sans-serif" font-size="18">${String.fromCharCode(65+i)}</text>`).join('')}<rect x="50" y="150" width="500" height="230" rx="30" fill="#f5fbff" stroke="#b3d7ed"/><text x="300" y="260" text-anchor="middle" font-family="sans-serif" font-size="25" fill="#24436c">Browser verification fixture</text></svg>`);
  for (const paper of STARTER_PAPERS) for (let index = 1; index <= 31; index++) {
    const setId = `qa-${paper}-${index}`, versionId = `${setId}-v1`, content = createDefaultExamContent(getExamPaperDefinition('starter', paper)!);
    content.title = `Starters ${paper === 'listening' ? 'Listening' : 'Reading & Writing'} ${index === 1 ? '\uFFFD' : '·'} Test ${String(index).padStart(2, '0')}`;
    content.parts.forEach(part => part.questions.forEach(question => { question.prompt ||= 'QA printed question'; question.acceptedAnswers = ['answer']; }));
    if (index === 1) {
      content.parts.forEach(part => {
        part.imageUrl = boardUrl;
        part.instruction = part.title + '. There is one example.';
        if (paper === 'listening') part.audioUrl = `/audio/starter-player-qa.wav?part=${part.part}`;
        part.questions.forEach(question => {
          if (question.options.length) question.correctOptionIds = [question.options[0].id];
          if (question.type === 'short-answer') question.acceptedAnswers = paper === 'reading-writing' && part.part === 3 ? ['cat'] : ['7'];
          if (paper === 'listening' && part.part === 3) question.options.forEach(option => { option.imageUrl = boardUrl; });
        });
      });
      const matching = content.parts[0].interactionLayout;
      if (matching?.kind === 'starter-image-matching-v2') {
        matching.sourceNodes.forEach((node, i) => { node.hitRegion = { shape: 'rect', x: .04+i*.14, y: .08, width: .08, height: .08 }; node.anchor = {x: node.hitRegion.x+.04, y: .12}; });
        matching.targetNodes.forEach((node, i) => { node.hitRegion = { shape: 'rect', x: .04+i*.14, y: .725, width: .08, height: .08 }; node.anchor = {x: node.hitRegion.x+.04, y: .765}; });
      }
    }
    const timestamp = new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString();
    await db.collection('exam_sets').doc(setId).set({ id: setId, moduleId: 'starter', paperId: paper, title: content.title, description: 'Bài luyện tập Starters', level: 'Pre A1', schemaVersion: content.schemaVersion, ownerId: 'local-test-admin', status: 'published', visibility: 'public', publishedVersionId: versionId, publishedVersionNumber: 1, draftContent: content, draftRevision: 1, shareToken: 'qa-only-share', timeLimitMinutes: content.timeLimitMinutes, createdAt: timestamp, updatedAt: timestamp });
    await db.collection('exam_set_versions').doc(versionId).set({ id: versionId, setId, moduleId: 'starter', paperId: paper, versionNumber: 1, content, createdAt: timestamp });
  }
  await fs.writeFile(path.join(root, 'audio', 'speaking-fixture.wav'), Buffer.alloc(44));
  await fs.writeFile(path.join(root, 'fixture.json'), JSON.stringify({ isolated: true, papers: STARTER_PAPERS, count: 31 }));
} finally { await closeSQLiteStorage(); }

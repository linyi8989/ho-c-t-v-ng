import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { normalizeLesson, type ProviderId } from '../src/shared/speaking/types';
import { inspectWav } from '../src/server/speaking/audio';
import { createProviders } from '../src/server/speaking/providers';
dotenv.config({ quiet: true });
const arg = (name: string) => process.argv.find(s => s.startsWith(`--${name}=`))?.slice(name.length + 3);
const manifestPath = path.resolve(arg('manifest') || 'docs/speaking-benchmark.example.json'), output = path.resolve(arg('output') || '.data/speaking-verification/benchmark-report.json');
const run = process.argv.includes('--run');
const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (!Array.isArray(raw.cases) || raw.cases.length > 500) throw new Error('Manifest cần cases[] tối đa 500 bản thu.');
const providers = createProviders(), rows: { id: string; provider: string; score: number | null; teacherScore: number | null; elapsedMs: number | null; error: string; detail?: unknown }[] = [];
for (const c of raw.cases) {
  if (typeof c.id !== 'string' || typeof c.file !== 'string') throw new Error('Mỗi case cần id và file.');
  const lesson = normalizeLesson({ title: c.id, instructions: '', partnerText: '', sampleAudioUrl: '', samplePlaybackRate: 1, feedbackEnabled: false, grade: c.grade || 3, locale: c.locale || 'en-US', provider: 'azure', maxSeconds: c.kind === 'word' ? 8 : c.kind === 'passage' ? 300 : 30, ...c });
  const wav = await fs.readFile(path.resolve(path.dirname(manifestPath), c.file)), quality = inspectWav(wav, lesson.maxSeconds);
  const teacherScore = typeof c.teacherScore === 'number' && c.teacherScore >= 0 && c.teacherScore <= 100 ? c.teacherScore : null;
  for (const id of ['azure', 'speechsuper'] as ProviderId[]) {
    let detail, error = '';
    if (!run) error = 'dry-run: WAV validated; no API call';
    else if (!providers[id].configured) error = 'provider not configured';
    else { try { detail = await providers[id].assess({ lesson: { ...lesson, provider: id }, wav, durationSeconds: quality.durationSeconds }); } catch { error = 'assessment failed; inspect provider configuration/audio'; } }
    rows.push({ id: c.id, provider: id, score: detail?.score ?? null, teacherScore, elapsedMs: detail?.elapsedMs ?? null, error, ...(detail ? { detail } : {}) });
  }
}
// Contract-only imports let a teacher compare Chivox, SpeechAce and ELSA exports on the same case IDs.
const external = arg('external');
if (external) {
  const data = JSON.parse(await fs.readFile(path.resolve(external), 'utf8')); if (!Array.isArray(data)) throw new Error('External results cần JSON array.');
  for (const r of data) { if (!['chivox', 'speechace', 'elsa'].includes(r.provider) || !raw.cases.some((c: any) => c.id === r.id) || typeof r.score !== 'number' || !Number.isFinite(r.score) || r.score < 0 || r.score > 100) throw new Error('External row không hợp lệ.'); const c = raw.cases.find((c: any) => c.id === r.id); rows.push({ id: r.id, provider: r.provider, score: r.score, teacherScore: typeof c.teacherScore === 'number' ? c.teacherScore : null, elapsedMs: typeof r.elapsedMs === 'number' ? r.elapsedMs : null, error: '' }); }
}
const summaries = ['azure', 'speechsuper', 'chivox', 'speechace', 'elsa'].map(provider => {
  const all = rows.filter(r => r.provider === provider), valid = all.filter(r => r.score !== null), paired = valid.filter(r => r.teacherScore !== null), latency = valid.flatMap(r => r.elapsedMs === null ? [] : [r.elapsedMs]).sort((a, b) => a - b);
  return { provider, cases: all.length, successful: valid.length, failed: all.filter(r => r.error).length, teacherPairs: paired.length, meanAbsoluteError: paired.length ? paired.reduce((n, r) => n + Math.abs(r.score! - r.teacherScore!), 0) / paired.length : null, latencyP50Ms: latency.length ? latency[Math.floor((latency.length - 1) * .5)] : null, latencyP95Ms: latency.length ? latency[Math.ceil((latency.length - 1) * .95)] : null };
});
await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, JSON.stringify({ schemaVersion: 1, dryRun: !run, createdAt: new Date().toISOString(), note: 'Different provider scores require teacher calibration. Imported vendors are not called by this runner.', summaries, rows }, null, 2));
console.log(JSON.stringify({ output, dryRun: !run, summaries }));

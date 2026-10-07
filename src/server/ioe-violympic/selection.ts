import crypto from 'node:crypto';
import { CompetitionError } from '../../shared/competition/import';
import { defaultCount, type Blueprint, type Question, type Scope } from '../../shared/competition/types';

function allocate(total: number, weights: Record<string, number>) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const rows = Object.entries(weights).map(([key, w]) => ({ key, count: Math.floor(total * w / sum), remainder: total * w / sum % 1 }));
  rows.sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));
  const remainder = total - rows.reduce((n, r) => n + r.count, 0);
  rows.slice(0, remainder).forEach(r => r.count++);
  return Object.fromEntries(rows.map(r => [r.key, r.count]));
}
export function blueprint(scope: Scope): Blueprint {
  const total = defaultCount(scope.subject, scope.grade);
  const weights: Record<string, Record<string, number>> = {
    school: { 1: 45, 2: 40, 3: 15 }, district: { 1: 20, 2: 40, 3: 30, 4: 10 },
    province: { 1: 10, 2: 25, 3: 40, 4: 20, 5: 5 }, national: { 1: 5, 2: 15, 3: 35, 4: 30, 5: 15 },
    practice: scope.grade <= 2 ? { 1: 50, 2: 35, 3: 15 } : scope.grade <= 5 ? { 1: 20, 2: 40, 3: 30, 4: 10 } : { 1: 10, 2: 30, 3: 40, 4: 15, 5: 5 },
  };
  return { ...scope, total, durationMinutes: 30,
    domains: scope.subject === 'english' ? allocate(total, scope.grade <= 2 ? { vocabulary: 45, grammar: 30, reading: 10, listening: 15 } : { vocabulary: 35, grammar: 35, reading: 15, listening: 15 }) : {},
    difficulties: scope.subject === 'english' ? allocate(total, weights[scope.level]) : {} };
}
export function fingerprint(q: Question): string {
  const normalize = (v: string) => v.normalize('NFKC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(JSON.stringify([q.subject, q.grade, q.level, normalize(q.prompt), normalize(q.passage),
    q.options.map(o => [normalize(o.text), o.media.map(m => m.url)]).sort(), q.media.map(m => m.url), q.pairs?.left.map(o => o.text), q.pairs?.right.map(o => o.text)])).digest('hex');
}
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
// Integral max-flow satisfies both marginal quotas whenever the bank permits it.
function exactAllocation(pool: Question[], b: Blueprint): Question[] | null {
  const domains = Object.keys(b.domains), difficulties = Object.keys(b.difficulties);
  const size = 2 + domains.length + difficulties.length, sink = size - 1;
  const capacity = Array.from({ length: size }, () => Array(size).fill(0) as number[]);
  const original = capacity.map(r => [...r]);
  const buckets = new Map<string, Question[]>();
  pool.forEach(q => { const key = `${q.domain}:${q.difficulty}`; buckets.set(key, [...(buckets.get(key) || []), q]); });
  domains.forEach((d, i) => { capacity[0][i + 1] = b.domains[d]; difficulties.forEach((f, j) => { capacity[i + 1][domains.length + j + 1] = buckets.get(`${d}:${f}`)?.length || 0; }); });
  difficulties.forEach((f, j) => { capacity[domains.length + j + 1][sink] = b.difficulties[f]; });
  capacity.forEach((r, i) => r.forEach((n, j) => { original[i][j] = n; }));
  let flow = 0;
  while (true) {
    const prev = Array(size).fill(-1) as number[], queue = [0]; prev[0] = 0;
    for (const u of queue) { for (let v = 0; v < size; v++) if (prev[v] < 0 && capacity[u][v] > 0) { prev[v] = u; queue.push(v); } }
    if (prev[sink] < 0) break;
    let amount = Infinity;
    for (let v = sink; v !== 0; v = prev[v]) amount = Math.min(amount, capacity[prev[v]][v]);
    for (let v = sink; v !== 0; v = prev[v]) { const u = prev[v]; capacity[u][v] -= amount; capacity[v][u] += amount; }
    flow += amount;
  }
  if (flow !== b.total) return null;
  const selected: Question[] = [];
  domains.forEach((d, i) => difficulties.forEach((f, j) => {
    const count = original[i + 1][domains.length + j + 1] - capacity[i + 1][domains.length + j + 1];
    selected.push(...(buckets.get(`${d}:${f}`) || []).slice(0, count));
  }));
  return selected;
}
export function selectQuestions(input: Question[], b: Blueprint) {
  const seen = new Set<string>();
  const pool = shuffle(input.filter(q => !q.archived && q.subject === b.subject && q.grade === b.grade && q.level === b.level))
    .filter(q => { const key = fingerprint(q); if (seen.has(key)) return false; seen.add(key); return true; });
  if (pool.length < b.total) throw new CompetitionError(409, 'BANK_INSUFFICIENT', `Kho có ${pool.length} câu hợp lệ không trùng; cần ${b.total}, còn thiếu ${b.total - pool.length} câu.`);
  if (b.subject !== 'english') return { questions: shuffle(pool.slice(0, b.total)), relaxed: false, warnings: [] as string[] };
  const exact = exactAllocation(pool, b);
  if (exact) return { questions: shuffle(exact), relaxed: false, warnings: [] as string[] };
  const domains: Record<string, number> = {}, difficulties: Record<string, number> = {};
  const selected: Question[] = [], remaining = [...pool];
  while (selected.length < b.total) {
    let best = 0, priority = -Infinity;
    remaining.forEach((q, i) => {
      const p = (b.domains[q.domain] || 0) - (domains[q.domain] || 0) + (b.difficulties[q.difficulty] || 0) - (difficulties[q.difficulty] || 0);
      if (p > priority) { priority = p; best = i; }
    });
    const [q] = remaining.splice(best, 1); selected.push(q); domains[q.domain] = (domains[q.domain] || 0) + 1; difficulties[q.difficulty] = (difficulties[q.difficulty] || 0) + 1;
  }
  return { questions: shuffle(selected), relaxed: true, warnings: ['Kho chưa đáp ứng đủ từng nhóm của ma trận IOE; đã nới quota và giữ đủ tổng số câu.'] };
}

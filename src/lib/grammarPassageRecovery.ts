import type { ClientLearningRun } from './learningRuns';
export interface StoredGrammarPassageRun { run: ClientLearningRun; grammarSetVersion: string }
const keyFor = (actorId: string, setId: string) => `msdieu_grammar_passage_run_v1:${actorId}:${setId}`;
export function readGrammarPassageRun(actorId: string, setId: string): StoredGrammarPassageRun | null {
  try {
    const data = JSON.parse(sessionStorage.getItem(keyFor(actorId, setId)) || 'null');
    if (!data || typeof data.run?.clientRunId !== 'string' || typeof data.run?.runSecret !== 'string' || typeof data.run?.startedAt !== 'string' || typeof data.grammarSetVersion !== 'string') return null;
    return data;
  } catch { return null; }
}
export function storeGrammarPassageRun(actorId: string, setId: string, data: StoredGrammarPassageRun | null) {
  try {
    if (data) sessionStorage.setItem(keyFor(actorId, setId), JSON.stringify(data));
    else sessionStorage.removeItem(keyFor(actorId, setId));
  } catch { /* Server-saved answers remain authoritative when browser storage is unavailable. */ }
}

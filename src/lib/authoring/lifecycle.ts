const checkpoints = new Set<() => void>();
const flushes = new Set<() => Promise<unknown>>();
export function registerCheckpoint(fn: () => void) { checkpoints.add(fn); return () => { checkpoints.delete(fn); }; }
export function registerDraftFlush(fn: () => Promise<unknown>) { flushes.add(fn); return () => { flushes.delete(fn); }; }
export function checkpointAuthoring() { for (const fn of checkpoints) fn(); }
export async function flushAuthoring() {
  checkpointAuthoring();
  await Promise.allSettled([...flushes].map(fn => fn()));
}
export function installAuthoringLifecycle() {
  const hidden = () => { if (document.visibilityState === 'hidden') void flushAuthoring(); };
  const leaving = () => checkpointAuthoring();
  document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leaving); window.addEventListener('beforeunload', leaving);
  return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving); window.removeEventListener('beforeunload', leaving); };
}

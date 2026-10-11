import { useEffect, useRef } from 'react';
import { registerDraftFlush } from './lifecycle';
export function useDraftAutosave(work: () => Promise<void>, state: { enabled: boolean; dirty: boolean; busy: boolean; blocked: boolean }) {
  const latest = useRef({ work, state }); latest.current = { work, state };
  const inFlight = useRef<Promise<void> | null>(null);
  const run = async () => {
    if (inFlight.current) return inFlight.current;
    const current = latest.current;
    if (!current.state.enabled || !current.state.dirty || current.state.busy || current.state.blocked) return;
    const task = current.work(); inFlight.current = task;
    try { await task; } finally { if (inFlight.current === task) inFlight.current = null; }
  };
  useEffect(() => { const timer = setTimeout(() => void run(), 1200); return () => clearTimeout(timer); }, [work, state.enabled, state.dirty, state.busy, state.blocked]);
  useEffect(() => { const unregister = registerDraftFlush(run); return () => { void run(); unregister(); }; }, []);
  return { flush: run, wait: () => inFlight.current || Promise.resolve() };
}

import type { AttemptView } from '../../shared/speaking/types';

export interface RecordingRun { clientRunId: string; renewingAttemptId: string | null }
interface RecordingApi {
  resume: (id: string) => Promise<AttemptView>;
  prepare: (clientRunId: string) => Promise<AttemptView>;
}

// Refresh before opening the microphone. Renew only on this explicit user action,
// preserving the new idempotency key if its prepare response is lost.
export async function prepareRecordingAttempt(initial: AttemptView | null, run: RecordingRun, api: RecordingApi): Promise<AttemptView> {
  let attempt = initial?.status === 'prepared' ? await api.resume(initial.id) : initial;
  if (!attempt) attempt = await api.prepare(run.clientRunId);
  if (attempt.status === 'prepared' && attempt.recordingAllowed === false) {
    if (run.renewingAttemptId !== attempt.id) {
      run.clientRunId = crypto.randomUUID(); run.renewingAttemptId = attempt.id;
    }
    attempt = await api.prepare(run.clientRunId);
  }
  return attempt;
}

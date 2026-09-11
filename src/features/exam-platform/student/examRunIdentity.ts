export type ExamRunActorType = 'authenticated' | 'guest';

export function examRunActorTypeFromTicket(ticket: string): ExamRunActorType | undefined {
  try {
    const [encoded, signature, extra] = String(ticket || '').split('.');
    if (!encoded || !signature || extra) return undefined;
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { ownerKey?: unknown };
    if (typeof payload.ownerKey !== 'string') return undefined;
    if (payload.ownerKey.startsWith('guest:')) return 'guest';
    if (payload.ownerKey.startsWith('user:')) return 'authenticated';
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Keep the same optional-auth mode that the signed attempt ticket was issued
 * for. This does not authorize the request: the backend still validates the
 * ticket signature, run secret and exact owner.
 */
export function authTokenForExamRun(ticket: string, currentToken: string | null) {
  return examRunActorTypeFromTicket(ticket) === 'guest' ? null : currentToken;
}

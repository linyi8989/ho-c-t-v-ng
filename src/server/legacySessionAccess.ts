const DEFAULT_LEGACY_SESSION_MAX_AGE_HOURS = 24;

export function parseLegacySessionMaxAgeMs(value: unknown) {
  const parsed = value === undefined || value === null || value === ""
    ? DEFAULT_LEGACY_SESSION_MAX_AGE_HOURS
    : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 168) {
    throw new Error("LEGACY_GUEST_SESSION_MAX_AGE_HOURS must be between 0 and 168.");
  }
  return Math.floor(parsed * 60 * 60 * 1000);
}

export function canUseLegacyGuestSessionUpdate(options: {
  session: Record<string, unknown>;
  suppliedGuestId: string;
  maxAgeMs: number;
  now?: number;
}) {
  const { session, suppliedGuestId, maxAgeMs } = options;
  if (maxAgeMs <= 0 || session.sessionTokenHash) return false;
  if (!session.guestId || suppliedGuestId !== String(session.guestId)) return false;
  if (session.status === "completed" || session.submissionStatus === "completed") return false;

  const sourceTime = session.lastSavedAt || session.updatedAt || session.startedAt || session.createdAt;
  const timestamp = new Date(String(sourceTime || "")).getTime();
  const now = options.now ?? Date.now();
  if (!Number.isFinite(timestamp) || timestamp > now + 60_000) return false;
  return now - timestamp <= maxAgeMs;
}

export interface ExistingGuestIdentity {
  id: string;
  guestId: string;
  displayName: string;
  status: 'active' | 'blocked';
  legacy?: boolean;
  historyAccess?: 'available' | 'recovery_required';
}

export interface GuestAccessCredential {
  guestId: string;
  accessToken: string;
  version?: number;
}

export const GUEST_ID_STORAGE_KEY = 'msdieu_guest_id';
export const STUDENT_NAME_STORAGE_KEY = 'msdieu_student_name';
export const GUEST_ACCESS_CREDENTIAL_STORAGE_KEY = 'msdieu_guest_history_access';

function createGuestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the browser identity without creating a new guest. History must use
 * this function so opening the page never creates or claims an identity.
 */
export function getStoredGuestId() {
  try {
    return getLocalStorage()?.getItem(GUEST_ID_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Learning flows may create a guest identity before the first attempt.
 * History flows must never call this function.
 */
export function getOrCreateGuestId() {
  const existing = getStoredGuestId();
  if (existing) return existing;

  const guestId = createGuestId();
  try {
    getLocalStorage()?.setItem(GUEST_ID_STORAGE_KEY, guestId);
  } catch {
    // The in-memory id remains usable for the current learning session.
  }
  return guestId;
}

export function getStoredGuestAccessCredential(
  expectedGuestId = getStoredGuestId()
): GuestAccessCredential | null {
  if (!expectedGuestId) return null;

  try {
    const raw = getLocalStorage()?.getItem(GUEST_ACCESS_CREDENTIAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestAccessCredential>;
    const guestId = typeof parsed.guestId === 'string' ? parsed.guestId.trim() : '';
    const accessToken = typeof parsed.accessToken === 'string' ? parsed.accessToken.trim() : '';
    if (!guestId || !accessToken || guestId !== expectedGuestId) return null;
    return {
      guestId,
      accessToken,
      ...(Number.isInteger(parsed.version) && Number(parsed.version) > 0
        ? { version: Number(parsed.version) }
        : {})
    };
  } catch {
    return null;
  }
}

export function storeGuestAccessCredential(
  guestId: string,
  accessToken: string,
  version?: number
) {
  const normalizedGuestId = String(guestId || '').trim();
  const normalizedToken = String(accessToken || '').trim();
  if (!normalizedGuestId || !normalizedToken) return false;

  const credential: GuestAccessCredential = {
    guestId: normalizedGuestId,
    accessToken: normalizedToken,
    ...(Number.isInteger(version) && Number(version) > 0 ? { version: Number(version) } : {})
  };

  try {
    const storage = getLocalStorage();
    if (!storage) return false;
    storage.setItem(GUEST_ACCESS_CREDENTIAL_STORAGE_KEY, JSON.stringify(credential));
    return true;
  } catch {
    return false;
  }
}

export async function identifyExistingGuest(
  guestId: string,
  signal?: AbortSignal
): Promise<ExistingGuestIdentity | null> {
  if (!guestId) return null;

  const response = await fetch('/api/guest-profiles/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestId }),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 404 && data.code === 'GUEST_PROFILE_NOT_FOUND') return null;
  if (!response.ok) {
    throw new Error(data.error || 'Không thể xác minh hồ sơ học sinh.');
  }
  return data as ExistingGuestIdentity;
}

export interface ExistingGuestIdentity {
  id: string;
  guestId: string;
  displayName: string;
  status: 'active' | 'blocked';
  legacy?: boolean;
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

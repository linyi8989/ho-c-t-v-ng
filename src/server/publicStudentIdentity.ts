import crypto from 'node:crypto';

function normalizedName(value: unknown) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .slice(0, 300);
}

export function createPublicStudentKey(data: Record<string, unknown>, secret: string) {
  const identity = String(
    data?.ownerKey
      || (data?.userId ? `user:${data.userId}` : '')
      || (data?.guestId ? `guest:${data.guestId}` : '')
      || (data?.studentId ? `student:${data.studentId}` : '')
      || `name:${normalizedName(data?.studentName || 'Học sinh')}`,
  ).normalize('NFKC').trim().slice(0, 300);
  return `student-${crypto
    .createHmac('sha256', secret)
    .update(identity)
    .digest('hex')
    .slice(0, 24)}`;
}

export function sanitizePublicStudentRecord<T extends Record<string, unknown>>(
  value: T,
  secret: string,
): Omit<T, 'ownerKey' | 'userId' | 'studentId' | 'guestId'> & {
  publicStudentKey: string;
  studentKey: string;
} {
  const {
    ownerKey: _ownerKey,
    userId: _userId,
    studentId: _studentId,
    guestId: _guestId,
    ...safe
  } = value;
  const pseudonymousKey = createPublicStudentKey(value, secret);
  return {
    ...safe,
    publicStudentKey: pseudonymousKey,
    studentKey: pseudonymousKey,
  } as Omit<T, 'ownerKey' | 'userId' | 'studentId' | 'guestId'> & {
    publicStudentKey: string;
    studentKey: string;
  };
}

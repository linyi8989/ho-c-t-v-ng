interface GuestTiming {
  mark(label: string): void;
}

interface GuestIdentityServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createGuestIdentityRepository>;
  safeText: (value: any, maxLength: number) => string;
  validateDisplayName: (value: any) => { valid: boolean; value?: string; error?: string };
  normalizePersonName: (value: string) => string;
  createSessionToken: () => string;
  hashSessionToken: (token: string) => string;
  omitCapabilitySecrets: (record: any) => any;
  invalidateStudentNameCache: () => void;
  createHttpError: (status: number, message: string) => any;
  activityTouchIntervalMs: number;
  now?: () => Date;
  nowMs?: () => number;
}

export function createGuestIdentityService(options: GuestIdentityServiceOptions) {
  const now = options.now || (() => new Date());
  const nowMs = options.nowMs || Date.now;
  const getGuestProfileId = (value: any) => options.safeText(value, 120);
  const isGuestOwnedRecord = (data: any) => {
    const guestId = getGuestProfileId(data?.guestId);
    const userId = options.safeText(data?.userId, 120);
    return Boolean(guestId && (data?.ownerType === 'guest' || !userId || userId === guestId));
  };

  const findExistingGuestIdentity = async (guestIdValue: any, timing?: GuestTiming) => {
    const guestId = getGuestProfileId(guestIdValue);
    if (!guestId) return null;
    const stored = await options.repository.getProfile(guestId);
    timing?.mark('guest_profile');
    if (!stored) return null;
    if (stored.status === 'blocked') {
      throw options.createHttpError(403, 'Hồ sơ học sinh này đã bị khóa.');
    }
    const displayName = options.safeText(stored.displayName || stored.name, 120);
    if (!displayName) return null;
    return {
      ...stored,
      guestId,
      displayName,
      name: displayName,
      status: stored.status || 'active',
      legacy: !options.validateDisplayName(displayName).valid,
    };
  };

  const resolveGuestProfile = async (
    guestIdValue: any,
    studentNameValue: any,
    touchActivity = true,
    classInfo: { classId?: any; className?: any; verified?: boolean } = {},
    timing?: GuestTiming,
  ) => {
    const guestId = getGuestProfileId(guestIdValue);
    if (!guestId) throw options.createHttpError(400, 'Thiếu mã nhận diện học sinh.');
    const existing = await options.repository.getProfile(guestId);
    timing?.mark('guest_profile');
    const currentDate = now();
    const timestamp = currentDate.toISOString();

    if (existing) {
      if (existing.status === 'blocked') {
        throw options.createHttpError(403, 'Hồ sơ học sinh này đã bị khóa.');
      }
      const displayName = options.safeText(existing.displayName || existing.name, 120);
      if (!displayName) {
        const validation = options.validateDisplayName(studentNameValue);
        if (!validation.valid) throw options.createHttpError(400, validation.error || 'Invalid display name.');
        const repaired = {
          ...existing,
          displayName: validation.value,
          name: validation.value,
          normalizedName: options.normalizePersonName(validation.value || ''),
          updatedAt: timestamp,
          lastActiveAt: touchActivity ? timestamp : (existing.lastActiveAt || timestamp),
          needsReview: false,
        };
        await options.repository.setProfile(repaired);
        timing?.mark('profile_write');
        options.invalidateStudentNameCache();
        return repaired;
      }

      const classId = classInfo.verified ? options.safeText(classInfo.classId, 160) : '';
      const className = classInfo.verified ? options.safeText(classInfo.className, 240) : '';
      const lastActiveAtMs = new Date(existing.lastActiveAt || 0).getTime();
      const shouldTouchActivity = Boolean(
        touchActivity
        && (!Number.isFinite(lastActiveAtMs) || nowMs() - lastActiveAtMs >= options.activityTouchIntervalMs)
      );
      const shouldUpdateClassId = Boolean(classId && classId !== options.safeText(existing.classId, 160));
      const shouldUpdateClassName = Boolean(className && className !== options.safeText(existing.className, 240));
      if (shouldTouchActivity || shouldUpdateClassId || shouldUpdateClassName) {
        await options.repository.updateProfile(guestId, {
          ...(shouldTouchActivity ? { lastActiveAt: timestamp } : {}),
          ...(shouldUpdateClassId ? { classId } : {}),
          ...(shouldUpdateClassName ? { className } : {}),
        });
        timing?.mark('profile_write');
      }
      return {
        ...existing,
        displayName,
        name: displayName,
        lastActiveAt: shouldTouchActivity ? timestamp : existing.lastActiveAt,
        classId: classId || existing.classId,
        className: className || existing.className,
      };
    }

    const validation = options.validateDisplayName(studentNameValue);
    if (!validation.valid) throw options.createHttpError(400, validation.error || 'Invalid display name.');
    const guestAccessToken = options.createSessionToken();
    const guestAccessTokenVersion = 1;
    const profile = {
      id: guestId,
      guestId,
      accountType: 'guest',
      displayName: validation.value,
      name: validation.value,
      normalizedName: options.normalizePersonName(validation.value || ''),
      role: 'student',
      status: 'active',
      classId: classInfo.verified ? options.safeText(classInfo.classId, 160) : '',
      className: classInfo.verified ? options.safeText(classInfo.className, 240) : '',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActiveAt: timestamp,
      needsReview: false,
      accessTokenHash: options.hashSessionToken(guestAccessToken),
      accessTokenVersion: guestAccessTokenVersion,
      accessTokenCreatedAt: timestamp,
    };
    await options.repository.setProfile(profile);
    timing?.mark('profile_write');
    options.invalidateStudentNameCache();
    return {
      ...options.omitCapabilitySecrets(profile),
      guestAccessToken,
      guestAccessTokenVersion,
    };
  };

  return { findExistingGuestIdentity, getGuestProfileId, isGuestOwnedRecord, resolveGuestProfile };
}

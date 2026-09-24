interface AccountServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createAccountRepository>;
  isSuperAdmin: (user: any) => boolean;
  getManageableGuestIds: (user: any) => Promise<Set<string>>;
  canManageGuestProfile: (user: any, profile: any) => Promise<boolean>;
  omitGuestCapabilitySecrets: (profile: any) => any;
  getGuestProfileId: (value: any) => string;
  validateDisplayName: (value: any) => { valid: boolean; value?: string; error?: string };
  normalizePersonName: (value: any) => string;
  invalidateStudentNameCache: () => void;
  createSessionToken: () => string;
  hashSessionToken: (token: string) => string;
  updateAuthDisplayName: (userId: string, displayName: string) => Promise<void>;
  setAuthRoleClaim: (userId: string, role: string) => Promise<void>;
  logAudit: (userId: string, userName: string, email: string, action: string, details: string) => Promise<void>;
  now?: () => Date;
  nowMs?: () => number;
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export function createAccountService(options: AccountServiceOptions) {
  const now = options.now || (() => new Date());
  const nowMs = options.nowMs || Date.now;
  const requireActor = (request: any) => {
    if (!request.user) throw httpError(401, 'Unauthenticated');
    return request.user;
  };
  const pageAdminRecords = (records: any[], request: any) => {
    const total = records.length;
    const pageSize = Math.max(1, Math.min(100, Number(request?.pageSize || 10)));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Number(request?.page || 1)), totalPages);
    return { items: records.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total, totalPages };
  };

  const loadScopedAdminAccounts = async (user: any) => {
    const [users, guests] = await Promise.all([
      options.repository.listUsers(),
      options.repository.listGuestProfiles(),
    ]);
    const accounts: any[] = [];
    if (options.isSuperAdmin(user)) {
      for (const data of users) accounts.push({
        ...data,
        name: data.name || data.displayName || 'Chưa đặt tên',
        accountType: 'registered',
        status: data.status || 'active',
      });
    }
    const manageableGuestIds = options.isSuperAdmin(user) ? null : await options.getManageableGuestIds(user);
    for (const raw of guests) {
      const data = {
        ...options.omitGuestCapabilitySecrets(raw),
        id: raw.id,
        guestId: raw.guestId || raw.id,
      };
      if (manageableGuestIds && !manageableGuestIds.has(options.getGuestProfileId(data.guestId || data.id))) continue;
      accounts.push({
        ...data,
        name: data.displayName || data.name || 'Chưa đặt tên',
        email: '', phone: '', role: 'student', accountType: 'guest', status: data.status || 'active',
      });
    }
    accounts.sort((a, b) => new Date(b.lastActiveAt || b.updatedAt || b.createdAt || 0).getTime()
      - new Date(a.lastActiveAt || a.updatedAt || a.createdAt || 0).getTime());
    return accounts;
  };

  const loadAdminAccountsPage = async (user: any, request: any) => {
    const keyword = options.normalizePersonName(request?.search || '');
    const accounts = (await loadScopedAdminAccounts(user)).filter(account => {
      const searchable = options.normalizePersonName([account.name, account.email, account.phone, account.guestId, account.id].filter(Boolean).join(' '));
      if (keyword && !searchable.includes(keyword)) return false;
      if (request?.role && account.role !== request.role) return false;
      if (request?.status && account.status !== request.status) return false;
      return true;
    });
    return pageAdminRecords(accounts, request);
  };

  const loadAdminAuditLogPage = async (user: any, request: any) => {
    if (!options.isSuperAdmin(user)) throw httpError(403, 'Super-admin access required.');
    const keyword = options.normalizePersonName(request?.search || '');
    const logs = (await options.repository.listAuditLogs()).filter(data => {
      const searchable = options.normalizePersonName([data.action, data.details, data.userName, data.userEmail].filter(Boolean).join(' '));
      return !keyword || searchable.includes(keyword);
    });
    return pageAdminRecords(logs, request);
  };

  const listUsers = async (_request: any) => ({ body: await options.repository.listUsers(false) });
  const listAccounts = async (request: any) => ({ body: await loadScopedAdminAccounts(requireActor(request)) });
  const listAuditLogs = async (_request: any) => ({ body: await options.repository.listAuditLogs(false) });

  const updateUserDisplayName = async (request: any) => {
    const actor = requireActor(request);
    const validation = options.validateDisplayName(request.body?.displayName || request.body?.name);
    if (!validation.valid) throw httpError(400, validation.error || 'Tên hiển thị không hợp lệ.');
    const existing = await options.repository.getUser(request.params.userId);
    if (!existing) throw httpError(404, 'Người dùng không tồn tại.');
    const displayName = validation.value || '';
    await options.repository.updateUser(request.params.userId, { name: displayName, updatedAt: now().toISOString() });
    options.invalidateStudentNameCache();
    let authWarning = '';
    try {
      await options.updateAuthDisplayName(request.params.userId, displayName);
    } catch (error: any) {
      authWarning = error?.message || 'Không đồng bộ được tên lên Firebase Authentication.';
      console.warn(`Could not update Firebase display name for ${request.params.userId}: ${authWarning}`);
    }
    await options.logAudit(actor.id, actor.name, actor.email, 'UPDATE_USER_DISPLAY_NAME',
      `Đổi tên tài khoản "${existing.name || request.params.userId}" thành "${displayName}"`);
    return { body: { success: true, userId: request.params.userId, displayName, authWarning } };
  };

  const updateGuestDisplayName = async (request: any) => {
    const actor = requireActor(request);
    const validation = options.validateDisplayName(request.body?.displayName || request.body?.name);
    if (!validation.valid) throw httpError(400, validation.error || 'Tên hiển thị không hợp lệ.');
    const guestId = options.getGuestProfileId(request.params.guestId);
    const existing = await options.repository.getGuestProfile(guestId);
    if (!existing) throw httpError(404, 'Hồ sơ học sinh không tồn tại.');
    if (!(await options.canManageGuestProfile(actor, existing))) throw httpError(403, 'Bạn không có quyền đổi tên học sinh này.');
    const displayName = validation.value || '';
    await options.repository.updateGuestProfile(guestId, {
      displayName, name: displayName, normalizedName: options.normalizePersonName(displayName), needsReview: false, updatedAt: now().toISOString(),
    });
    options.invalidateStudentNameCache();
    await options.logAudit(actor.id, actor.name, actor.email, 'UPDATE_GUEST_DISPLAY_NAME',
      `Đổi tên học sinh khách "${existing.displayName || request.params.guestId}" thành "${displayName}"`);
    return { body: { success: true, guestId: request.params.guestId, displayName } };
  };

  const updateGuestStatus = async (request: any) => {
    const actor = requireActor(request);
    const status = request.body?.status;
    if (!['active', 'blocked'].includes(status)) throw httpError(400, 'Trạng thái hồ sơ không hợp lệ.');
    const guestId = options.getGuestProfileId(request.params.guestId);
    const existing = await options.repository.getGuestProfile(guestId);
    if (!existing) throw httpError(404, 'Hồ sơ học sinh không tồn tại.');
    await options.repository.updateGuestProfile(guestId, { status, updatedAt: now().toISOString() });
    await options.logAudit(actor.id, actor.name, actor.email, status === 'blocked' ? 'LOCK_GUEST_PROFILE' : 'UNLOCK_GUEST_PROFILE',
      `Chuyển hồ sơ học sinh "${existing.displayName || request.params.guestId}" thành ${status}`);
    return { body: { success: true, guestId: request.params.guestId, status } };
  };

  const rotateGuestHistoryCapability = async (request: any) => {
    const actor = requireActor(request);
    const guestId = options.getGuestProfileId(request.params.guestId);
    const profile = await options.repository.getGuestProfile(guestId);
    if (!profile) throw httpError(404, 'Hồ sơ học sinh không tồn tại.');
    if (!(await options.canManageGuestProfile(actor, profile))) throw httpError(403, 'Bạn không có quyền cấp lại quyền lịch sử cho học sinh này.');
    const guestAccessToken = options.createSessionToken();
    const createdAt = now().toISOString();
    const guestAccessTokenVersion = nowMs();
    await options.repository.updateGuestProfile(guestId, {
      accessTokenHash: options.hashSessionToken(guestAccessToken), accessTokenVersion: guestAccessTokenVersion,
      accessTokenCreatedAt: createdAt, updatedAt: createdAt,
    });
    await options.logAudit(actor.id, actor.name, actor.email, 'ROTATE_GUEST_HISTORY_CAPABILITY', `Cấp lại quyền xem lịch sử cho hồ sơ khách ${guestId}`);
    return { body: { guestId, guestAccessToken, guestAccessTokenVersion, createdAt } };
  };

  const updateUserRole = async (request: any) => {
    const actor = requireActor(request);
    const targetUserId = request.params.userId;
    const role = request.body?.role;
    if (!['super_admin', 'teacher', 'student'].includes(role)) throw httpError(400, 'Vai trò không hợp lệ.');
    const existing = await options.repository.getUser(targetUserId);
    if (!existing) throw httpError(404, 'Người dùng không tồn tại.');
    await options.repository.updateUser(targetUserId, { role });
    let customClaimWarning = '';
    try {
      await options.setAuthRoleClaim(targetUserId, role);
    } catch (error: any) {
      customClaimWarning = error?.message || 'Could not update Firebase custom claims.';
      console.warn(`Could not update custom claims for ${targetUserId}: ${customClaimWarning}`);
    }
    await options.logAudit(actor.id, actor.name, actor.email, 'UPDATE_USER_ROLE',
      `Đã thay đổi vai trò của user "${existing.name}" (${existing.email}) từ ${existing.role} thành ${role}`);
    return { body: { success: true, userId: targetUserId, role, customClaimWarning } };
  };

  const updateUserStatus = async (request: any) => {
    const actor = requireActor(request);
    const targetUserId = request.params.userId;
    const status = request.body?.status;
    if (!['active', 'pending', 'blocked', 'deleted'].includes(status)) throw httpError(400, 'Trạng thái không hợp lệ.');
    const existing = await options.repository.getUser(targetUserId);
    if (!existing) throw httpError(404, 'Người dùng không tồn tại.');
    await options.repository.updateUser(targetUserId, { status });
    await options.logAudit(actor.id, actor.name, actor.email, status === 'blocked' ? 'LOCK_USER' : 'UNLOCK_USER',
      `Đã chuyển trạng thái của user "${existing.name}" (${existing.email}) thành ${status}`);
    return { body: { success: true, userId: targetUserId, status } };
  };

  return {
    listAccounts, listAuditLogs, listUsers, loadAdminAccountsPage, loadAdminAuditLogPage,
    rotateGuestHistoryCapability, updateGuestDisplayName, updateGuestStatus,
    updateUserDisplayName, updateUserRole, updateUserStatus,
  };
}

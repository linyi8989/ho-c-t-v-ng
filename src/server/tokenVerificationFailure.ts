export function tokenVerificationFailure(error: unknown): { status: 401 | 503; code: string; message: string } {
  const code = String((error as { code?: unknown })?.code || 'unknown');
  const invalid = new Set(['auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token', 'auth/argument-error', 'auth/user-disabled', 'auth/user-not-found']);
  return invalid.has(code)
    ? { status: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }
    : { status: 503, code: 'AUTH_VERIFICATION_UNAVAILABLE', message: 'Dịch vụ xác thực tạm thời không khả dụng. Nội dung đang soạn được giữ; vui lòng thử lại.' };
}

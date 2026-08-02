export const LOCAL_AUTH_BYPASS_TOKEN = 'local-test-auth-bypass';

export const LOCAL_AUTH_BYPASS_USER = Object.freeze({
  id: 'local-test-super-admin',
  name: 'Local Test Super Admin',
  email: 'local-test@localhost.invalid',
  role: 'super_admin' as const,
  status: 'active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
});

function normalizedHost(value: string | undefined) {
  return String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export function isLoopbackHostname(value: string | undefined) {
  const hostname = normalizedHost(value);
  return hostname === 'localhost'
    || hostname === '::1'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export function isLoopbackAddress(value: string | undefined) {
  const address = normalizedHost(value).replace(/^::ffff:/, '');
  return isLoopbackHostname(address);
}

export function isLocalBrowserAuthBypassEnabled(flag: string | undefined, hostname: string | undefined) {
  return flag === 'true' && isLoopbackHostname(hostname);
}

export function isLocalServerAuthBypassAllowed(input: {
  requested: boolean;
  nodeEnv: string | undefined;
  hostname: string | undefined;
  remoteAddress: string | undefined;
  bearerToken: string | undefined;
}) {
  return input.requested
    && input.nodeEnv !== 'production'
    && input.bearerToken === LOCAL_AUTH_BYPASS_TOKEN
    && isLoopbackHostname(input.hostname)
    && isLoopbackAddress(input.remoteAddress);
}

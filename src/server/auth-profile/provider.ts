import { authProfileHttpError } from './contracts.js';

interface AuthProviderOptions {
  apiKey: string;
  auth: { createCustomToken(userId: string): Promise<string> };
  fetchImpl?: typeof fetch;
}

export function createAuthProfileProvider(options: AuthProviderOptions) {
  const fetchImpl = options.fetchImpl || fetch;
  return {
    async verifyPassword(email: string, password: string) {
      if (!options.apiKey) throw authProfileHttpError(503, 'Phone password login is not configured.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetchImpl(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(options.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
            signal: controller.signal,
          },
        );
        const data: any = await response.json().catch(() => ({}));
        if (!response.ok || !data.localId) {
          throw authProfileHttpError(401, 'Phone number or password is incorrect.');
        }
        return data as { localId: string };
      } finally {
        clearTimeout(timeout);
      }
    },
    createCustomToken(userId: string) {
      return options.auth.createCustomToken(userId);
    },
  };
}

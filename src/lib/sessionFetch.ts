export interface SessionUser { uid: string; getIdToken(force?: boolean): Promise<string> }
export type SessionReader = () => SessionUser | null;

function tokenOwner(token: string): string | null {
  try { const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return typeof payload.sub === 'string' ? payload.sub : null; } catch { return null; }
}
export function createSessionFetch(nativeFetch: typeof fetch, readUser: SessionReader, origin: string): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), origin);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const bearer = headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (url.origin !== origin || !url.pathname.startsWith('/api/') || !bearer) return nativeFetch(input, init);
    const owner = tokenOwner(bearer);
    // Unknown/custom bearer capabilities and local test tokens retain their contracts.
    if (!owner) return nativeFetch(input, init);
    const user = readUser();
    if (!user) throw new Error('Phiên đăng nhập chưa sẵn sàng. Bản nháp được giữ; vui lòng đăng nhập lại để lưu lên server.');
    const assertOwner = () => { if (readUser()?.uid !== user.uid || owner !== user.uid) throw new Error('Tài khoản đã thay đổi. Hãy đăng nhập lại đúng tài khoản để tiếp tục; bản nháp trên thiết bị được giữ.'); };
    assertOwner();
    const token = await user.getIdToken();
    assertOwner();
    const request = new Request(input instanceof Request ? input : url, init);
    const authorizedHeaders = new Headers(request.headers);
    authorizedHeaders.set('Authorization', 'Bearer ' + token);
    const authorized = new Request(request, { headers: authorizedHeaders });
    authorized.signal.throwIfAborted();
    const retry = authorized.clone();
    const response = await nativeFetch(authorized);
    if (response.status !== 401) return response;
    assertOwner();
    let fresh: string;
    try { fresh = await user.getIdToken(true); } catch { return response; }
    assertOwner();
    if (fresh === token) return response;
    const retryHeaders = new Headers(retry.headers); retryHeaders.set('Authorization', 'Bearer ' + fresh);
    retry.signal.throwIfAborted();
    // A 401 is rejected before the authenticated write handler; never replay network/5xx errors.
    return nativeFetch(new Request(retry, { headers: retryHeaders }));
  };
}
export function installSessionFetch(readUser: SessionReader): () => void {
  const original = window.fetch;
  const wrapped = createSessionFetch(original.bind(window), readUser, window.location.origin);
  window.fetch = wrapped;
  return () => { if (window.fetch === wrapped) window.fetch = original; };
}

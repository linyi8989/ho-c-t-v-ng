export type AppShellRoute =
  | { kind: 'home'; pathname: '/' }
  | { kind: 'history'; pathname: '/history' }
  | { kind: 'auth'; pathname: string; mode: 'login' | 'register' }
  | { kind: 'private-vocabulary'; pathname: string; token: string }
  | { kind: 'private-grammar'; pathname: string; token: string }
  | { kind: 'other'; pathname: string };

function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}

function decodeRouteToken(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

export function parseAppShellRoute(pathnameValue: string): AppShellRoute {
  const pathname = normalizePathname(pathnameValue);
  if (pathname === '/') return { kind: 'home', pathname };
  if (pathname === '/history') return { kind: 'history', pathname };
  if (pathname === '/reg' || pathname === '/register') {
    return { kind: 'auth', pathname, mode: 'register' };
  }
  if (pathname === '/login' || pathname === '/admin') {
    return { kind: 'auth', pathname, mode: 'login' };
  }

  const vocabularyMatch = pathname.match(/^\/(?:assignment|vocabulary\/private)\/([^/?#]+)$/);
  if (vocabularyMatch) {
    return {
      kind: 'private-vocabulary',
      pathname,
      token: decodeRouteToken(vocabularyMatch[1]),
    };
  }

  const grammarMatch = pathname.match(/^\/grammar\/private\/([^/?#]+)$/);
  if (grammarMatch) {
    return {
      kind: 'private-grammar',
      pathname,
      token: decodeRouteToken(grammarMatch[1]),
    };
  }
  return { kind: 'other', pathname };
}

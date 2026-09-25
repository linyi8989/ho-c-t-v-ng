import { parseAppShellRoute } from '../appRoutes';
import { parseListeningLibraryRoute } from '../features/listening-library/routes';

const FILE_EXTENSION = /\.[a-z0-9]{1,12}$/i;

export function isSpaNavigationRequest(pathnameValue: string, search = '') {
  const pathname = pathnameValue.replace(/\/{2,}/g, '/');
  if (pathname === '/api' || pathname.startsWith('/api/')) return false;
  if (pathname === '/assets' || pathname.startsWith('/assets/')) return false;
  if (FILE_EXTENSION.test(pathname)) return false;
  if (parseAppShellRoute(pathname).kind !== 'other') return true;
  return Boolean(parseListeningLibraryRoute(pathname, search));
}

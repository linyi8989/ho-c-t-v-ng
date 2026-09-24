import React from 'react';
import { parseAppShellRoute } from '../../appRoutes';
import { parseListeningLibraryRoute } from '../listening-library/routes';

export function useAppNavigation() {
  const [browserLocation, setBrowserLocation] = React.useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));

  const appShellRoute = React.useMemo(
    () => parseAppShellRoute(browserLocation.pathname),
    [browserLocation.pathname],
  );
  const listeningLibraryRoute = React.useMemo(
    () => parseListeningLibraryRoute(browserLocation.pathname, browserLocation.search),
    [browserLocation.pathname, browserLocation.search],
  );

  const navigateInternal = React.useCallback((href: string) => {
    const target = new URL(href, window.location.origin);
    if (target.origin !== window.location.origin) {
      window.location.href = target.href;
      return;
    }
    const nextHref = `${target.pathname}${target.search}${target.hash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextHref !== currentHref) window.history.pushState({ appNavigation: true }, '', nextHref);
    setBrowserLocation({ pathname: target.pathname, search: target.search });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  React.useEffect(() => {
    const syncRouteFromPath = () => {
      setBrowserLocation({ pathname: window.location.pathname, search: window.location.search });
    };
    window.addEventListener('popstate', syncRouteFromPath);
    return () => window.removeEventListener('popstate', syncRouteFromPath);
  }, []);

  return {
    appShellRoute,
    browserLocation,
    listeningLibraryRoute,
    navigateInternal,
  };
}

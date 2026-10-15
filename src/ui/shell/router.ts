import { useEffect, useState } from 'preact/hooks';

/** The analysis tabs, in order. */
export const ROUTES = ['describe', 'tests', 'correlation', 'regression', 'sample-size'] as const;
/** Tabs plus the printable method guides (reached from the method guide, not a tab). */
export type Route = (typeof ROUTES)[number] | 'guides';

export function parseHash(hash: string): Route {
  const r = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(r) || r === 'guides' ? (r as Route) : 'describe';
}

/** Hash routes (#/describe, …) so the browser's back button moves between tabs on any static host. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

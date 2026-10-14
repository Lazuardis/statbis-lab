import { useEffect, useState } from 'preact/hooks';

export const ROUTES = ['describe', 'tests', 'correlation', 'regression', 'sample-size'] as const;
export type Route = (typeof ROUTES)[number];

export function parseHash(hash: string): Route {
  const r = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : 'describe';
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

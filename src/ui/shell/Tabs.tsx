import { useT, type MessageKey } from '../../i18n/i18n';
import { ROUTES, type Route } from './router';

const LABELS: Record<Route, MessageKey> = {
  describe: 'tabs.describe',
  tests: 'tabs.tests',
  correlation: 'tabs.correlation',
  regression: 'tabs.regression',
  'sample-size': 'tabs.sampleSize',
};

export function Tabs(props: { route: Route }) {
  const t = useT();
  return (
    <nav class="tabs" aria-label={t('tabs.label')}>
      {ROUTES.map((r) => (
        <a key={r} href={`#/${r}`} class={r === props.route ? 'active' : ''} aria-current={r === props.route ? 'page' : undefined}>
          {t(LABELS[r])}
        </a>
      ))}
    </nav>
  );
}

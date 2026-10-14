import { useT } from '../../i18n/i18n';

export function ComingSoon() {
  const t = useT();
  return <p class="coming-soon muted">{t('section.comingSoon')}</p>;
}

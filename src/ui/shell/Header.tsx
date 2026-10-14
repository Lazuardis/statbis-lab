import type { Lang } from '../../i18n/i18n';
import { useT } from '../../i18n/i18n';

export function Header(props: { lang: Lang; onLang: (l: Lang) => void }) {
  const t = useT();
  return (
    <header class="site-header">
      <div class="brand">
        <svg class="brand-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="currentColor" />
          <rect x="7" y="17" width="4" height="8" fill="#fff" />
          <rect x="14" y="11" width="4" height="14" fill="#fff" />
          <rect x="21" y="7" width="4" height="18" fill="#fff" />
        </svg>
        <span class="brand-name">{t('app.name')}</span>
      </div>
      <div class="lang-switch" role="group" aria-label={t('header.language')}>
        <LangButton l="en" current={props.lang} onLang={props.onLang} />
        <span class="lang-sep" aria-hidden="true">|</span>
        <LangButton l="id" current={props.lang} onLang={props.onLang} />
      </div>
    </header>
  );
}

function LangButton(props: { l: Lang; current: Lang; onLang: (l: Lang) => void }) {
  const active = props.l === props.current;
  return (
    <button
      type="button"
      class={`link-btn${active ? ' active' : ''}`}
      aria-pressed={active}
      lang={props.l}
      onClick={() => props.onLang(props.l)}
    >
      {props.l.toUpperCase()}
    </button>
  );
}

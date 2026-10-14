import { useEffect, useRef, useState } from 'preact/hooks';
import { EXAMPLES } from '../../data/examples';
import { useT, type MessageKey } from '../../i18n/i18n';
import { ChevronIcon, LocalIcon } from './icons';

export function DataToolbar(props: {
  onNew: () => void;
  onExample: (key: string) => void;
  onSettings: () => void;
}) {
  const t = useT();
  return (
    <div class="data-toolbar">
      <div class="data-toolbar-actions">
        <button type="button" class="link-btn strong" onClick={props.onNew}>
          {t('toolbar.newData')}
        </button>
        <ExampleMenu onPick={props.onExample} />
        <button type="button" class="link-btn" onClick={props.onSettings}>
          {t('toolbar.settings')}
        </button>
      </div>
      <p class="privacy-note" title={t('toolbar.privacyHelp')}>
        <LocalIcon />
        <span>{t('toolbar.privacy')}</span>
      </p>
    </div>
  );
}

function ExampleMenu(props: { onPick: (key: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div class="menu" ref={root}>
      <button
        type="button"
        class="link-btn"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t('toolbar.examples')} <ChevronIcon />
      </button>
      {open && (
        <ul class="menu-list" role="menu">
          {EXAMPLES.map((ex) => (
            <li key={ex.key} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  props.onPick(ex.key);
                }}
              >
                <span class="menu-item-title">{t(`examples.${ex.key}` as MessageKey)}</span>
                <span class="menu-item-sub">{ex.key}.csv</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

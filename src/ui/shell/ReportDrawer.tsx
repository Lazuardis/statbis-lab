import { useEffect, useRef } from 'preact/hooks';
import { useT } from '../../i18n/i18n';
import {
  itemsHtml,
  itemsText,
  metaBlockHtml,
  reportFileName,
  standaloneHtml,
  type ReportItem,
  type ReportMeta,
} from '../report';
import { copyRich } from '../table';
import { CloseIcon, ReportIcon } from './icons';

export function ReportButton(props: { count: number; onOpen: () => void }) {
  const t = useT();
  return (
    <button type="button" class="report-fab no-print" aria-label={t('report.open', { count: props.count })} onClick={props.onOpen}>
      <ReportIcon />
      {props.count > 0 && <span class="badge">{props.count}</span>}
    </button>
  );
}

export function ReportDrawer(props: {
  open: boolean;
  items: ReportItem[];
  meta: ReportMeta;
  onClose: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!props.open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) props.onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props.open]);

  const empty = props.items.length === 0;

  const print = () => {
    document.body.classList.add('printing-report');
    const done = () => {
      document.body.classList.remove('printing-report');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  const download = () => {
    const html = standaloneHtml(props.meta, props.items);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFileName(props.meta.dataName, new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <aside
      ref={panel}
      tabIndex={-1}
      class={`drawer${props.open ? ' open' : ''}`}
      aria-label={t('report.title')}
      aria-hidden={!props.open}
      inert={!props.open}
    >
      <div class="drawer-head">
        <h2>{t('report.title')}</h2>
        <div class="drawer-actions">
          <button
            type="button"
            class="link-btn"
            disabled={empty}
            onClick={() =>
              copyRich(
                metaBlockHtml(props.meta) + itemsHtml(props.items),
                itemsText(props.meta, props.items),
              )
            }
          >
            {t('report.copyAll')}
          </button>
          <button type="button" class="link-btn" disabled={empty} onClick={print}>
            {t('report.print')}
          </button>
          <button type="button" class="link-btn" disabled={empty} onClick={download}>
            {t('report.download')}
          </button>
          <button type="button" class="link-btn" disabled={empty} onClick={props.onClear}>
            {t('report.clear')}
          </button>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>
      <div class="drawer-body">
        <div class="report-paper report-doc">
          <h1>{t('report.title')}</h1>
          <div dangerouslySetInnerHTML={{ __html: metaBlockHtml(props.meta) }} />
          {empty ? (
            <p class="muted">{t('report.empty')}</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: itemsHtml(props.items) }} />
          )}
        </div>
      </div>
      <p class="drawer-foot">{t('report.notSaved')}</p>
    </aside>
  );
}

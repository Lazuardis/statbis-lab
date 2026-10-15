import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { useT } from '../../i18n/i18n';
import type { ReportItem } from '../report';
import { CheckIcon } from '../shell/icons';

/** Options on the left, chart on the right, with Download PNG · SVG · Copy · Add to report. */
export function ChartSection(props: {
  title: string;
  /** Analysis name for the report heading. */
  heading: string;
  /** Base for downloaded file names. */
  fileBase: string;
  options: ComponentChildren;
  children: ComponentChildren;
  /** Extra lines under the chart (e.g. the Shapiro–Wilk line); also added to the report. */
  footer?: string[];
  onAdd: (item: Omit<ReportItem, 'id' | 'fingerprint'>) => void;
}) {
  const t = useT();
  const holder = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<'copied' | 'added' | 'failed' | null>(null);

  const blink = (k: 'copied' | 'added' | 'failed') => {
    setFlash(k);
    setTimeout(() => setFlash(null), 1800);
  };

  const svgText = () => {
    const svg = holder.current?.querySelector('svg');
    return svg ? new XMLSerializer().serializeToString(svg) : '';
  };

  const download = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName(props.fileBase)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const png = () => svgToPng(svgText());

  const footerHtml = (props.footer ?? []).map((l) => `<p class="chart-note">${escape(l)}</p>`).join('');

  return (
    <section class="chart-section">
      <h3 class="result-title">{props.title}</h3>
      <div class="chart-layout">
        <div class="chart-options">{props.options}</div>
        <div class="chart-main">
          <div class="result-toolbar chart-toolbar">
            <span class="muted">{t('chart.download')}</span>
            <button type="button" class="link-btn strong" onClick={async () => download(await png(), 'png')}>
              PNG
            </button>
            <button type="button" class="link-btn strong" onClick={() => download(new Blob([svgText()], { type: 'image/svg+xml' }), 'svg')}>
              SVG
            </button>
            <button
              type="button"
              class="link-btn"
              onClick={async () => {
                try {
                  const blob = await png();
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                  blink('copied');
                } catch {
                  blink('failed');
                }
              }}
            >
              {flash === 'copied' ? (
                <>
                  <CheckIcon /> {t('result.copied')}
                </>
              ) : flash === 'failed' ? (
                t('chart.copyFailed')
              ) : (
                t('chart.copy')
              )}
            </button>
            <button
              type="button"
              class="link-btn"
              onClick={() => {
                props.onAdd({
                  heading: props.heading,
                  title: props.title,
                  html: `<div class="chart">${svgText()}</div>${footerHtml}`,
                  text: [props.title, ...(props.footer ?? [])].join('\n'),
                });
                blink('added');
              }}
            >
              {flash === 'added' ? (
                <>
                  <CheckIcon /> {t('result.added')}
                </>
              ) : (
                t('result.addToReport')
              )}
            </button>
          </div>
          <div class="chart-holder" ref={holder}>
            {props.children}
          </div>
          {props.footer?.map((l) => (
            <p key={l} class="chart-note">
              {l}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function safeName(s: string): string {
  return s.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'chart';
}

/** Render an SVG string to a PNG at twice its size, on a white background. */
function svgToPng(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png');
    };
    img.onerror = () => reject(new Error('svg failed to load'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Small option controls used in the left column. */
export function RadioGroup<T extends string>(props: {
  label: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset class="opt-group">
      <legend>{props.label}</legend>
      {props.options.map((o) => (
        <label key={o.value} class="radio">
          <input type="radio" name={props.name} checked={props.value === o.value} onChange={() => props.onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Check(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="checkbox">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.currentTarget.checked)} />
      <span>{props.label}</span>
    </label>
  );
}

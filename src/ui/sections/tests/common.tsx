import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { useT, type MessageKey, type T } from '../../../i18n/i18n';
import type { Alternative } from '../../../stats/tests';
import { RadioGroup } from '../../charts/ChartSection';
import type { Fmt } from '../../fmt';
import type { ReportItem } from '../../report';
import { ResultBlock } from '../../shell/ResultBlock';

export type AddFn = (item: Omit<ReportItem, 'id' | 'fingerprint'>) => void;

/** Render text with **bold** markers. */
export function rich(s: string): ComponentChildren {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

/** Same text without the markers (for the report and the clipboard). */
export function plain(s: string): string {
  return s.replace(/\*\*/g, '');
}

/** 6 significant figures, unrounded otherwise, for "Check your manual working". */
export function sig6(x: number, sep: '.' | ','): string {
  if (!Number.isFinite(x)) return '—';
  if (Number.isInteger(x) && Math.abs(x) < 1e9) return String(x);
  const s = Number(x.toPrecision(6)).toString();
  return sep === ',' ? s.replace('.', ',') : s;
}

export function tailWord(alt: Alternative, t: T): string {
  return alt === 'two-sided' ? t('tests.twoSided') : t('tests.oneSided');
}

export function decision(p: number, alpha: number, t: T): string {
  return p < alpha ? t('tests.reject') : t('tests.noReject');
}

export function decisionSentence(p: number, alpha: number, h0short: string, f: Fmt, t: T): string {
  return t(p < alpha ? 'tests.interp.reject' : 'tests.interp.noReject', { p: f.pEq(p), alpha: alphaText(alpha, f), h0: h0short });
}

/** α shown as 0.05 / 0,05 (not 0.0500). */
export function alphaText(alpha: number, f: Fmt): string {
  return String(alpha).replace('.', f.sep);
}

export function AlphaRadios(props: { value: number; onChange: (v: number) => void }) {
  const t = useT();
  return (
    <RadioGroup
      label={t('tests.alpha')}
      name="alpha"
      value={String(props.value)}
      options={['0.01', '0.05', '0.1'].map((v) => ({ value: v, label: v === '0.1' ? '0.10' : v }))}
      onChange={(v) => props.onChange(Number(v))}
    />
  );
}

export function AltRadios(props: { value: Alternative; onChange: (v: Alternative) => void; a: string; b: string; prefix?: string }) {
  const t = useT();
  const label = (key: MessageKey) => `${props.prefix ? `${props.prefix} ` : ''}${t(key, { a: props.a, b: props.b })}`;
  return (
    <RadioGroup
      label={t('tests.alternative')}
      name="alternative"
      value={props.value}
      options={[
        { value: 'two-sided' as Alternative, label: label('tests.altTwo') },
        { value: 'greater' as Alternative, label: label('tests.altGreater') },
        { value: 'less' as Alternative, label: label('tests.altLess') },
      ]}
      onChange={props.onChange}
    />
  );
}

export interface ManualRow {
  label: string;
  value: number;
}

/** A titled test with the two pill buttons and their panels. */
export function TestFrame(props: {
  title: string;
  heading: string;
  assumptions?: ComponentChildren;
  manual?: ManualRow[];
  sep: '.' | ',';
  onAdd: AddFn;
  children: ComponentChildren;
}) {
  const t = useT();
  const [open, setOpen] = useState<'assumptions' | 'manual' | null>(null);
  const toggle = (k: 'assumptions' | 'manual') => setOpen(open === k ? null : k);
  return (
    <section class="result-section">
      <h2 class="section-title">{props.title}</h2>
      <div class="pills">
        {props.assumptions && (
          <button type="button" class={`pill${open === 'assumptions' ? ' active' : ''}`} aria-pressed={open === 'assumptions'} onClick={() => toggle('assumptions')}>
            {t('tests.checkAssumptions')}
          </button>
        )}
        {props.manual && (
          <button type="button" class={`pill${open === 'manual' ? ' active' : ''}`} aria-pressed={open === 'manual'} onClick={() => toggle('manual')}>
            {t('tests.manual')}
          </button>
        )}
      </div>
      {open === 'assumptions' && <div class="pill-panel">{props.assumptions}</div>}
      {open === 'manual' && props.manual && (
        <div class="pill-panel">
          <p class="muted small">{t('tests.manualIntro')}</p>
          <ResultBlock
            heading={props.heading}
            title={t('tests.manual')}
            table={{
              columns: [t('man.quantity'), t('man.value')],
              rows: props.manual.map((r) => [r.label, sig6(r.value, props.sep)]),
              numeric: [false, true],
            }}
            onAdd={props.onAdd}
          />
        </div>
      )}
      {props.children}
    </section>
  );
}

export function Hypotheses(props: { h0: string; h1: string }) {
  const t = useT();
  return (
    <div class="hypotheses">
      <h3 class="result-title">{t('tests.hypotheses')}</h3>
      <div class="hyp-grid">
        <div>
          <div class="hyp-label">{t('tests.h0')}</div>
          <p>{rich(props.h0)}</p>
        </div>
        <div>
          <div class="hyp-label">{t('tests.h1')}</div>
          <p>{rich(props.h1)}</p>
        </div>
      </div>
    </div>
  );
}

/** Hypotheses as plain lines, attached to the result table in the report. */
export function hypothesisNotes(h0: string, h1: string): string[] {
  return [`H₀: ${plain(h0)}`, `H₁: ${plain(h1)}`];
}

export function Note(props: { children: ComponentChildren; kind?: 'warn' | 'info' }) {
  return <p class={`note ${props.kind === 'info' ? 'note-info' : 'note-warn'}`}>{props.children}</p>;
}

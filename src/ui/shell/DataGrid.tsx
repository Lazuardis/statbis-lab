import { useEffect, useRef, useState } from 'preact/hooks';
import type { VariableWarnings } from '../../data/detect';
import type { Dataset } from '../../data/types';
import { useT, type MessageKey } from '../../i18n/i18n';
import { InfoIcon, LevelIcon, WarnIcon } from './icons';

const ROW_H = 26;
const OVERSCAN = 8;
const VISIBLE_ROWS = 15;
const MIN_COLUMNS = 8;

/** Read-only spreadsheet view of the pasted data, with a Case column and type labels. */
export function DataGrid(props: {
  dataset: Dataset | null;
  warnings: VariableWarnings[];
  isMissing: (cell: string) => boolean;
  onLevelClick: (index: number) => void;
  onPasteBoxText: (text: string) => void;
}) {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const d = props.dataset;

  useEffect(() => {
    frame.current?.scrollTo({ top: 0, left: 0 });
    setScrollTop(0);
  }, [d?.fingerprint, d?.rows.length]);

  if (!d) {
    return (
      <div class="grid-frame grid-empty">
        <textarea
          class="paste-zone"
          data-paste-zone
          aria-label={t('grid.pasteBoxLabel')}
          spellcheck={false}
          onInput={(e) => {
            // Phones paste through the keyboard rather than a paste event.
            const el = e.currentTarget;
            if (/[\t\n]/.test(el.value)) {
              const text = el.value;
              el.value = '';
              props.onPasteBoxText(text);
            }
          }}
        />
        <div class="paste-hint" aria-hidden="true">
          <p class="paste-hint-title">{t('grid.emptyTitle')}</p>
          <p>{t('grid.emptyHelp')}</p>
          <p class="muted">{t('grid.emptyExamples')}</p>
        </div>
      </div>
    );
  }

  const n = d.rows.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(n, start + VISIBLE_ROWS + 2 * OVERSCAN);
  const fillers = Math.max(0, MIN_COLUMNS - d.variables.length);
  const numeric = d.variables.map((v) => v.level === 'metric');

  return (
    <div
      class="grid-frame"
      ref={frame}
      tabIndex={0}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <table class="grid">
        <thead>
          <tr class="grid-levels">
            <th class="case-col" />
            {d.variables.map((v, j) => {
              const w = props.warnings[j];
              const label = t(`level.${v.level}` as MessageKey);
              return (
                <th key={v.id}>
                  <button
                    type="button"
                    class={`level-label level-${v.level}`}
                    title={t('grid.levelButton', { level: label, name: v.name })}
                    onClick={() => props.onLevelClick(j)}
                  >
                    {w?.idLike && (
                      <span class="flag flag-id" title={t('warn.id')}>
                        <InfoIcon size={12} />
                      </span>
                    )}
                    {w?.codedCategory && (
                      <span class="flag flag-warn" title={t('warn.codedShort')}>
                        <WarnIcon size={12} />
                      </span>
                    )}
                    {label} <LevelIcon level={v.level} />
                  </button>
                </th>
              );
            })}
            {Array.from({ length: fillers }, (_, k) => (
              <th key={`f${k}`} class="filler" />
            ))}
          </tr>
          <tr class="grid-names">
            <th class="case-col">{t('grid.case')}</th>
            {d.variables.map((v, j) => (
              <th key={v.id} class={numeric[j] ? 'num' : ''} title={v.unit ? `${v.name} (${v.unit})` : v.name}>
                {v.name}
              </th>
            ))}
            {Array.from({ length: fillers }, (_, k) => (
              <th key={`f${k}`} class="filler" />
            ))}
          </tr>
        </thead>
        <tbody>
          {start > 0 && <tr style={{ height: `${start * ROW_H}px` }} aria-hidden="true" />}
          {d.rows.slice(start, end).map((row, k) => (
            <tr key={start + k}>
              <th class="case-col" scope="row">
                {start + k + 1}
              </th>
              {row.map((cell, j) => (
                <td key={j} class={`${numeric[j] ? 'num' : ''}${props.isMissing(cell) ? ' missing' : ''}`}>
                  {cell}
                </td>
              ))}
              {Array.from({ length: fillers }, (_, f) => (
                <td key={`f${f}`} class="filler" />
              ))}
            </tr>
          ))}
          {end < n && <tr style={{ height: `${(n - end) * ROW_H}px` }} aria-hidden="true" />}
        </tbody>
      </table>
    </div>
  );
}

export function GridFooter(props: {
  dataset: Dataset;
  onRename: (name: string) => void;
}) {
  const t = useT();
  const d = props.dataset;
  const [editing, setEditing] = useState(false);
  const commaCols = d.variables.filter((v) => v.level === 'metric' && v.decimal === 'comma').map((v) => v.name);

  return (
    <div class="grid-footer">
      <p class="grid-meta">
        {editing ? (
          <input
            class="input input-inline"
            aria-label={t('grid.nameLabel')}
            value={d.name}
            ref={(el) => el?.focus()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
            }}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (v) props.onRename(v);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <strong class="data-name">{d.name}</strong>
            <button type="button" class="link-btn small" onClick={() => setEditing(true)}>
              {t('grid.rename')}
            </button>
          </>
        )}
        <span class="dot">·</span>
        <span>{t('grid.size', { rows: d.rows.length, cols: d.variables.length })}</span>
        <span class="dot">·</span>
        <span title={t('grid.fingerprintHelp')}>
          {t('grid.fingerprint')} <code class="fingerprint">{d.fingerprint}</code>
        </span>
      </p>
      {commaCols.length > 0 && <p class="muted small">{t('grid.decimalComma', { names: commaCols.join(', ') })}</p>}
      <p class="muted small">{t('grid.pasteHint')}</p>
    </div>
  );
}

export function DataWarnings(props: {
  dataset: Dataset;
  warnings: VariableWarnings[];
  headerLooksNumeric: boolean;
  onOpenVariable: (index: number) => void;
}) {
  const t = useT();
  const items: { key: string; text: string; index?: number }[] = [];
  if (props.headerLooksNumeric) items.push({ key: 'header', text: t('warn.headerNumeric') });
  props.dataset.variables.forEach((v, j) => {
    const w = props.warnings[j];
    if (w?.codedCategory) items.push({ key: `c${j}`, text: t('warn.coded', { name: v.name }), index: j });
    if (w && w.nonNumericCount > 0)
      items.push({ key: `n${j}`, text: t('warn.nonNumeric', { name: v.name, count: w.nonNumericCount }), index: j });
  });
  if (items.length === 0) return null;
  return (
    <ul class="data-warnings">
      {items.map((it) => (
        <li key={it.key}>
          <WarnIcon />
          {it.index === undefined ? (
            <span>{it.text}</span>
          ) : (
            <button type="button" class="link-btn warn-link" onClick={() => props.onOpenVariable(it.index!)}>
              {it.text}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

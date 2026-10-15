import { useState } from 'preact/hooks';
import { useT } from '../../i18n/i18n';
import type { ReportItem } from '../report';
import { copyRich, escapeHtml, tableToHtml, tableToTsv, type ResultTable } from '../table';
import { CheckIcon } from './icons';

/**
 * One results table with its toolbar: Copy · Interpretation · Add to report.
 * Every method's section renders its tables through this component.
 */
export function ResultBlock(props: {
  /** Analysis name used as the report heading, e.g. "Two-sample t-test". */
  heading: string;
  title: string;
  table: ResultTable;
  /** Templated paragraphs (already filled with live values). */
  interpretation?: string[];
  onAdd: (item: Omit<ReportItem, 'id' | 'fingerprint'>) => void;
}) {
  const t = useT();
  const [showInterp, setShowInterp] = useState(false);
  const [flash, setFlash] = useState<'copied' | 'added' | null>(null);

  const blink = (k: 'copied' | 'added') => {
    setFlash(k);
    setTimeout(() => setFlash(null), 1500);
  };

  const interpHtml =
    showInterp && props.interpretation
      ? `<div class="interpretation">${props.interpretation.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>`
      : '';
  const interpText = showInterp && props.interpretation ? `\n\n${props.interpretation.join('\n\n')}` : '';

  return (
    <div class="result-block">
      <h3 class="result-title">{props.title}</h3>
      <div class="result-toolbar">
        <button
          type="button"
          class="link-btn"
          onClick={async () => {
            if (await copyRich(tableToHtml(props.table), tableToTsv(props.table))) blink('copied');
          }}
        >
          {flash === 'copied' ? (
            <>
              <CheckIcon /> {t('result.copied')}
            </>
          ) : (
            t('result.copy')
          )}
        </button>
        {props.interpretation && (
          <button type="button" class={`link-btn${showInterp ? ' active' : ''}`} aria-pressed={showInterp} onClick={() => setShowInterp(!showInterp)}>
            {t('result.interpretation')}
          </button>
        )}
        <button
          type="button"
          class="link-btn"
          onClick={() => {
            props.onAdd({
              heading: props.heading,
              title: props.title,
              html: tableToHtml(props.table) + interpHtml,
              text: tableToTsv(props.table) + interpText,
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
      <div class="table-scroll">
        <table class="result">
          <thead>
            <tr>
              {props.table.columns.map((c, j) => (
                <th key={j} class={props.table.numeric[j] ? 'num' : ''}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} class={props.table.numeric[j] ? 'num' : ''}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showInterp && props.interpretation && (
        <div class="interpretation">
          {props.interpretation.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

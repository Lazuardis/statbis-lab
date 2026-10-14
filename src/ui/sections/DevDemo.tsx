import { column } from '../../data/dataset';
import type { Dataset } from '../../data/types';
import { useT, type MessageKey } from '../../i18n/i18n';
import { formatCount } from '../format';
import type { ReportItem } from '../report';
import { ResultBlock } from '../shell/ResultBlock';

/**
 * Development build only (removed from production by `import.meta.env.DEV`): a trivial table
 * that exercises Copy, Interpretation and Add to report before any real method exists.
 */
export function DevDemo(props: {
  dataset: Dataset;
  selected: string[];
  isMissing: (c: string) => boolean;
  onAdd: (item: Omit<ReportItem, 'id'>) => void;
}) {
  const t = useT();
  const vars = props.selected
    .map((id) => props.dataset.variables.findIndex((v) => v.id === id))
    .filter((j) => j >= 0);
  if (vars.length === 0) return <p class="muted">{t('dev.tickSomething')}</p>;

  const rows = vars.map((j) => {
    const v = props.dataset.variables[j]!;
    const cells = column(props.dataset.rows, j);
    const missing = cells.filter(props.isMissing).length;
    return [v.name, t(`level.${v.level}` as MessageKey), formatCount(cells.length - missing), formatCount(missing)];
  });

  return (
    <section class="result-section">
      <h2 class="section-title">{t('dev.demoHeading')}</h2>
      <ResultBlock
        heading={t('dev.demoHeading')}
        title={t('dev.demoTitle')}
        table={{
          columns: [t('dev.variable'), t('dev.level'), t('dev.nUsed'), t('dev.nMissing')],
          rows,
          numeric: [false, false, true, true],
        }}
        interpretation={[t('dev.demoInterpretation')]}
        onAdd={props.onAdd}
      />
    </section>
  );
}

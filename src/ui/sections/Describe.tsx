import { useState } from 'preact/hooks';
import type { VariableWarnings } from '../../data/detect';
import type { Dataset, Variable } from '../../data/types';
import { useT, type MessageKey, type T } from '../../i18n/i18n';
import {
  boxStats,
  coefficientOfVariation,
  compareCategories,
  crosstab,
  frequencies,
  meanCI,
  proportionCI,
  sturgesBins,
  summarize,
  type Summary,
} from '../../stats/descriptive';
import { shapiroWilk } from '../../stats/normality';
import { BarChart, BoxPlot, Histogram, QQPlot } from '../charts/charts';
import { ChartSection, Check, RadioGroup } from '../charts/ChartSection';
import { useFmt, type Fmt } from '../fmt';
import type { ReportItem } from '../report';
import { ResultBlock } from '../shell/ResultBlock';
import { categoryColumn, groupedNumeric, labelWithUnit, numericColumn, unitSuffix, type NumericColumn } from './columns';

type AddFn = (item: Omit<ReportItem, 'id' | 'fingerprint'>) => void;

const CALC_KEYS = ['n', 'mean', 'sd', 'min', 'max', 'median', 'mode', 'variance', 'range', 'quartiles', 'iqr', 'skewness', 'cv', 'ci', 'missing'] as const;
type CalcKey = (typeof CALC_KEYS)[number];
const DEFAULT_CALC: CalcKey[] = ['n', 'mean', 'sd', 'min', 'max'];
const CALC_LABEL: Record<CalcKey, MessageKey> = {
  n: 'stat.n',
  mean: 'stat.mean',
  sd: 'stat.sd',
  min: 'stat.min',
  max: 'stat.max',
  median: 'stat.median',
  mode: 'stat.mode',
  variance: 'stat.variance',
  range: 'stat.range',
  quartiles: 'stat.quartiles',
  iqr: 'stat.iqr',
  skewness: 'stat.skewness',
  cv: 'stat.cv',
  ci: 'stat.ci',
  missing: 'stat.missing',
};
const LEVELS = [0.9, 0.95, 0.99];

interface Props {
  dataset: Dataset;
  selected: string[];
  warnings: VariableWarnings[];
  isMissing: (c: string) => boolean;
  onAdd: AddFn;
}

export function Describe(props: Props) {
  const t = useT();
  const [calc, setCalc] = useState<Set<CalcKey>>(new Set(DEFAULT_CALC));
  const [confidence, setConfidence] = useState(0.95);
  const [ciProp, setCiProp] = useState(false);

  const d = props.dataset;
  const picked = props.selected.map((id) => d.variables.findIndex((v) => v.id === id)).filter((j) => j >= 0);
  const metric = picked.filter((j) => d.variables[j]!.level === 'metric');
  const categorical = picked.filter((j) => d.variables[j]!.level !== 'metric');

  if (picked.length === 0) return <p class="muted coming-soon">{t('describe.pick')}</p>;

  const toggle = (k: CalcKey, on: boolean) =>
    setCalc((prev) => {
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  const showLevel = (metric.length > 0 && calc.has('ci')) || (metric.length === 0 && categorical.length === 1 && ciProp);

  return (
    <div class="describe">
      <div class="options">
        {metric.length > 0 ? (
          <fieldset class="opt-group">
            <legend>{t('opt.calculate')}</legend>
            <div class="calc-grid">
              {CALC_KEYS.map((k) => (
                <label key={k} class="checkbox">
                  <input
                    type="checkbox"
                    checked={k === 'n' || calc.has(k)}
                    disabled={k === 'n'}
                    onChange={(e) => toggle(k, e.currentTarget.checked)}
                  />
                  <span>{t(CALC_LABEL[k])}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          categorical.length === 1 && (
            <fieldset class="opt-group">
              <legend>{t('opt.calculate')}</legend>
              <Check label={t('describe.ciProportion')} checked={ciProp} onChange={setCiProp} />
            </fieldset>
          )
        )}
        {showLevel && (
          <RadioGroup
            label={t('opt.confidence')}
            name="describe-level"
            value={String(confidence)}
            options={LEVELS.map((l) => ({ value: String(l), label: `${Math.round(l * 100)}%` }))}
            onChange={(v) => setConfidence(Number(v))}
          />
        )}
      </div>

      <section class="result-section">
        <h2 class="section-title">{t('describe.heading')}</h2>
        {metric.length > 0 ? (
          <MetricResults {...props} metric={metric} categorical={categorical} calc={calc} confidence={confidence} />
        ) : categorical.length === 1 ? (
          <FrequencyResults {...props} j={categorical[0]!} ciProp={ciProp} confidence={confidence} />
        ) : (
          <ContingencyResults {...props} a={categorical[0]!} b={categorical[1]!} more={categorical.length > 2} />
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ metric variables

function MetricResults(
  props: Props & { metric: number[]; categorical: number[]; calc: Set<CalcKey>; confidence: number },
) {
  const t = useT();
  const f = useFmt();
  const d = props.dataset;
  const heading = t('describe.heading');
  const g = props.categorical[0];
  const groupVar = g === undefined ? null : d.variables[g]!;
  const groupBlocked = g !== undefined && !!props.warnings[g]?.idLike;
  const grouped = g !== undefined && !groupBlocked;

  const notes: string[] = [];
  if (groupBlocked) notes.push(t('describe.groupId', { name: groupVar!.name }));
  if (grouped && props.categorical.length > 1) notes.push(t('describe.firstGroupOnly', { name: groupVar!.name }));

  const tables: { title: string; v: Variable; columns: { label: string; col: NumericColumn }[]; excluded: number[] }[] = [];
  if (grouped) {
    for (const j of props.metric) {
      const v = d.variables[j]!;
      const { groups, excluded } = groupedNumeric(d, j, g!, props.isMissing);
      const labels = [...groups.keys()].sort(compareCategories);
      tables.push({
        title: t('describe.byGroup', { name: v.name, group: groupVar!.name }),
        v,
        columns: labels.map((l) => ({ label: l, col: groups.get(l)! })),
        excluded: labels.map((_, i) => (i === 0 ? excluded : 0)),
      });
    }
  } else {
    const cols = props.metric.map((j) => ({ v: d.variables[j]!, col: numericColumn(d, j, props.isMissing) }));
    tables.push({
      title: t('describe.tableTitle'),
      v: cols[0]!.v,
      columns: cols.map((c) => ({ label: labelWithUnit(c.v), col: c.col })),
      excluded: cols.map((c) => c.col.missing),
    });
  }

  return (
    <>
      {notes.map((n) => (
        <p key={n} class="note note-warn">
          {n}
        </p>
      ))}
      {tables.map((tb, ti) => (
        <StatsTable
          key={ti}
          heading={heading}
          title={tb.title}
          variables={grouped ? props.metric.map(() => tb.v) : props.metric.map((j) => d.variables[j]!)}
          columns={tb.columns}
          excludedPerColumn={grouped ? null : tb.excluded}
          excludedTotal={grouped ? tb.excluded[0]! : 0}
          calc={props.calc}
          confidence={props.confidence}
          groupName={grouped ? groupVar!.name : null}
          onAdd={props.onAdd}
        />
      ))}
      {props.metric.map((j) => {
        const v = d.variables[j]!;
        const all = numericColumn(d, j, props.isMissing);
        if (all.values.length === 0) return <p key={v.id} class="muted">{t('describe.noValues', { name: v.name })}</p>;
        const groups = grouped
          ? (() => {
              const { groups: gm } = groupedNumeric(d, j, g!, props.isMissing);
              return [...gm.keys()].sort(compareCategories).map((label) => ({ label, col: gm.get(label)! }));
            })()
          : [{ label: v.name, col: all }];
        return (
          <div key={v.id}>
            <Outliers v={v} groups={groups} grouped={grouped} heading={heading} onAdd={props.onAdd} f={f} t={t} />
            <MetricCharts
              v={v}
              values={all.values}
              groups={groups.map((x) => ({ label: x.label, values: x.col.values }))}
              groupName={grouped ? groupVar!.name : ''}
              heading={heading}
              dataName={d.name}
              onAdd={props.onAdd}
            />
          </div>
        );
      })}
    </>
  );
}

function StatsTable(props: {
  heading: string;
  title: string;
  variables: Variable[];
  columns: { label: string; col: NumericColumn }[];
  excludedPerColumn: number[] | null;
  excludedTotal: number;
  calc: Set<CalcKey>;
  confidence: number;
  groupName: string | null;
  onAdd: AddFn;
}) {
  const t = useT();
  const f = useFmt();
  const level = Math.round(props.confidence * 100);
  const sums = props.columns.map((c) => (c.col.values.length > 0 ? summarize(c.col.values) : null));
  const cis = props.columns.map((c) => (props.calc.has('ci') ? meanCI(c.col.values, props.confidence) : null));
  const has = (k: CalcKey) => props.calc.has(k);
  const anyMissing = (props.excludedPerColumn ?? [props.excludedTotal]).some((m) => m > 0);

  const rows: string[][] = [];
  const add = (label: string, cell: (s: Summary, i: number) => string) =>
    rows.push([label, ...sums.map((s, i) => (s ? cell(s, i) : '—'))]);

  add(t('stat.n'), (s) => f.int(s.n));
  if (props.excludedPerColumn && (has('missing') || anyMissing))
    rows.push([t('stat.missing'), ...props.excludedPerColumn.map((m) => f.int(m))]);
  if (has('mean')) add(t('stat.mean'), (s) => f.num(s.mean));
  if (has('sd')) add(t('stat.sd'), (s) => f.num(s.sd));
  if (has('variance')) add(t('stat.variance'), (s) => f.num(s.variance));
  if (has('min')) add(t('stat.min'), (s) => f.num(s.min));
  if (has('quartiles')) add(t('stat.q1'), (s) => f.num(s.q1));
  if (has('median')) add(t('stat.median'), (s) => f.num(s.median));
  if (has('quartiles')) add(t('stat.q3'), (s) => f.num(s.q3));
  if (has('max')) add(t('stat.max'), (s) => f.num(s.max));
  if (has('range')) add(t('stat.range'), (s) => f.num(s.range));
  if (has('iqr')) add(t('stat.iqr'), (s) => f.num(s.iqr));
  if (has('mode')) add(t('stat.mode'), (s) => (s.modes.length ? fmtModes(s.modes, f) : t('stat.noMode')));
  if (has('skewness')) add(t('stat.skewness'), (s) => f.num(s.skewness));
  const cvOf = (s: Summary, i: number) => {
    const v = props.variables[i] ?? props.variables[0]!;
    return v.ratio ? coefficientOfVariation(s.sd, s.mean) : null;
  };
  if (has('cv')) add(t('stat.cv'), (s, i) => f.num(cvOf(s, i)));
  if (has('ci')) {
    rows.push([t('stat.ciLower', { level }), ...cis.map((c) => f.num(c?.lower))]);
    rows.push([t('stat.ciUpper', { level }), ...cis.map((c) => f.num(c?.upper))]);
  }

  const notes: string[] = [];
  if (!props.excludedPerColumn && props.excludedTotal > 0) notes.push(t('describe.excluded', { count: props.excludedTotal }));
  if ((has('quartiles') || has('iqr')) && sums.some((s) => s && s.q1 === null)) notes.push(t('describe.quartileNote'));
  if (has('cv') && sums.some((s, i) => s && cvOf(s, i) === null)) notes.push(t('describe.cvNote'));

  const interpretation: string[] = [];
  sums.forEach((s, i) => {
    if (!s) return;
    const v = props.variables[i] ?? props.variables[0]!;
    const u = unitSuffix(v);
    const name = props.groupName ? `${v.name} (${props.groupName} = ${props.columns[i]!.label})` : v.name;
    const missing = props.excludedPerColumn?.[i] ?? 0;
    let para = t('describe.interp.summary', {
      name,
      n: s.n,
      missing: missing > 0 ? t('describe.interp.missing', { count: missing }) : '',
      mean: f.num(s.mean),
      sd: f.num(s.sd),
      min: f.num(s.min),
      max: f.num(s.max),
      unit: u,
    });
    if ((has('quartiles') || has('median')) && s.q1 !== null)
      para += ` ${t('describe.interp.quartiles', { median: f.num(s.median), q1: f.num(s.q1), q3: f.num(s.q3), unit: u })}`;
    if (has('skewness') && s.skewness !== null) {
      const key = s.skewness >= 0.5 ? 'describe.interp.skewRight' : s.skewness <= -0.5 ? 'describe.interp.skewLeft' : 'describe.interp.skewNone';
      para += ` ${t(key, { skew: f.num(s.skewness) })}`;
    }
    const cv = has('cv') ? cvOf(s, i) : null;
    if (cv !== null) para += ` ${t('describe.interp.cv', { cv: f.num(cv) })}`;
    const ci = cis[i];
    if (ci) para += ` ${t('describe.interp.ci', { level, lower: f.num(ci.lower), upper: f.num(ci.upper), unit: u })}`;
    interpretation.push(para);
  });

  return (
    <ResultBlock
      heading={props.heading}
      title={props.title}
      table={{
        columns: [t('stat.statistic'), ...props.columns.map((c) => c.label)],
        rows,
        numeric: [false, ...props.columns.map(() => true)],
      }}
      notes={notes}
      interpretation={interpretation}
      onAdd={props.onAdd}
    />
  );
}

function fmtModes(modes: number[], f: Fmt): string {
  const shown = modes.slice(0, 5).map((m) => f.num(m));
  return shown.join('; ') + (modes.length > 5 ? '; …' : '');
}

function Outliers(props: {
  v: Variable;
  groups: { label: string; col: NumericColumn }[];
  grouped: boolean;
  heading: string;
  onAdd: AddFn;
  f: Fmt;
  t: T;
}) {
  const { t, f } = props;
  const rows: string[][] = [];
  const fenceLines: string[] = [];
  for (const g of props.groups) {
    const b = boxStats(g.col.values);
    if (!b) continue;
    const fence = t('describe.fences', { lower: f.num(b.fences.lower), upper: f.num(b.fences.upper) });
    fenceLines.push(props.grouped ? `${g.label}: ${fence}` : fence);
    for (const i of b.outliers) {
      rows.push([String(g.col.cases[i]), f.num(g.col.values[i]!), ...(props.grouped ? [g.label] : [])]);
    }
  }
  if (fenceLines.length === 0) return null;
  const title = t('describe.outlierTitle', { name: props.v.name });
  if (rows.length === 0) {
    return (
      <div class="result-block">
        <h3 class="result-title">{title}</h3>
        <p>{t('describe.noOutliers')}</p>
        {fenceLines.map((l) => (
          <p key={l} class="muted small">
            {l}
          </p>
        ))}
      </div>
    );
  }
  return (
    <ResultBlock
      heading={props.heading}
      title={title}
      table={{
        columns: [t('describe.case'), labelWithUnit(props.v), ...(props.grouped ? [t('describe.groupLabel')] : [])],
        rows,
        numeric: [true, true, false],
      }}
      notes={[...fenceLines, t('describe.outlierAdvice')]}
      onAdd={props.onAdd}
    />
  );
}

function MetricCharts(props: {
  v: Variable;
  values: number[];
  groups: { label: string; values: number[] }[];
  groupName: string;
  heading: string;
  dataName: string;
  onAdd: AddFn;
}) {
  const t = useT();
  const f = useFmt();
  const n = props.values.length;
  const sturges = sturgesBins(n);
  const [density, setDensity] = useState(false);
  const [hMean, setHMean] = useState(false);
  const [hMedian, setHMedian] = useState(false);
  const [hNormal, setHNormal] = useState(false);
  const [hStats, setHStats] = useState(false);
  const [bins, setBins] = useState('');
  const [horizontal, setHorizontal] = useState(false);
  const [bMean, setBMean] = useState(false);
  const [bPoints, setBPoints] = useState(false);
  const [band, setBand] = useState(true);

  const label = labelWithUnit(props.v);
  const binCount = Math.min(200, Math.max(1, Number.parseInt(bins, 10) || sturges));
  const s = summarize(props.values);
  const sw = shapiroWilk(props.values);
  const yesNo = [
    { value: 'yes', label: t('chart.yes') },
    { value: 'no', label: t('chart.no') },
  ];

  return (
    <>
      <ChartSection
        title={t('chart.histogram', { name: props.v.name })}
        heading={props.heading}
        fileBase={`${props.dataName}_histogram_${props.v.name}`}
        onAdd={props.onAdd}
        options={
          <>
            <RadioGroup
              label={t('chart.yAxis')}
              name={`h-y-${props.v.id}`}
              value={density ? 'density' : 'frequency'}
              options={[
                { value: 'frequency', label: t('chart.frequency') },
                { value: 'density', label: t('chart.density') },
              ]}
              onChange={(v) => setDensity(v === 'density')}
            />
            <fieldset class="opt-group">
              <legend>{t('chart.show')}</legend>
              <Check label={t('chart.mean')} checked={hMean} onChange={setHMean} />
              <Check label={t('chart.median')} checked={hMedian} onChange={setHMedian} />
              <Check label={t('chart.normalCurve')} checked={hNormal} onChange={setHNormal} />
              <Check label={t('chart.statistics')} checked={hStats} onChange={setHStats} />
            </fieldset>
            <label class="opt-group field">
              <span class="field-label">{t('chart.bins')}</span>
              <input
                class="input input-small"
                type="number"
                min={1}
                max={200}
                placeholder={String(sturges)}
                value={bins}
                onInput={(e) => setBins(e.currentTarget.value)}
              />
              <span class="muted small">{t('chart.binsHelp', { bins: sturges })}</span>
            </label>
          </>
        }
      >
        <Histogram
          title={t('chart.histogram', { name: props.v.name })}
          xLabel={label}
          yLabel={density ? t('chart.density') : t('chart.frequency')}
          values={props.values}
          bins={binCount}
          density={density}
          showMean={hMean}
          showMedian={hMedian}
          showNormal={hNormal}
          statsText={hStats ? t('chart.statsText', { mean: f.num(s.mean), sd: f.num(s.sd), n: s.n }) : null}
          meanLabel={t('chart.mean')}
          medianLabel={t('chart.median')}
          sep={f.sep}
        />
      </ChartSection>

      <ChartSection
        title={t('chart.boxplot', { name: props.v.name })}
        heading={props.heading}
        fileBase={`${props.dataName}_boxplot_${props.v.name}`}
        onAdd={props.onAdd}
        options={
          <>
            <RadioGroup
              label={t('chart.orientation')}
              name={`b-o-${props.v.id}`}
              value={horizontal ? 'h' : 'v'}
              options={[
                { value: 'v', label: t('chart.vertical') },
                { value: 'h', label: t('chart.horizontal') },
              ]}
              onChange={(v) => setHorizontal(v === 'h')}
            />
            <fieldset class="opt-group">
              <legend>{t('chart.show')}</legend>
              <Check label={t('chart.mean')} checked={bMean} onChange={setBMean} />
              <Check label={t('chart.points')} checked={bPoints} onChange={setBPoints} />
            </fieldset>
          </>
        }
      >
        <BoxPlot
          title={t('chart.boxplot', { name: props.v.name })}
          valueLabel={label}
          groupLabel={props.groupName}
          groups={props.groups}
          horizontal={horizontal}
          showMean={bMean}
          showPoints={bPoints}
          sep={f.sep}
        />
      </ChartSection>

      <ChartSection
        title={t('chart.qq', { name: props.v.name })}
        heading={props.heading}
        fileBase={`${props.dataName}_qqplot_${props.v.name}`}
        onAdd={props.onAdd}
        footer={[
          sw ? t('chart.sw', { w: f.num(sw.w), p: f.pEq(sw.p), n: sw.n }) : t('chart.swNA'),
          t('chart.swCaption'),
        ]}
        options={
          <RadioGroup
            label={t('chart.band')}
            name={`q-b-${props.v.id}`}
            value={band ? 'yes' : 'no'}
            options={yesNo}
            onChange={(v) => setBand(v === 'yes')}
          />
        }
      >
        <QQPlot
          title={t('chart.qq', { name: props.v.name })}
          valueLabel={label}
          zLabel={t('chart.theoretical')}
          values={props.values}
          band={band}
          sep={f.sep}
        />
      </ChartSection>
    </>
  );
}

// ------------------------------------------------------------------ one categorical variable

function FrequencyResults(props: Props & { j: number; ciProp: boolean; confidence: number }) {
  const t = useT();
  const f = useFmt();
  const [percentAxis, setPercentAxis] = useState(false);
  const v = props.dataset.variables[props.j]!;
  const col = categoryColumn(props.dataset, props.j, props.isMissing);
  if (col.values.length === 0) return <p class="muted">{t('describe.noValues', { name: v.name })}</p>;
  const freq = frequencies(col.values);
  const n = col.values.length;
  const level = Math.round(props.confidence * 100);
  const cis = freq.map((r) => proportionCI(r.count, n, props.confidence));
  const anyUnreliable = props.ciProp && cis.some((c) => !c.conditionsMet);

  const columns = [t('describe.category'), t('describe.count'), t('describe.percent'), t('describe.cumPercent')];
  if (props.ciProp) columns.push(t('describe.ciLowerPct', { level }), t('describe.ciUpperPct', { level }));
  const rows = freq.map((r, i) => {
    const row = [r.category, f.int(r.count), f.pct(r.percent), f.pct(r.cumulativePercent)];
    if (props.ciProp) {
      const c = cis[i]!;
      const mark = c.conditionsMet ? '' : ' †';
      row.push(f.pct(c.lower * 100) + mark, f.pct(c.upper * 100) + mark);
    }
    return row;
  });
  rows.push([t('describe.total'), f.int(n), f.pct(100), '', ...(props.ciProp ? ['', ''] : [])]);

  const top = freq.reduce((a, b) => (b.count > a.count ? b : a));
  const interpretation = [
    t('describe.interp.freq', {
      name: v.name,
      n,
      missing: col.missing > 0 ? t('describe.interp.missing', { count: col.missing }) : '',
      top: top.category,
      count: top.count,
      pct: f.pct(top.percent),
    }),
  ];
  if (props.ciProp) interpretation.push(t('describe.interp.freqCi', { level }));
  const notes: string[] = [];
  if (col.missing > 0) notes.push(t('describe.excluded', { count: col.missing }));
  if (anyUnreliable) notes.push(t('describe.ciUnreliable'));
  const heading = t('describe.heading');

  return (
    <>
      <ResultBlock
        heading={heading}
        title={t('describe.freqTitle', { name: v.name })}
        table={{ columns, rows, numeric: columns.map((_, i) => i > 0) }}
        notes={notes}
        interpretation={interpretation}
        onAdd={props.onAdd}
      />
      <ChartSection
        title={t('chart.bar', { name: v.name })}
        heading={heading}
        fileBase={`${props.dataset.name}_bar_${v.name}`}
        onAdd={props.onAdd}
        options={
          <RadioGroup
            label={t('chart.yAxis')}
            name={`bar-y-${v.id}`}
            value={percentAxis ? 'pct' : 'count'}
            options={[
              { value: 'count', label: t('chart.count') },
              { value: 'pct', label: t('chart.percent') },
            ]}
            onChange={(x) => setPercentAxis(x === 'pct')}
          />
        }
      >
        <BarChart
          title={t('chart.bar', { name: v.name })}
          xLabel={v.name}
          yLabel={percentAxis ? t('chart.percent') : t('chart.count')}
          categories={freq.map((r) => r.category)}
          values={freq.map((r) => (percentAxis ? r.percent : r.count))}
          label={(x) => (percentAxis ? `${f.pct(x)}%` : f.int(x))}
          sep={f.sep}
        />
      </ChartSection>
    </>
  );
}

// ------------------------------------------------------------------ two categorical variables

function ContingencyResults(props: Props & { a: number; b: number; more: boolean }) {
  const t = useT();
  const f = useFmt();
  const d = props.dataset;
  const va = d.variables[props.a]!;
  const vb = d.variables[props.b]!;
  const a: string[] = [];
  const b: string[] = [];
  let missing = 0;
  d.rows.forEach((row) => {
    const x = row[props.a] ?? '';
    const y = row[props.b] ?? '';
    if (props.isMissing(x) || props.isMissing(y)) missing++;
    else {
      a.push(x);
      b.push(y);
    }
  });
  if (a.length === 0) return <p class="muted">{t('describe.noValues', { name: `${va.name} × ${vb.name}` })}</p>;
  const ct = crosstab(a, b);
  const heading = t('describe.heading');
  const header = [`${va.name} \\ ${vb.name}`, ...ct.cols, t('describe.total')];
  const numeric = header.map((_, i) => i > 0);
  const build = (cell: (i: number, j: number) => string, rowTotal: (i: number) => string, colTotal: (j: number) => string, grand: string) => [
    ...ct.rows.map((r, i) => [r, ...ct.cols.map((_, j) => cell(i, j)), rowTotal(i)]),
    [t('describe.total'), ...ct.cols.map((_, j) => colTotal(j)), grand],
  ];
  const counts = build(
    (i, j) => f.int(ct.counts[i]![j]!),
    (i) => f.int(ct.rowTotals[i]!),
    (j) => f.int(ct.colTotals[j]!),
    f.int(ct.total),
  );
  const rowPct = build(
    (i, j) => f.pct((ct.counts[i]![j]! / ct.rowTotals[i]!) * 100),
    () => f.pct(100),
    (j) => f.pct((ct.colTotals[j]! / ct.total) * 100),
    f.pct(100),
  );
  const colPct = build(
    (i, j) => f.pct((ct.counts[i]![j]! / ct.colTotals[j]!) * 100),
    (i) => f.pct((ct.rowTotals[i]! / ct.total) * 100),
    () => f.pct(100),
    f.pct(100),
  );
  const title = t('describe.contTitle', { row: va.name, col: vb.name });
  const notes = [
    ...(props.more ? [t('describe.twoOnly')] : []),
    ...(missing > 0 ? [t('describe.excluded', { count: missing })] : []),
  ];
  return (
    <>
      <ResultBlock
        heading={heading}
        title={`${title} — ${t('describe.counts')}`}
        table={{ columns: header, rows: counts, numeric }}
        notes={notes}
        interpretation={[
          t('describe.interp.cont', {
            row: va.name,
            col: vb.name,
            n: ct.total,
            missing: missing > 0 ? t('describe.interp.missing', { count: missing }) : '',
          }),
        ]}
        onAdd={props.onAdd}
      />
      <ResultBlock heading={heading} title={`${title} — ${t('describe.rowPct')}`} table={{ columns: header, rows: rowPct, numeric }} onAdd={props.onAdd} />
      <ResultBlock heading={heading} title={`${title} — ${t('describe.colPct')}`} table={{ columns: header, rows: colPct, numeric }} onAdd={props.onAdd} />
    </>
  );
}

import { useState } from 'preact/hooks';
import { parseNumber } from '../../data/parse';
import type { Dataset, Variable } from '../../data/types';
import { useT } from '../../i18n/i18n';
import { pearson, simpleRegression } from '../../stats/regression';
import { Scatter } from '../charts/charts';
import { ChartSection, Check, RadioGroup } from '../charts/ChartSection';
import { useFmt } from '../fmt';
import { ResultBlock } from '../shell/ResultBlock';
import type { RegressionSelection } from '../shell/VariablePicker';
import { labelWithUnit, unitSuffix } from './columns';
import { AlphaRadios, Hypotheses, Note, TestFrame, decision, decisionSentence, hypothesisNotes, type AddFn } from './tests/common';

/** Rows where both columns hold a number. */
function pairedValues(d: Dataset, jx: number, jy: number, isMissing: (c: string) => boolean) {
  const vx = d.variables[jx]!;
  const vy = d.variables[jy]!;
  const x: number[] = [];
  const y: number[] = [];
  d.rows.forEach((row) => {
    const a = row[jx] ?? '';
    const b = row[jy] ?? '';
    const xa = isMissing(a) ? null : parseNumber(a, vx.decimal);
    const yb = isMissing(b) ? null : parseNumber(b, vy.decimal);
    if (xa !== null && yb !== null) {
      x.push(xa);
      y.push(yb);
    }
  });
  return { x, y, excluded: d.rows.length - x.length };
}

// ---------------------------------------------------------------- correlation tab

export function Correlation(props: { dataset: Dataset; selected: string[]; isMissing: (c: string) => boolean; onAdd: AddFn }) {
  const t = useT();
  const f = useFmt();
  const [alpha, setAlpha] = useState(0.05);
  const [showLine, setShowLine] = useState(false);
  const [swap, setSwap] = useState(false);
  const d = props.dataset;
  const picked = props.selected.map((id) => d.variables.findIndex((v) => v.id === id)).filter((j) => j >= 0);
  const metric = picked.filter((j) => d.variables[j]!.level === 'metric');
  const others = picked.length > metric.length;
  if (metric.length < 2)
    return (
      <>
        {others && <Note>{t('cor.metricOnly')}</Note>}
        <p class="muted coming-soon">{t('cor.pick')}</p>
      </>
    );

  const title = t('cor.title');
  const pairs: { a: Variable; b: Variable; n: number; r: number; tt: number; df: number; p: number; excluded: number }[] = [];
  const matrix: string[][] = metric.map(() => metric.map(() => ''));
  metric.forEach((ja, i) => {
    metric.forEach((jb, k) => {
      if (k <= i) return;
      const { x, y, excluded } = pairedValues(d, ja, jb, props.isMissing);
      const r = pearson(x, y);
      if (!r) return;
      pairs.push({ a: d.variables[ja]!, b: d.variables[jb]!, n: r.n, r: r.r, tt: r.t, df: r.df, p: r.p, excluded });
      matrix[i]![k] = f.num(r.r);
      matrix[k]![i] = f.num(r.r);
    });
    matrix[i]![i] = f.num(1);
  });
  if (pairs.length === 0) return <Note>{t('tests.tooFew')}</Note>;
  const first = pairs[0]!;
  const two = metric.length === 2;
  const h0 = t('cor.h0', { x: first.a.name, y: first.b.name });
  const h1 = t('cor.h1', { x: first.a.name, y: first.b.name });
  const [vx, vy] = swap ? [first.b, first.a] : [first.a, first.b];
  const pv = two ? pairedValues(d, d.variables.indexOf(vx), d.variables.indexOf(vy), props.isMissing) : null;
  const fit = pv && showLine ? simpleRegression(pv.x, pv.y, 0.95) : null;

  return (
    <>
      {others && <Note>{t('cor.metricOnly')}</Note>}
      <div class="options">
        <AlphaRadios value={alpha} onChange={setAlpha} />
      </div>
      <TestFrame title={title} heading={title} sep={f.sep} onAdd={props.onAdd}>
        {two && <Hypotheses h0={h0} h1={h1} />}
        <ResultBlock
          heading={title}
          title={t('cor.pairsTitle')}
          table={{
            columns: [t('cor.pair'), t('col.n'), t('cor.r'), t('col.t'), t('col.df'), t('col.p'), t('col.decision')],
            rows: pairs.map((p) => [`${p.a.name} – ${p.b.name}`, f.int(p.n), f.num(p.r), f.num(p.tt), f.int(p.df), f.p(p.p), decision(p.p, alpha, t)]),
            numeric: [false, true, true, true, true, true, false],
          }}
          notes={[
            ...pairs.filter((p) => p.excluded > 0).map((p) => `${p.a.name} – ${p.b.name}: ${t('describe.excluded', { count: p.excluded })}`),
            ...(two ? hypothesisNotes(h0, h1) : []),
            t('cor.causation'),
          ]}
          interpretation={pairs.flatMap((p) => [
            t('cor.interp', { r: f.num(p.r), x: p.a.name, y: p.b.name, n: p.n, t: f.num(p.tt), df: p.df, p: f.pEq(p.p) }),
            decisionSentence(p.p, alpha, t('cor.h0short'), f, t),
          ])}
          onAdd={props.onAdd}
        />
        {!two && (
          <ResultBlock
            heading={title}
            title={t('cor.matrixTitle')}
            table={{
              columns: ['', ...metric.map((j) => d.variables[j]!.name)],
              rows: metric.map((j, i) => [d.variables[j]!.name, ...matrix[i]!]),
              numeric: [false, ...metric.map(() => true)],
            }}
            onAdd={props.onAdd}
          />
        )}
        {pv && (
          <ChartSection
            title={t('cor.scatterTitle', { x: vx.name, y: vy.name })}
            heading={title}
            fileBase={`${d.name}_scatter_${vy.name}_${vx.name}`}
            onAdd={props.onAdd}
            options={
              <fieldset class="opt-group">
                <legend>{t('chart.show')}</legend>
                <Check label={t('chart.regLine')} checked={showLine} onChange={setShowLine} />
                <Check label={t('chart.swapAxes')} checked={swap} onChange={setSwap} />
              </fieldset>
            }
          >
            <Scatter
              title={t('cor.scatterTitle', { x: vx.name, y: vy.name })}
              xLabel={labelWithUnit(vx)}
              yLabel={labelWithUnit(vy)}
              x={pv.x}
              y={pv.y}
              line={fit ? { a: fit.intercept.b, b: fit.slope.b } : null}
              sep={f.sep}
            />
          </ChartSection>
        )}
        <p class="note note-info">{t('cor.causation')}</p>
      </TestFrame>
    </>
  );
}

// ---------------------------------------------------------------- regression tab

export function Regression(props: { dataset: Dataset; selection: RegressionSelection; isMissing: (c: string) => boolean; onAdd: AddFn }) {
  const t = useT();
  const f = useFmt();
  const [level, setLevel] = useState('0.95');
  const [x0Text, setX0Text] = useState('');
  const d = props.dataset;
  const jy = d.variables.findIndex((v) => v.id === props.selection.dependent);
  const jx = d.variables.findIndex((v) => v.id === props.selection.independent);
  if (jy < 0 || jx < 0) return <p class="muted coming-soon">{t('reg.pick')}</p>;
  const vy = d.variables[jy]!;
  const vx = d.variables[jx]!;
  const conf = Number(level);
  const alpha = Math.round((1 - conf) * 100) / 100;
  const lv = Math.round(conf * 100);
  const { x, y, excluded } = pairedValues(d, jx, jy, props.isMissing);
  const r = simpleRegression(x, y, conf);
  const title = t('reg.title');
  if (!r) return <Note>{t('tests.tooFew')}</Note>;
  const yu = unitSuffix(vy);
  const h0 = t('reg.h0', { x: vx.name, y: vy.name });
  const h1 = t('reg.h1', { x: vx.name, y: vy.name });
  const b1 = r.slope.b;
  const x0 = Number(x0Text.trim().replace(',', '.'));
  const hasX0 = x0Text.trim() !== '' && Number.isFinite(x0);
  const yhat = r.intercept.b + b1 * x0;

  return (
    <>
      <div class="options">
        <RadioGroup
          label={t('opt.confidence')}
          name="reg-level"
          value={level}
          options={['0.9', '0.95', '0.99'].map((l) => ({ value: l, label: `${Math.round(Number(l) * 100)}%` }))}
          onChange={setLevel}
        />
      </div>
      <TestFrame
        title={title}
        heading={title}
        sep={f.sep}
        onAdd={props.onAdd}
        manual={[
          { label: 'n', value: r.n },
          { label: 'x̄', value: r.meanX },
          { label: 'ȳ', value: r.meanY },
          { label: 'Sxx = Σ(x − x̄)²', value: r.sxx },
          { label: 'Sxy = Σ(x − x̄)(y − ȳ)', value: r.sxy },
          { label: 'b₁ = Sxy / Sxx', value: r.slope.b },
          { label: 'b₀ = ȳ − b₁·x̄', value: r.intercept.b },
          { label: 'SSE = Σ(y − ŷ)²', value: r.ssResidual },
          { label: 'SST = Σ(y − ȳ)²', value: r.ssTotal },
          { label: 's = √(SSE/(n − 2))', value: r.seEstimate },
          { label: 'SE(b₁) = s/√Sxx', value: r.slope.se },
          { label: 'SE(b₀) = s·√(1/n + x̄²/Sxx)', value: r.intercept.se },
          { label: 't = b₁ / SE(b₁)', value: r.slope.t },
          { label: `t crit (${lv}% CI, df = ${r.dfResidual})`, value: r.tCrit },
          { label: 'R² = SSR / SST', value: r.rSquared },
        ]}
      >
        <Hypotheses h0={h0} h1={h1} />
        <ResultBlock
          heading={title}
          title={t('reg.casesTitle')}
          table={{ columns: [t('reg.used'), t('reg.excluded')], rows: [[f.int(r.n), f.int(excluded)]], numeric: [true, true] }}
          onAdd={props.onAdd}
        />
        <ResultBlock
          heading={title}
          title={t('reg.summaryTitle')}
          table={{
            columns: [t('reg.R'), t('reg.R2'), t('reg.see')],
            rows: [[f.num(Math.abs(r.r)), f.num(r.rSquared), f.num(r.seEstimate)]],
            numeric: [true, true, true],
          }}
          interpretation={[
            t('reg.summaryInterp', { R: f.num(Math.abs(r.r)), R2: f.num(r.rSquared), pct: f.pct(r.rSquared * 100), x: vx.name, y: vy.name, see: f.num(r.seEstimate), yunit: yu }),
          ]}
          onAdd={props.onAdd}
        />
        <ResultBlock
          heading={title}
          title={t('reg.anovaTitle')}
          table={{
            columns: [t('an.source'), t('col.df'), t('an.ss'), t('an.ms'), t('an.f'), t('reg.sigF')],
            rows: [
              [t('reg.regression'), f.int(r.dfRegression), f.num(r.ssRegression), f.num(r.msRegression), f.num(r.f), f.p(r.pF)],
              [t('reg.residual'), f.int(r.dfResidual), f.num(r.ssResidual), f.num(r.msResidual), '', ''],
              [t('an.total'), f.int(r.dfTotal), f.num(r.ssTotal), '', '', ''],
            ],
            numeric: [false, true, true, true, true, true],
          }}
          interpretation={[t('reg.anovaInterp', { y: vy.name, f: f.num(r.f), df: r.dfResidual, p: f.pEq(r.pF) })]}
          onAdd={props.onAdd}
        />
        <ResultBlock
          heading={title}
          title={t('reg.coefTitle')}
          table={{
            columns: [t('reg.term'), t('reg.B'), t('reg.se'), t('col.t'), t('col.p'), t('col.ciLower', { level: lv }), t('col.ciUpper', { level: lv })],
            rows: [
              [t('reg.intercept'), f.num(r.intercept.b), f.num(r.intercept.se), f.num(r.intercept.t), f.p(r.intercept.p), f.num(r.intercept.lower), f.num(r.intercept.upper)],
              [vx.name, f.num(r.slope.b), f.num(r.slope.se), f.num(r.slope.t), f.p(r.slope.p), f.num(r.slope.lower), f.num(r.slope.upper)],
            ],
            numeric: [false, true, true, true, true, true, true],
          }}
          notes={hypothesisNotes(h0, h1)}
          interpretation={[
            t('reg.coefInterp', { df: r.dfResidual, level: lv }),
            decisionSentence(r.slope.p, alpha, t('reg.h0short'), f, t),
          ]}
          onAdd={props.onAdd}
        />
        <div class="result-block">
          <h3 class="result-title">{t('reg.equationTitle')}</h3>
          <p class="equation">
            {t('reg.equationWords', { y: vy.name, x: vx.name, b0: f.num(r.intercept.b), sign: b1 < 0 ? '−' : '+', b1: f.num(Math.abs(b1)) })}
          </p>
          <p>
            {t('reg.equationMeaning', {
              x: vx.name,
              y: vy.name,
              xunit: vx.unit || t('reg.unitFallback'),
              yunit: vy.unit || t('reg.unitFallback'),
              yunitSuffix: yu,
              b1abs: f.num(Math.abs(b1)),
              direction: b1 < 0 ? t('reg.lower') : t('reg.higher'),
              b0: f.num(r.intercept.b),
            })}
          </p>
        </div>
        <ChartSection title={t('reg.scatterTitle')} heading={title} fileBase={`${d.name}_regression_${vy.name}_${vx.name}`} onAdd={props.onAdd}>
          <Scatter
            title={t('cor.scatterTitle', { x: vx.name, y: vy.name })}
            xLabel={labelWithUnit(vx)}
            yLabel={labelWithUnit(vy)}
            x={x}
            y={y}
            line={{ a: r.intercept.b, b: b1 }}
            sep={f.sep}
          />
        </ChartSection>
        <ChartSection
          title={t('reg.residualTitle', { x: vx.name })}
          heading={title}
          fileBase={`${d.name}_residuals_${vy.name}_${vx.name}`}
          footer={[t('reg.residualNote')]}
          onAdd={props.onAdd}
        >
          <Scatter
            title={t('reg.residualTitle', { x: vx.name })}
            xLabel={labelWithUnit(vx)}
            yLabel={t('reg.residualAxis', { y: vy.name })}
            x={x}
            y={r.residuals}
            zeroLine
            sep={f.sep}
          />
        </ChartSection>
        <div class="result-block">
          <h3 class="result-title">{t('reg.predictTitle')}</h3>
          <label class="field">
            <span class="field-label">{t('reg.predictLabel', { x: labelWithUnit(vx) })}</span>
            <input class="input input-small" inputMode="decimal" value={x0Text} onInput={(e) => setX0Text(e.currentTarget.value)} />
          </label>
          {hasX0 && (
            <>
              <p class="equation">{t('reg.predictResult', { y: vy.name, x: vx.name, x0: f.num(x0), yhat: f.num(yhat), yunit: yu })}</p>
              {(x0 < r.minX || x0 > r.maxX) && <Note>{t('reg.extrapolation', { x0: f.num(x0), x: vx.name, min: f.num(r.minX), max: f.num(r.maxX) })}</Note>}
            </>
          )}
        </div>
      </TestFrame>
    </>
  );
}

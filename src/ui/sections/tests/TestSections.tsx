import { useState } from 'preact/hooks';
import type { Variable } from '../../../data/types';
import { useT } from '../../../i18n/i18n';
import { levene, oneWayAnova, tukeyKramer } from '../../../stats/anova';
import { chiSquareGof, chiSquareIndependence } from '../../../stats/chisquare';
import { sturgesBins, summarize } from '../../../stats/descriptive';
import { shapiroWilk } from '../../../stats/normality';
import { oneProportionZ, oneSampleT, pairedT, twoProportionZ, welchT, type Alternative } from '../../../stats/tests';
import { BoxPlot, Histogram, QQPlot } from '../../charts/charts';
import { ChartSection } from '../../charts/ChartSection';
import { DistChart } from '../../charts/DistChart';
import { useFmt } from '../../fmt';
import { ResultBlock } from '../../shell/ResultBlock';
import { labelWithUnit, unitSuffix } from '../columns';
import {
  Hypotheses,
  Note,
  TestFrame,
  alphaText,
  decision,
  decisionSentence,
  hypothesisNotes,
  plain,
  tailWord,
  type AddFn,
} from './common';

interface Common {
  alpha: number;
  dataName: string;
  onAdd: AddFn;
}

const pct = (x: number) => x * 100;

// ---------------------------------------------------------------- small shared charts

function HistQQ(props: { name: string; xLabel: string; values: number[]; heading: string; dataName: string; onAdd: AddFn }) {
  const t = useT();
  const f = useFmt();
  const sw = shapiroWilk(props.values);
  return (
    <>
      <ChartSection title={t('chart.histogram', { name: props.name })} heading={props.heading} fileBase={`${props.dataName}_histogram_${props.name}`} onAdd={props.onAdd}>
        <Histogram
          title={t('chart.histogram', { name: props.name })}
          xLabel={props.xLabel}
          yLabel={t('chart.frequency')}
          values={props.values}
          bins={sturgesBins(props.values.length)}
          density={false}
          showMean={false}
          showMedian={false}
          showNormal
          statsText={null}
          meanLabel=""
          medianLabel=""
          sep={f.sep}
        />
      </ChartSection>
      <QQSection {...props} footer={[sw ? t('chart.sw', { w: f.num(sw.w), p: f.pEq(sw.p), n: sw.n }) : t('chart.swNA'), t('chart.swCaption')]} />
    </>
  );
}

function QQSection(props: { name: string; xLabel: string; values: number[]; heading: string; dataName: string; onAdd: AddFn; footer?: string[] }) {
  const t = useT();
  const f = useFmt();
  return (
    <ChartSection title={t('chart.qq', { name: props.name })} heading={props.heading} fileBase={`${props.dataName}_qqplot_${props.name}`} onAdd={props.onAdd} footer={props.footer}>
      <QQPlot title={t('chart.qq', { name: props.name })} valueLabel={props.xLabel} zLabel={t('chart.theoretical')} values={props.values} band sep={f.sep} />
    </ChartSection>
  );
}

// ---------------------------------------------------------------- one-sample t

export function OneSampleSection(props: Common & { v: Variable; values: number[]; missing: number; mu0: number; alt: Alternative }) {
  const t = useT();
  const f = useFmt();
  const r = oneSampleT(props.values, props.mu0, props.alt, props.alpha);
  const title = t('os.title');
  if (!r) return <Note>{t('tests.tooFew')}</Note>;
  const u = unitSuffix(props.v);
  const vars = { var: props.v.name, mu0: f.num(props.mu0), unit: u };
  const h0 = t('os.h0', vars);
  const h1 = t(`os.h1.${props.alt}`, vars);
  const level = Math.round((1 - props.alpha) * 100);
  const excluded = props.missing > 0 ? [t('describe.excluded', { count: props.missing })] : [];
  const tail = tailWord(props.alt, t);
  return (
    <TestFrame
      title={title}
      heading={title}
      sep={f.sep}
      onAdd={props.onAdd}
      manual={[
        { label: 'n', value: r.n },
        { label: 'x̄', value: r.mean },
        { label: 's', value: r.sd },
        { label: 'SE = s/√n', value: r.se },
        { label: 'df = n − 1', value: r.df },
        { label: 'μ₀', value: r.mu0 },
        { label: 'x̄ − μ₀', value: r.diff },
        { label: 't = (x̄ − μ₀)/SE', value: r.t },
        { label: t('man.crit', { tail, alpha: alphaText(props.alpha, f) }), value: r.tCrit },
        { label: 'p', value: r.p },
        { label: t('man.ciCrit', { level }), value: r.ciT },
      ]}
      assumptions={
        <>
          <p>{t('tests.nPerGroup', { list: String(r.n) })}. {t('tests.n30')}</p>
          <HistQQ name={props.v.name} xLabel={labelWithUnit(props.v)} values={props.values} heading={title} dataName={props.dataName} onAdd={props.onAdd} />
        </>
      }
    >
      <Hypotheses h0={h0} h1={h1} />
      <ResultBlock
        heading={title}
        title={t('describe.tableTitle')}
        table={{
          columns: [t('col.variable'), t('col.n'), t('col.mean'), t('col.sd'), t('col.se')],
          rows: [[labelWithUnit(props.v), f.int(r.n), f.num(r.mean), f.num(r.sd), f.num(r.se)]],
          numeric: [false, true, true, true, true],
        }}
        notes={excluded}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.result')}
        table={{
          columns: [`${t('os.diff')}${props.v.unit ? ` (${props.v.unit})` : ''}`, t('col.t'), t('col.df'), t('col.p'), t('col.decision')],
          rows: [[f.num(r.diff), f.num(r.t), f.int(r.df), f.p(r.p), decision(r.p, props.alpha, t)]],
          numeric: [true, true, true, true, false],
        }}
        notes={hypothesisNotes(h0, h1)}
        interpretation={[
          t('os.interp', { mean: f.num(r.mean), mu0: f.num(r.mu0), diff: f.num(r.diff), t: f.num(r.t), se: f.num(r.se), df: r.df, tail, p: f.pEq(r.p), unit: u }),
          decisionSentence(r.p, props.alpha, t('os.h0short', { mu0: f.num(r.mu0) }), f, t),
        ]}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.ci')}
        table={{
          columns: [t('col.mean'), t('col.ciLower', { level }), t('col.ciUpper', { level })],
          rows: [[f.num(r.mean), f.num(r.ciLower), f.num(r.ciUpper)]],
          numeric: [true, true, true],
        }}
        interpretation={[t('describe.interp.ci', { level, lower: f.num(r.ciLower), upper: f.num(r.ciUpper), unit: u })]}
        onAdd={props.onAdd}
      />
    </TestFrame>
  );
}

// ---------------------------------------------------------------- one-proportion z

export function OneProportionSection(props: Common & { varName: string; cat: string; x: number; n: number; missing: number; p0: number; alt: Alternative }) {
  const t = useT();
  const f = useFmt();
  const r = oneProportionZ(props.x, props.n, props.p0, props.alt, props.alpha);
  const title = t('op.title');
  if (!r) return <Note>{t('tests.tooFew')}</Note>;
  const vars = { var: props.varName, cat: props.cat, p0: f.num(pct(props.p0)) };
  const h0 = t('op.h0', vars);
  const h1 = t(`op.h1.${props.alt}`, vars);
  const level = Math.round((1 - props.alpha) * 100);
  const tail = tailWord(props.alt, t);
  const cond = t('op.cond', {
    a: f.num(r.n * r.p0),
    b: f.num(r.n * (1 - r.p0)),
    verdict: r.conditionsMet ? t('tests.condOk') : t('tests.condFail'),
  });
  return (
    <TestFrame
      title={title}
      heading={title}
      sep={f.sep}
      onAdd={props.onAdd}
      manual={[
        { label: 'n', value: r.n },
        { label: 'x', value: r.x },
        { label: 'p̂ = x/n', value: r.pHat },
        { label: 'p₀', value: r.p0 },
        { label: 'SE₀ = √(p₀(1 − p₀)/n)', value: r.se0 },
        { label: 'z = (p̂ − p₀)/SE₀', value: r.z },
        { label: t('man.crit', { tail, alpha: alphaText(props.alpha, f) }), value: r.zCrit },
        { label: 'p', value: r.p },
        { label: 'SE = √(p̂(1 − p̂)/n)', value: r.seHat },
        { label: t('man.ciCrit', { level }), value: r.ciZ },
      ]}
      assumptions={<p>{cond}</p>}
    >
      <Hypotheses h0={h0} h1={h1} />
      {!r.conditionsMet && <Note>{cond}</Note>}
      <ResultBlock
        heading={title}
        title={t('tests.result')}
        table={{
          columns: [t('col.n'), t('op.successes', { cat: props.cat }), t('op.pHat'), t('op.p0'), t('op.diffPts'), t('col.z'), t('col.p'), t('col.decision')],
          rows: [[f.int(r.n), f.int(r.x), f.pct(pct(r.pHat)), f.pct(pct(r.p0)), f.num(pct(r.pHat - r.p0)), f.num(r.z), f.p(r.p), decision(r.p, props.alpha, t)]],
          numeric: [true, true, true, true, true, true, true, false],
        }}
        notes={[...(props.missing > 0 ? [t('describe.excluded', { count: props.missing })] : []), ...hypothesisNotes(h0, h1)]}
        interpretation={[
          t('op.interp', { x: r.x, n: r.n, cat: props.cat, phat: f.pct(pct(r.pHat)), se: f.num(r.se0), z: f.num(r.z), tail, p: f.pEq(r.p) }),
          decisionSentence(r.p, props.alpha, t('op.h0short', { p0: f.num(pct(r.p0)) }), f, t),
        ]}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.ci')}
        table={{
          columns: [t('op.pHat'), t('col.ciLower', { level }), t('col.ciUpper', { level })],
          rows: [[f.pct(pct(r.pHat)), f.pct(pct(r.ciLower)), f.pct(pct(r.ciUpper))]],
          numeric: [true, true, true],
        }}
        interpretation={[t('describe.interp.freqCi', { level })]}
        onAdd={props.onAdd}
      />
    </TestFrame>
  );
}

// ---------------------------------------------------------------- Welch two-sample t

export function WelchSection(
  props: Common & {
    v: Variable;
    groupName: string;
    g1: { label: string; values: number[] };
    g2: { label: string; values: number[] };
    excluded: number;
    alt: Alternative;
  },
) {
  const t = useT();
  const f = useFmt();
  const r = welchT(props.g1.values, props.g2.values, props.alt, props.alpha);
  const title = t('ws.title');
  if (!r) return <Note>{t('tests.tooFew')}</Note>;
  const u = unitSuffix(props.v);
  const g1 = props.g1.label;
  const g2 = props.g2.label;
  const vars = { var: props.v.name, g1, g2 };
  const h0 = t('ws.h0', vars);
  const h1 = t(`ws.h1.${props.alt}`, vars);
  const level = Math.round((1 - props.alpha) * 100);
  const tail = tailWord(props.alt, t);
  const ratio = Math.max(r.sd1, r.sd2) / Math.min(r.sd1, r.sd2);
  return (
    <TestFrame
      title={title}
      heading={title}
      sep={f.sep}
      onAdd={props.onAdd}
      manual={[
        { label: `n₁ (${g1})`, value: r.n1 },
        { label: 'x̄₁', value: r.mean1 },
        { label: 's₁', value: r.sd1 },
        { label: `n₂ (${g2})`, value: r.n2 },
        { label: 'x̄₂', value: r.mean2 },
        { label: 's₂', value: r.sd2 },
        { label: 's₁²/n₁', value: r.v1 },
        { label: 's₂²/n₂', value: r.v2 },
        { label: 'SE = √(s₁²/n₁ + s₂²/n₂)', value: r.se },
        { label: 'df (Welch–Satterthwaite)', value: r.df },
        { label: 'x̄₁ − x̄₂', value: r.diff },
        { label: 't = (x̄₁ − x̄₂)/SE', value: r.t },
        { label: t('man.crit', { tail, alpha: alphaText(props.alpha, f) }), value: r.tCrit },
        { label: 'p', value: r.p },
        { label: t('man.ciCrit', { level }), value: r.ciT },
      ]}
      assumptions={
        <>
          <p>
            {t('tests.nPerGroup', { list: `${g1} ${r.n1}, ${g2} ${r.n2}` })}. {t('tests.n30')}
          </p>
          <p>{t('tests.sdRatio', { ratio: f.num(ratio) })}</p>
          {[props.g1, props.g2].map((g) => (
            <QQSection
              key={g.label}
              name={`${props.v.name} (${g.label})`}
              xLabel={labelWithUnit(props.v)}
              values={g.values}
              heading={title}
              dataName={props.dataName}
              onAdd={props.onAdd}
            />
          ))}
        </>
      }
    >
      <Hypotheses h0={h0} h1={h1} />
      <ResultBlock
        heading={title}
        title={t('ws.descTitle')}
        table={{
          columns: [props.groupName, t('col.n'), t('col.mean'), t('col.sd'), t('col.se')],
          rows: [
            [g1, f.int(r.n1), f.num(r.mean1), f.num(r.sd1), f.num(r.se1)],
            [g2, f.int(r.n2), f.num(r.mean2), f.num(r.sd2), f.num(r.se2)],
          ],
          numeric: [false, true, true, true, true],
        }}
        notes={props.excluded > 0 ? [t('describe.excluded', { count: props.excluded })] : []}
        onAdd={props.onAdd}
      />
      <ChartSection title={t('ws.boxTitle', { var: props.v.name, group: props.groupName })} heading={title} fileBase={`${props.dataName}_boxplot_${props.v.name}`} onAdd={props.onAdd}>
        <BoxPlot
          title={t('ws.boxTitle', { var: props.v.name, group: props.groupName })}
          valueLabel={labelWithUnit(props.v)}
          groupLabel={props.groupName}
          groups={[props.g1, props.g2]}
          horizontal={false}
          showMean
          showPoints={false}
          sep={f.sep}
        />
      </ChartSection>
      <ResultBlock
        heading={title}
        title={t('tests.result')}
        table={{
          columns: [`${t('ws.diffCol', { g1, g2 })}${props.v.unit ? ` (${props.v.unit})` : ''}`, t('col.t'), t('col.df'), t('col.p'), t('col.decision')],
          rows: [[f.num(r.diff), f.num(r.t), f.num(r.df), f.p(r.p), decision(r.p, props.alpha, t)]],
          numeric: [true, true, true, true, false],
        }}
        notes={[t('tests.diffDef', { first: g1, second: g2 }), ...hypothesisNotes(h0, h1)]}
        interpretation={[
          t('ws.interp', { g1, g2, diff: f.num(r.diff), t: f.num(r.t), se: f.num(r.se), df: f.num(r.df), tail, p: f.pEq(r.p), unit: u }),
          decisionSentence(r.p, props.alpha, t('ws.h0short'), f, t),
        ]}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.ci')}
        table={{
          columns: [t('ws.diffCol', { g1, g2 }), t('col.ciLower', { level }), t('col.ciUpper', { level })],
          rows: [[f.num(r.diff), f.num(r.ciLower), f.num(r.ciUpper)]],
          numeric: [true, true, true],
        }}
        onAdd={props.onAdd}
      />
    </TestFrame>
  );
}

// ---------------------------------------------------------------- paired t

export function PairedSection(
  props: Common & { before: Variable; after: Variable; b: number[]; a: number[]; excluded: number; alt: Alternative },
) {
  const t = useT();
  const f = useFmt();
  const r = pairedT(props.b, props.a, props.alt, props.alpha);
  const title = t('pt.title');
  if (!r) return <Note>{t('tests.tooFew')}</Note>;
  const names = { after: props.after.name, before: props.before.name };
  const u = unitSuffix(props.after);
  const h0 = t('pt.h0', names);
  const h1 = t(`pt.h1.${props.alt}`, names);
  const level = Math.round((1 - props.alpha) * 100);
  const tail = tailWord(props.alt, t);
  const sb = summarize(props.b);
  const sa = summarize(props.a);
  const diffName = t('pt.diffName', names);
  return (
    <TestFrame
      title={title}
      heading={title}
      sep={f.sep}
      onAdd={props.onAdd}
      manual={[
        { label: 'n', value: r.n },
        { label: 'd̄', value: r.meanD },
        { label: 's_d', value: r.sdD },
        { label: 'SE = s_d/√n', value: r.se },
        { label: 'df = n − 1', value: r.df },
        { label: 't = d̄/SE', value: r.t },
        { label: t('man.crit', { tail, alpha: alphaText(props.alpha, f) }), value: r.tCrit },
        { label: 'p', value: r.p },
        { label: t('man.ciCrit', { level }), value: r.ciT },
      ]}
      assumptions={
        <>
          <p>{t('tests.nPerGroup', { list: String(r.n) })}. {t('tests.n30')}</p>
          <HistQQ name={diffName} xLabel={diffName} values={r.diffs} heading={title} dataName={props.dataName} onAdd={props.onAdd} />
        </>
      }
    >
      <Note kind="info">{t('pt.note')}</Note>
      <Hypotheses h0={h0} h1={h1} />
      <ResultBlock
        heading={title}
        title={t('describe.tableTitle')}
        table={{
          columns: [t('col.variable'), t('col.n'), t('col.mean'), t('col.sd')],
          rows: [
            [labelWithUnit(props.before), f.int(sb.n), f.num(sb.mean), f.num(sb.sd)],
            [labelWithUnit(props.after), f.int(sa.n), f.num(sa.mean), f.num(sa.sd)],
            [t('pt.diffRow', names), f.int(r.n), f.num(r.meanD), f.num(r.sdD)],
          ],
          numeric: [false, true, true, true],
        }}
        notes={props.excluded > 0 ? [t('describe.excluded', { count: props.excluded })] : []}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.result')}
        table={{
          columns: [`${t('pt.meanD')}${props.after.unit ? ` (${props.after.unit})` : ''}`, t('pt.sdD'), t('col.t'), t('col.df'), t('col.p'), t('col.decision')],
          rows: [[f.num(r.meanD), f.num(r.sdD), f.num(r.t), f.int(r.df), f.p(r.p), decision(r.p, props.alpha, t)]],
          numeric: [true, true, true, true, true, false],
        }}
        notes={[t('pt.dDef', names), ...hypothesisNotes(h0, h1)]}
        interpretation={[
          t('pt.interp', { n: r.n, d: f.num(r.meanD), t: f.num(r.t), se: f.num(r.se), df: r.df, tail, p: f.pEq(r.p), unit: u }),
          decisionSentence(r.p, props.alpha, t('pt.h0short'), f, t),
        ]}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.ci')}
        table={{
          columns: [t('pt.meanD'), t('col.ciLower', { level }), t('col.ciUpper', { level })],
          rows: [[f.num(r.meanD), f.num(r.ciLower), f.num(r.ciUpper)]],
          numeric: [true, true, true],
        }}
        onAdd={props.onAdd}
      />
    </TestFrame>
  );
}

// ---------------------------------------------------------------- two-proportion z

export function TwoProportionSection(
  props: Common & {
    outcome: string;
    cat: string;
    g1: { label: string; x: number; n: number };
    g2: { label: string; x: number; n: number };
    excluded: number;
    alt: Alternative;
    /** χ² of the same 2 × 2 table, for the z² note. */
    chi2?: number;
  },
) {
  const t = useT();
  const f = useFmt();
  const r = twoProportionZ(props.g1.x, props.g1.n, props.g2.x, props.g2.n, props.alt, props.alpha);
  const title = t('tp.title');
  if (!r) return <Note>{t('tests.tooFew')}</Note>;
  const g1 = props.g1.label;
  const g2 = props.g2.label;
  const vars = { outcome: props.outcome, cat: props.cat, g1, g2 };
  const h0 = t('tp.h0', vars);
  const h1 = t(`tp.h1.${props.alt}`, vars);
  const level = Math.round((1 - props.alpha) * 100);
  const tail = tailWord(props.alt, t);
  const cond = t('tp.cond', { verdict: r.conditionsMet ? t('tests.condOk') : t('tests.condFail') });
  return (
    <TestFrame
      title={title}
      heading={title}
      sep={f.sep}
      onAdd={props.onAdd}
      manual={[
        { label: `x₁ (${g1})`, value: r.x1 },
        { label: 'n₁', value: r.n1 },
        { label: 'p̂₁', value: r.p1 },
        { label: `x₂ (${g2})`, value: r.x2 },
        { label: 'n₂', value: r.n2 },
        { label: 'p̂₂', value: r.p2 },
        { label: 'p̄ = (x₁ + x₂)/(n₁ + n₂)', value: r.pooled },
        { label: 'SE = √(p̄(1 − p̄)(1/n₁ + 1/n₂))', value: r.se },
        { label: 'z = (p̂₁ − p̂₂)/SE', value: r.z },
        { label: t('man.crit', { tail, alpha: alphaText(props.alpha, f) }), value: r.zCrit },
        { label: 'p', value: r.p },
        { label: 'SE (CI) = √(p̂₁(1 − p̂₁)/n₁ + p̂₂(1 − p̂₂)/n₂)', value: r.seCI },
        { label: t('man.ciCrit', { level }), value: r.ciZ },
      ]}
      assumptions={<p>{cond}</p>}
    >
      <Hypotheses h0={h0} h1={h1} />
      {!r.conditionsMet && <Note>{cond}</Note>}
      <ResultBlock
        heading={title}
        title={t('tp.sharesTitle')}
        table={{
          columns: [t('col.group'), t('col.n'), t('tp.successes', { cat: props.cat }), t('tp.share')],
          rows: [
            [g1, f.int(r.n1), f.int(r.x1), f.pct(pct(r.p1))],
            [g2, f.int(r.n2), f.int(r.x2), f.pct(pct(r.p2))],
          ],
          numeric: [false, true, true, true],
        }}
        notes={props.excluded > 0 ? [t('describe.excluded', { count: props.excluded })] : []}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.result')}
        table={{
          columns: [t('tp.diffCol', { g1, g2 }), t('tp.pooled'), t('col.z'), t('col.p'), t('col.decision')],
          rows: [[f.num(pct(r.diff)), f.pct(pct(r.pooled)), f.num(r.z), f.p(r.p), decision(r.p, props.alpha, t)]],
          numeric: [true, true, true, true, false],
        }}
        notes={[
          t('tests.diffDef', { first: g1, second: g2 }),
          ...hypothesisNotes(h0, h1),
          ...(props.chi2 !== undefined && props.alt === 'two-sided' ? [t('tp.z2', { z2: f.num(r.z * r.z), chi2: f.num(props.chi2) })] : []),
        ]}
        interpretation={[
          t('tp.interp', { pooled: f.pct(pct(r.pooled)), se: f.num(r.se), diff: f.num(pct(r.diff)), z: f.num(r.z), tail, p: f.pEq(r.p) }),
          decisionSentence(r.p, props.alpha, t('tp.h0short'), f, t),
        ]}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.ci')}
        table={{
          columns: [t('tp.diffCol', { g1, g2 }), t('col.ciLower', { level }), t('col.ciUpper', { level })],
          rows: [[f.num(pct(r.diff)), f.num(pct(r.ciLower)), f.num(pct(r.ciUpper))]],
          numeric: [true, true, true],
        }}
        onAdd={props.onAdd}
      />
    </TestFrame>
  );
}

// ---------------------------------------------------------------- one-way ANOVA + Tukey–Kramer

export function AnovaSection(
  props: Common & { v: Variable; groupName: string; groups: { label: string; values: number[] }[]; excluded: number },
) {
  const t = useT();
  const f = useFmt();
  const a = oneWayAnova(props.groups, props.alpha);
  const title = t('an.title');
  if (!a || props.groups.some((g) => g.values.length < 2)) return <Note>{t('tests.tooFew')}</Note>;
  const vars = { var: props.v.name, group: props.groupName, k: a.k };
  const h0 = t('an.h0', vars);
  const h1 = t('an.h1', vars);
  const level = Math.round((1 - props.alpha) * 100);
  const tk = tukeyKramer(a, props.alpha);
  const lev = levene(props.groups);
  const sds = a.groups.map((g) => g.sd);
  const ratio = Math.max(...sds) / Math.min(...sds);
  const alphaStr = alphaText(props.alpha, f);
  return (
    <TestFrame
      title={title}
      heading={title}
      sep={f.sep}
      onAdd={props.onAdd}
      manual={[
        { label: 'N', value: a.N },
        { label: 'k', value: a.k },
        { label: 'x̄ (grand mean)', value: a.grandMean },
        { label: 'SS between = Σ nᵢ(x̄ᵢ − x̄)²', value: a.ssBetween },
        { label: 'SS within = ΣΣ (x − x̄ᵢ)²', value: a.ssWithin },
        { label: 'df between = k − 1', value: a.dfBetween },
        { label: 'df within = N − k', value: a.dfWithin },
        { label: 'MS between', value: a.msBetween },
        { label: 'MS within', value: a.msWithin },
        { label: 'F = MS between / MS within', value: a.f },
        { label: `F crit (α = ${alphaStr})`, value: a.fCrit },
        { label: 'p', value: a.p },
        { label: `q crit (Tukey, α = ${alphaStr})`, value: tk.qCrit },
      ]}
      assumptions={
        <>
          <ResultBlock
            heading={title}
            title={t('an.sdTitle')}
            table={{
              columns: [props.groupName, t('col.n'), t('col.sd')],
              rows: a.groups.map((g) => [g.label, f.int(g.count), f.num(g.sd)]),
              numeric: [false, true, true],
            }}
            notes={[t('tests.sdRatio', { ratio: f.num(ratio) })]}
            onAdd={props.onAdd}
          />
          {lev && (
            <ResultBlock
              heading={title}
              title={t('an.leveneTitle')}
              table={{
                columns: [t('an.leveneW'), t('col.df'), t('col.p')],
                rows: [[f.num(lev.w), `${lev.df1}, ${lev.df2}`, f.p(lev.p)]],
                numeric: [true, true, true],
              }}
              notes={[t('an.leveneInterp', { p: f.pEq(lev.p), verdict: lev.p < props.alpha ? t('an.leveneDiffer') : t('an.leveneSame') })]}
              onAdd={props.onAdd}
            />
          )}
          {props.groups.map((g) => (
            <QQSection
              key={g.label}
              name={`${props.v.name} (${g.label})`}
              xLabel={labelWithUnit(props.v)}
              values={g.values}
              heading={title}
              dataName={props.dataName}
              onAdd={props.onAdd}
            />
          ))}
        </>
      }
    >
      <Hypotheses h0={h0} h1={h1} />
      <ResultBlock
        heading={title}
        title={t('an.summaryTitle')}
        table={{
          columns: [t('an.groups'), t('an.count'), t('an.sum'), t('an.average'), t('an.variance')],
          rows: a.groups.map((g) => [g.label, f.int(g.count), f.num(g.sum), f.num(g.mean), f.num(g.variance)]),
          numeric: [false, true, true, true, true],
        }}
        notes={props.excluded > 0 ? [t('describe.excluded', { count: props.excluded })] : []}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('an.tableTitle')}
        table={{
          columns: [t('an.source'), t('an.ss'), t('col.df'), t('an.ms'), t('an.f'), t('col.p'), t('an.fcrit')],
          rows: [
            [t('an.between'), f.num(a.ssBetween), f.int(a.dfBetween), f.num(a.msBetween), f.num(a.f), f.p(a.p), f.num(a.fCrit)],
            [t('an.within'), f.num(a.ssWithin), f.int(a.dfWithin), f.num(a.msWithin), '', '', ''],
            [t('an.total'), f.num(a.ssTotal), f.int(a.dfTotal), '', '', '', ''],
          ],
          numeric: [false, true, true, true, true, true, true],
        }}
        notes={hypothesisNotes(h0, h1)}
        interpretation={[
          t('an.interp', { f: f.num(a.f), df1: a.dfBetween, df2: a.dfWithin, p: f.pEq(a.p) }),
          decisionSentence(a.p, props.alpha, t('an.h0short'), f, t),
        ]}
        onAdd={props.onAdd}
      />
      <ChartSection title={t('chart.boxplot', { name: props.v.name })} heading={title} fileBase={`${props.dataName}_boxplot_${props.v.name}`} onAdd={props.onAdd}>
        <BoxPlot
          title={t('ws.boxTitle', { var: props.v.name, group: props.groupName })}
          valueLabel={labelWithUnit(props.v)}
          groupLabel={props.groupName}
          groups={props.groups}
          horizontal={false}
          showMean
          showPoints={false}
          sep={f.sep}
        />
      </ChartSection>
      <ChartSection title={t('an.fChart', { df1: a.dfBetween, df2: a.dfWithin })} heading={title} fileBase={`${props.dataName}_F_${props.v.name}`} onAdd={props.onAdd}>
        <DistChart
          kind="F"
          df1={a.dfBetween}
          df2={a.dfWithin}
          stat={a.f}
          crit={a.fCrit}
          title={t('an.fChart', { df1: a.dfBetween, df2: a.dfWithin })}
          xLabel="F"
          yLabel={t('chart.density')}
          observedLabel={t('chart.observedLine', { value: `F = ${f.num(a.f)}` })}
          criticalLabel={t('chart.criticalLine', { value: f.num(a.fCrit) })}
          pLabel={t('chart.pArea', { p: f.p(a.p) })}
          sep={f.sep}
        />
      </ChartSection>
      <ResultBlock
        heading={title}
        title={t('an.tukeyTitle')}
        table={{
          columns: [t('an.pair'), t('an.diff'), t('an.se'), t('an.q'), t('an.pAdj'), t('col.ciLower', { level }), t('col.ciUpper', { level })],
          rows: tk.pairs.map((p) => [`${p.first} − ${p.second}`, f.num(p.diff), f.num(p.se), f.num(p.q), f.p(p.p), f.num(p.lower), f.num(p.upper)]),
          numeric: [false, true, true, true, true, true, true],
        }}
        notes={a.p >= props.alpha ? [t('an.tukeyNotSig', { alpha: alphaStr })] : []}
        interpretation={[
          t('an.tukeyInterp', { level, m: tk.pairs.length, k: tk.k, df: tk.df, qcrit: f.num(tk.qCrit), alpha: alphaStr }),
        ]}
        onAdd={props.onAdd}
      />
    </TestFrame>
  );
}

// ---------------------------------------------------------------- chi-square independence

export function ChiSquareSection(
  props: Common & { aName: string; bName: string; rows: string[]; cols: string[]; observed: number[][]; excluded: number },
) {
  const t = useT();
  const f = useFmt();
  const r = chiSquareIndependence(props.rows, props.cols, props.observed, props.alpha);
  const title = t('cs.title');
  if (!r) return <Note>{t('tests.tooFew')}</Note>;
  const h0 = t('cs.h0', { a: props.aName, b: props.bName });
  const h1 = t('cs.h1', { a: props.aName, b: props.bName });
  const corner = `${props.aName} \\ ${props.bName}`;
  const header = [corner, ...r.cols, t('describe.total')];
  const numeric = header.map((_, i) => i > 0);
  const small = r.smallCells.map(([i, j]) => `${r.rows[i]} × ${r.cols[j]} (E = ${f.num(r.expected[i]![j]!)})`);
  const smallNote = small.length ? [t('cs.smallCells', { count: small.length, cells: small.join('; ') })] : [];
  return (
    <TestFrame
      title={title}
      heading={title}
      sep={f.sep}
      onAdd={props.onAdd}
      manual={[
        { label: 'N', value: r.total },
        { label: 'χ² = Σ(O − E)²/E', value: r.chi2 },
        { label: 'df = (r − 1)(c − 1)', value: r.df },
        { label: `χ² crit (α = ${alphaText(props.alpha, f)})`, value: r.critical },
        { label: 'p', value: r.p },
      ]}
      assumptions={
        <ResultBlock
          heading={title}
          title={t('cs.expected')}
          table={{
            columns: header,
            rows: [
              ...r.rows.map((row, i) => [row, ...r.expected[i]!.map((e) => f.num(e)), f.int(r.rowTotals[i]!)]),
              [t('describe.total'), ...r.colTotals.map((c) => f.int(c)), f.int(r.total)],
            ],
            numeric,
          }}
          notes={smallNote.length ? smallNote : [t('ss.minChi')]}
          onAdd={props.onAdd}
        />
      }
    >
      <Hypotheses h0={h0} h1={h1} />
      {smallNote.map((n) => (
        <Note key={n}>{n}</Note>
      ))}
      <ResultBlock
        heading={title}
        title={t('cs.observed')}
        table={{
          columns: header,
          rows: [
            ...r.rows.map((row, i) => [row, ...r.observed[i]!.map((o) => f.int(o)), f.int(r.rowTotals[i]!)]),
            [t('describe.total'), ...r.colTotals.map((c) => f.int(c)), f.int(r.total)],
          ],
          numeric,
        }}
        notes={props.excluded > 0 ? [t('describe.excluded', { count: props.excluded })] : []}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('cs.expected')}
        table={{
          columns: header,
          rows: [
            ...r.rows.map((row, i) => [row, ...r.expected[i]!.map((e) => f.num(e)), f.int(r.rowTotals[i]!)]),
            [t('describe.total'), ...r.colTotals.map((c) => f.int(c)), f.int(r.total)],
          ],
          numeric,
        }}
        onAdd={props.onAdd}
      />
      <ResultBlock
        heading={title}
        title={t('tests.result')}
        table={{
          columns: [t('cs.chi2'), t('col.df'), t('col.p'), t('col.decision')],
          rows: [[f.num(r.chi2), f.int(r.df), f.p(r.p), decision(r.p, props.alpha, t)]],
          numeric: [true, true, true, false],
        }}
        notes={hypothesisNotes(h0, h1)}
        interpretation={[t('cs.interp', { chi2: f.num(r.chi2), df: r.df, p: f.pEq(r.p) }), decisionSentence(r.p, props.alpha, t('cs.h0short'), f, t)]}
        onAdd={props.onAdd}
      />
      <ChartSection title={t('cs.chart', { df: r.df })} heading={title} fileBase={`${props.dataName}_chisquare`} onAdd={props.onAdd}>
        <DistChart
          kind="chi2"
          df1={r.df}
          stat={r.chi2}
          crit={r.critical}
          title={t('cs.chart', { df: r.df })}
          xLabel="χ²"
          yLabel={t('chart.density')}
          observedLabel={t('chart.observedLine', { value: `χ² = ${f.num(r.chi2)}` })}
          criticalLabel={t('chart.criticalLine', { value: f.num(r.critical) })}
          pLabel={t('chart.pArea', { p: f.p(r.p) })}
          sep={f.sep}
        />
      </ChartSection>
    </TestFrame>
  );
}

// ---------------------------------------------------------------- chi-square goodness of fit

export function GofSection(props: Common & { varName: string; categories: string[]; observed: number[]; missing: number }) {
  const t = useT();
  const f = useFmt();
  const k = props.categories.length;
  const [shares, setShares] = useState<string[]>(() => props.categories.map(() => (100 / k).toFixed(2)));
  const key = props.categories.join('\u0000');
  const [shareKey, setShareKey] = useState(key);
  if (shareKey !== key) {
    setShareKey(key);
    setShares(props.categories.map(() => (100 / k).toFixed(2)));
  }
  const parsed = shares.map((s) => Number(s.replace(',', '.')));
  const sum = parsed.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const sumOk = Math.abs(sum - 100) < 0.05 && parsed.every((x) => x > 0);
  // Equal shares typed as 33.33 + 33.33 + 33.33 are normalised to sum exactly to 1.
  const fractions = parsed.map((x) => x / sum);
  const r = sumOk ? chiSquareGof(props.categories, props.observed, fractions, props.alpha) : null;
  const title = t('gof.title');
  const h0 = t('gof.h0', { var: props.varName });
  const h1 = t('gof.h1', { var: props.varName });
  const small = r ? r.smallCells.map((i) => `${r.categories[i]} (E = ${f.num(r.expected[i]!)})`) : [];
  const smallNote = small.length ? [t('cs.smallCells', { count: small.length, cells: small.join('; ') })] : [];

  return (
    <TestFrame
      title={title}
      heading={title}
      sep={f.sep}
      onAdd={props.onAdd}
      manual={
        r
          ? [
              { label: 'n', value: r.total },
              { label: 'χ² = Σ(O − E)²/E', value: r.chi2 },
              { label: 'df = k − 1', value: r.df },
              { label: `χ² crit (α = ${alphaText(props.alpha, f)})`, value: r.critical },
              { label: 'p', value: r.p },
            ]
          : undefined
      }
    >
      <fieldset class="opt-group">
        <legend>{t('gof.shares')}</legend>
        <div class="summary-form">
          {props.categories.map((c, i) => (
            <label key={c} class="field">
              <span class="field-label">{c}</span>
              <input
                class="input input-small"
                inputMode="decimal"
                value={shares[i]}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  setShares((s) => s.map((x, j) => (j === i ? v : x)));
                }}
              />
            </label>
          ))}
        </div>
        <button type="button" class="link-btn small" onClick={() => setShares(props.categories.map(() => (100 / k).toFixed(2)))}>
          {t('gof.equal')}
        </button>
      </fieldset>
      {!sumOk && <Note>{t('gof.sumWarn', { sum: f.num(sum) })}</Note>}
      <Hypotheses h0={h0} h1={h1} />
      {r && (
        <>
          {smallNote.map((n) => (
            <Note key={n}>{n}</Note>
          ))}
          <ResultBlock
            heading={title}
            title={t('describe.freqTitle', { name: props.varName })}
            table={{
              columns: [t('describe.category'), t('gof.observed'), t('gof.expShare'), t('gof.expCount'), t('gof.contrib')],
              rows: [
                ...r.categories.map((c, i) => [c, f.int(r.observed[i]!), f.pct(fractions[i]! * 100), f.num(r.expected[i]!), f.num(r.contributions[i]!)]),
                [t('describe.total'), f.int(r.total), f.pct(100), f.num(r.total), f.num(r.chi2)],
              ],
              numeric: [false, true, true, true, true],
            }}
            notes={props.missing > 0 ? [t('describe.excluded', { count: props.missing })] : []}
            onAdd={props.onAdd}
          />
          <ResultBlock
            heading={title}
            title={t('tests.result')}
            table={{
              columns: [t('cs.chi2'), t('col.df'), t('col.p'), t('col.decision')],
              rows: [[f.num(r.chi2), f.int(r.df), f.p(r.p), decision(r.p, props.alpha, t)]],
              numeric: [true, true, true, false],
            }}
            notes={hypothesisNotes(h0, h1)}
            interpretation={[t('gof.interp', { n: r.total, chi2: f.num(r.chi2), df: r.df, p: f.pEq(r.p) }), decisionSentence(r.p, props.alpha, t('gof.h0short'), f, t)]}
            onAdd={props.onAdd}
          />
          <ChartSection title={t('cs.chart', { df: r.df })} heading={title} fileBase={`${props.dataName}_chisquare_${props.varName}`} onAdd={props.onAdd}>
            <DistChart
              kind="chi2"
              df1={r.df}
              stat={r.chi2}
              crit={r.critical}
              title={t('cs.chart', { df: r.df })}
              xLabel="χ²"
              yLabel={t('chart.density')}
              observedLabel={t('chart.observedLine', { value: `χ² = ${f.num(r.chi2)}` })}
              criticalLabel={t('chart.criticalLine', { value: f.num(r.critical) })}
              pLabel={t('chart.pArea', { p: f.p(r.p) })}
              sep={f.sep}
            />
          </ChartSection>
        </>
      )}
    </TestFrame>
  );
}

export { plain };

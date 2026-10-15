import { EXAMPLES } from '../../data/examples';
import { splitDelimited } from '../../data/parse';
import { useT, type MessageKey, type T } from '../../i18n/i18n';
import { oneWayAnova } from '../../stats/anova';
import { chiSquareGof, chiSquareIndependence } from '../../stats/chisquare';
import { compareCategories, crosstab, meanCI, proportionCI } from '../../stats/descriptive';
import { pearson, simpleRegression } from '../../stats/regression';
import { oneProportionZ, oneSampleT, pairedT, twoProportionZ, welchT } from '../../stats/tests';
import { useFmt, type Fmt } from '../fmt';
import { decisionSentence, plain, tailWord } from './tests/common';

/** Column of an example dataset by name (blank cells dropped for numeric columns). */
function example(key: string) {
  const csv = EXAMPLES.find((e) => e.key === key)!.csv;
  const [header, ...rows] = splitDelimited(csv, ',');
  const idx = (name: string) => header!.indexOf(name);
  return {
    text: (name: string) => rows.map((r) => r[idx(name)]!),
    nums: (name: string) => rows.map((r) => r[idx(name)]!).filter((c) => c !== '').map(Number),
  };
}

interface Guide {
  method: MessageKey;
  question: MessageKey;
  where: MessageKey;
  tick: MessageKey;
  file: string;
  formula: string[];
  h0?: string;
  h1?: string;
  assumptions: MessageKey[];
  reading: string[];
}

const ALPHA = 0.05;

function buildGuides(t: T, f: Fmt): Guide[] {
  const guides: Guide[] = [];
  const two = tailWord('two-sided', t);

  // CI for a mean — ex02 Basket_value
  {
    const ci = meanCI(example('ex02_ci_basket').nums('Basket_value'), 0.95)!;
    guides.push({
      method: 'guide.m.ciMean',
      question: 'guide.q.estimate',
      where: 'guide.w.describe',
      tick: 'guide.t.oneMetric',
      file: 'ex02_ci_basket — Basket_value',
      formula: ['x̄ ± t(α/2, n − 1) · s/√n', 'Excel: CONFIDENCE.T'],
      assumptions: ['g.as.ciMean', 'g.as.outliers'],
      reading: [t('describe.interp.ci', { level: 95, lower: f.num(ci.lower), upper: f.num(ci.upper), unit: ' Rp ribu' })],
    });
  }
  // CI for a proportion — ex02 Used_voucher = yes
  {
    const v = example('ex02_ci_basket').text('Used_voucher');
    const ci = proportionCI(v.filter((x) => x === 'yes').length, v.length, 0.95);
    guides.push({
      method: 'guide.m.ciProp',
      question: 'guide.q.estimate',
      where: 'guide.w.describeProp',
      tick: 'guide.t.oneNominal',
      file: 'ex02_ci_basket — Used_voucher',
      formula: ['p̂ ± z(α/2) · √(p̂(1 − p̂)/n)'],
      assumptions: ['g.as.ciProp'],
      reading: [`yes: p̂ = ${f.pct(ci.pHat * 100)}%, 95% CI ${f.pct(ci.lower * 100)}% – ${f.pct(ci.upper * 100)}%.`, t('describe.interp.freqCi', { level: 95 })],
    });
  }
  // One-sample t — ex03 Waiting_min vs 10
  {
    const r = oneSampleT(example('ex03_onesample_waiting').nums('Waiting_min'), 10, 'two-sided', ALPHA)!;
    const vars = { var: 'Waiting_min', mu0: '10', unit: ' min' };
    guides.push({
      method: 'guide.m.oneSample',
      question: 'guide.q.target',
      where: 'guide.w.tests',
      tick: 'guide.t.oneMetric',
      file: 'ex03_onesample_waiting — Waiting_min, μ₀ = 10',
      formula: ['t = (x̄ − μ₀) / (s/√n)', 'df = n − 1'],
      h0: t('os.h0', vars),
      h1: t('os.h1.two-sided', vars),
      assumptions: ['g.as.ciMean', 'g.as.outliers'],
      reading: [
        t('os.interp', { mean: f.num(r.mean), mu0: '10', diff: f.num(r.diff), t: f.num(r.t), se: f.num(r.se), df: r.df, tail: two, p: f.pEq(r.p), unit: ' min' }),
        decisionSentence(r.p, ALPHA, t('os.h0short', { mu0: '10' }), f, t),
      ],
    });
  }
  // One-proportion z — ex03 On_time = yes vs 80%
  {
    const v = example('ex03_onesample_waiting').text('On_time');
    const r = oneProportionZ(v.filter((x) => x === 'yes').length, v.length, 0.8, 'two-sided', ALPHA)!;
    const vars = { var: 'On_time', cat: 'yes', p0: '80' };
    guides.push({
      method: 'guide.m.oneProp',
      question: 'guide.q.target',
      where: 'guide.w.tests',
      tick: 'guide.t.oneNominal',
      file: 'ex03_onesample_waiting — On_time, p₀ = 80%',
      formula: ['z = (p̂ − p₀) / √(p₀(1 − p₀)/n)', 'CI: p̂ ± z(α/2) · √(p̂(1 − p̂)/n)'],
      h0: t('op.h0', vars),
      h1: t('op.h1.two-sided', vars),
      assumptions: ['g.as.oneProp'],
      reading: [
        t('op.interp', { x: r.x, n: r.n, cat: 'yes', phat: f.pct(r.pHat * 100), se: f.num(r.se0), z: f.num(r.z), tail: two, p: f.pEq(r.p) }),
        decisionSentence(r.p, ALPHA, t('op.h0short', { p0: '80' }), f, t),
      ],
    });
  }
  // Welch — ex04
  {
    const e = example('ex04_twosample_channel');
    const ch = e.text('Channel');
    const bv = e.nums('Basket_value');
    const r = welchT(bv.filter((_, i) => ch[i] === 'GoFood'), bv.filter((_, i) => ch[i] === 'Walk-in'), 'two-sided', ALPHA)!;
    const vars = { var: 'Basket_value', g1: 'GoFood', g2: 'Walk-in' };
    guides.push({
      method: 'guide.m.welch',
      question: 'guide.q.twoGroups',
      where: 'guide.w.tests',
      tick: 'guide.t.metricGroup',
      file: 'ex04_twosample_channel — Basket_value by Channel',
      formula: ['t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)', 'df = (s₁²/n₁ + s₂²/n₂)² / [(s₁²/n₁)²/(n₁ − 1) + (s₂²/n₂)²/(n₂ − 1)]', 'Excel: T.TEST(…, 2, 3)'],
      h0: t('ws.h0', vars),
      h1: t('ws.h1.two-sided', vars),
      assumptions: ['g.as.welch', 'g.as.outliers'],
      reading: [
        t('ws.interp', { g1: 'GoFood', g2: 'Walk-in', diff: f.num(r.diff), t: f.num(r.t), se: f.num(r.se), df: f.num(r.df), tail: two, p: f.pEq(r.p), unit: ' Rp ribu' }),
        decisionSentence(r.p, ALPHA, t('ws.h0short'), f, t),
      ],
    });
  }
  // Paired — ex05
  {
    const e = example('ex05_paired_promo');
    const r = pairedT(e.nums('Units_before'), e.nums('Units_after'), 'two-sided', ALPHA)!;
    const names = { after: 'Units_after', before: 'Units_before' };
    guides.push({
      method: 'guide.m.paired',
      question: 'guide.q.beforeAfter',
      where: 'guide.w.tests',
      tick: 'guide.t.twoMetric',
      file: 'ex05_paired_promo — Units_before, Units_after',
      formula: ['d = after − before', 't = d̄ / (s_d/√n)', 'df = n − 1', 'Excel: T.TEST(…, 2, 1)'],
      h0: t('pt.h0', names),
      h1: t('pt.h1.two-sided', names),
      assumptions: ['g.as.paired'],
      reading: [
        t('pt.interp', { n: r.n, d: f.num(r.meanD), t: f.num(r.t), se: f.num(r.se), df: r.df, tail: two, p: f.pEq(r.p), unit: '' }),
        decisionSentence(r.p, ALPHA, t('pt.h0short'), f, t),
      ],
    });
  }
  // Two-proportion z — ex06
  {
    const e = example('ex06_twoprop_banner');
    const b = e.text('Banner');
    const c = e.text('Converted');
    const cnt = (g: string) => ({ x: b.filter((v, i) => v === g && c[i] === 'yes').length, n: b.filter((v) => v === g).length });
    const A = cnt('A');
    const B = cnt('B');
    const r = twoProportionZ(A.x, A.n, B.x, B.n, 'two-sided', ALPHA)!;
    const vars = { outcome: 'Converted', cat: 'yes', g1: 'A', g2: 'B' };
    guides.push({
      method: 'guide.m.twoProp',
      question: 'guide.q.twoGroups',
      where: 'guide.w.tests',
      tick: 'guide.t.twoBinary',
      file: 'ex06_twoprop_banner — Banner, Converted',
      formula: ['p̄ = (x₁ + x₂)/(n₁ + n₂)', 'z = (p̂₁ − p̂₂) / √(p̄(1 − p̄)(1/n₁ + 1/n₂))', 'CI: (p̂₁ − p̂₂) ± z(α/2) · √(p̂₁(1 − p̂₁)/n₁ + p̂₂(1 − p̂₂)/n₂)'],
      h0: t('tp.h0', vars),
      h1: t('tp.h1.two-sided', vars),
      assumptions: ['g.as.twoProp'],
      reading: [
        t('tp.interp', { pooled: f.pct(r.pooled * 100), se: f.num(r.se), diff: f.num(r.diff * 100), z: f.num(r.z), tail: two, p: f.pEq(r.p) }),
        decisionSentence(r.p, ALPHA, t('tp.h0short'), f, t),
      ],
    });
  }
  // ANOVA — ex07
  {
    const e = example('ex07_anova_outlets');
    const o = e.text('Outlet');
    const v = e.nums('Delivery_min');
    const labels = [...new Set(o)].sort(compareCategories);
    const a = oneWayAnova(labels.map((l) => ({ label: l, values: v.filter((_, i) => o[i] === l) })), ALPHA)!;
    const vars = { var: 'Delivery_min', group: 'Outlet', k: a.k };
    guides.push({
      method: 'guide.m.anova',
      question: 'guide.q.manyGroups',
      where: 'guide.w.tests',
      tick: 'guide.t.metricGroup',
      file: 'ex07_anova_outlets — Delivery_min by Outlet',
      formula: ['SS between = Σ nᵢ(x̄ᵢ − x̄)², SS within = ΣΣ (x − x̄ᵢ)²', 'F = [SS between/(k − 1)] / [SS within/(N − k)]', 'Tukey–Kramer: q = |x̄ᵢ − x̄ⱼ| / √(MS within/2 · (1/nᵢ + 1/nⱼ))'],
      h0: t('an.h0', vars),
      h1: t('an.h1', vars),
      assumptions: ['g.as.anova', 'g.as.outliers'],
      reading: [t('an.interp', { f: f.num(a.f), df1: a.dfBetween, df2: a.dfWithin, p: f.pEq(a.p) }), decisionSentence(a.p, ALPHA, t('an.h0short'), f, t)],
    });
  }
  // Chi-square independence — ex08
  {
    const e = example('ex08_chisq_segment');
    const ct = crosstab(e.text('Segment'), e.text('Payment'));
    const r = chiSquareIndependence(ct.rows, ct.cols, ct.counts, ALPHA)!;
    guides.push({
      method: 'guide.m.chi',
      question: 'guide.q.twoCategorical',
      where: 'guide.w.tests',
      tick: 'guide.t.twoNominal',
      file: 'ex08_chisq_segment — Segment, Payment',
      formula: ['E = row total × column total / N', 'χ² = Σ (O − E)²/E', 'df = (r − 1)(c − 1)', 'Excel: CHISQ.TEST'],
      h0: t('cs.h0', { a: 'Segment', b: 'Payment' }),
      h1: t('cs.h1', { a: 'Segment', b: 'Payment' }),
      assumptions: ['g.as.chi'],
      reading: [t('cs.interp', { chi2: f.num(r.chi2), df: r.df, p: f.pEq(r.p) }), decisionSentence(r.p, ALPHA, t('cs.h0short'), f, t)],
    });
  }
  // Goodness of fit — ex08 Payment, equal shares
  {
    const pay = example('ex08_chisq_segment').text('Payment');
    const cats = [...new Set(pay)].sort(compareCategories);
    const r = chiSquareGof(cats, cats.map((c) => pay.filter((x) => x === c).length), cats.map(() => 1 / cats.length), ALPHA)!;
    guides.push({
      method: 'gof.title',
      question: 'guide.q.twoCategorical',
      where: 'guide.w.tests',
      tick: 'guide.t.oneNominal',
      file: 'ex08_chisq_segment — Payment, equal shares',
      formula: ['E = expected share × n', 'χ² = Σ (O − E)²/E', 'df = k − 1'],
      h0: t('gof.h0', { var: 'Payment' }),
      h1: t('gof.h1', { var: 'Payment' }),
      assumptions: ['g.as.gof'],
      reading: [t('gof.interp', { n: r.total, chi2: f.num(r.chi2), df: r.df, p: f.pEq(r.p) }), decisionSentence(r.p, ALPHA, t('gof.h0short'), f, t)],
    });
  }
  // Correlation and regression — ex09
  {
    const e = example('ex09_regression_promo');
    const x = e.nums('Promo_spend');
    const y = e.nums('Orders');
    const p = pearson(x, y)!;
    const r = simpleRegression(x, y, 0.95)!;
    guides.push({
      method: 'guide.m.corr',
      question: 'guide.q.twoNumeric',
      where: 'guide.w.corr',
      tick: 'guide.t.corr',
      file: 'ex09_regression_promo — Promo_spend, Orders',
      formula: ['r = Sxy / √(Sxx·Syy); t = r√(n − 2)/√(1 − r²), df = n − 2', 'b₁ = Sxy/Sxx, b₀ = ȳ − b₁x̄; R² = SSR/SST', 'Excel: CORREL, SLOPE, INTERCEPT, RSQ'],
      h0: t('cor.h0', { x: 'Promo_spend', y: 'Orders' }),
      h1: t('cor.h1', { x: 'Promo_spend', y: 'Orders' }),
      assumptions: ['g.as.reg'],
      reading: [
        t('cor.interp', { r: f.num(p.r), x: 'Promo_spend', y: 'Orders', n: p.n, t: f.num(p.t), df: p.df, p: f.pEq(p.p) }),
        t('reg.equationWords', { y: 'Orders', x: 'Promo_spend', b0: f.num(r.intercept.b), sign: '+', b1: f.num(r.slope.b) }),
        t('reg.summaryInterp', { R: f.num(Math.abs(r.r)), R2: f.num(r.rSquared), pct: f.pct(r.rSquared * 100), x: 'Promo_spend', y: 'Orders', see: f.num(r.seEstimate), yunit: '' }),
        t('cor.causation'),
      ],
    });
  }
  return guides;
}

export function Guides() {
  const t = useT();
  const f = useFmt();
  const guides = buildGuides(t, f);
  return (
    <div class="guides">
      <div class="guides-bar no-print">
        <h1 class="guides-title">{t('guides.title')}</h1>
        <p class="muted">{t('guides.intro')}</p>
        <div class="guides-actions">
          <button type="button" class="btn btn-primary" onClick={() => window.print()}>
            {t('guides.print')}
          </button>
          <a class="btn" href="#/describe">
            {t('guides.back')}
          </a>
        </div>
      </div>
      {guides.map((g) => (
        <article key={g.method} class="guide-page">
          <header class="guide-head">
            <span class="guide-app">{t('app.name')}</span>
            <h2>{t(g.method)}</h2>
          </header>
          <dl class="guide-facts">
            <dt>{t('guides.question')}</dt>
            <dd>{t(g.question)}</dd>
            <dt>{t('guides.where')}</dt>
            <dd>{t(g.where)}</dd>
            <dt>{t('guides.tick')}</dt>
            <dd>{t(g.tick)}</dd>
            <dt>{t('guides.example')}</dt>
            <dd>{g.file}</dd>
          </dl>
          <h3>{t('guides.formula')}</h3>
          <ul class="guide-formula">
            {g.formula.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {g.h0 && g.h1 && (
            <>
              <h3>{t('tests.hypotheses')}</h3>
              <p>H₀: {plain(g.h0)}</p>
              <p>H₁: {plain(g.h1)}</p>
            </>
          )}
          <h3>{t('guides.assumptions')}</h3>
          <ul>
            {g.assumptions.map((a) => (
              <li key={a}>{t(a)}</li>
            ))}
          </ul>
          <h3>{t('guides.reading')}</h3>
          {g.reading.map((r) => (
            <p key={r}>{r}</p>
          ))}
          <h3>{t('guides.conclusion')}</h3>
          <p>{t('guides.conclusionText')}</p>
        </article>
      ))}
    </div>
  );
}

import { useState } from 'preact/hooks';
import type { VariableWarnings } from '../../../data/detect';
import { splitDelimited } from '../../../data/parse';
import type { Dataset } from '../../../data/types';
import { useT } from '../../../i18n/i18n';
import { chiSquareIndependence } from '../../../stats/chisquare';
import { compareCategories, crosstab } from '../../../stats/descriptive';
import type { Alternative } from '../../../stats/tests';
import { categoryColumn, groupedNumeric, numericColumn } from '../columns';
import { AlphaRadios, AltRadios, Note, type AddFn } from './common';
import { AnovaSection, ChiSquareSection, GofSection, OneProportionSection, OneSampleSection, PairedSection, TwoProportionSection, WelchSection } from './TestSections';

interface Props {
  dataset: Dataset;
  selected: string[];
  warnings: VariableWarnings[];
  isMissing: (c: string) => boolean;
  onAdd: AddFn;
}

/** Prefer an obvious "success" label as the default success category. */
function defaultSuccess(categories: string[]): string {
  const yes = categories.find((c) => /^(yes|ya|y|1|true|ok|sukses|success|converted)$/i.test(c));
  return yes ?? categories[0]!;
}

function num(text: string): number {
  const s = text.trim().replace(',', '.');
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}

export function Tests(props: Props) {
  const t = useT();
  const [alpha, setAlpha] = useState(0.05);
  const [alt, setAlt] = useState<Alternative>('two-sided');
  const [mu0, setMu0] = useState('');
  const [p0, setP0] = useState('50');
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [swapGroups, setSwapGroups] = useState(false);
  const [swapPaired, setSwapPaired] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [form, setForm] = useState<'counts' | 'table' | null>(null);

  const d = props.dataset;
  const picked = props.selected.map((id) => d.variables.findIndex((v) => v.id === id)).filter((j) => j >= 0);
  const metric = picked.filter((j) => d.variables[j]!.level === 'metric');
  const cat = picked.filter((j) => d.variables[j]!.level !== 'metric');
  const common = { alpha, dataName: d.name, onAdd: props.onAdd };

  const links = (
    <div class="test-links">
      <button type="button" class="link-btn" onClick={() => setForm(form === 'counts' ? null : 'counts')}>
        {t('tp.countsLink')}
      </button>
      <button type="button" class="link-btn" onClick={() => setForm(form === 'table' ? null : 'table')}>
        {t('cs.tableLink')}
      </button>
    </div>
  );

  if (form === 'counts')
    return (
      <>
        {links}
        <div class="options">
          <AlphaRadios value={alpha} onChange={setAlpha} />
        </div>
        <CountsForm alpha={alpha} alt={alt} setAlt={setAlt} onAdd={props.onAdd} dataName={d.name} />
      </>
    );
  if (form === 'table')
    return (
      <>
        {links}
        <div class="options">
          <AlphaRadios value={alpha} onChange={setAlpha} />
        </div>
        <TableForm alpha={alpha} onAdd={props.onAdd} dataName={d.name} />
      </>
    );

  if (picked.length === 0)
    return (
      <>
        {links}
        <p class="muted coming-soon">{t('tests.pick')}</p>
      </>
    );

  const options: preact.ComponentChildren[] = [<AlphaRadios key="alpha" value={alpha} onChange={setAlpha} />];
  let body: preact.ComponentChildren = <Note>{t('tests.unsupported')}</Note>;

  const ordinalBlock = (j: number) => <Note>{t('tests.ordinalNote', { name: d.variables[j]!.name })}</Note>;
  const pickSuccess = (varId: string, categories: string[]) => {
    const chosen = success[varId];
    return chosen && categories.includes(chosen) ? chosen : defaultSuccess(categories);
  };
  const successSelect = (varId: string, categories: string[], label: string) => (
    <label key={`s-${varId}`} class="opt-group field">
      <span class="field-label">{label}</span>
      <select class="input select input-small" value={pickSuccess(varId, categories)} onChange={(e) => setSuccess({ ...success, [varId]: e.currentTarget.value })}>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );
  const swapButton = (onClick: () => void, labelText: string) => (
    <div key="swap" class="opt-group">
      <span class="field-label">{t('tests.order')}</span>
      <span class="inline-input">
        <span>{labelText}</span>
        <button type="button" class="btn btn-outline btn-small" onClick={onClick}>
          ⇄ {t('tests.swap')}
        </button>
      </span>
    </div>
  );

  if (picked.length === 1 && metric.length === 1) {
    // ---------------- one-sample t
    const v = d.variables[metric[0]!]!;
    const col = numericColumn(d, metric[0]!, props.isMissing);
    const m0 = num(mu0);
    options.push(
      <AltRadios key="alt" value={alt} onChange={setAlt} a={t('os.altMean', { var: v.name })} b={Number.isFinite(m0) ? mu0.trim() : 'μ₀'} />,
      <label key="mu0" class="opt-group field">
        <span class="field-label">{t('os.testValue')}</span>
        <input class="input input-small" inputMode="decimal" value={mu0} onInput={(e) => setMu0(e.currentTarget.value)} />
      </label>,
    );
    body = Number.isFinite(m0) ? (
      <OneSampleSection {...common} v={v} values={col.values} missing={col.missing} mu0={m0} alt={alt} />
    ) : (
      <Note kind="info">{t('os.enterValue')}</Note>
    );
  } else if (picked.length === 1 && cat.length === 1) {
    // ---------------- one-proportion z or goodness of fit
    const j = cat[0]!;
    const v = d.variables[j]!;
    const col = categoryColumn(d, j, props.isMissing);
    const categories = [...new Set(col.values)].sort(compareCategories);
    if (categories.length < 2) body = <Note>{t('tests.oneCategory', { name: v.name })}</Note>;
    else if (categories.length === 2) {
      const s = pickSuccess(v.id, categories);
      const p0v = num(p0) / 100;
      options.push(
        <AltRadios key="alt" value={alt} onChange={setAlt} a={t('op.altShare', { var: v.name, cat: s })} b={`${p0.trim() || 'p₀'}%`} />,
        successSelect(v.id, categories, t('op.success')),
        <label key="p0" class="opt-group field">
          <span class="field-label">{t('op.testProp')}</span>
          <input class="input input-small" inputMode="decimal" value={p0} onInput={(e) => setP0(e.currentTarget.value)} />
        </label>,
      );
      body =
        p0v > 0 && p0v < 1 ? (
          <OneProportionSection {...common} varName={v.name} cat={s} x={col.values.filter((x) => x === s).length} n={col.values.length} missing={col.missing} p0={p0v} alt={alt} />
        ) : (
          <Note>{t('ss.invalid')}</Note>
        );
    } else {
      const observed = categories.map((c) => col.values.filter((x) => x === c).length);
      body = <GofSection {...common} varName={v.name} categories={categories} observed={observed} missing={col.missing} />;
    }
  } else if (picked.length === 2 && metric.length === 2) {
    // ---------------- paired t: d = right-hand column − left-hand column (swap reverses)
    const [left, right] = [...metric].sort((a, b) => a - b) as [number, number];
    const [bIdx, aIdx] = swapPaired ? [right, left] : [left, right];
    const before = d.variables[bIdx]!;
    const after = d.variables[aIdx]!;
    const b: number[] = [];
    const a: number[] = [];
    const nb = numericColumn(d, bIdx, props.isMissing);
    const na = numericColumn(d, aIdx, props.isMissing);
    const byCase = new Map(nb.cases.map((c, i) => [c, nb.values[i]!]));
    na.cases.forEach((c, i) => {
      const x = byCase.get(c);
      if (x !== undefined) {
        b.push(x);
        a.push(na.values[i]!);
      }
    });
    options.push(
      <AltRadios key="alt" value={alt} onChange={setAlt} a={after.name} b={before.name} />,
      swapButton(() => setSwapPaired(!swapPaired), t('pt.dDef', { after: after.name, before: before.name })),
    );
    body = <PairedSection {...common} before={before} after={after} b={b} a={a} excluded={d.rows.length - a.length} alt={alt} />;
  } else if (picked.length === 2 && metric.length === 1 && cat.length === 1) {
    // ---------------- Welch t or ANOVA
    const g = cat[0]!;
    const gv = d.variables[g]!;
    const v = d.variables[metric[0]!]!;
    if (gv.level === 'ordinal') body = ordinalBlock(g);
    else if (props.warnings[g]?.idLike) body = <Note>{t('describe.groupId', { name: gv.name })}</Note>;
    else {
      const { groups, excluded } = groupedNumeric(d, metric[0]!, g, props.isMissing);
      const labels = [...groups.keys()].sort(compareCategories);
      if (labels.length < 2) body = <Note>{t('tests.oneCategory', { name: gv.name })}</Note>;
      else if (labels.length === 2) {
        const [l1, l2] = swapGroups ? [labels[1]!, labels[0]!] : [labels[0]!, labels[1]!];
        options.push(
          <AltRadios key="alt" value={alt} onChange={setAlt} a={l1} b={l2} prefix={t('ws.altMean', { var: v.name })} />,
          swapButton(() => setSwapGroups(!swapGroups), t('tests.diffDef', { first: l1, second: l2 })),
        );
        body = (
          <WelchSection
            {...common}
            v={v}
            groupName={gv.name}
            g1={{ label: l1, values: groups.get(l1)!.values }}
            g2={{ label: l2, values: groups.get(l2)!.values }}
            excluded={excluded}
            alt={alt}
          />
        );
      } else {
        body = (
          <AnovaSection {...common} v={v} groupName={gv.name} groups={labels.map((l) => ({ label: l, values: groups.get(l)!.values }))} excluded={excluded} />
        );
      }
    }
  } else if (picked.length === 2 && cat.length === 2) {
    // ---------------- two-proportion z (+ χ²) or χ² independence
    const ord = cat.find((j) => d.variables[j]!.level === 'ordinal');
    if (ord !== undefined) body = ordinalBlock(ord);
    else {
      const [ja, jb] = cat as [number, number];
      const a: string[] = [];
      const b: string[] = [];
      d.rows.forEach((row) => {
        const x = row[ja] ?? '';
        const y = row[jb] ?? '';
        if (!props.isMissing(x) && !props.isMissing(y)) {
          a.push(x);
          b.push(y);
        }
      });
      const excluded = d.rows.length - a.length;
      const ct = crosstab(a, b);
      if (ct.rows.length < 2 || ct.cols.length < 2) {
        body = <Note>{t('tests.oneCategory', { name: ct.rows.length < 2 ? d.variables[ja]!.name : d.variables[jb]!.name })}</Note>;
      } else if (ct.rows.length === 2 && ct.cols.length === 2) {
        // Group variable: chosen in "Compare groups of" (default the first ticked); the other is the outcome.
        const groupIdx = compareId === d.variables[jb]!.id ? jb : ja;
        const outIdx = groupIdx === ja ? jb : ja;
        const gv = d.variables[groupIdx]!;
        const ov = d.variables[outIdx]!;
        const groupVals = groupIdx === ja ? a : b;
        const outVals = groupIdx === ja ? b : a;
        const glabels = [...new Set(groupVals)].sort(compareCategories);
        const olabels = [...new Set(outVals)].sort(compareCategories);
        const s = pickSuccess(ov.id, olabels);
        const [l1, l2] = swapGroups ? [glabels[1]!, glabels[0]!] : [glabels[0]!, glabels[1]!];
        const count = (label: string) => {
          let x = 0;
          let n = 0;
          groupVals.forEach((gval, i) => {
            if (gval === label) {
              n++;
              if (outVals[i] === s) x++;
            }
          });
          return { label, x, n };
        };
        options.push(
          <AltRadios key="alt" value={alt} onChange={setAlt} a={l1} b={l2} prefix={t('tp.altShare', { outcome: ov.name, cat: s })} />,
          <label key="compare" class="opt-group field">
            <span class="field-label">{t('tp.compare')}</span>
            <select class="input select input-small" value={gv.id} onChange={(e) => setCompareId(e.currentTarget.value)}>
              {[ja, jb].map((j) => (
                <option key={j} value={d.variables[j]!.id}>
                  {d.variables[j]!.name}
                </option>
              ))}
            </select>
          </label>,
          successSelect(ov.id, olabels, t('tp.success')),
          swapButton(() => setSwapGroups(!swapGroups), t('tests.diffDef', { first: l1, second: l2 })),
        );
        const ctab = crosstab(groupVals, outVals);
        const chi = chiSquareIndependence(ctab.rows, ctab.cols, ctab.counts, alpha);
        body = (
          <>
            <TwoProportionSection {...common} outcome={ov.name} cat={s} g1={count(l1)} g2={count(l2)} excluded={excluded} alt={alt} chi2={chi?.chi2} />
            <ChiSquareSection {...common} aName={gv.name} bName={ov.name} rows={ctab.rows} cols={ctab.cols} observed={ctab.counts} excluded={excluded} />
          </>
        );
      } else {
        body = <ChiSquareSection {...common} aName={d.variables[ja]!.name} bName={d.variables[jb]!.name} rows={ct.rows} cols={ct.cols} observed={ct.counts} excluded={excluded} />;
      }
    }
  }

  return (
    <>
      {links}
      <div class="options">{options}</div>
      {body}
    </>
  );
}

// ---------------------------------------------------------------- summary-data forms

function CountsForm(props: { alpha: number; alt: Alternative; setAlt: (a: Alternative) => void; onAdd: AddFn; dataName: string }) {
  const t = useT();
  const [g, setG] = useState({ n1: 'A', x1: '', t1: '', n2: 'B', x2: '', t2: '', out: 'yes' });
  const set = (k: keyof typeof g) => (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setG((prev) => ({ ...prev, [k]: value }));
  };
  const ints = [g.x1, g.t1, g.x2, g.t2].map((s) => Number(s.trim()));
  const valid = ints.every((x) => Number.isInteger(x) && x >= 0) && ints[1]! >= 1 && ints[3]! >= 1 && ints[0]! <= ints[1]! && ints[2]! <= ints[3]!;
  const filled = [g.x1, g.t1, g.x2, g.t2].every((s) => s.trim() !== '');
  const field = (k: keyof typeof g, label: string) => (
    <label class="field">
      <span class="field-label">{label}</span>
      <input class="input input-small" value={g[k]} onInput={set(k)} />
    </label>
  );
  return (
    <>
      <h3 class="result-title">{t('tp.countsTitle')}</h3>
      <div class="summary-form">
        {field('n1', `${t('tp.groupName')} 1`)}
        {field('x1', t('tp.successCount'))}
        {field('t1', t('tp.totalCount'))}
        {field('n2', `${t('tp.groupName')} 2`)}
        {field('x2', t('tp.successCount'))}
        {field('t2', t('tp.totalCount'))}
        {field('out', t('tp.outcomeName'))}
      </div>
      <div class="options">
        <AltRadios value={props.alt} onChange={props.setAlt} a={g.n1} b={g.n2} />
      </div>
      {filled && !valid && <Note>{t('tp.countsInvalid')}</Note>}
      {valid && (
        <TwoProportionSection
          alpha={props.alpha}
          dataName={props.dataName}
          onAdd={props.onAdd}
          outcome={g.out}
          cat={g.out}
          g1={{ label: g.n1, x: ints[0]!, n: ints[1]! }}
          g2={{ label: g.n2, x: ints[2]!, n: ints[3]! }}
          excluded={0}
          alt={props.alt}
        />
      )}
    </>
  );
}

function TableForm(props: { alpha: number; onAdd: AddFn; dataName: string }) {
  const t = useT();
  const [text, setText] = useState('');
  const grid = splitDelimited(text);
  const header = grid[0] ?? [];
  const body = grid.slice(1);
  const counts = body.map((r) => r.slice(1).map((c) => Number(c.replace(/\s/g, ''))));
  const valid =
    body.length >= 2 &&
    header.length >= 3 &&
    counts.every((r) => r.length === header.length - 1 && r.every((x) => Number.isInteger(x) && x >= 0));
  return (
    <>
      <h3 class="result-title">{t('cs.tableTitle')}</h3>
      <p class="muted small">{t('cs.tableHelp')}</p>
      <textarea class="input codes" rows={6} value={text} spellcheck={false} onInput={(e) => setText(e.currentTarget.value)} />
      {text.trim() && !valid && <Note>{t('cs.tableInvalid')}</Note>}
      {valid && (
        <ChiSquareSection
          alpha={props.alpha}
          dataName={props.dataName}
          onAdd={props.onAdd}
          aName={header[0] || t('cs.rowsLabel')}
          bName={t('cs.colsLabel')}
          rows={body.map((r) => r[0]!)}
          cols={header.slice(1)}
          observed={counts}
          excluded={0}
        />
      )}
    </>
  );
}

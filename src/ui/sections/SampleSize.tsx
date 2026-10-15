import { useState } from 'preact/hooks';
import { useT } from '../../i18n/i18n';
import { mean, variance } from '../../stats/descriptive';
import { sampleSizeMean, sampleSizeProportion, type SampleSize as Result } from '../../stats/samplesize';
import { RadioGroup } from '../charts/ChartSection';
import { useFmt } from '../fmt';
import type { ReportItem } from '../report';
import { ResultBlock } from '../shell/ResultBlock';

type AddFn = (item: Omit<ReportItem, 'id' | 'fingerprint'>) => void;
const LEVELS = ['0.9', '0.95', '0.99'];

/** Accept 12.5 and 12,5. */
function num(text: string): number {
  const s = text.trim().replace(',', '.');
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}

export function SampleSize(props: { onAdd: AddFn }) {
  const t = useT();
  return (
    <section class="result-section">
      <h2 class="section-title">{t('ss.heading')}</h2>
      <div class="ss-grid">
        <MeanSize onAdd={props.onAdd} />
        <ProportionSize onAdd={props.onAdd} />
      </div>
      <div class="ss-minimums">
        <h3 class="result-title">{t('ss.minTitle')}</h3>
        <ul>
          <li>{t('ss.minMean')}</li>
          <li>{t('ss.minProp')}</li>
          <li>{t('ss.minChi')}</li>
        </ul>
      </div>
    </section>
  );
}

function Field(props: { label: string; value: string; onInput: (v: string) => void; help?: string; placeholder?: string }) {
  return (
    <label class="field">
      <span class="field-label">{props.label}</span>
      <input class="input input-small" inputMode="decimal" value={props.value} placeholder={props.placeholder} onInput={(e) => props.onInput(e.currentTarget.value)} />
      {props.help && <span class="muted small">{props.help}</span>}
    </label>
  );
}

function resultRows(r: Result, level: number, t: ReturnType<typeof useT>, f: ReturnType<typeof useFmt>): string[][] {
  return [
    [t('ss.z', { level }), f.num(r.z)],
    [t('ss.exact'), f.num(r.exact)],
    [t('ss.perGroup'), f.int(r.perGroup)],
    [t('ss.groups'), f.int(r.groups)],
    [t('ss.total'), f.int(r.total)],
  ];
}

function MeanSize(props: { onAdd: AddFn }) {
  const t = useT();
  const f = useFmt();
  const [level, setLevel] = useState('0.95');
  const [sigma, setSigma] = useState('');
  const [margin, setMargin] = useState('');
  const [unit, setUnit] = useState('');
  const [groups, setGroups] = useState('1');
  const [pilot, setPilot] = useState('');

  const pilotValues = pilot
    .split(/[\s;]+/)
    .filter(Boolean)
    .map(num)
    .filter((x) => Number.isFinite(x));
  const pilotS = pilotValues.length >= 2 ? Math.sqrt(variance(pilotValues)) : null;
  const r = sampleSizeMean(Number(level), num(sigma), num(margin), Math.floor(num(groups)));
  const lv = Math.round(Number(level) * 100);
  const u = unit.trim() ? ` ${unit.trim()}` : '';

  return (
    <div class="ss-card">
      <h3 class="result-title">{t('ss.meanTitle')}</h3>
      <RadioGroup label={t('opt.confidence')} name="ss-mean-level" value={level} options={LEVELS.map((l) => ({ value: l, label: `${Math.round(Number(l) * 100)}%` }))} onChange={setLevel} />
      <Field label={t('ss.sigma')} value={sigma} onInput={setSigma} help={t('ss.sigmaHelp')} />
      <label class="field">
        <span class="field-label">{t('ss.pilot')}</span>
        <textarea class="input" rows={2} placeholder={t('ss.pilotPlaceholder')} value={pilot} onInput={(e) => setPilot(e.currentTarget.value)} />
        {pilotS !== null && (
          <span class="small">
            {t('ss.pilotResult', { s: f.num(pilotS), n: pilotValues.length })}{' '}
            <button type="button" class="link-btn small" onClick={() => setSigma(String(Number(pilotS.toPrecision(6))))}>
              {t('ss.usePilot')}
            </button>
            <span class="muted"> (x̄ = {f.num(mean(pilotValues))})</span>
          </span>
        )}
      </label>
      <Field label={t('ss.margin')} value={margin} onInput={setMargin} />
      <label class="field">
        <span class="field-label">{t('ss.unit')}</span>
        <input class="input input-small" value={unit} onInput={(e) => setUnit(e.currentTarget.value)} />
      </label>
      <Field label={t('ss.groups')} value={groups} onInput={setGroups} />
      {r ? (
        <ResultBlock
          heading={t('ss.heading')}
          title={t('ss.meanTitle')}
          table={{ columns: [t('ss.quantity'), t('ss.value')], rows: resultRows(r, lv, t, f), numeric: [false, true] }}
          notes={r.perGroup < 30 ? [t('ss.belowMean')] : []}
          interpretation={[
            t('ss.interp.mean', { level: lv, sigma: f.num(num(sigma)), e: f.num(num(margin)), unit: u, n: r.perGroup, groups: r.groups, total: r.total }),
          ]}
          onAdd={props.onAdd}
        />
      ) : (
        (sigma || margin) && <p class="muted small">{t('ss.invalid')}</p>
      )}
    </div>
  );
}

function ProportionSize(props: { onAdd: AddFn }) {
  const t = useT();
  const f = useFmt();
  const [level, setLevel] = useState('0.95');
  const [p, setP] = useState('50');
  const [margin, setMargin] = useState('');
  const [groups, setGroups] = useState('1');
  const pv = num(p) / 100;
  const r = sampleSizeProportion(Number(level), pv, num(margin) / 100, Math.floor(num(groups)));
  const lv = Math.round(Number(level) * 100);
  const small = r ? r.perGroup * pv < 5 || r.perGroup * (1 - pv) < 5 : false;

  return (
    <div class="ss-card">
      <h3 class="result-title">{t('ss.propTitle')}</h3>
      <RadioGroup label={t('opt.confidence')} name="ss-prop-level" value={level} options={LEVELS.map((l) => ({ value: l, label: `${Math.round(Number(l) * 100)}%` }))} onChange={setLevel} />
      <Field label={t('ss.p')} value={p} onInput={setP} help={t('ss.pHelp')} />
      <Field label={t('ss.marginPct')} value={margin} onInput={setMargin} />
      <Field label={t('ss.groups')} value={groups} onInput={setGroups} />
      {r ? (
        <ResultBlock
          heading={t('ss.heading')}
          title={t('ss.propTitle')}
          table={{ columns: [t('ss.quantity'), t('ss.value')], rows: resultRows(r, lv, t, f), numeric: [false, true] }}
          notes={small ? [t('ss.belowProp')] : []}
          interpretation={[t('ss.interp.prop', { level: lv, p: f.num(num(p)), e: f.num(num(margin)), n: r.perGroup, groups: r.groups, total: r.total })]}
          onAdd={props.onAdd}
        />
      ) : (
        margin && <p class="muted small">{t('ss.invalid')}</p>
      )}
    </div>
  );
}

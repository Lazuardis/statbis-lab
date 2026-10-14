import type { VariableWarnings } from '../../data/detect';
import type { Level, Variable } from '../../data/types';
import { useT, type MessageKey } from '../../i18n/i18n';
import { InfoIcon, WarnIcon } from './icons';

const COLUMNS: { level: Level; label: MessageKey }[] = [
  { level: 'metric', label: 'picker.metric' },
  { level: 'ordinal', label: 'picker.ordinal' },
  { level: 'nominal', label: 'picker.nominal' },
];

function Flags(props: { w: VariableWarnings | undefined }) {
  const t = useT();
  return (
    <>
      {props.w?.idLike && (
        <span class="flag flag-id" title={t('warn.id')} aria-label={t('warn.id')} role="img">
          <InfoIcon />
        </span>
      )}
      {props.w?.codedCategory && (
        <span class="flag flag-warn" title={t('warn.codedShort')} aria-label={t('warn.codedShort')} role="img">
          <WarnIcon />
        </span>
      )}
    </>
  );
}

/** Three columns of checkboxes, one per level of measurement. `selected` keeps tick order. */
export function VariablePicker(props: {
  variables: Variable[];
  warnings: VariableWarnings[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT();
  if (props.variables.length === 0) return <p class="muted picker-empty">{t('picker.noData')}</p>;

  const toggle = (id: string, on: boolean) =>
    props.onChange(on ? [...props.selected.filter((s) => s !== id), id] : props.selected.filter((s) => s !== id));

  return (
    <div class="picker">
      {COLUMNS.map((col) => {
        const vars = props.variables.map((v, j) => ({ v, j })).filter(({ v }) => v.level === col.level);
        return (
          <fieldset key={col.level} class="picker-col">
            <legend>{t(col.label)}</legend>
            {vars.length === 0 && <span class="muted small">{t('picker.noneOfType')}</span>}
            <div class="picker-items">
              {vars.map(({ v, j }) => (
                <label key={v.id} class="checkbox">
                  <input
                    type="checkbox"
                    checked={props.selected.includes(v.id)}
                    onChange={(e) => toggle(v.id, e.currentTarget.checked)}
                  />
                  <span>{v.name}</span>
                  <Flags w={props.warnings[j]} />
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

export interface RegressionSelection {
  dependent: string | null;
  independent: string | null;
}

/** Regression tab: one dependent and one independent metric variable, as radio buttons. */
export function RegressionPicker(props: {
  variables: Variable[];
  warnings: VariableWarnings[];
  value: RegressionSelection;
  onChange: (v: RegressionSelection) => void;
}) {
  const t = useT();
  if (props.variables.length === 0) return <p class="muted picker-empty">{t('picker.noData')}</p>;
  const metric = props.variables.map((v, j) => ({ v, j })).filter(({ v }) => v.level === 'metric');

  const group = (role: 'dependent' | 'independent', label: MessageKey) => (
    <fieldset class="picker-col">
      <legend>{t(label)}</legend>
      {metric.length === 0 && <span class="muted small">{t('picker.noneOfType')}</span>}
      <div class="picker-items">
        {metric.map(({ v, j }) => (
          <label key={v.id} class="radio">
            <input
              type="radio"
              name={`reg-${role}`}
              checked={props.value[role] === v.id}
              onChange={() => {
                const other = role === 'dependent' ? 'independent' : 'dependent';
                props.onChange({
                  ...props.value,
                  [role]: v.id,
                  [other]: props.value[other] === v.id ? null : props.value[other],
                });
              }}
            />
            <span>{v.name}</span>
            <Flags w={props.warnings[j]} />
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div class="picker picker-two">
      {group('dependent', 'picker.dependent')}
      {group('independent', 'picker.independent')}
    </div>
  );
}

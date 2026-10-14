import { useState } from 'preact/hooks';
import { detectColumn, variableWarnings } from '../../data/detect';
import type { DecimalSetting, Level, Variable } from '../../data/types';
import { useT, type MessageKey } from '../../i18n/i18n';
import { LevelIcon, WarnIcon } from './icons';
import { Modal } from './Modal';

const LEVELS: Level[] = ['metric', 'ordinal', 'nominal'];

/** Name, level of measurement, unit and ratio flag. No delete, no value editing. */
export function VariableDialog(props: {
  variable: Variable;
  cells: string[];
  otherNames: string[];
  isMissing: (c: string) => boolean;
  decimalSetting: DecimalSetting;
  onSave: (v: Variable) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<Variable>(props.variable);
  const [error, setError] = useState<string | null>(null);

  const setLevel = (level: Level, byUser: boolean) => {
    const reading = detectColumn(props.cells, props.isMissing, props.decimalSetting);
    setDraft((d) => ({ ...d, level, levelSetByUser: byUser, decimal: reading.decimal }));
  };
  const warnings = variableWarnings(draft, props.cells, props.isMissing);

  const save = () => {
    const name = draft.name.trim();
    if (!name) return setError(t('variable.nameEmpty'));
    if (props.otherNames.some((o) => o.toLowerCase() === name.toLowerCase())) return setError(t('variable.nameTaken'));
    props.onSave({ ...draft, name, unit: draft.unit.trim() });
  };

  return (
    <Modal
      title={t('variable.title')}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" class="btn" onClick={props.onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="variable-form" class="btn btn-primary">
            {t('common.ok')}
          </button>
        </>
      }
    >
      <form
        id="variable-form"
        class="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label class="field">
          <span class="field-label">{t('variable.name')}</span>
          <input
            class="input"
            value={draft.name}
            onInput={(e) => {
              setError(null);
              const name = e.currentTarget.value;
              setDraft((d) => ({ ...d, name }));
            }}
          />
          {error && <span class="field-error">{error}</span>}
        </label>

        <fieldset class="field">
          <legend class="field-label">{t('variable.level')}</legend>
          <div class="level-row">
            <button
              type="button"
              class="btn btn-outline btn-small"
              onClick={() => setLevel(detectColumn(props.cells, props.isMissing, props.decimalSetting).level, false)}
            >
              {t('variable.autoDetect')}
            </button>
            {LEVELS.map((l) => (
              <label key={l} class="radio">
                <input type="radio" name="level" checked={draft.level === l} onChange={() => setLevel(l, true)} />
                <span>{t(`level.${l}` as MessageKey)}</span>
                <LevelIcon level={l} />
              </label>
            ))}
          </div>
          {warnings.codedCategory && (
            <p class="note note-warn">
              <WarnIcon /> {t('warn.coded', { name: draft.name })}
            </p>
          )}
          {warnings.idLike && <p class="note note-id">{t('warn.id')}</p>}
          {warnings.nonNumericCount > 0 && (
            <p class="note note-warn">
              <WarnIcon /> {t('warn.nonNumeric', { name: draft.name, count: warnings.nonNumericCount })}
            </p>
          )}
        </fieldset>

        <label class="field">
          <span class="field-label">{t('variable.unit')}</span>
          <input
            class="input"
            value={draft.unit}
            placeholder={t('variable.unitPlaceholder')}
            onInput={(e) => {
              const unit = e.currentTarget.value;
              setDraft((d) => ({ ...d, unit }));
            }}
          />
        </label>

        {draft.level === 'metric' && (
          <div class="field">
            <label class="checkbox">
              <input
                type="checkbox"
                checked={draft.ratio}
                onChange={(e) => {
                  const ratio = e.currentTarget.checked;
                  setDraft((d) => ({ ...d, ratio }));
                }}
              />
              <span>{t('variable.ratio')}</span>
            </label>
            <p class="muted small indent">{t('variable.ratioHelp')}</p>
          </div>
        )}

        <p class="muted small">{t('variable.readOnly')}</p>
      </form>
    </Modal>
  );
}

import { useState } from 'preact/hooks';
import { DEFAULT_INVALID_CODES } from '../../data/missing';
import type { DecimalSetting } from '../../data/types';
import { useT } from '../../i18n/i18n';
import type { Places } from '../format';
import { Modal } from './Modal';

const PLACES: Places[] = ['auto', 2, 3, 4, 5, 6];

export function SettingsDialog(props: {
  invalidCodes: readonly string[];
  decimal: DecimalSetting;
  places: Places;
  onChange: (s: { invalidCodes: string[]; decimal: DecimalSetting; places: Places }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [codesText, setCodesText] = useState(props.invalidCodes.join('\n'));
  const [decimal, setDecimal] = useState(props.decimal);
  const [places, setPlaces] = useState(props.places);

  const apply = () => {
    const invalidCodes = [...new Set(codesText.split('\n').map((c) => c.trim()).filter((c) => c !== ''))];
    props.onChange({ invalidCodes, decimal, places });
    props.onClose();
  };

  return (
    <Modal
      title={t('settings.title')}
      size="large"
      onClose={props.onClose}
      footer={
        <>
          <button type="button" class="btn" onClick={props.onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" class="btn btn-primary" onClick={apply}>
            {t('common.ok')}
          </button>
        </>
      }
    >
      <div class="settings-grid">
        <div class="field">
          <label class="field-label" for="invalid-codes">
            {t('settings.invalid')}
          </label>
          <textarea
            id="invalid-codes"
            class="input codes"
            rows={9}
            spellcheck={false}
            value={codesText}
            onInput={(e) => setCodesText(e.currentTarget.value)}
          />
          <p class="muted small">{t('settings.invalidHelp')}</p>
          <button type="button" class="link-btn small" onClick={() => setCodesText(DEFAULT_INVALID_CODES.join('\n'))}>
            {t('settings.invalidReset')}
          </button>
        </div>

        <div>
          <fieldset class="field">
            <legend class="field-label">{t('settings.decimal')}</legend>
            <div class="radio-row">
              {(['auto', 'comma', 'point'] as const).map((d) => (
                <label key={d} class="radio">
                  <input type="radio" name="decimal" checked={decimal === d} onChange={() => setDecimal(d)} />
                  <span>{t(`settings.decimal.${d}`)}</span>
                </label>
              ))}
            </div>
            <p class="muted small">{t('settings.decimalHelp')}</p>
          </fieldset>

          <label class="field">
            <span class="field-label">{t('settings.places')}</span>
            <select
              class="input select"
              value={String(places)}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setPlaces(v === 'auto' ? 'auto' : (Number(v) as Places));
              }}
            >
              {PLACES.map((p) => (
                <option key={p} value={String(p)}>
                  {p === 'auto' ? t('settings.places.auto') : p}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </Modal>
  );
}

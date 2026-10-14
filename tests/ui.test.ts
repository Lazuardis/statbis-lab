import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import id from '../src/i18n/id.json';
import { translate } from '../src/i18n/i18n';
import { formatNumber, formatP } from '../src/ui/format';

describe('i18n', () => {
  it('English and Bahasa have exactly the same keys', () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  });
  it('every string is non-empty and uses the same placeholders in both languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(en[key].trim(), key).not.toBe('');
      expect(id[key].trim(), key).not.toBe('');
      expect(vars(id[key]), key).toEqual(vars(en[key]));
    }
  });
  it('fills placeholders', () => {
    expect(translate('en', 'grid.size', { rows: 80, cols: 3 })).toBe('80 rows × 3 columns');
    expect(translate('id', 'grid.size', { rows: 80, cols: 3 })).toBe('80 baris × 3 kolom');
  });
});

describe('formatNumber', () => {
  it('Automatic: 4 significant figures, at least 2 decimals', () => {
    expect(formatNumber(68.7925, 'auto', '.')).toBe('68.79');
    expect(formatNumber(2.834217, 'auto', '.')).toBe('2.834');
    expect(formatNumber(0.17, 'auto', '.')).toBe('0.1700');
    expect(formatNumber(77.1258, 'auto', '.')).toBe('77.13');
    expect(formatNumber(1234.567, 'auto', '.')).toBe('1234.57');
    expect(formatNumber(0, 'auto', '.')).toBe('0.00');
    expect(formatNumber(-0.0001, 'auto', '.')).toBe('-0.0001000');
  });
  it('fixed places and the comma separator', () => {
    expect(formatNumber(7.7725, 2, ',')).toBe('7,77');
    expect(formatNumber(2.3118657, 4, '.')).toBe('2.3119');
    expect(formatNumber(-0.001, 2, '.')).toBe('0.00');
  });
});

describe('formatP', () => {
  it('APA style', () => {
    expect(formatP(0.005861, '.')).toBe('.006');
    expect(formatP(0.0004, '.')).toBe('< .001');
    expect(formatP(0.207, ',')).toBe(',207');
    expect(formatP(0.0004, ',')).toBe('< ,001');
    expect(formatP(1, '.')).toBe('1.000');
  });
});

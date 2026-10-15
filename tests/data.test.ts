import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDataset, redetect, warningsFor } from '../src/data/dataset';
import { detectColumn } from '../src/data/detect';
import { canonicalCell, fingerprint } from '../src/data/fingerprint';
import { DEFAULT_INVALID_CODES, makeIsMissing } from '../src/data/missing';
import { parseNumber, splitDelimited } from '../src/data/parse';
import type { DecimalSetting } from '../src/data/types';

const golden = JSON.parse(readFileSync(new URL('./golden/fingerprint.json', import.meta.url), 'utf8')) as {
  name: string;
  text: string;
  fingerprint: string;
}[];
const pilotCsv = readFileSync(new URL('../C3_basket_by_channel.csv', import.meta.url), 'utf8');
const isMissing = makeIsMissing(DEFAULT_INVALID_CODES);
const opts: { name: string; invalidCodes: readonly string[]; decimal: DecimalSetting } = {
  name: 'test',
  invalidCodes: DEFAULT_INVALID_CODES,
  decimal: 'auto',
};

function build(text: string, extra: Partial<typeof opts> & { delimiter?: string } = {}) {
  const r = buildDataset(text, { ...opts, ...extra });
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('splitDelimited', () => {
  it('reads Excel clipboard text: CRLF, trailing newline, trims cells', () => {
    expect(splitDelimited('a\tb\r\n 1 \t2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('handles quoted cells with tabs, newlines and doubled quotes', () => {
    expect(splitDelimited('name\tnote\nA\t"line 1\nline 2"\nB\t"say ""hi""\tok"')).toEqual([
      ['name', 'note'],
      ['A', 'line 1\nline 2'],
      ['B', 'say "hi"\tok'],
    ]);
  });
  it('drops trailing blank rows and columns, pads ragged rows', () => {
    expect(splitDelimited('a\tb\t\t\n1\t\t\t\n2\n\t\t\n\n')).toEqual([
      ['a', 'b'],
      ['1', ''],
      ['2', ''],
    ]);
  });
  it('strips a byte-order mark and reads comma-separated text', () => {
    expect(splitDelimited('﻿x,y\n1,2', ',')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('parseNumber', () => {
  it('reads point decimals', () => {
    expect(parseNumber('12.5', 'point')).toBe(12.5);
    expect(parseNumber('-0.25', 'point')).toBe(-0.25);
    expect(parseNumber('.5', 'point')).toBe(0.5);
    expect(parseNumber('1e3', 'point')).toBe(1000);
    expect(parseNumber('12,5', 'point')).toBeNull();
    expect(parseNumber('1.250.000', 'point')).toBeNull();
    expect(parseNumber('abc', 'point')).toBeNull();
  });
  it('reads comma decimals', () => {
    expect(parseNumber('12,5', 'comma')).toBe(12.5);
    expect(parseNumber('7', 'comma')).toBe(7);
    expect(parseNumber('12.5', 'comma')).toBeNull();
  });
});

describe('missing values', () => {
  it('treats blanks and the default codes as missing, ignoring case', () => {
    for (const c of ['', 'NA', 'na', 'N/A', '-', '.', '?', '#N/A', '#NULL!']) expect(isMissing(c)).toBe(true);
    for (const c of ['0', '-5', 'Nana', 'GoFood']) expect(isMissing(c)).toBe(false);
  });
});

describe('detectColumn', () => {
  it('numbers are metric, text is nominal, never ordinal', () => {
    expect(detectColumn(['1', '2.5', 'NA', ''], isMissing, 'auto')).toEqual({ level: 'metric', decimal: 'point' });
    expect(detectColumn(['GoFood', 'Walk-in'], isMissing, 'auto')).toEqual({ level: 'nominal', decimal: 'point' });
    expect(detectColumn(['1', 'two'], isMissing, 'auto').level).toBe('nominal');
  });
  it('Auto finds comma-decimal columns with no dots', () => {
    expect(detectColumn(['12,5', '7', '3,25'], isMissing, 'auto')).toEqual({ level: 'metric', decimal: 'comma' });
    expect(detectColumn(['12,5', '7.5'], isMissing, 'auto').level).toBe('nominal');
  });
  it('a forced separator applies to every column', () => {
    expect(detectColumn(['12.5'], isMissing, 'comma')).toEqual({ level: 'nominal', decimal: 'comma' });
    expect(detectColumn(['12,5'], isMissing, 'point')).toEqual({ level: 'nominal', decimal: 'point' });
  });
});

describe('fingerprint', () => {
  it('canonicalises numbers in either locale', () => {
    expect(canonicalCell(' 12.50 ')).toBe('12.5');
    expect(canonicalCell('12,5')).toBe('12.5');
    expect(canonicalCell('007')).toBe('7');
    expect(canonicalCell('GoFood')).toBe('GoFood');
  });
  for (const g of golden) {
    it(`matches Python: ${g.name}`, async () => {
      expect(await fingerprint(build(g.text).dataset.rows)).toBe(g.fingerprint);
    });
  }
  it('pasted pilot and the pilot CSV give the same fingerprint', async () => {
    expect(await fingerprint(build(pilotCsv, { delimiter: ',' }).dataset.rows)).toBe(golden[0]!.fingerprint);
  });
  it('ignores column names and settings', async () => {
    const renamed = golden[0]!.text.replace('Order_ID\tChannel\tBasket_value', 'id\tchannel\tbasket');
    const a = await fingerprint(build(golden[0]!.text).dataset.rows);
    const b = await fingerprint(build(renamed, { decimal: 'comma', invalidCodes: [] }).dataset.rows);
    expect(b).toBe(a);
    expect(await fingerprint([])).toBe('');
  });
});

describe('buildDataset on the pilot file', () => {
  it('reads 80 rows × 3 columns with the expected levels and warnings', () => {
    const d = build(golden[0]!.text).dataset;
    expect(d.rows.length).toBe(80);
    expect(d.variables.map((v) => v.name)).toEqual(['Order_ID', 'Channel', 'Basket_value']);
    expect(d.variables.map((v) => v.level)).toEqual(['nominal', 'nominal', 'metric']);
    const w = warningsFor(d, DEFAULT_INVALID_CODES);
    expect(w.map((x) => x.idLike)).toEqual([true, false, false]);
    expect(w.map((x) => x.codedCategory)).toEqual([false, false, false]);
  });
  it('the Indonesian-locale paste reads Basket_value as a comma-decimal metric', () => {
    expect(build(golden[1]!.text).dataset.variables[2]).toMatchObject({ level: 'metric', decimal: 'comma' });
  });
});

describe('buildDataset edge cases', () => {
  it('rejects empty text and a header with no rows', () => {
    expect(buildDataset('  \r\n', opts)).toEqual({ ok: false, error: 'empty' });
    expect(buildDataset('a\tb\r\n', opts)).toEqual({ ok: false, error: 'noRows' });
  });
  it('flags a header row that looks like data', () => {
    expect(build('1\t2\n3\t4').headerLooksNumeric).toBe(true);
  });
  it('names blank and repeated headers', () => {
    const d = build('\tx\tX\tx\n1\t2\t3\t4').dataset;
    expect(d.variables.map((v) => v.name)).toEqual(['Var1', 'x', 'X_2', 'x_3']);
    expect(d.variables[0]!.autoName).toBe(true);
  });
  it('warns about coded categories', () => {
    const d = build('code\n1\n2\n3\n1\n2\n3').dataset;
    expect(warningsFor(d, DEFAULT_INVALID_CODES)[0]!.codedCategory).toBe(true);
  });
  it('redetect keeps levels the user chose and re-reads the rest', () => {
    const d = build('a\tb\n12,5\t1,5\n3\t2', { decimal: 'point' }).dataset;
    expect(d.variables.map((v) => v.level)).toEqual(['nominal', 'nominal']);
    const userSet = { ...d, variables: d.variables.map((v, j) => (j === 1 ? { ...v, levelSetByUser: true } : v)) };
    expect(redetect(userSet, DEFAULT_INVALID_CODES, 'auto').variables.map((v) => v.level)).toEqual(['metric', 'nominal']);
  });
});

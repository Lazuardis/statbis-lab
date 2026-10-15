import { describe, expect, it } from 'vitest';
import {
  clearRange,
  datasetToTsv,
  deleteColumns,
  deleteRows,
  emptyDataset,
  insertColumns,
  insertRows,
  isUnusedColumn,
  rangeToTsv,
  setCells,
  updateVariable,
} from '../src/data/edit';
import { DEFAULT_INVALID_CODES } from '../src/data/missing';
import type { Dataset } from '../src/data/types';

const ctx = { invalidCodes: DEFAULT_INVALID_CODES, decimal: 'auto' as const };
const names = (d: Dataset) => d.variables.map((v) => v.name);
const levels = (d: Dataset) => d.variables.map((v) => v.level);

function sample(): Dataset {
  return setCells(emptyDataset('t'), -1, 0, [['Channel', 'Basket'], ['GoFood', '60.5'], ['Walk-in', '48'], ['GoFood', '71']], ctx);
}

describe('typing into an empty sheet', () => {
  it('a value in a data cell creates the column and row, named by position', () => {
    const d = setCells(emptyDataset('t'), 0, 0, [['5']], ctx);
    expect(d.rows).toEqual([['5']]);
    expect(names(d)).toEqual(['Var1']);
    expect(levels(d)).toEqual(['metric']);
  });
  it('typing far away fills the gap with blank cells', () => {
    const d = setCells(emptyDataset('t'), 2, 2, [['x']], ctx);
    expect(d.rows).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['', '', 'x'],
    ]);
    expect(names(d)).toEqual(['Var1', 'Var2', 'Var3']);
    expect(isUnusedColumn(d, 0)).toBe(true);
    expect(isUnusedColumn(d, 2)).toBe(false);
  });
  it('typing in the names row names the column; clearing it goes back to VarN', () => {
    let d = setCells(emptyDataset('t'), -1, 1, [['Price']], ctx);
    expect(names(d)).toEqual(['Var1', 'Price']);
    d = setCells(d, 0, 1, [['10']], ctx);
    d = setCells(d, -1, 1, [['']], ctx);
    expect(names(d)).toEqual(['Var1', 'Var2']);
    expect(d.variables[1]!.autoName).toBe(true);
  });
  it('re-detects the level as values change', () => {
    let d = setCells(emptyDataset('t'), -1, 0, [['x'], ['1'], ['2']], ctx);
    expect(levels(d)).toEqual(['metric']);
    d = setCells(d, 1, 0, [['two']], ctx);
    expect(levels(d)).toEqual(['nominal']);
  });
  it('keeps a level the user chose', () => {
    let d = sample();
    d = updateVariable(d, 1, { ...d.variables[1]!, level: 'ordinal', levelSetByUser: true }, ctx);
    d = setCells(d, 0, 1, [['99']], ctx);
    expect(levels(d)).toEqual(['nominal', 'ordinal']);
  });
});

describe('pasting a block', () => {
  it('overwrites from the chosen cell and grows the table', () => {
    const d = setCells(sample(), 2, 1, [['50', 'yes'], ['52', 'no']], ctx);
    expect(names(d)).toEqual(['Channel', 'Basket', 'Var3']);
    expect(d.rows).toEqual([
      ['GoFood', '60.5', ''],
      ['Walk-in', '48', ''],
      ['GoFood', '50', 'yes'],
      ['', '52', 'no'],
    ]);
  });
  it('never changes the previous version (undo relies on it)', () => {
    const before = sample();
    const snapshot = JSON.stringify(before);
    setCells(before, 0, 0, [['changed']], ctx);
    clearRange(before, 0, 0, 2, 1, ctx);
    insertRows(before, 0, 2, ctx);
    deleteColumns(before, 0, 1, ctx);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
  it('makes repeated names unique', () => {
    const d = setCells(sample(), -1, 1, [['Channel']], ctx);
    expect(names(d)).toEqual(['Channel', 'Channel_2']);
  });
});

describe('clearing', () => {
  it('trailing blank rows and unnamed blank columns disappear', () => {
    let d = setCells(sample(), 3, 2, [['extra']], ctx);
    expect(d.rows.length).toBe(4);
    d = clearRange(d, 3, 2, 3, 2, ctx);
    expect(d.rows.length).toBe(3);
    expect(names(d)).toEqual(['Channel', 'Basket']);
  });
  it('a named column stays even when empty', () => {
    const d = clearRange(sample(), 0, 1, 2, 1, ctx);
    expect(names(d)).toEqual(['Channel', 'Basket']);
    expect(d.rows.map((r) => r[1])).toEqual(['', '', '']);
  });
  it('clearing everything leaves an empty sheet', () => {
    const d = clearRange(sample(), -1, 0, 2, 1, ctx);
    expect(d.rows).toEqual([]);
    expect(d.variables).toEqual([]);
  });
});

describe('rows and columns', () => {
  it('insert and delete rows', () => {
    let d = insertRows(sample(), 1, 2, ctx);
    expect(d.rows.map((r) => r[0])).toEqual(['GoFood', '', '', 'Walk-in', 'GoFood']);
    d = deleteRows(d, 1, 2, ctx);
    expect(d.rows).toEqual(sample().rows);
  });
  it('insert and delete columns keep variable ids stable', () => {
    const base = sample();
    let d = insertColumns(base, 1, 1, ctx);
    expect(names(d)).toEqual(['Channel', 'Var2', 'Basket']);
    expect(d.variables[2]!.id).toBe(base.variables[1]!.id);
    d = setCells(d, -1, 1, [['Voucher']], ctx);
    d = deleteColumns(d, 0, 1, ctx);
    expect(names(d)).toEqual(['Voucher', 'Basket']);
    expect(d.rows[0]).toEqual(['', '60.5']);
  });
  it('deleting the last rows trims the table', () => {
    expect(deleteRows(sample(), 0, 3, ctx).rows).toEqual([]);
  });
});

describe('copying out', () => {
  it('whole table as Excel-ready text, quoting cells with tabs or quotes', () => {
    const d = setCells(sample(), 0, 0, [['Go "Food"']], ctx);
    expect(datasetToTsv(d)).toBe('Channel\tBasket\r\n"Go ""Food"""\t60.5\r\nWalk-in\t48\r\nGoFood\t71\r\n');
  });
  it('a rectangle, names row included', () => {
    expect(rangeToTsv(sample(), -1, 1, 1, 1)).toBe('Basket\r\n60.5\r\n48');
  });
});

import { useEffect, useRef, useState } from 'preact/hooks';
import type { VariableWarnings } from '../../data/detect';
import { rangeToTsv } from '../../data/edit';
import { splitDelimited } from '../../data/parse';
import type { Dataset } from '../../data/types';
import { useT, type MessageKey } from '../../i18n/i18n';
import { copyRich } from '../table';
import { InfoIcon, LevelIcon, WarnIcon } from './icons';

const ROW_H = 26;
const HEAD_H = 58; // type-label row + names row
const CASE_W = 56;
const COL_W = 120;
const OVERSCAN = 8;
const VISIBLE_ROWS = 15;
const MIN_COLUMNS = 8;
const MIN_ROWS = 40;
const SPARE_COLUMNS = 3;
const SPARE_ROWS = 25;

/** Edits the grid asks the app to make (the app keeps the history for undo). */
export type GridOp =
  | { kind: 'set'; r: number; c: number; block: string[][] }
  | { kind: 'clear'; r0: number; c0: number; r1: number; c1: number }
  | { kind: 'insertRows'; at: number; count: number }
  | { kind: 'deleteRows'; from: number; count: number }
  | { kind: 'insertCols'; at: number; count: number }
  | { kind: 'deleteCols'; from: number; count: number };

/** Anchor (where the selection started) and focus (the active cell). Row -1 is the names row. */
interface Sel {
  ar: number;
  ac: number;
  fr: number;
  fc: number;
}

interface Editing {
  r: number;
  c: number;
  value: string;
  /** Started by typing a character: arrow keys then leave the cell, as in Excel. */
  typed: boolean;
}

/**
 * Editable spreadsheet: the first row holds the variable names, the rows below the data.
 * Only the rows in view are drawn, so long tables stay fast.
 */
export function DataGrid(props: {
  dataset: Dataset;
  warnings: VariableWarnings[];
  isMissing: (cell: string) => boolean;
  autoFocus: boolean;
  onLevelClick: (index: number) => void;
  onOp: (op: GridOp) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  /** Invisible text box that holds keyboard focus, so typing works with any keyboard or input method. */
  const sink = useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [sel, setSel] = useState<Sel>({ ar: -1, ac: 0, fr: -1, fc: 0 });
  const [active, setActive] = useState(false);
  const [editing, setEditingState] = useState<Editing | null>(null);
  const editRef = useRef<Editing | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const d = props.dataset;
  const nRows = d.rows.length;
  const nCols = d.variables.length;
  const shownCols = Math.max(MIN_COLUMNS, nCols + SPARE_COLUMNS);
  const shownRows = Math.max(MIN_ROWS, nRows + SPARE_ROWS);
  const r0 = Math.min(sel.ar, sel.fr);
  const r1 = Math.max(sel.ar, sel.fr);
  const c0 = Math.min(sel.ac, sel.fc);
  const c1 = Math.max(sel.ac, sel.fc);
  const isEmpty = nRows === 0 && nCols === 0;

  const setEditing = (e: Editing | null) => {
    editRef.current = e;
    setEditingState(e);
  };

  const cellText = (r: number, c: number): string => {
    if (r === -1) {
      const v = d.variables[c];
      return v && !v.autoName ? v.name : '';
    }
    return d.rows[r]?.[c] ?? '';
  };

  const focusFrame = () => sink.current?.focus({ preventScroll: true });

  useEffect(() => {
    if (props.autoFocus) {
      focusFrame();
      setActive(true);
    }
  }, []);

  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onDown = (e: Event) => {
      if (!(e.target as HTMLElement).closest('.grid-menu')) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  // Keep the active cell in view.
  useEffect(() => {
    const f = frame.current;
    if (!f || !active) return;
    const { fr: r, fc: c } = sel;
    if (r >= 0) {
      const top = HEAD_H + r * ROW_H;
      if (top < f.scrollTop + HEAD_H) f.scrollTop = top - HEAD_H;
      else if (top + ROW_H > f.scrollTop + f.clientHeight) f.scrollTop = top + ROW_H - f.clientHeight;
    }
    const left = CASE_W + c * COL_W;
    if (left < f.scrollLeft + CASE_W) f.scrollLeft = left - CASE_W;
    else if (left + COL_W > f.scrollLeft + f.clientWidth) f.scrollLeft = left + COL_W - f.clientWidth;
  }, [sel.fr, sel.fc, active]);

  const clampR = (r: number) => Math.max(-1, Math.min(shownRows - 1, r));
  const clampC = (c: number) => Math.max(0, Math.min(shownCols - 1, c));

  const select = (r: number, c: number, extend = false) => {
    const rr = clampR(r);
    const cc = clampC(c);
    setSel((s) => (extend ? { ...s, fr: rr, fc: cc } : { ar: rr, ac: cc, fr: rr, fc: cc }));
    setActive(true);
  };

  const selectRect = (ar: number, ac: number, fr: number, fc: number) => {
    setSel({ ar: clampR(ar), ac: clampC(ac), fr: clampR(fr), fc: clampC(fc) });
    setActive(true);
  };

  const startEdit = (r: number, c: number, value: string, typed: boolean) => {
    setMenu(null);
    setEditing({ r, c, value, typed });
  };

  /** Save the cell being edited, optionally moving the active cell. */
  const commit = (dr = 0, dc = 0) => {
    const e = editRef.current;
    if (!e) return;
    setEditing(null);
    if (e.value.trim() !== cellText(e.r, e.c)) props.onOp({ kind: 'set', r: e.r, c: e.c, block: [[e.value]] });
    if (dr || dc) select(e.r + dr, e.c + dc);
    focusFrame();
  };

  const cancel = () => {
    setEditing(null);
    focusFrame();
  };

  const pasteBlock = (text: string, r: number, c: number) => {
    const block = splitDelimited(text);
    if (block.length === 0) return;
    props.onOp({ kind: 'set', r, c, block });
    selectRect(r, c, r + block.length - 1, c + block[0]!.length - 1);
  };

  const clearSelection = () => props.onOp({ kind: 'clear', r0, c0, r1, c1 });

  const selectionTsv = () => rangeToTsv(d, r0, c0, r1, c1);

  const onKeyDown = (e: KeyboardEvent) => {
    if (editRef.current) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    const move = (r: number, c: number, extend = false) => {
      e.preventDefault();
      select(r, c, extend);
    };
    const lastRow = Math.max(nRows - 1, -1);
    const lastCol = Math.max(nCols - 1, 0);

    if (mod && (key === 'z' || key === 'Z')) {
      e.preventDefault();
      return e.shiftKey ? props.onRedo() : props.onUndo();
    }
    if (mod && (key === 'y' || key === 'Y')) {
      e.preventDefault();
      return props.onRedo();
    }
    if (mod && (key === 'a' || key === 'A')) {
      e.preventDefault();
      return selectRect(-1, 0, lastRow, lastCol);
    }

    switch (key) {
      case 'ArrowUp':
        return move(mod ? -1 : sel.fr - 1, sel.fc, e.shiftKey);
      case 'ArrowDown':
        return move(mod ? lastRow : sel.fr + 1, sel.fc, e.shiftKey);
      case 'ArrowLeft':
        return move(sel.fr, mod ? 0 : sel.fc - 1, e.shiftKey);
      case 'ArrowRight':
        return move(sel.fr, mod ? lastCol : sel.fc + 1, e.shiftKey);
      case 'PageUp':
        return move(sel.fr - VISIBLE_ROWS, sel.fc, e.shiftKey);
      case 'PageDown':
        return move(sel.fr + VISIBLE_ROWS, sel.fc, e.shiftKey);
      case 'Home':
        return move(mod ? -1 : sel.fr, 0, e.shiftKey);
      case 'End':
        return move(mod ? lastRow : sel.fr, lastCol, e.shiftKey);
      case 'Tab':
        return move(sel.fr, sel.fc + (e.shiftKey ? -1 : 1));
      case 'Enter':
        return move(sel.fr + (e.shiftKey ? -1 : 1), sel.fc);
      case 'F2':
        e.preventDefault();
        return startEdit(sel.fr, sel.fc, cellText(sel.fr, sel.fc), false);
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        return clearSelection();
    }
    if (!mod && !e.altKey && key.length === 1) {
      e.preventDefault();
      startEdit(sel.fr, sel.fc, key, true);
    }
  };

  const onEditKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    const ed = editRef.current;
    if (!ed) return;
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        return commit(e.shiftKey ? -1 : 1, 0);
      case 'Tab':
        e.preventDefault();
        return commit(0, e.shiftKey ? -1 : 1);
      case 'Escape':
        e.preventDefault();
        return cancel();
      case 'ArrowUp':
        e.preventDefault();
        return commit(-1, 0);
      case 'ArrowDown':
        e.preventDefault();
        return commit(1, 0);
      case 'ArrowLeft':
        if (ed.typed) {
          e.preventDefault();
          return commit(0, -1);
        }
        return;
      case 'ArrowRight':
        if (ed.typed) {
          e.preventDefault();
          return commit(0, 1);
        }
        return;
    }
  };

  const inSel = (r: number, c: number) => active && r >= r0 && r <= r1 && c >= c0 && c <= c1;

  const onCellPointerDown = (e: PointerEvent, r: number, c: number) => {
    if (e.button === 2) return;
    setMenu(null);
    if (editRef.current) {
      if (editRef.current.r === r && editRef.current.c === c) return;
      commit();
    }
    if (e.pointerType === 'touch') {
      // On a phone: first tap selects, a second tap on the same cell starts typing.
      if (active && sel.ar === r && sel.ac === c && sel.fr === r && sel.fc === c) startEdit(r, c, cellText(r, c), false);
      else select(r, c);
      return;
    }
    e.preventDefault();
    focusFrame();
    select(r, c, e.shiftKey);
    dragging.current = true;
  };

  const onRowHeaderPointerDown = (e: PointerEvent, r: number) => {
    if (e.button === 2) return;
    e.preventDefault();
    if (editRef.current) commit();
    focusFrame();
    const lastCol = Math.max(nCols - 1, 0);
    if (e.shiftKey) setSel((s) => ({ ...s, fr: r, fc: lastCol }));
    else selectRect(r, 0, r, lastCol);
    setActive(true);
  };

  const onContextMenu = (e: MouseEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
    if (!cell) return;
    e.preventDefault();
    if (editRef.current) commit();
    const r = Number(cell.dataset.r);
    const c = cell.dataset.c === undefined ? null : Number(cell.dataset.c);
    if (c === null) {
      if (!(active && r >= r0 && r <= r1)) selectRect(r, 0, r, Math.max(nCols - 1, 0));
    } else if (!inSel(r, c)) {
      select(r, c);
    }
    focusFrame();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const copyToClipboard = async (cut: boolean) => {
    setMenu(null);
    if ((await copyRich(null, selectionTsv())) && cut) clearSelection();
    focusFrame();
  };

  const firstDataRow = Math.max(r0, 0);
  const menuItems: { key: MessageKey; enabled: boolean; run: () => void }[] = [
    { key: 'grid.menu.insertRowAbove', enabled: firstDataRow < nRows, run: () => props.onOp({ kind: 'insertRows', at: firstDataRow, count: r1 - firstDataRow + 1 }) },
    { key: 'grid.menu.insertRowBelow', enabled: r1 + 1 < nRows, run: () => props.onOp({ kind: 'insertRows', at: r1 + 1, count: Math.max(1, r1 - firstDataRow + 1) }) },
    { key: 'grid.menu.deleteRows', enabled: r1 >= 0 && firstDataRow < nRows, run: () => props.onOp({ kind: 'deleteRows', from: firstDataRow, count: r1 - firstDataRow + 1 }) },
    { key: 'grid.menu.insertColLeft', enabled: c0 < nCols, run: () => props.onOp({ kind: 'insertCols', at: c0, count: c1 - c0 + 1 }) },
    { key: 'grid.menu.insertColRight', enabled: c1 + 1 < nCols, run: () => props.onOp({ kind: 'insertCols', at: c1 + 1, count: c1 - c0 + 1 }) },
    { key: 'grid.menu.deleteCols', enabled: c0 < nCols, run: () => props.onOp({ kind: 'deleteCols', from: c0, count: c1 - c0 + 1 }) },
    { key: 'grid.menu.cut', enabled: !isEmpty, run: () => void copyToClipboard(true) },
    { key: 'grid.menu.copy', enabled: !isEmpty, run: () => void copyToClipboard(false) },
    { key: 'grid.menu.clear', enabled: !isEmpty, run: clearSelection },
    { key: 'grid.menu.undo', enabled: true, run: props.onUndo },
    { key: 'grid.menu.redo', enabled: true, run: props.onRedo },
  ];

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(shownRows, start + VISIBLE_ROWS + 2 * OVERSCAN);
  const cols = Array.from({ length: shownCols }, (_, c) => c);
  const numeric = d.variables.map((v) => v.level === 'metric');

  const renderCell = (r: number, c: number, Tag: 'td' | 'th') => {
    const isFocus = active && sel.fr === r && sel.fc === c;
    const ed = editing && editing.r === r && editing.c === c ? editing : null;
    const value = cellText(r, c);
    const v = d.variables[c];
    const cls = [
      r >= 0 && numeric[c] ? 'num' : '',
      r >= 0 && c < nCols && r < nRows && props.isMissing(value) ? 'missing' : '',
      inSel(r, c) ? 'sel' : '',
      isFocus ? 'focus' : '',
      ed ? 'editing' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <Tag
        key={c}
        class={cls}
        data-r={r}
        data-c={c}
        title={r === -1 && v?.unit ? `${v.name} (${v.unit})` : undefined}
        onPointerDown={(e) => onCellPointerDown(e, r, c)}
        onPointerEnter={(e) => dragging.current && e.pointerType === 'mouse' && select(r, c, true)}
        onDblClick={() => startEdit(r, c, cellText(r, c), false)}
      >
        {ed ? (
          <input
            class="cell-input"
            value={ed.value}
            spellcheck={false}
            aria-label={t('grid.label')}
            ref={(el) => {
              if (el && document.activeElement !== el) {
                el.focus({ preventScroll: true });
                el.setSelectionRange(el.value.length, el.value.length);
              }
            }}
            onInput={(e) => setEditing({ ...ed, value: e.currentTarget.value })}
            onKeyDown={onEditKeyDown}
            onBlur={() => commit()}
            onPaste={(e) => {
              e.stopPropagation();
              const text = e.clipboardData?.getData('text/plain') ?? '';
              if (/[\t\n]/.test(text.replace(/\r?\n$/, ''))) {
                e.preventDefault();
                setEditing(null);
                pasteBlock(text, ed.r, ed.c);
                focusFrame();
              }
            }}
          />
        ) : r === -1 && v?.autoName ? (
          <span class="auto-name">{v.name}</span>
        ) : (
          value
        )}
      </Tag>
    );
  };

  return (
    <div class="grid-wrap">
      <div
        class={`grid-frame${active ? ' active' : ''}`}
        ref={frame}
        role="grid"
        aria-label={t('grid.label')}
        aria-rowcount={shownRows + 1}
        aria-colcount={shownCols}
        onScroll={(e) => {
          setScrollTop(e.currentTarget.scrollTop);
          setMenu(null);
        }}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
        onCopy={(e) => {
          if (editRef.current) return;
          e.preventDefault();
          e.clipboardData?.setData('text/plain', selectionTsv());
        }}
        onCut={(e) => {
          if (editRef.current) return;
          e.preventDefault();
          e.clipboardData?.setData('text/plain', selectionTsv());
          clearSelection();
        }}
        onPaste={(e) => {
          if (editRef.current) return;
          e.preventDefault();
          e.stopPropagation();
          pasteBlock(e.clipboardData?.getData('text/plain') ?? '', r0, c0);
        }}
      >
        <input
          ref={sink}
          class="grid-sink"
          aria-label={t('grid.label')}
          autocomplete="off"
          spellcheck={false}
          onFocus={() => setActive(true)}
          onInput={(e) => {
            // Text that arrives without a key press (phone keyboards, dictation, input methods).
            const value = e.currentTarget.value;
            e.currentTarget.value = '';
            if (value && !editRef.current) startEdit(sel.fr, sel.fc, value, true);
          }}
        />
        <table class="grid">
          <colgroup>
            <col style={{ width: `${CASE_W}px` }} />
            {cols.map((c) => (
              <col key={c} style={{ width: `${COL_W}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr class="grid-levels">
              <th class="case-col" />
              {cols.map((c) => {
                const v = d.variables[c];
                if (!v) return <th key={c} />;
                const w = props.warnings[c];
                const label = t(`level.${v.level}` as MessageKey);
                return (
                  <th key={c}>
                    <button
                      type="button"
                      class={`level-label level-${v.level}`}
                      title={t('grid.levelButton', { level: label, name: v.name })}
                      onClick={() => props.onLevelClick(c)}
                    >
                      {w?.idLike && (
                        <span class="flag flag-id" title={t('warn.id')}>
                          <InfoIcon size={12} />
                        </span>
                      )}
                      {w?.codedCategory && (
                        <span class="flag flag-warn" title={t('warn.codedShort')}>
                          <WarnIcon size={12} />
                        </span>
                      )}
                      {label} <LevelIcon level={v.level} />
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr class="grid-names">
              <th
                class="case-col corner"
                data-r={-1}
                title={t('grid.case')}
                onPointerDown={(e) => {
                  if (e.button === 2) return;
                  e.preventDefault();
                  focusFrame();
                  selectRect(-1, 0, Math.max(nRows - 1, -1), Math.max(nCols - 1, 0));
                }}
              >
                {t('grid.case')}
              </th>
              {cols.map((c) => renderCell(-1, c, 'th'))}
            </tr>
          </thead>
          <tbody>
            {start > 0 && <tr style={{ height: `${start * ROW_H}px` }} aria-hidden="true" />}
            {Array.from({ length: end - start }, (_, k) => {
              const r = start + k;
              return (
                <tr key={r} class={r >= nRows ? 'spare' : ''}>
                  <th
                    class={`case-col${active && r >= r0 && r <= r1 ? ' sel' : ''}`}
                    scope="row"
                    data-r={r}
                    onPointerDown={(e) => onRowHeaderPointerDown(e, r)}
                  >
                    {r + 1}
                  </th>
                  {cols.map((c) => renderCell(r, c, 'td'))}
                </tr>
              );
            })}
            {end < shownRows && <tr style={{ height: `${(shownRows - end) * ROW_H}px` }} aria-hidden="true" />}
          </tbody>
        </table>
      </div>

      {isEmpty && !editing && (
        <div class="grid-empty-hint" aria-hidden="true">
          <p class="paste-hint-title">{t('grid.emptyTitle')}</p>
          <p>{t('grid.emptyHelp')}</p>
          <p class="muted">{t('grid.emptyExamples')}</p>
        </div>
      )}

      {menu && (
        <ul class="grid-menu" role="menu" style={{ left: `${Math.min(menu.x, innerWidth - 250)}px`, top: `${Math.min(menu.y, innerHeight - 380)}px` }}>
          {menuItems.map((item, i) => (
            <li key={item.key} role="none" class={i === 3 || i === 6 || i === 9 ? 'sep' : ''}>
              <button
                type="button"
                role="menuitem"
                disabled={!item.enabled}
                onClick={() => {
                  setMenu(null);
                  item.run();
                  focusFrame();
                }}
              >
                {t(item.key)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GridFooter(props: {
  dataset: Dataset;
  fingerprint: string;
  onRename: (name: string) => void;
}) {
  const t = useT();
  const d = props.dataset;
  const [editingName, setEditingName] = useState(false);
  const commaCols = d.variables.filter((v) => v.level === 'metric' && v.decimal === 'comma').map((v) => v.name);
  const isEmpty = d.rows.length === 0 && d.variables.length === 0;

  return (
    <div class="grid-footer">
      {!isEmpty && (
        <p class="grid-meta">
          {editingName ? (
            <input
              class="input input-inline"
              aria-label={t('grid.nameLabel')}
              value={d.name}
              ref={(el) => el?.focus()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
              }}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (v) props.onRename(v);
                setEditingName(false);
              }}
            />
          ) : (
            <>
              <strong class="data-name">{d.name}</strong>
              <button type="button" class="link-btn small" onClick={() => setEditingName(true)}>
                {t('grid.rename')}
              </button>
            </>
          )}
          <span class="dot">·</span>
          <span>{t('grid.size', { rows: d.rows.length, cols: d.variables.length })}</span>
          <span class="dot">·</span>
          <span title={t('grid.fingerprintHelp')}>
            {t('grid.fingerprint')} <code class="fingerprint">{props.fingerprint || '—'}</code>
          </span>
        </p>
      )}
      {commaCols.length > 0 && <p class="muted small">{t('grid.decimalComma', { names: commaCols.join(', ') })}</p>}
      <p class="muted small">{t('grid.help')}</p>
    </div>
  );
}

export function DataWarnings(props: {
  dataset: Dataset;
  warnings: VariableWarnings[];
  headerLooksNumeric: boolean;
  onOpenVariable: (index: number) => void;
}) {
  const t = useT();
  const items: { key: string; text: string; index?: number }[] = [];
  if (props.headerLooksNumeric) items.push({ key: 'header', text: t('warn.headerNumeric') });
  props.dataset.variables.forEach((v, j) => {
    const w = props.warnings[j];
    if (w?.codedCategory) items.push({ key: `c${j}`, text: t('warn.coded', { name: v.name }), index: j });
    if (w && w.nonNumericCount > 0)
      items.push({ key: `n${j}`, text: t('warn.nonNumeric', { name: v.name, count: w.nonNumericCount }), index: j });
  });
  if (items.length === 0) return null;
  return (
    <ul class="data-warnings">
      {items.map((it) => (
        <li key={it.key}>
          <WarnIcon />
          {it.index === undefined ? (
            <span>{it.text}</span>
          ) : (
            <button type="button" class="link-btn warn-link" onClick={() => props.onOpenVariable(it.index!)}>
              {it.text}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildDataset, column, redetect, warningsFor } from '../data/dataset';
import {
  clearRange,
  datasetToTsv,
  deleteColumns,
  deleteRows,
  emptyDataset,
  insertColumns,
  insertRows,
  isUnusedColumn,
  setCells,
  updateVariable,
  type EditContext,
} from '../data/edit';
import { EXAMPLES } from '../data/examples';
import { fingerprint } from '../data/fingerprint';
import { DEFAULT_INVALID_CODES, makeIsMissing } from '../data/missing';
import type { Dataset } from '../data/types';
import { LangContext, translate, type Lang, type MessageKey, type Vars } from '../i18n/i18n';
import { displaySep, loadPrefs, savePrefs, type Prefs } from './prefs';
import type { ReportItem, ReportMeta } from './report';
import { copyRich } from './table';
import { ComingSoon } from './sections/ComingSoon';
import { Describe } from './sections/Describe';
import { SampleSize } from './sections/SampleSize';
import { FmtContext, makeFmt } from './fmt';
import { DataGrid, DataWarnings, GridFooter, type GridOp } from './shell/DataGrid';
import { DataToolbar } from './shell/DataToolbar';
import { Header } from './shell/Header';
import { ConfirmDialog } from './shell/Modal';
import { ReportButton, ReportDrawer } from './shell/ReportDrawer';
import { useRoute } from './shell/router';
import { SettingsDialog } from './shell/SettingsDialog';
import { Tabs } from './shell/Tabs';
import { VariableDialog } from './shell/VariableDialog';
import { RegressionPicker, VariablePicker, type RegressionSelection } from './shell/VariablePicker';

type PickerTab = 'describe' | 'tests' | 'correlation';
const NO_SELECTION: Record<PickerTab, string[]> = { describe: [], tests: [], correlation: [] };
const NO_REGRESSION: RegressionSelection = { dependent: null, independent: null };
const HISTORY_LIMIT = 200;

interface ConfirmRequest {
  title: string;
  body: string[];
  okLabel: string;
  resolve: (ok: boolean) => void;
}

interface Notice {
  kind: 'error' | 'info';
  text: string;
}

const isEmptyDataset = (d: Dataset) => d.rows.length === 0 && d.variables.length === 0;

export function App() {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [invalidCodes, setInvalidCodes] = useState<string[]>([...DEFAULT_INVALID_CODES]);
  const [dataset, setDataset] = useState<Dataset>(() => emptyDataset(translate(prefs.lang, 'grid.defaultName')));
  const [fp, setFp] = useState('');
  const [headerLooksNumeric, setHeaderLooksNumeric] = useState(false);
  /** Grid edits that have not been copied out with Copy data. */
  const [edited, setEdited] = useState(false);
  const [gridKey, setGridKey] = useState(0);
  const [focusGrid, setFocusGrid] = useState(false);
  const past = useRef<Dataset[]>([]);
  const future = useRef<Dataset[]>([]);
  const [selected, setSelected] = useState(NO_SELECTION);
  const [regression, setRegression] = useState(NO_REGRESSION);
  const [report, setReport] = useState<ReportItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [variableIndex, setVariableIndex] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const nextId = useRef(1);
  const route = useRoute();

  const lang = prefs.lang;
  const t = (key: MessageKey, vars?: Vars) => translate(lang, key, vars);
  const ctx: EditContext = { invalidCodes, decimal: prefs.decimal };
  const isMissing = useMemo(() => makeIsMissing(invalidCodes), [invalidCodes]);
  const warnings = useMemo(() => warningsFor(dataset, invalidCodes), [dataset, invalidCodes]);
  const empty = isEmptyDataset(dataset);
  const fmt = useMemo(() => makeFmt(displaySep(prefs), prefs.places), [prefs]);

  const setPrefs = (p: Prefs) => {
    setPrefsState(p);
    savePrefs(p);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // The fingerprint follows the data: recomputed shortly after every change.
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      void fingerprint(dataset.rows).then((v) => alive && setFp(v));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [dataset.rows]);

  // Success messages fade after a few seconds; errors stay until closed.
  useEffect(() => {
    if (notice?.kind !== 'info') return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Warn before the page is closed or reloaded while there is something to lose.
  useEffect(() => {
    if (report.length === 0 && !edited) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [report.length, edited]);

  const confirm = (title: string, body: string[], okLabel: string) =>
    new Promise<boolean>((resolve) => setConfirmReq({ title, body, okLabel, resolve }));

  /** Ask before replacing or removing data; uncopied edits and the report are lost with it. */
  const confirmDataChange = async (title: string, body: string, okLabel: string) => {
    if (empty && report.length === 0) return true;
    const lines = [body];
    if (edited) lines.push(t('confirm.editsLost'));
    if (report.length > 0) lines.push(t('confirm.reportCleared'));
    return confirm(title, lines, okLabel);
  };

  /** Start over with a new dataset (paste over the page, example, New data): no undo across it. */
  const replaceDataset = (d: Dataset, focus: boolean) => {
    setDataset(d);
    past.current = [];
    future.current = [];
    setEdited(false);
    setSelected(NO_SELECTION);
    setRegression(NO_REGRESSION);
    setReport([]);
    setFocusGrid(focus);
    setGridKey((k) => k + 1);
  };

  const loadText = async (text: string, name: string, delimiter: string) => {
    const result = buildDataset(text, { name, delimiter, ...ctx });
    if (!result.ok) {
      setNotice({ kind: 'error', text: t(result.error === 'empty' ? 'paste.empty' : 'paste.noRows') });
      return;
    }
    if (!(await confirmDataChange(t('confirm.replaceTitle'), t('confirm.replaceBody'), t('confirm.replace')))) return;
    replaceDataset(result.dataset, false);
    setHeaderLooksNumeric(result.headerLooksNumeric);
    setNotice(null);
  };

  /** An undoable change made in the grid or the variable dialog. */
  const commitChange = (next: Dataset) => {
    if (next === dataset) return;
    past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), dataset];
    future.current = [];
    setDataset(next);
    setEdited(true);
  };

  const applyOp = (op: GridOp) => {
    switch (op.kind) {
      case 'set':
        return commitChange(setCells(dataset, op.r, op.c, op.block, ctx));
      case 'clear':
        return commitChange(clearRange(dataset, op.r0, op.c0, op.r1, op.c1, ctx));
      case 'insertRows':
        return commitChange(insertRows(dataset, op.at, op.count, ctx));
      case 'deleteRows':
        return commitChange(deleteRows(dataset, op.from, op.count, ctx));
      case 'insertCols':
        return commitChange(insertColumns(dataset, op.at, op.count, ctx));
      case 'deleteCols':
        return commitChange(deleteColumns(dataset, op.from, op.count, ctx));
    }
  };

  const undo = () => {
    const prev = past.current.at(-1);
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [dataset, ...future.current];
    setDataset(prev);
    setEdited(true);
  };

  const redo = () => {
    const next = future.current[0];
    if (!next) return;
    future.current = future.current.slice(1);
    past.current = [...past.current, dataset];
    setDataset(next);
    setEdited(true);
  };

  // Paste outside the grid (and outside text fields and dialogs) loads the clipboard as a new table.
  const loadTextRef = useRef(loadText);
  loadTextRef.current = loadText;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.grid-frame, input, textarea, select, [contenteditable="true"]')) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      e.preventDefault();
      void loadTextRef.current(text, translate(lang, 'grid.defaultName'), '\t');
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [lang]);

  const newData = async () => {
    if (!(await confirmDataChange(t('confirm.newTitle'), t('confirm.newBody'), t('confirm.remove')))) return;
    replaceDataset(emptyDataset(t('grid.defaultName')), true);
    setHeaderLooksNumeric(false);
    setNotice(null);
  };

  const loadExample = (key: string) => {
    const ex = EXAMPLES.find((e) => e.key === key);
    if (ex) void loadText(ex.csv, ex.key, ',');
  };

  const copyData = async () => {
    if (await copyRich(null, datasetToTsv(dataset))) {
      setEdited(false);
      setNotice({ kind: 'info', text: t('notice.dataCopied') });
    } else {
      setNotice({ kind: 'error', text: t('notice.copyFailed') });
    }
  };

  const addToReport = async (item: Omit<ReportItem, 'id' | 'fingerprint'>) => {
    const stamp = await fingerprint(dataset.rows);
    setReport((r) => [...r, { ...item, fingerprint: stamp, id: nextId.current++ }]);
  };

  const clearReport = async () => {
    if (await confirm(t('report.clear'), [t('report.clearConfirm')], t('report.clear'))) setReport([]);
  };

  const meta: ReportMeta = {
    appName: t('app.name'),
    versionLabel: t('report.version', { version: __APP_VERSION__ }),
    createdLabel: t('report.created'),
    created: new Date(),
    dataLabel: t('report.data'),
    dataName: empty ? '—' : dataset.name,
    sizeLabel: t('report.size'),
    size: empty ? '—' : t('grid.size', { rows: dataset.rows.length, cols: dataset.variables.length }),
    fingerprintLabel: t('grid.fingerprint'),
    fingerprint: fp || '—',
    reportTitle: t('report.title'),
    staleTemplate: t('report.staleNote'),
    lang,
  };

  // The picker lists columns that have a name or data; ids of deleted columns drop out.
  const visible = dataset.variables
    .map((v, j) => ({ v, w: warnings[j]!, j }))
    .filter(({ j }) => !isUnusedColumn(dataset, j));
  const pickerVariables = visible.map((x) => x.v);
  const pickerWarnings = visible.map((x) => x.w);
  const ids = new Set(pickerVariables.map((v) => v.id));
  const pickerTab: PickerTab | null =
    route === 'describe' || route === 'tests' || route === 'correlation' ? route : null;
  const liveSelection = (tab: PickerTab) => selected[tab].filter((id) => ids.has(id));
  const liveRegression: RegressionSelection = {
    dependent: regression.dependent && ids.has(regression.dependent) ? regression.dependent : null,
    independent: regression.independent && ids.has(regression.independent) ? regression.independent : null,
  };

  return (
    <LangContext.Provider value={lang}>
      <FmtContext.Provider value={fmt}>
      <div class="page">
        <Header lang={lang} onLang={(l: Lang) => setPrefs({ ...prefs, lang: l })} />

        <main>
          <DataToolbar
            onNew={newData}
            onExample={loadExample}
            onCopyData={copyData}
            canCopy={!empty}
            onSettings={() => setSettingsOpen(true)}
          />

          {notice && (
            <div class={`notice notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
              <span>{notice.text}</span>
              <button type="button" class="link-btn small" onClick={() => setNotice(null)}>
                {t('common.close')}
              </button>
            </div>
          )}

          <DataGrid
            key={gridKey}
            dataset={dataset}
            warnings={warnings}
            isMissing={isMissing}
            autoFocus={focusGrid}
            onLevelClick={setVariableIndex}
            onOp={applyOp}
            onUndo={undo}
            onRedo={redo}
          />
          <GridFooter dataset={dataset} fingerprint={fp} onRename={(name) => setDataset({ ...dataset, name })} />
          <DataWarnings
            dataset={dataset}
            warnings={warnings}
            headerLooksNumeric={headerLooksNumeric}
            onOpenVariable={setVariableIndex}
          />
          {edited && <p class="unsaved-note small">{t('grid.notSaved')}</p>}

          <Tabs route={route} />

          <div class="analysis">
            {pickerTab && (
              <VariablePicker
                variables={pickerVariables}
                warnings={pickerWarnings}
                selected={liveSelection(pickerTab)}
                onChange={(next) => setSelected({ ...selected, [pickerTab]: next })}
              />
            )}
            {route === 'regression' && (
              <RegressionPicker
                variables={pickerVariables}
                warnings={pickerWarnings}
                value={liveRegression}
                onChange={setRegression}
              />
            )}

            {route === 'describe' ? (
              !empty && (
                <Describe
                  dataset={dataset}
                  selected={liveSelection('describe')}
                  warnings={warnings}
                  isMissing={isMissing}
                  onAdd={addToReport}
                />
              )
            ) : route === 'sample-size' ? (
              <SampleSize onAdd={addToReport} />
            ) : (
              <ComingSoon />
            )}
          </div>
        </main>

        <ReportButton count={report.length} onOpen={() => setDrawerOpen(true)} />
      </div>

      <ReportDrawer open={drawerOpen} items={report} meta={meta} onClose={() => setDrawerOpen(false)} onClear={clearReport} />

      {variableIndex !== null && dataset.variables[variableIndex] && (
        <VariableDialog
          variable={dataset.variables[variableIndex]}
          cells={column(dataset.rows, variableIndex)}
          otherNames={dataset.variables.filter((_, k) => k !== variableIndex).map((v) => v.name)}
          isMissing={isMissing}
          decimalSetting={prefs.decimal}
          onSave={(v) => {
            commitChange(updateVariable(dataset, variableIndex, v, ctx));
            setVariableIndex(null);
          }}
          onClose={() => setVariableIndex(null)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          invalidCodes={invalidCodes}
          decimal={prefs.decimal}
          places={prefs.places}
          onChange={(s) => {
            setInvalidCodes(s.invalidCodes);
            setPrefs({ ...prefs, decimal: s.decimal, places: s.places });
            setDataset(redetect(dataset, s.invalidCodes, s.decimal));
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {confirmReq && (
        <ConfirmDialog
          title={confirmReq.title}
          body={confirmReq.body}
          okLabel={confirmReq.okLabel}
          onAnswer={(ok) => {
            confirmReq.resolve(ok);
            setConfirmReq(null);
          }}
        />
      )}
      </FmtContext.Provider>
    </LangContext.Provider>
  );
}

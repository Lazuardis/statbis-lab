import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildDataset, column, redetect, warningsFor } from '../data/dataset';
import { EXAMPLES } from '../data/examples';
import { DEFAULT_INVALID_CODES, makeIsMissing } from '../data/missing';
import type { Dataset, Variable } from '../data/types';
import { LangContext, translate, type Lang, type MessageKey, type Vars } from '../i18n/i18n';
import { loadPrefs, savePrefs, type Prefs } from './prefs';
import type { ReportItem, ReportMeta } from './report';
import { ComingSoon } from './sections/ComingSoon';
import { DevDemo } from './sections/DevDemo';
import { DataGrid, DataWarnings, GridFooter } from './shell/DataGrid';
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

export function App() {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [invalidCodes, setInvalidCodes] = useState<string[]>([...DEFAULT_INVALID_CODES]);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [headerLooksNumeric, setHeaderLooksNumeric] = useState(false);
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
  const isMissing = useMemo(() => makeIsMissing(invalidCodes), [invalidCodes]);
  const warnings = useMemo(() => (dataset ? warningsFor(dataset, invalidCodes) : []), [dataset, invalidCodes]);

  const setPrefs = (p: Prefs) => {
    setPrefsState(p);
    savePrefs(p);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Success messages fade after a few seconds so the tabs stay in view; errors stay until closed.
  useEffect(() => {
    if (notice?.kind !== 'info') return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Warn before the page is closed or reloaded while the report has content.
  useEffect(() => {
    if (report.length === 0) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [report.length]);

  const confirm = (title: string, body: string[], okLabel: string) =>
    new Promise<boolean>((resolve) => setConfirmReq({ title, body, okLabel, resolve }));

  /** Ask before replacing or removing data; the report is cleared with it. */
  const confirmDataChange = async (title: string, body: string, okLabel: string) => {
    if (!dataset) return true;
    const lines = [body];
    if (report.length > 0) lines.push(t('confirm.reportCleared'));
    return confirm(title, lines, okLabel);
  };

  const loadText = async (text: string, name: string, delimiter: string) => {
    const result = await buildDataset(text, { name, delimiter, invalidCodes, decimal: prefs.decimal });
    if (!result.ok) {
      setNotice({ kind: 'error', text: t(result.error === 'empty' ? 'paste.empty' : 'paste.noRows') });
      return;
    }
    if (!(await confirmDataChange(t('confirm.replaceTitle'), t('confirm.replaceBody'), t('confirm.replace')))) return;
    setDataset(result.dataset);
    setHeaderLooksNumeric(result.headerLooksNumeric);
    setSelected(NO_SELECTION);
    setRegression(NO_REGRESSION);
    setReport([]);
    setNotice({
      kind: 'info',
      text: t('paste.done', { rows: result.dataset.rows.length, cols: result.dataset.variables.length }),
    });
  };

  // Paste anywhere on the page (outside text fields and dialogs) loads the clipboard table.
  const loadTextRef = useRef(loadText);
  loadTextRef.current = loadText;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      const inField = target?.closest('input, textarea, select, [contenteditable="true"]');
      if (inField && !inField.hasAttribute('data-paste-zone')) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      e.preventDefault();
      void loadTextRef.current(text, translate(lang, 'grid.defaultName'), '\t');
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [lang]);

  const newData = async () => {
    if (!(await confirmDataChange(t('confirm.newTitle'), t('confirm.newBody'), t('confirm.remove')))) return;
    setDataset(null);
    setSelected(NO_SELECTION);
    setRegression(NO_REGRESSION);
    setReport([]);
    setNotice(null);
  };

  const loadExample = (key: string) => {
    const ex = EXAMPLES.find((e) => e.key === key);
    if (ex) void loadText(ex.csv, ex.key, ',');
  };

  const updateVariable = (j: number, v: Variable) => {
    if (!dataset) return;
    setDataset({ ...dataset, variables: dataset.variables.map((old, k) => (k === j ? v : old)) });
  };

  const addToReport = (item: Omit<ReportItem, 'id'>) => setReport((r) => [...r, { ...item, id: nextId.current++ }]);

  const clearReport = async () => {
    if (await confirm(t('report.clear'), [t('report.clearConfirm')], t('report.clear'))) setReport([]);
  };

  const meta: ReportMeta = {
    appName: t('app.name'),
    versionLabel: t('report.version', { version: __APP_VERSION__ }),
    createdLabel: t('report.created'),
    created: new Date(),
    dataLabel: t('report.data'),
    dataName: dataset?.name ?? '—',
    sizeLabel: t('report.size'),
    size: dataset ? t('grid.size', { rows: dataset.rows.length, cols: dataset.variables.length }) : '—',
    fingerprintLabel: t('grid.fingerprint'),
    fingerprint: dataset?.fingerprint ?? '—',
    reportTitle: t('report.title'),
    lang,
  };

  const variables = dataset?.variables ?? [];
  const pickerTab: PickerTab | null =
    route === 'describe' || route === 'tests' || route === 'correlation' ? route : null;

  return (
    <LangContext.Provider value={lang}>
      <div class="page no-print-report">
        <Header lang={lang} onLang={(l: Lang) => setPrefs({ ...prefs, lang: l })} />

        <main>
          <DataToolbar onNew={newData} onExample={loadExample} onSettings={() => setSettingsOpen(true)} />

          {notice && (
            <div class={`notice notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
              <span>{notice.text}</span>
              <button type="button" class="link-btn small" onClick={() => setNotice(null)}>
                {t('common.close')}
              </button>
            </div>
          )}

          <DataGrid
            dataset={dataset}
            warnings={warnings}
            isMissing={isMissing}
            onLevelClick={setVariableIndex}
            onPasteBoxText={(text) => void loadText(text, t('grid.defaultName'), '\t')}
          />
          {dataset && (
            <>
              <GridFooter dataset={dataset} onRename={(name) => setDataset({ ...dataset, name })} />
              <DataWarnings
                dataset={dataset}
                warnings={warnings}
                headerLooksNumeric={headerLooksNumeric}
                onOpenVariable={setVariableIndex}
              />
            </>
          )}

          <Tabs route={route} />

          <div class="analysis">
            {pickerTab && (
              <VariablePicker
                variables={variables}
                warnings={warnings}
                selected={selected[pickerTab]}
                onChange={(ids) => setSelected({ ...selected, [pickerTab]: ids })}
              />
            )}
            {route === 'regression' && (
              <RegressionPicker variables={variables} warnings={warnings} value={regression} onChange={setRegression} />
            )}

            {import.meta.env.DEV && route === 'describe' && dataset ? (
              <DevDemo dataset={dataset} selected={selected.describe} isMissing={isMissing} onAdd={addToReport} />
            ) : (
              <ComingSoon />
            )}
          </div>
        </main>

        <ReportButton count={report.length} onOpen={() => setDrawerOpen(true)} />
      </div>

      <ReportDrawer
        open={drawerOpen}
        items={report}
        meta={meta}
        onClose={() => setDrawerOpen(false)}
        onClear={clearReport}
      />

      {variableIndex !== null && dataset && dataset.variables[variableIndex] && (
        <VariableDialog
          variable={dataset.variables[variableIndex]}
          cells={column(dataset.rows, variableIndex)}
          otherNames={dataset.variables.filter((_, k) => k !== variableIndex).map((v) => v.name)}
          isMissing={isMissing}
          decimalSetting={prefs.decimal}
          onSave={(v) => {
            updateVariable(variableIndex, v);
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
            if (dataset) setDataset(redetect(dataset, s.invalidCodes, s.decimal));
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
    </LangContext.Provider>
  );
}

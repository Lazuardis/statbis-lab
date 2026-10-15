import { escapeHtml } from './table';

export interface ReportItem {
  id: number;
  /** The analysis the item belongs to, e.g. "Two-sample t-test". Shown as a heading. */
  heading: string;
  /** The table or chart title. */
  title: string;
  /** Snapshot of the table/chart and its interpretation (if open), as HTML. */
  html: string;
  /** Plain-text version for Copy all. */
  text: string;
  /** Dataset fingerprint when the item was added. */
  fingerprint: string;
}

export interface ReportMeta {
  appName: string;
  versionLabel: string;
  createdLabel: string;
  created: Date;
  dataLabel: string;
  dataName: string;
  sizeLabel: string;
  size: string;
  fingerprintLabel: string;
  fingerprint: string;
  reportTitle: string;
  /** Shown under items made before a later edit; contains {fingerprint}. */
  staleTemplate: string;
  lang: string;
}

export function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `<data name>_statbis-report_<yyyymmdd-hhmm>.html`, with the name made safe for file systems. */
export function reportFileName(dataName: string, d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  const safe = dataName.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'data';
  return `${safe}_statbis-report_${stamp}.html`;
}

export function metaBlockHtml(m: ReportMeta): string {
  const row = (k: string, v: string) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`;
  return (
    `<div class="report-meta"><p class="report-app">${escapeHtml(m.appName)} · ${escapeHtml(m.versionLabel)}</p>` +
    `<table>${row(m.createdLabel, formatDateTime(m.created))}${row(m.dataLabel, m.dataName)}` +
    `${row(m.sizeLabel, m.size)}${row(m.fingerprintLabel, m.fingerprint)}</table></div>`
  );
}

/** Items grouped under their analysis heading, in the order they were added. */
function staleNote(m: ReportMeta, it: ReportItem): string | null {
  return it.fingerprint !== m.fingerprint ? m.staleTemplate.replace('{fingerprint}', it.fingerprint) : null;
}

export function itemsHtml(items: readonly ReportItem[], m: ReportMeta): string {
  let out = '';
  let last = '';
  for (const it of items) {
    if (it.heading !== last) {
      out += `<h2>${escapeHtml(it.heading)}</h2>`;
      last = it.heading;
    }
    const note = staleNote(m, it);
    out +=
      `<section class="report-item"><h3>${escapeHtml(it.title)}</h3>` +
      (note ? `<p class="stale-note">${escapeHtml(note)}</p>` : '') +
      `${it.html}</section>`;
  }
  return out;
}

export function itemsText(m: ReportMeta, items: readonly ReportItem[]): string {
  const head = [
    `${m.appName} · ${m.versionLabel}`,
    `${m.createdLabel}: ${formatDateTime(m.created)}`,
    `${m.dataLabel}: ${m.dataName}`,
    `${m.sizeLabel}: ${m.size}`,
    `${m.fingerprintLabel}: ${m.fingerprint}`,
  ].join('\n');
  let out = head;
  let last = '';
  for (const it of items) {
    if (it.heading !== last) {
      out += `\n\n${it.heading}`;
      last = it.heading;
    }
    const note = staleNote(m, it);
    out += `\n\n${it.title}\n${note ? `${note}\n` : ''}${it.text}`;
  }
  return out;
}

/** Style shared by the drawer, print and the downloaded file. */
export const REPORT_CSS = `
.report-doc{font-family:Lato,"Segoe UI",system-ui,sans-serif;color:#1F2933;line-height:1.5;font-size:15px}
.report-doc h1{font-size:24px;margin:0 0 12px;font-weight:700}
.report-doc h2{font-size:20px;margin:28px 0 8px;padding-bottom:4px;border-bottom:2px solid #0F6B6B;font-weight:700}
.report-doc h3{font-size:16px;margin:18px 0 8px;font-weight:700}
.report-doc .report-app{margin:0 0 6px;color:#6B7785}
.report-doc .report-meta table{border-collapse:collapse;font-size:14px}
.report-doc .report-meta th{text-align:left;font-weight:400;color:#6B7785;padding:2px 16px 2px 0}
.report-doc .report-meta td{padding:2px 0}
.report-doc table.result{border-collapse:collapse;margin:4px 0 8px;font-size:14px}
.report-doc table.result th,.report-doc table.result td{padding:5px 12px;text-align:left;border-bottom:1px solid #E3E8EC}
.report-doc table.result thead th{border-top:1.5px solid #1F2933;border-bottom:1px solid #1F2933;font-weight:700}
.report-doc table.result tbody tr:last-child td{border-bottom:1.5px solid #1F2933}
.report-doc table.result .num{text-align:right;font-variant-numeric:tabular-nums}
.report-doc .interpretation{max-width:46em;margin:8px 0}
.report-doc .interpretation p{margin:0 0 8px}
.report-doc .stale-note{margin:0 0 6px;padding:4px 10px;border-left:3px solid #9A6200;background:#FFF6E0;color:#6B4400;font-size:13.5px}
`;

export function standaloneHtml(m: ReportMeta, items: readonly ReportItem[]): string {
  return `<!doctype html>
<html lang="${escapeHtml(m.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(m.reportTitle)} — ${escapeHtml(m.dataName)}</title>
<style>
body{margin:0;background:#fff}
main{max-width:900px;margin:0 auto;padding:32px 20px}
${REPORT_CSS}
@media print{main{padding:0}}
</style>
</head>
<body>
<main class="report-doc">
<h1>${escapeHtml(m.reportTitle)}</h1>
${metaBlockHtml(m)}
${itemsHtml(items, m)}
</main>
</body>
</html>
`;
}

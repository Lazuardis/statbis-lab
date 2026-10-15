/**
 * A results table as shown on screen, copied to the clipboard and stored in the report.
 * Cells are already formatted strings; numbers are right-aligned.
 */
export interface ResultTable {
  columns: string[];
  rows: string[][];
  /** Per column: true for numeric (right-aligned). */
  numeric: boolean[];
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function tableToTsv(t: ResultTable): string {
  return [t.columns, ...t.rows].map((r) => r.map((c) => c.replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
}

export function tableToHtml(t: ResultTable): string {
  const cell = (tag: 'th' | 'td', text: string, j: number) =>
    `<${tag}${t.numeric[j] ? ' class="num"' : ''}>${escapeHtml(text)}</${tag}>`;
  const head = `<tr>${t.columns.map((c, j) => cell('th', c, j)).join('')}</tr>`;
  const body = t.rows.map((r) => `<tr>${r.map((c, j) => cell('td', c, j)).join('')}</tr>`).join('');
  return `<table class="result"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/**
 * Put text (and optionally HTML, so Word and Excel paste a real table) on the clipboard.
 * Falls back to the older copy command where the browser blocks the Clipboard API.
 */
export async function copyRich(html: string | null, text: string): Promise<boolean> {
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(html, text);
  }
}

function legacyCopy(html: string | null, text: string): boolean {
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData('text/plain', text);
    if (html) e.clipboardData?.setData('text/html', html);
    e.preventDefault();
    e.stopImmediatePropagation(); // keep the grid's own copy handler out of it
  };
  document.addEventListener('copy', onCopy, true);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.removeEventListener('copy', onCopy, true);
  }
}

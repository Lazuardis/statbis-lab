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

/** Put HTML and plain text on the clipboard, so Word and Excel paste a real table. */
export async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
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
    return false;
  }
}

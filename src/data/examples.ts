/** Practice datasets built by scripts/make_examples.py, bundled as text. */
const files = import.meta.glob('../../examples/*.csv', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export interface Example {
  /** File name without extension, e.g. ex04_twosample_channel. Also the i18n key suffix. */
  key: string;
  csv: string;
}

export const EXAMPLES: Example[] = Object.entries(files)
  .map(([path, csv]) => ({ key: path.split('/').pop()!.replace(/\.csv$/, ''), csv }))
  .sort((a, b) => a.key.localeCompare(b.key));

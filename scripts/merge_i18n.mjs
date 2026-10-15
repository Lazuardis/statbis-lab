// Merge new UI strings into src/i18n/{en,id}.json.
// Usage: node scripts/merge_i18n.mjs <en-additions.json> <id-additions.json> [key-prefix-to-remove ...]
import { readFileSync, writeFileSync } from 'node:fs';

const [enAdd, idAdd, ...dropPrefixes] = process.argv.slice(2);
for (const [lang, file] of [['en', enAdd], ['id', idAdd]]) {
  const path = new URL(`../src/i18n/${lang}.json`, import.meta.url);
  const obj = JSON.parse(readFileSync(path, 'utf8'));
  for (const k of Object.keys(obj)) if (dropPrefixes.some((p) => k.startsWith(p))) delete obj[k];
  Object.assign(obj, JSON.parse(readFileSync(file, 'utf8')));
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}
console.log('merged');

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import en from './en.json';
import id from './id.json';

export type Lang = 'en' | 'id';
export type MessageKey = keyof typeof en;
export type Vars = Record<string, string | number>;

const messages: Record<Lang, Record<string, string>> = { en, id };

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const template = messages[lang][key] ?? messages.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export type T = (key: MessageKey, vars?: Vars) => string;

export const LangContext = createContext<Lang>('id');

export function useT(): T {
  const lang = useContext(LangContext);
  return (key, vars) => translate(lang, key, vars);
}

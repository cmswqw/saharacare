import { en } from "./en";
import { ne } from "./ne";
import type { Language } from "@/types";

export const dictionaries = { en, ne };
export type TranslationKey = keyof typeof en;
export type TranslationValues = Record<string, string | number>;

export function translate(
  language: Language,
  key: TranslationKey,
  values?: TranslationValues,
) {
  const template = dictionaries[language][key] as string;

  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : match
  ));
}

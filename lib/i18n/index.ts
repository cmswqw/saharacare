import { en } from "./en";
import { ne } from "./ne";
import type { Language } from "@/types";

export const dictionaries = { en, ne };
export type TranslationKey = keyof typeof en;
export function translate(language: Language, key: TranslationKey) {
  return dictionaries[language][key];
}

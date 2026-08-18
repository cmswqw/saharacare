"use client";

import { useApp } from "@/components/providers/AppProvider";
import type { TranslationKey, TranslationValues } from "@/lib/i18n";

export function TranslatedText({
  translationKey,
  values,
}: {
  translationKey: TranslationKey;
  values?: TranslationValues;
}) {
  const { t } = useApp();
  return <>{t(translationKey, values)}</>;
}

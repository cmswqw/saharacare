"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Language } from "@/types";
import {
  translate,
  type TranslationKey,
  type TranslationValues,
} from "@/lib/i18n";
import { Toast } from "@/components/ui/Toast";

type TextSize = "normal" | "large" | "extra";
type ToastState = { message: string; tone?: "success" | "info" | "warning" } | null;

type AppContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
  toast: (message: string, tone?: "success" | "info" | "warning") => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [textSize, setTextSizeState] = useState<TextSize>("large");
  const [darkMode, setDarkMode] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [toastState, setToastState] = useState<ToastState>(null);

  useEffect(() => {
    const savedLanguage = localStorage.getItem("saharacare-language") as Language | null;
    const savedSize = localStorage.getItem("saharacare-text-size") as TextSize | null;
    if (savedLanguage === "en" || savedLanguage === "ne") setLanguageState(savedLanguage);
    if (["normal", "large", "extra"].includes(savedSize ?? "")) setTextSizeState(savedSize as TextSize);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.classList.toggle("dark", darkMode);
    root.classList.toggle("contrast", highContrast);
    root.classList.toggle("reduce-motion", reducedMotion);
    root.classList.remove("text-size-normal", "text-size-large", "text-size-extra");
    root.classList.add(`text-size-${textSize}`);
  }, [language, textSize, darkMode, highContrast, reducedMotion]);

  const setLanguage = useCallback((value: Language) => {
    setLanguageState(value);
    localStorage.setItem("saharacare-language", value);
  }, []);

  const setTextSize = useCallback((value: TextSize) => {
    setTextSizeState(value);
    localStorage.setItem("saharacare-text-size", value);
  }, []);

  const toast = useCallback((message: string, tone: "success" | "info" | "warning" = "info") => {
    setToastState({ message, tone });
    window.setTimeout(() => setToastState(null), 3500);
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    language,
    setLanguage,
    t: (key, values) => translate(language, key, values),
    textSize,
    setTextSize,
    darkMode,
    setDarkMode,
    highContrast,
    setHighContrast,
    reducedMotion,
    setReducedMotion,
    toast,
  }), [
    darkMode,
    highContrast,
    language,
    reducedMotion,
    setLanguage,
    setTextSize,
    textSize,
    toast,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <Toast state={toastState} />
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}

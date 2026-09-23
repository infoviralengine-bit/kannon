import { useSyncExternalStore } from "react";
import { en } from "./en";

/**
 * Lightweight i18n. Source language is Italian: every UI string is written in
 * Italian and wrapped in t("..."). The English dictionary is keyed by the
 * Italian text; missing keys fall back to Italian, so pages can be migrated
 * incrementally. Numbers, currency and dates stay in it-IT format by design.
 * Placeholders: t("Aggiornato {when}", { when: "5m" }).
 */
export type Lang = "it" | "en";
const STORAGE_KEY = "kannon-lang";

const listeners = new Set<() => void>();
let current: Lang = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" ? "en" : "it";
  } catch {
    return "it";
  }
})();
if (typeof document !== "undefined") document.documentElement.lang = current;

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Non-reactive translate (for toasts, constants evaluated at call time). */
export function t(it: string, vars?: Record<string, string | number>): string {
  const base = current === "en" ? en[it] ?? it : it;
  return interpolate(base, vars);
}

/** Reactive hook: re-renders the component on language change. */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, setLang, t };
}

// Language switching for the whole app.
// Every visible word comes from en.json / ar.json, so each language shows only its own text.
import { createContext, Fragment, useContext, useEffect, useMemo, useState } from "react";
import en from "./en.json";
import ar from "./ar.json";

const DICTS = { en, ar };
const STORAGE_KEY = "kanaf.lang";
const I18nContext = createContext(null);

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

function savedLang() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "ar" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => savedLang() || "en");
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* private mode: the choice just won't be remembered */
    }
  }, [lang, dir]);

  const value = useMemo(() => {
    const dict = DICTS[lang];

    // t("today.title", { name: "Sara" }) -> "Sara’s day"
    // Values can be React elements; then t returns an array you can render.
    function t(key, vars = {}) {
      const template = lookup(dict, key) ?? lookup(en, key) ?? key;
      if (typeof template !== "string") return key;
      const parts = template.split(/\{(\w+)\}/g);
      if (parts.length === 1) return template;
      const hasElements = Object.values(vars).some((v) => v !== null && typeof v === "object");
      if (!hasElements) {
        return parts.map((p, i) => (i % 2 ? vars[p] ?? `{${p}}` : p)).join("");
      }
      return parts.map((p, i) => <Fragment key={i}>{i % 2 ? vars[p] ?? `{${p}}` : p}</Fragment>);
    }

    // tl("processing.steps") -> the list stored under that key.
    const tl = (key) => {
      const value = lookup(dict, key) ?? lookup(en, key);
      return Array.isArray(value) ? value : [];
    };

    return {
      lang,
      dir,
      t,
      tl,
      locale: lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB",
      toggle: () => setLang((l) => (l === "ar" ? "en" : "ar")),
    };
  }, [lang, dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { translate, type Locale } from "./i18n-messages"

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("xuan-locale")
    if (saved === "en" || saved === "zh") return saved
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"
  })

  useEffect(() => {
    localStorage.setItem("xuan-locale", locale)
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
  }, [locale])

  const value = useMemo(
    () => ({ locale, setLocale, t: (key: string) => translate(locale, key) }),
    [locale],
  )

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used within I18nProvider")
  return context
}

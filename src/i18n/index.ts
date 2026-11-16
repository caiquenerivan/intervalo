import { useCallback } from 'react'
import { useStore, type Lang } from '../store/useStore'
import { en, type Key } from './en'
import { pt } from './pt'

const DICTS: Record<Lang, Record<Key, string>> = { en, pt }

export type { Key }
export type T = (key: Key, vars?: Record<string, string | number>) => string

/** A piece of content written in both languages (used by lesson content). */
export interface Localized {
  en: string
  pt: string
}

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const text = DICTS[lang][key] ?? en[key] ?? key
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}

export function useT(): T {
  const lang = useStore((s) => s.lang)
  return useCallback((key, vars) => translate(lang, key, vars), [lang])
}

export function useLang(): Lang {
  return useStore((s) => s.lang)
}

/**
 * Internationalization (i18n) system.
 * Supports Russian (primary) and English (secondary).
 * Language preference is stored in Zustand store and persisted to localStorage.
 */

import { ru } from './ru';
import { en } from './en';

export type Language = 'ru' | 'en';
export type TranslationKey = keyof typeof ru;

/**
 * All translations dictionary.
 */
const translations = {
  ru,
  en,
} as const;

/**
 * Current language (default: Russian).
 * This is set by the store, not managed here directly.
 */
let currentLanguage: Language = 'ru';

/**
 * Set current language.
 * Called by store when language changes.
 */
export function setCurrentLanguage(lang: Language): void {
  currentLanguage = lang;
}

/**
 * Get current language.
 */
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

/**
 * Translate a key to current language.
 * Falls back to English if key not found in current language.
 * Falls back to key itself if not found in any language.
 *
 * @param key - Translation key (e.g., 'menu.title')
 * @returns Translated string
 */
export function t(key: TranslationKey): string {
  const lang = currentLanguage;

  // Try current language
  const translation = translations[lang][key];
  if (translation) {
    return translation;
  }

  // Fallback to English
  const fallback = translations.en[key];
  if (fallback) {
    return fallback;
  }

  // Last resort: return key itself
  console.warn(`Translation missing for key: ${key}`);
  return key;
}

/**
 * Translate with explicit language (for language selector preview).
 */
export function tLang(key: TranslationKey, lang: Language): string {
  return translations[lang][key] || translations.en[key] || key;
}

/**
 * Get all available languages with their native names.
 */
export const AVAILABLE_LANGUAGES = [
  { code: 'ru' as const, name: 'Русский' },
  { code: 'en' as const, name: 'English' },
];

/**
 * Re-export types and constants.
 */
export { ru, en };

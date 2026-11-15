/**
 * React hook for using translations in components.
 * Automatically re-renders when language changes.
 */

import { useEffect } from 'react';
import { useGameStore } from '../game/store';
import { t, setCurrentLanguage, type TranslationKey, type Language } from './index';

/**
 * Hook for using translations in React components.
 * Returns translation function and current language.
 *
 * @example
 * function MyComponent() {
 *   const { t } = useTranslation();
 *   return <h1>{t('menu.title')}</h1>;
 * }
 */
export function useTranslation() {
  const language = useGameStore((state) => state.settings.language);
  const setLanguage = useGameStore((state) => state.setLanguage);

  // Sync i18n system with store language on mount and when it changes
  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  return {
    t,
    language,
    setLanguage,
  };
}

/**
 * Re-export types for convenience.
 */
export type { TranslationKey, Language };

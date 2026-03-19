import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './en/translation.json';
import frTranslation from './fr/translation.json';
import deTranslation from './de/translation.json';
import esTranslation from './es/translation.json';

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const SERVER_LANGUAGES = [
  'unknown',
  'french',
  'english',
  'german',
  'spanish',
  'italian',
  'portuguese',
  'japanese',
  'chinese',
  'russian',
  'arabic',
  'dutch',
  'swedish',
  'norwegian',
  'danish',
  'finnish',
  'polish',
  'czech',
  'hungarian',
  'romanian',
  'turkish',
  'korean',
  'latin',
  'greek',
  'croatian',
  'hindi',
  'hebrew',
  'persian',
  'catalan',
  'thai',
  'vietnamese',
  'indonesian',
  'malay',
] as const;
export type ServerLanguage = typeof SERVER_LANGUAGES[number];

const SERVER_TO_SUPPORTED_LANGUAGE: Partial<Record<ServerLanguage, SupportedLanguage>> = {
  english: 'en',
  french: 'fr',
  german: 'de',
  spanish: 'es',
};

const SUPPORTED_TO_SERVER_LANGUAGE: Record<SupportedLanguage, string> = {
  en: 'english',
  fr: 'french',
  de: 'german',
  es: 'spanish',
};

export function fromServerLanguage(value: string | null | undefined): SupportedLanguage | null {
  if (!value) return null;
  const normalized = value.toLowerCase() as ServerLanguage;
  return SERVER_TO_SUPPORTED_LANGUAGE[normalized] ?? null;
}

export function toServerLanguage(value: SupportedLanguage): string {
  return SUPPORTED_TO_SERVER_LANGUAGE[value];
}

export function fromI18nLanguage(value: string | null | undefined): SupportedLanguage {
  if (!value) return 'en';
  const normalized = value.toLowerCase().split('-')[0] as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : 'en';
}

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  de: '🇩🇪',
  es: '🇪🇸',
};

const resources = {
  en: { translation: enTranslation },
  fr: { translation: frTranslation },
  de: { translation: deTranslation },
  es: { translation: esTranslation },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    
    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;


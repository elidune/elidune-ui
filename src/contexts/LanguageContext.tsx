import { createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  LANGUAGE_FLAGS,
  fromI18nLanguage,
  fromServerLanguage,
  toServerLanguage,
  type SupportedLanguage,
} from '@/locales';
import { useAuth } from './AuthContext';
import api from '@/services/api';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  availableLanguages: typeof SUPPORTED_LANGUAGES;
  languageNames: typeof LANGUAGE_NAMES;
  languageFlags: typeof LANGUAGE_FLAGS;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const language = fromI18nLanguage(i18n.resolvedLanguage ?? i18n.language);

  // Sync language with user profile when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.language) {
      const userLang = fromServerLanguage(user.language);
      if (!userLang) return;
      if (SUPPORTED_LANGUAGES.includes(userLang) && userLang !== language) {
        i18n.changeLanguage(userLang);
      }
    }
  }, [isAuthenticated, user?.language, i18n, language]);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;

    await i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);

    // Save to server if authenticated
    if (isAuthenticated) {
      try {
        await api.updateProfile({ language: toServerLanguage(lang) });
      } catch (error) {
        console.error('Failed to save language preference to server:', error);
      }
    }
  }, [i18n, isAuthenticated]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        availableLanguages: SUPPORTED_LANGUAGES,
        languageNames: LANGUAGE_NAMES,
        languageFlags: LANGUAGE_FLAGS,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}


'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Language, LanguageContextType } from './types';
import { getTranslation } from './translations';

interface ExtendedLanguageContextType extends LanguageContextType {
  t: ReturnType<typeof getTranslation>;
}

const LanguageContext = createContext<ExtendedLanguageContextType | null>(null);

const STORAGE_KEY = 'huriza_language';
const COOKIE_NAME = 'huriza_lang';

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'rw') return saved;
    const cookieMatch = document.cookie.match(new RegExp(`(^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (cookieMatch && (cookieMatch[2] === 'en' || cookieMatch[2] === 'rw')) {
      return cookieMatch[2] as Language;
    }
  } catch {
    // Ignore storage/cookie read errors
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getInitialLanguage();
    setLanguageState(initial);
    document.documentElement.lang = initial;
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
        document.cookie = `${COOKIE_NAME}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
        document.documentElement.lang = lang;
      } catch {
        // Storage write may fail in restricted environments
      }
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'rw' : 'en');
  };

  const t = useMemo(() => getTranslation(language), [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      isKinyarwanda: language === 'rw',
      t,
    }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Provide a safe fallback if accessed outside the provider
    const fallbackT = getTranslation('en');
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      toggleLanguage: () => {},
      isKinyarwanda: false,
      t: fallbackT,
    };
  }
  return context;
}

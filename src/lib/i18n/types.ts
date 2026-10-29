export type Language = 'en' | 'rw';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isKinyarwanda: boolean;
}

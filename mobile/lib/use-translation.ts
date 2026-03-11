import { useLanguage } from "./language-context";
import { translations, TranslationKey, interpolate } from "./translations";

export function useTranslation() {
  const { language } = useLanguage();

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const text = translations[language][key];
    if (!text) {
      console.warn(`Translation missing for key: ${key} in language: ${language}`);
      return key;
    }
    
    if (params) {
      return interpolate(text, params);
    }
    
    return text;
  };

  return { t, language };
}

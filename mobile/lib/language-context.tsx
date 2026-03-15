import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

type Language = "ja" | "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANGUAGE_KEY = "@pashabook_language";

// Detect device language and map to supported languages
function getDeviceLanguage(): Language {
  const deviceLocale = Localization.getLocales()[0];
  const languageCode = deviceLocale?.languageCode;
  
  // If device language is Japanese, use Japanese, otherwise default to English
  return languageCode === "ja" ? "ja" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getDeviceLanguage());
  const [isLoading, setIsLoading] = useState(true);

  // Load language from AsyncStorage on mount
  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (stored === "ja" || stored === "en") {
        // Use stored preference if exists
        setLanguageState(stored);
      } else {
        // First launch: detect device language and save it
        const deviceLang = getDeviceLanguage();
        setLanguageState(deviceLang);
        await AsyncStorage.setItem(LANGUAGE_KEY, deviceLang);
      }
    } catch (error) {
      console.error("Error loading language:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error("Error saving language:", error);
      throw error;
    }
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      isLoading,
    }),
    [language, isLoading]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { storage } from '@/src/utils/storage';
import { supportedLanguages } from '@/src/i18n';
import { getPalette, ThemeMode } from '@/src/theme';

type AppState = {
  language: string;
  setLanguage: (l: string) => Promise<void>;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => Promise<void>;
  palette: ReturnType<typeof getPalette>;
  hasOnboarded: boolean;
  setOnboarded: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLangState] = useState<string>('en');
  const [themeMode, setThemeState] = useState<ThemeMode>('light');
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const lang = await storage.getItem('cropido_lang', '');
      const theme = await storage.getItem('cropido_theme', '');
      const onb = await storage.getItem('cropido_onboarded', false);
      if (lang) { setLangState(lang as string); i18n.changeLanguage(lang as string); }
      if (theme) setThemeState(theme as ThemeMode);
      if (onb) setHasOnboarded(true);
    })();
  }, [i18n]);

  const setLanguage = async (l: string) => {
    setLangState(l);
    i18n.changeLanguage(l);
    await storage.setItem('cropido_lang', l);
  };
  const setThemeMode = async (m: ThemeMode) => {
    setThemeState(m);
    await storage.setItem('cropido_theme', m);
  };
  const setOnboarded = async () => {
    setHasOnboarded(true);
    await storage.setItem('cropido_onboarded', true);
  };

  return (
    <AppContext.Provider value={{ language, setLanguage, themeMode, setThemeMode, palette: getPalette(themeMode), hasOnboarded, setOnboarded }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
};

export { supportedLanguages };

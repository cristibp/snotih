import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, blackColors, lightColors } from './colors';

export type ThemeMode = 'light' | 'black';

export const THEME_STORAGE_KEY = '@snotih_app_theme';

interface ThemeContextType {
  theme: ThemeMode;
  isBlack: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isBlack: false,
  colors: lightColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

// Check if localStorage is available synchronously (e.g. web environment)
function getInitialTheme(): ThemeMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'black') {
        return stored;
      }
    }
  } catch (e) {
    // Ignore storage read error
  }
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  // Load persisted theme on mount (for native mobile via AsyncStorage)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isMounted && (storedTheme === 'light' || storedTheme === 'black')) {
          setThemeState(storedTheme);
        }
      } catch (err) {
        console.warn('Failed to load theme from storage:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    // Persist synchronously to localStorage if on web
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      }
    } catch (e) {
      // Ignore
    }
    // Persist to AsyncStorage
    AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch((err) => {
      console.warn('Failed to save theme to AsyncStorage:', err);
    });
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'light' ? 'black' : 'light';
    setTheme(nextTheme);
  };

  const isBlack = theme === 'black';
  const colors = isBlack ? blackColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isBlack, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

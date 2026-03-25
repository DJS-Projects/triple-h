"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole, Theme } from '/@app/types';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  textToVoice: boolean;
  setTextToVoice: (enabled: boolean) => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<Theme>('blue');
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [textToVoice, setTextToVoice] = useState(false);
  const [currentPage, setCurrentPage] = useState('landing');

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        theme,
        setTheme,
        darkMode,
        setDarkMode,
        fontSize,
        setFontSize,
        textToVoice,
        setTextToVoice,
        currentPage,
        setCurrentPage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

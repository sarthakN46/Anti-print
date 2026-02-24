import React, { createContext, useContext } from 'react';

// Always 'light'
type Theme = 'light';

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // No state, no effects. Just static 'light'.
  const theme: Theme = 'light';
  const toggleTheme = () => { console.log('Dark mode disabled'); };

  // Ensure any lingering dark mode classes/attributes are removed on mount
  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-mode');
    document.documentElement.style.colorScheme = 'light';
    localStorage.removeItem('theme');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext)!;
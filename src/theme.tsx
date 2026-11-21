import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const themes = ['system', 'light', 'dark'] as const;
type Theme = (typeof themes)[number];
const key = 'sisidos.theme';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(key);
    return themes.find((value) => value === saved) ?? 'system';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(key, theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeSelect() {
  const state = useContext(ThemeContext)!;
  return (
    <label className="field account-theme">
      <span>Tema</span>
      <select value={state.theme} onChange={(event) => state.setTheme(event.target.value as Theme)}>
        <option value="system">Ikuti sistem</option>
        <option value="light">Terang</option>
        <option value="dark">Gelap</option>
      </select>
    </label>
  );
}

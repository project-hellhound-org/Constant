import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { applyTheme } from './resolver';
import { readLocalPreference, saveDbPreference, writeLocalPreference } from './persistence';
import { THEMES, DEFAULT_PREFERENCE, ThemePreference } from './themes';
import { isThemeId, normalizePreference } from './validation';

export type SaveState = 'idle' | 'saved' | 'error';
interface Ctx {
  preference: ThemePreference;
  saveState: SaveState;
  announcement: string;
  setPreference: (patch: Partial<ThemePreference>) => Promise<void>;
}
const ThemeContext = createContext<Ctx | null>(null);

const FALLBACK: Ctx = { preference: DEFAULT_PREFERENCE, saveState: 'idle', announcement: '', setPreference: async () => {} };
export const useTheme = (): Ctx => useContext(ThemeContext) ?? FALLBACK;

/** Call once in main.tsx BEFORE rendering so the first paint already has the right theme. */
export function bootstrapTheme(): ThemePreference {
  return applyTheme(readLocalPreference());
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPref] = useState<ThemePreference>(() => readLocalPreference());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [announcement, setAnnouncement] = useState('');
  const lastValid = useRef<ThemePreference>(preference); // last preference known to be saved
  const latest = useRef<ThemePreference>(preference);    // most recently requested preference (rapid clicks merge here)
  const settings = useLiveQuery(() => db.settings.get('default'));

  // Reconcile with the saved account setting once it loads (db wins when valid).
  useEffect(() => {
    if (!settings) return;
    if (!isThemeId(settings.themeId)) return;
    const fromDb = normalizePreference({ themeId: settings.themeId, fontId: settings.fontId, backgroundId: settings.backgroundId });
    lastValid.current = fromDb; latest.current = fromDb;
    setPref((cur) => (cur.themeId === fromDb.themeId && cur.fontId === fromDb.fontId && cur.backgroundId === fromDb.backgroundId ? cur : fromDb));
  }, [settings?.themeId, settings?.fontId, settings?.backgroundId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const applied = applyTheme(preference);
    writeLocalPreference(applied);
  }, [preference]);

  const setPreference = useCallback(async (patch: Partial<ThemePreference>) => {
    const next = normalizePreference({ ...latest.current, ...patch });
    latest.current = next;
    setPref(next); // applies immediately, no reload
    try {
      await saveDbPreference(next);
      lastValid.current = next;
      setSaveState('saved');
      setAnnouncement(`${THEMES[next.themeId].name} theme applied and saved.`);
    } catch {
      // Persistence failed: roll back to the last theme that is known to be saved.
      latest.current = lastValid.current;
      setPref(lastValid.current);
      setSaveState('error');
      setAnnouncement('Could not save the theme. Your previous theme was kept.');
    }
  }, []);

  const value = useMemo(() => ({ preference, saveState, announcement, setPreference }), [preference, saveState, announcement, setPreference]);
  return (
    <ThemeContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{announcement}</div>
    </ThemeContext.Provider>
  );
};

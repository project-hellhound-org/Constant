import { db } from '../db/schema';
import { DEFAULT_PREFERENCE, ThemePreference } from './themes';
import { normalizePreference } from './validation';

/** localStorage mirror: lets the theme apply synchronously before first paint. */
const KEY = 'habitos.theme.v2';
export const THEME_STORAGE_KEYS = [KEY, 'habitos.theme.v1'];

export function readLocalPreference(): ThemePreference {
  try { const raw = localStorage.getItem(KEY); return raw ? normalizePreference(JSON.parse(raw)) : { ...DEFAULT_PREFERENCE }; }
  catch { return { ...DEFAULT_PREFERENCE }; }
}
export function writeLocalPreference(pref: ThemePreference): void { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch { /* keep in-memory theme */ } }

/** Persists ONLY the three appearance fields; never touches other settings. Throws on failure. */
export async function saveDbPreference(pref: ThemePreference): Promise<void> {
  const n = await db.settings.update('default', { themeId: pref.themeId, fontId: pref.fontId, backgroundId: pref.backgroundId });
  if (n === 0) throw new Error('settings row not found');
}

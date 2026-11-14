import { db, AppSettings, AISettings } from './schema';
import { DEFAULT_AI_SETTINGS } from '../services/aiProviderService';

export async function initializeDatabase(): Promise<void> {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    const defaultSettings: AppSettings = {
      id: 'default',
      userName: '',
      theme: 'light',
      accentColor: '#355844',
      themeId: 'sage-minimal',
      fontId: 'inter',
      backgroundId: 'sage-leaves',
      financeCurrency: 'USD',
      weekStartDay: 1,
      productivityWeights: {
        habitWeight: 50,
        taskWeight: 40,
        focusWeight: 0,
        goalWeight: 10,
      },
      streakSkipRule: 'pause',
      streakFreezeEarned: 1,
      streakFreezeActiveUntil: null,
      consecutiveDays100Pct: 5,
    };
    await db.settings.add(defaultSettings);
  }

  const aiSettingsCount = await db.aiSettings.count();
  if (aiSettingsCount === 0) {
    await db.aiSettings.add(DEFAULT_AI_SETTINGS);
  }
}

/**
 * Wipes EVERYTHING: every table (profile, credentials, AI keys, habits, finance, notes…) and all local
 * preferences. Afterwards the app is in its first-launch state and requires a new account.
 */
export async function resetAllDataToInitialState(): Promise<void> {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear(); });
  for (const store of [localStorage, sessionStorage]) {
    const mine: string[] = [];
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith('habitos.')) mine.push(k); }
    mine.forEach((k) => store.removeItem(k));
  }
  await initializeDatabase();
}

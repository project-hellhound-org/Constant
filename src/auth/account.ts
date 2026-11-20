import { db, AppSettings } from '../db/schema';
import { hashPassword, verifyPassword } from './crypto';

<<<<<<< HEAD
const SESSION_KEY = 'habitos.session.v2';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // stay signed in for 30 days unless the user signs out

interface StoredSession { at: number }
const readSession = (): StoredSession | null => {
  try { const raw = localStorage.getItem(SESSION_KEY); if (!raw) return null; const v = JSON.parse(raw); return typeof v?.at === 'number' ? v : null; } catch { return null; }
};
/** True while a persisted, unexpired session exists. Survives app restarts (localStorage, not sessionStorage). */
export const isSessionActive = () => { const s = readSession(); return !!s && Date.now() - s.at < SESSION_TTL_MS; };
export const startSession = () => { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now() })); } catch { /* ignore */ } };
export const endSession = () => { try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('habitos.session.v1'); } catch { /* ignore */ } };

/** Time-of-day greeting used on launch. */
export const greetingFor = (name?: string, now: Date = new Date()) => {
  const h = now.getHours();
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const n = name?.trim();
  return n ? `${part}, ${n}` : part;
};
=======
const SESSION_KEY = 'habitos.session.v1';
export const isSessionActive = () => { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; } };
export const startSession = () => { try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ } };
export const endSession = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } };
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e

/** An account exists once a password hash (or a legacy plain password from an older version) is stored. */
export const hasAccount = (s?: AppSettings | null) => !!(s && ((s.passwordHash && s.passwordSalt) || s.appPassword));

export async function createAccount(input: { name: string; email: string; password: string }): Promise<void> {
  const { hash, salt } = await hashPassword(input.password);
  const row = (await db.settings.get('default')) as AppSettings;
  await db.settings.put({ ...row, id: 'default', userName: input.name.trim(), email: input.email.trim(), passwordHash: hash, passwordSalt: salt, appPassword: undefined, accountCreatedAt: new Date().toISOString() });
  startSession();
}

/** Verifies a password against the stored credentials. Legacy plain-text passwords are upgraded to a hash. */
export async function checkPassword(password: string): Promise<boolean> {
  const s = await db.settings.get('default');
  if (!s) return false;
  if (s.passwordHash && s.passwordSalt) return verifyPassword(password, s.passwordHash, s.passwordSalt);
  if (s.appPassword) {
    if (password !== s.appPassword) return false;
    const { hash, salt } = await hashPassword(password);
    await db.settings.update('default', { passwordHash: hash, passwordSalt: salt, appPassword: undefined });
    return true;
  }
  return false;
}

export async function signIn(email: string, password: string): Promise<'ok' | 'bad_credentials'> {
  const s = await db.settings.get('default');
  if (!s) return 'bad_credentials';
  const emailOk = !s.email || s.email.trim().toLowerCase() === email.trim().toLowerCase();
  const pwOk = await checkPassword(password);
  if (emailOk && pwOk) { startSession(); return 'ok'; }
  return 'bad_credentials';
}

export async function changePassword(current: string, next: string): Promise<boolean> {
  if (!(await checkPassword(current))) return false;
  const { hash, salt } = await hashPassword(next);
  await db.settings.update('default', { passwordHash: hash, passwordSalt: salt, appPassword: undefined });
  return true;
}

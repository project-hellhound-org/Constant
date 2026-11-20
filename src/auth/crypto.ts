/** Password hashing with PBKDF2-SHA256 (Web Crypto). Passwords are never stored in plain text. */
const ITERATIONS = 150_000;
const enc = new TextEncoder();

const toB64 = (buf: ArrayBuffer | Uint8Array) => { const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; b.forEach((x) => (s += String.fromCharCode(x))); return btoa(s); };
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Secure password hashing is not available in this environment.');
  const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
  return toB64(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derive(password, salt), salt: toB64(salt) };
}

/** Constant-time-ish comparison of the derived hash. */
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const got = await derive(password, fromB64(salt));
  if (got.length !== hash.length) return false;
  let diff = 0; for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export const MIN_PASSWORD_LENGTH = 8;
export const validatePasswordStrength = (pw: string): string | null => (pw.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : null);
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

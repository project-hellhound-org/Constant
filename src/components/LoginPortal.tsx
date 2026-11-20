import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { Brand } from './Brand';
import { createAccount, signIn } from '../auth/account';
import { isValidEmail, validatePasswordStrength } from '../auth/crypto';

interface Props { mode: 'create' | 'login'; knownName?: string; knownEmail?: string; onAuthenticated: () => void }

/** First-launch sign-up or returning sign-in. */
export const LoginPortal: React.FC<Props> = ({ mode, knownName, knownEmail, onAuthenticated }) => {
  const [name, setName] = useState(knownName || '');
  const [email, setEmail] = useState(knownEmail || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const creating = mode === 'create';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (creating) {
      if (!name.trim()) return setError('Enter your name.');
      if (!isValidEmail(email)) return setError('Enter a valid email address.');
      const weak = validatePasswordStrength(password); if (weak) return setError(weak);
      if (password !== confirm) return setError('Passwords do not match.');
      setBusy(true);
      try { await createAccount({ name, email, password }); onAuthenticated(); } catch (err: any) { setError(err?.message || 'Could not create the account.'); } finally { setBusy(false); }
    } else {
      if (!email.trim() || !password) return setError('Enter your email and password.');
      setBusy(true);
      try {
        if (fails >= 3) await new Promise((r) => setTimeout(r, Math.min(fails, 6) * 700)); // slow down repeated guessing
        const res = await signIn(email, password);
        if (res === 'ok') onAuthenticated(); else { setFails((n) => n + 1); setError('Incorrect email or password.'); }
      } catch (err: any) { setError(err?.message || 'Sign-in failed.'); } finally { setBusy(false); }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-primary)', backgroundImage: 'var(--bg-image, none)', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--bg-scrim, transparent)' }} />
      <main style={{ position: 'relative', width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
        <Brand size="lg" align="center" />
        <form onSubmit={submit} noValidate aria-label={creating ? 'Create account' : 'Sign in'} className="liquid-panel liquid-panel-elevated" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem' }}>{creating ? 'Create your account' : knownName ? `Welcome back, ${knownName}` : 'Welcome back'}</h1>
            <p className="subtitle" style={{ fontSize: '0.85rem', marginTop: 4 }}>{creating ? 'Your data stays on this device. Set up a profile to get started.' : 'Sign in to continue to your routine tracker.'}</p>
          </div>
          {creating && <div className="form-group"><label className="form-label" htmlFor="auth-name">Name</label><input id="auth-name" className="form-input" autoComplete="name" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>}
          <div className="form-group"><label className="form-label" htmlFor="auth-email">Email</label><input id="auth-email" className="form-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="form-group"><label className="form-label" htmlFor="auth-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="auth-password" className="form-input" style={{ width: '100%', paddingRight: 44 }} type={show ? 'text' : 'password'} autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="link-action" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} style={{ position: 'absolute', right: 6, top: 8 }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          {creating && <div className="form-group"><label className="form-label" htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" className="form-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>}
          {error && <p role="alert" className="chip chip-danger" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ height: 44 }}>{creating ? <><UserPlus size={16} /> Create account</> : <><LogIn size={16} /> Sign in</>}</button>
        </form>
      </main>
    </div>
  );
};

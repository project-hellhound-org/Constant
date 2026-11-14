import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle2, Download, KeyRound, Palette, Sparkles, Trash2, Upload, User, X } from 'lucide-react';
import { db } from '../db/schema';
import { AppearanceSection } from '../theme/AppearanceSection';
import { AIEnginePanel } from '../components/AIEnginePanel';
import { resetAllDataToInitialState } from '../db/seed';
import { exportAllTables, hasRecognizedTable, importTables } from '../db/backup';
import { changePassword, checkPassword } from '../auth/account';
import { isValidEmail, validatePasswordStrength } from '../auth/crypto';

type Section = 'profile' | 'ai' | 'appearance';
type Protected = 'export' | 'import' | 'clear';
export const RESET_EVENT = 'habitos:reset';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'ai', label: 'AI Configuration', icon: <Sparkles size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
];
const GENDERS = ['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'];

export const SettingsView: React.FC = () => {
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [section, setSection] = useState<Section>('profile');

  // profile form
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [bio, setBio] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (settings) { setName(settings.userName || ''); setGender(settings.gender || ''); setEmail(settings.email || ''); setDob(settings.dob || ''); setBio(settings.bio || ''); } }, [settings?.userName, settings?.gender, settings?.email, settings?.dob, settings?.bio]); // eslint-disable-line react-hooks/exhaustive-deps

  // password form
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // protected actions
  const [pending, setPending] = useState<Protected | null>(null);
  const [verifyPw, setVerifyPw] = useState('');
  const [verifyErr, setVerifyErr] = useState('');
  const [dbMsg, setDbMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    if (!name.trim()) return setProfileMsg({ ok: false, text: 'Name is required.' });
    if (!isValidEmail(email)) return setProfileMsg({ ok: false, text: 'Enter a valid email address.' });
    if (dob && (dob > today || dob < '1900-01-01')) return setProfileMsg({ ok: false, text: 'Enter a valid date of birth.' });
    await db.settings.update('default', { userName: name.trim(), gender, email: email.trim(), dob, bio: bio.trim().slice(0, 280) });
    setProfileMsg({ ok: true, text: 'Profile saved.' });
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    const weak = validatePasswordStrength(newPw);
    if (weak) return setPwMsg({ ok: false, text: weak });
    if (newPw !== confPw) return setPwMsg({ ok: false, text: 'New passwords do not match.' });
    if (newPw === curPw) return setPwMsg({ ok: false, text: 'Choose a password different from the current one.' });
    const ok = await changePassword(curPw, newPw);
    if (!ok) return setPwMsg({ ok: false, text: 'Current password is incorrect.' });
    setCurPw(''); setNewPw(''); setConfPw('');
    setPwMsg({ ok: true, text: 'Password updated.' });
  };

  const request = (a: Protected) => { setPending(a); setVerifyPw(''); setVerifyErr(''); setDbMsg(null); };
  const confirmProtected = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await checkPassword(verifyPw))) return setVerifyErr('Incorrect password.');
    const action = pending; setPending(null); setVerifyPw('');
    if (action === 'export') {
      const blob = new Blob([JSON.stringify(await exportAllTables(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `CONSTANT_Backup_${today}.json`; a.click(); URL.revokeObjectURL(url);
      setDbMsg({ ok: true, text: 'Backup downloaded.' });
    } else if (action === 'import') {
      fileRef.current?.click();
    } else if (action === 'clear') {
      await resetAllDataToInitialState(); // wipes profile, credentials, all data and preferences
      window.dispatchEvent(new Event(RESET_EVENT)); // App returns to the sign-up portal
    }
  };

  const onFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(String(e.target?.result || ''));
        if (!data || typeof data !== 'object' || !hasRecognizedTable(data)) return setDbMsg({ ok: false, text: 'Not a valid backup file.' });
        if (!window.confirm('Restoring a backup replaces existing data. Continue?')) return;
        await importTables(data);
        setDbMsg({ ok: true, text: 'Backup restored. Reloading…' });
        setTimeout(() => window.location.reload(), 600);
      } catch (err: any) { setDbMsg({ ok: false, text: `Restore failed: ${err?.message || 'invalid file'}` }); }
      finally { ev.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const Msg: React.FC<{ m: { ok: boolean; text: string } | null }> = ({ m }) => m ? <p role={m.ok ? 'status' : 'alert'} className={`chip ${m.ok ? 'chip-success' : 'chip-danger'}`} style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>{m.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {m.text}</p> : null;

  return (
    <div className="view-container">
      <div className="view-header">
        <div><h1 className="view-header-title">Settings</h1><p className="view-header-subtitle">Your profile, AI configuration and appearance.</p></div>
      </div>

      <div className="tabbar" role="tablist" aria-label="Settings sections">
        {SECTIONS.map((s) => <button key={s.id} role="tab" type="button" aria-selected={section === s.id} className="tab" onClick={() => setSection(s.id)}>{s.icon}{s.label}</button>)}
      </div>

      {section === 'ai' && <AIEnginePanel />}
      {section === 'appearance' && <AppearanceSection />}

      {section === 'profile' && (<>
        <section className="liquid-panel" aria-label="Profile details">
          <h3 className="panel-title" style={{ marginBottom: 4 }}><User size={18} /> Profile details</h3>
          <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>This information is stored only on this device.</p>
          <form onSubmit={saveProfile} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group"><label className="form-label" htmlFor="p-name">Name</label><input id="p-name" className="form-input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="p-gender">Gender</label><select id="p-gender" className="form-select" value={gender} onChange={(e) => setGender(e.target.value)}>{GENDERS.map((g) => <option key={g} value={g}>{g || 'Select…'}</option>)}</select></div>
              <div className="form-group"><label className="form-label" htmlFor="p-email">Email address</label><input id="p-email" className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="p-dob">Date of birth</label><input id="p-dob" className="form-input" type="date" max={today} min="1900-01-01" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label" htmlFor="p-bio">Short description</label><textarea id="p-bio" className="form-textarea" rows={3} maxLength={280} placeholder="A line or two about you" value={bio} onChange={(e) => setBio(e.target.value)} /><span className="subtitle num" style={{ fontSize: '0.72rem', alignSelf: 'flex-end' }}>{bio.length}/280</span></div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><button type="submit" className="btn btn-primary">Save profile</button><Msg m={profileMsg} /></div>
          </form>
        </section>

        <section className="liquid-panel" aria-label="Change password">
          <h3 className="panel-title" style={{ marginBottom: 4 }}><KeyRound size={18} /> Password</h3>
          <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Passwords are stored as a salted hash, never in plain text.</p>
          <form onSubmit={savePassword} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group"><label className="form-label" htmlFor="pw-cur">Current password</label><input id="pw-cur" className="form-input" type="password" autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="pw-new">New password</label><input id="pw-new" className="form-input" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="pw-conf">Confirm new password</label><input id="pw-conf" className="form-input" type="password" autoComplete="new-password" value={confPw} onChange={(e) => setConfPw(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><button type="submit" className="btn btn-primary" disabled={!curPw || !newPw}>Update password</button><Msg m={pwMsg} /></div>
          </form>
        </section>

        <section className="liquid-panel" aria-label="Database operations">
          <h3 className="panel-title" style={{ marginBottom: 4 }}>Database operations</h3>
          <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Each action asks for your password.</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={() => request('export')}><Download size={16} /> Extract data</button>
            <button type="button" className="btn btn-secondary" onClick={() => request('import')}><Upload size={16} /> Restore data</button>
            <button type="button" className="btn btn-danger" onClick={() => request('clear')}><Trash2 size={16} /> Clear all data</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Backup file" onChange={onFile} />
          </div>
          <p className="subtitle" style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>Clearing removes your profile, password and every record, then returns the app to first launch so you can create a new account.</p>
          <div style={{ marginTop: 8 }}><Msg m={dbMsg} /></div>
        </section>
      </>)}

      {pending && (
        <div className="drawer-scrim" role="dialog" aria-modal="true" aria-label="Confirm password" onClick={() => setPending(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={confirmProtected} className="liquid-panel liquid-panel-elevated" onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 92vw)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{pending === 'clear' ? 'Clear all data?' : pending === 'export' ? 'Extract data' : 'Restore data'}</h3>
              <button type="button" className="link-action" aria-label="Close" onClick={() => setPending(null)}><X size={16} /></button>
            </div>
            {pending === 'clear' && <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>This permanently deletes your profile and all data on this device. You will need to create a new account.</p>}
            <div className="form-group"><label className="form-label" htmlFor="verify-pw">Enter your password to continue</label><input id="verify-pw" className="form-input" type="password" autoFocus autoComplete="current-password" value={verifyPw} onChange={(e) => setVerifyPw(e.target.value)} /></div>
            {verifyErr && <p role="alert" className="chip chip-danger" style={{ alignSelf: 'flex-start' }}>{verifyErr}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>Cancel</button>
              <button type="submit" className={`btn ${pending === 'clear' ? 'btn-danger' : 'btn-primary'}`} disabled={!verifyPw}>{pending === 'clear' ? 'Delete everything' : 'Continue'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

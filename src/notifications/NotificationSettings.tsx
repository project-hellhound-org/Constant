import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, BellRing } from 'lucide-react';
import { db } from '../db/schema';
import { TimeListEditor } from './TimeListEditor';
import { DEFAULT_TASK_SUMMARY, MODE_DEFAULT_TIMES, TaskSummaryConfig, sortTimes } from './schedule';
import { notificationPermission, requestNotificationPermission, sendSystemNotification } from './platform';

const MODES: { id: TaskSummaryConfig['mode']; label: string; hint: string }[] = [
  { id: 'once', label: 'Once daily', hint: 'One summary in the evening.' },
  { id: 'twice', label: 'Twice daily', hint: 'Midday check-in and an evening wrap-up.' },
  { id: 'custom', label: 'Custom', hint: 'Choose any times you like.' },
];

export const NotificationSettings: React.FC = () => {
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [perm, setPerm] = useState(notificationPermission());
  const [msg, setMsg] = useState('');
  if (!settings) return null;
  const cfg: TaskSummaryConfig = { ...DEFAULT_TASK_SUMMARY, ...(settings.taskSummary || {}) };
  const save = (patch: Partial<TaskSummaryConfig>) => db.settings.update('default', { taskSummary: { ...cfg, ...patch } });
  const habitsOn = settings.habitRemindersEnabled !== false;
  const enable = async () => { setPerm(await requestNotificationPermission()); };
  const test = async () => { const ok = await sendSystemNotification('CONSTANT', 'Notifications are working.', 'test'); setMsg(ok ? 'Test notification sent.' : 'System notifications are not allowed here — in-app pop-ups will still appear while the app is open.'); };

  return (
    <>
      <section className="liquid-panel" aria-label="Notification permission">
        <h3 className="panel-title" style={{ marginBottom: 4 }}><Bell size={18} /> Notifications</h3>
        <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Pop-ups appear inside the app whenever it is open. Allow system notifications to also get them as native alerts.</p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`chip ${perm === 'granted' ? 'chip-success' : 'chip-neutral'}`}>System notifications: {perm === 'granted' ? 'allowed' : perm === 'denied' ? 'blocked' : perm === 'unsupported' ? 'unsupported' : 'not yet allowed'}</span>
          {perm !== 'granted' && perm !== 'unsupported' && <button type="button" className="btn btn-primary btn-xs" onClick={enable}>Allow notifications</button>}
          <button type="button" className="btn btn-secondary btn-xs" onClick={test}><BellRing size={13} /> Send test</button>
        </div>
        {msg && <p role="status" className="subtitle" style={{ fontSize: '0.8rem', marginTop: '0.6rem' }}>{msg}</p>}
      </section>

      <section className="liquid-panel" aria-label="Habit reminders">
        <h3 className="panel-title" style={{ marginBottom: 4 }}>Habit reminders</h3>
        <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: '0.9rem' }}>Reminder times are set per habit (Habits → edit a habit). Completed or skipped habits are not reminded again that day.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={habitsOn} onChange={(e) => db.settings.update('default', { habitRemindersEnabled: e.target.checked })} /> Enable habit reminders
        </label>
      </section>

      <section className="liquid-panel" aria-label="Daily task summary">
        <h3 className="panel-title" style={{ marginBottom: 4 }}>Daily task summary</h3>
        <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: '0.9rem' }}>Summarizes today's progress and lists unfinished tasks and their open steps.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => save({ enabled: e.target.checked })} /> Send a daily summary
        </label>
        <div style={{ opacity: cfg.enabled ? 1 : 0.55, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div role="radiogroup" aria-label="Summary frequency" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={cfg.mode === m.id} disabled={!cfg.enabled} className={`btn ${cfg.mode === m.id ? 'btn-primary' : 'btn-secondary'}`} style={{ flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '0.65rem 0.85rem', textAlign: 'left' }} onClick={() => save({ mode: m.id, times: m.id === 'custom' && cfg.mode === 'custom' ? cfg.times : MODE_DEFAULT_TIMES[m.id] })}>
                <strong>{m.label}</strong><span style={{ fontSize: '0.74rem', fontWeight: 400, opacity: 0.85 }}>{m.hint}</span>
              </button>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="summary-times">{cfg.mode === 'custom' ? 'Summary times' : cfg.mode === 'once' ? 'Summary time' : 'Summary times (two per day)'}</label>
            <TimeListEditor id="summary-times" value={cfg.times} max={cfg.mode === 'once' ? 1 : cfg.mode === 'twice' ? 2 : 8}
              onChange={(v) => { const t = sortTimes(v); save({ times: cfg.mode === 'once' ? t.slice(-1) : cfg.mode === 'twice' ? t.slice(0, 2) : t }); }} />
          </div>
        </div>
      </section>
    </>
  );
};

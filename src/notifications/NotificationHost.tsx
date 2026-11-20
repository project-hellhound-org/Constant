import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Bell, Check, SkipForward, X, ListChecks } from 'lucide-react';
import { db } from '../db/schema';
import { DueNotification, dueHabitReminders, dueTaskSummaries, loadFired, saveFired, sortTimes } from './schedule';
import { sendSystemNotification, syncNativeDailyReminders } from './platform';

interface Toast extends DueNotification { id: string }
const TICK_MS = 20_000;

/** Runs the reminder scheduler while the app is open and renders in-app pop-ups (with OS notifications alongside). */
export const NotificationHost: React.FC = () => {
  const habits = useLiveQuery(() => db.habits.toArray());
  const logs = useLiveQuery(() => db.habitLogs.toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const steps = useLiveQuery(() => db.doItems.toArray());
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const state = useRef({ habits, logs, tasks, steps, settings });
  state.current = { habits, logs, tasks, steps, settings };

  const tick = useCallback(() => {
    const s = state.current;
    if (!s.habits || !s.logs || !s.tasks || !s.steps || !s.settings) return;
    const now = new Date();
    const date = format(now, 'yyyy-MM-dd');
    const fired = loadFired(date);
    const due = [
      ...dueHabitReminders(now, s.habits, s.logs, fired, s.settings.habitRemindersEnabled !== false),
      ...dueTaskSummaries(now, s.settings.taskSummary, s.tasks, s.steps, fired),
    ];
    if (!due.length) return;
    for (const n of due) { fired.add(n.key); void sendSystemNotification(n.title, n.body, n.key); }
    saveFired(date, fired);
    setToasts((cur) => [...cur, ...due.map((n) => ({ ...n, id: n.key }))].slice(-4));
  }, []);

  useEffect(() => { tick(); const id = setInterval(tick, TICK_MS); return () => clearInterval(id); }, [tick, habits, logs, tasks, steps, settings]);

  // Native (Android/iOS): keep repeating daily reminders registered so they fire with the app closed.
  useEffect(() => {
    if (!habits || !settings) return;
    const items: { id: number; title: string; body: string; time: string }[] = [];
    if (settings.habitRemindersEnabled !== false) habits.filter((h) => !h.archived && !h.paused).forEach((h, hi) => sortTimes(h.reminderTimes || []).forEach((t, ti) => items.push({ id: 1000 + hi * 20 + ti, title: h.name, body: `Time for “${h.name}”.`, time: t })));
    if (settings.taskSummary?.enabled) sortTimes(settings.taskSummary.times).forEach((t, i) => items.push({ id: 9000 + i, title: 'Daily progress', body: 'Check your tasks and steps for today.', time: t }));
    void syncNativeDailyReminders(items);
  }, [habits, settings]);

  const dismiss = (id: string) => setToasts((cur) => cur.filter((t) => t.id !== id));
  const logHabit = async (habitId: string, status: 'completed' | 'skipped') => {
    const date = format(new Date(), 'yyyy-MM-dd');
    const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first();
    const now = new Date().toISOString();
    if (existing) await db.habitLogs.update(existing.id, { status, loggedAt: now });
    else await db.habitLogs.put({ id: crypto.randomUUID(), habitId, date, status, value: 0, loggedAt: now });
  };

  if (!toasts.length) return null;
  return (
    <div role="region" aria-label="Notifications" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '0.65rem', width: 340, maxWidth: 'calc(100vw - 40px)' }}>
      {toasts.map((t) => (
        <div key={t.id} role="alert" className="liquid-panel liquid-panel-elevated" style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', border: '1px solid var(--border-hover)', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ color: 'var(--accent-secondary)', flex: 'none', marginTop: 2 }}>{t.kind === 'habit' ? <Bell size={18} /> : <ListChecks size={18} />}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{t.title}</div>
              <div className="subtitle" style={{ fontSize: '0.82rem', marginTop: 2 }}>{t.body}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-icon btn-xs" aria-label="Dismiss" onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
          {t.actionable && t.habitId && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary btn-xs" style={{ flex: 1 }} onClick={async () => { await logHabit(t.habitId!, 'completed'); dismiss(t.id); }}><Check size={13} /> Done</button>
              <button type="button" className="btn btn-secondary btn-xs" style={{ flex: 1 }} onClick={async () => { await logHabit(t.habitId!, 'skipped'); dismiss(t.id); }}><SkipForward size={13} /> Skip</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

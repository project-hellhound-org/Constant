import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';

/** Lightweight focus-session tracker (device-local). Sessions are summed for "Focus Time". */
const KEY = 'habitos.focus.v1';
export interface FocusSession { date: string; minutes: number; category: string }
interface FocusState { sessions: FocusSession[]; active: { startedAt: number; category: string; targetMinutes: number; accumulatedMs: number; running: boolean } | null }

const read = (): FocusState => {
  try { const r = JSON.parse(localStorage.getItem(KEY) || ''); if (r && Array.isArray(r.sessions)) return r; } catch { /* fresh state */ }
  return { sessions: [], active: null };
};
const write = (s: FocusState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

export const minutesOn = (sessions: FocusSession[], date: string) => sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
export const formatMinutes = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`.replace(/^0h /, '0h ');

export function useFocus() {
  const [state, setState] = useState<FocusState>(read);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const commit = useCallback((next: FocusState) => { write(next); setState(next); }, []);

  const elapsedMs = state.active ? state.active.accumulatedMs + (state.active.running ? Date.now() - state.active.startedAt : 0) : 0;
  const start = (category = 'Deep Work', targetMinutes = 25) =>
    commit({ ...state, active: { startedAt: Date.now(), category, targetMinutes, accumulatedMs: 0, running: true } });
  const toggle = () => {
    if (!state.active) return start();
    const a = state.active;
    commit({ ...state, active: a.running ? { ...a, running: false, accumulatedMs: a.accumulatedMs + Date.now() - a.startedAt } : { ...a, running: true, startedAt: Date.now() } });
  };
  const finish = () => {
    if (!state.active) return;
    const minutes = Math.max(1, Math.round(elapsedMs / 60000));
    commit({ sessions: [...state.sessions, { date: format(new Date(), 'yyyy-MM-dd'), minutes, category: state.active.category }], active: null });
  };
  return { sessions: state.sessions, active: state.active, elapsedMs, start, toggle, finish };
}

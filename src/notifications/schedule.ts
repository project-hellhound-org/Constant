import { format, getDay } from 'date-fns';
import type { Habit, HabitLog, Task, DoItem, AppSettings } from '../db/schema';

export type TaskSummaryConfig = NonNullable<AppSettings['taskSummary']>;
export const DEFAULT_TASK_SUMMARY: TaskSummaryConfig = { enabled: false, mode: 'once', times: ['20:00'] };
/** Presets for the three schedule modes. Custom keeps whatever the user entered. */
export const MODE_DEFAULT_TIMES: Record<TaskSummaryConfig['mode'], string[]> = { once: ['20:00'], twice: ['12:00', '20:00'], custom: ['09:00', '14:00', '20:00'] };
/** A reminder is only delivered if it is at most this late (e.g. app was closed); older ones are skipped, not replayed. */
export const GRACE_MINUTES = 90;

export const isValidTime = (t: unknown): t is string => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const nowMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const sortTimes = (times: string[]) => Array.from(new Set(times.filter(isValidTime))).sort();

export const habitScheduledOn = (h: Habit, d: Date) => (h.frequencyMode === 'custom' && h.selectedDays?.length ? h.selectedDays.includes(getDay(d)) : true);

export interface DueNotification { key: string; kind: 'habit' | 'tasks'; title: string; body: string; habitId?: string; actionable?: boolean }

const withinWindow = (nowMin: number, t: string) => { const diff = nowMin - minutesOf(t); return diff >= 0 && diff <= GRACE_MINUTES; };

export function dueHabitReminders(now: Date, habits: Habit[], logs: HabitLog[], fired: Set<string>, enabled = true): DueNotification[] {
  if (!enabled) return [];
  const date = format(now, 'yyyy-MM-dd');
  const nm = nowMinutes(now);
  const out: DueNotification[] = [];
  for (const h of habits) {
    if (h.archived || h.paused || !h.reminderTimes?.length || !habitScheduledOn(h, now)) continue;
    const resolved = logs.some((l) => l.habitId === h.id && l.date === date && (l.status === 'completed' || l.status === 'skipped'));
    if (resolved) continue;
    for (const t of sortTimes(h.reminderTimes)) {
      const key = `habit:${h.id}:${date}:${t}`;
      if (fired.has(key) || !withinWindow(nm, t)) continue;
      out.push({ key, kind: 'habit', habitId: h.id, actionable: true, title: h.name, body: `Time for “${h.name}”${h.targetValue ? ` (${h.targetValue}${h.unit ? ' ' + h.unit : ''})` : ''}.` });
    }
  }
  return out;
}

export interface TaskSummary { total: number; done: number; unfinished: { title: string; openSteps: number }[]; openSteps: number; body: string }

/** Tasks that count for today: due today, overdue and open, or having a Do-List step scheduled for today. */
export function buildTaskSummary(now: Date, tasks: Task[], steps: DoItem[]): TaskSummary {
  const date = format(now, 'yyyy-MM-dd');
  const stepsByTask = new Map<string, DoItem[]>();
  for (const s of steps) stepsByTask.set(s.taskId, [...(stepsByTask.get(s.taskId) || []), s]);
  const isDone = (t: Task) => t.status === 'completed';
  const relevant = tasks.filter((t) => {
    if (t.status === 'cancelled' || t.status === 'deferred' || t.status === 'backlog') return false;
    const sts = stepsByTask.get(t.id) || [];
    const scheduledToday = sts.some((s) => s.scheduledDate === date);
    const dueToday = t.dueDate === date;
    const overdue = !!t.dueDate && t.dueDate < date && !isDone(t);
    return dueToday || scheduledToday || overdue;
  });
  const unfinished = relevant.filter((t) => !isDone(t)).map((t) => ({ title: t.title, openSteps: (stepsByTask.get(t.id) || []).filter((s) => !s.completed).length }));
  const done = relevant.length - unfinished.length;
  const openSteps = unfinished.reduce((n, t) => n + t.openSteps, 0);
  let body: string;
  if (relevant.length === 0) body = 'No tasks are scheduled for today.';
  else if (unfinished.length === 0) body = `All ${relevant.length} task${relevant.length === 1 ? '' : 's'} done today. Nice work!`;
  else {
    const names = unfinished.slice(0, 3).map((t) => t.title + (t.openSteps ? ` (${t.openSteps} step${t.openSteps === 1 ? '' : 's'} left)` : '')).join('; ');
    body = `${done}/${relevant.length} tasks done. Unfinished: ${names}${unfinished.length > 3 ? ` +${unfinished.length - 3} more` : ''}.`;
  }
  return { total: relevant.length, done, unfinished, openSteps, body };
}

export function dueTaskSummaries(now: Date, cfg: TaskSummaryConfig | undefined, tasks: Task[], steps: DoItem[], fired: Set<string>): DueNotification[] {
  if (!cfg?.enabled) return [];
  const date = format(now, 'yyyy-MM-dd');
  const nm = nowMinutes(now);
  const out: DueNotification[] = [];
  for (const t of sortTimes(cfg.times || [])) {
    const key = `tasks:${date}:${t}`;
    if (fired.has(key) || !withinWindow(nm, t)) continue;
    const sum = buildTaskSummary(now, tasks, steps);
    out.push({ key, kind: 'tasks', title: sum.unfinished.length ? `Daily progress · ${sum.unfinished.length} unfinished` : 'Daily progress', body: sum.body });
  }
  return out;
}

// ---- once-per-day "already delivered" ledger (localStorage) ----
const FIRED_KEY = 'habitos.notify.fired.v1';
export function loadFired(date: string): Set<string> {
  try { const v = JSON.parse(localStorage.getItem(FIRED_KEY) || 'null'); if (v && v.date === date && Array.isArray(v.keys)) return new Set<string>(v.keys); } catch { /* ignore */ }
  return new Set();
}
export function saveFired(date: string, keys: Set<string>) { try { localStorage.setItem(FIRED_KEY, JSON.stringify({ date, keys: Array.from(keys) })); } catch { /* ignore */ } }

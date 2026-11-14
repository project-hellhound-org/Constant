import { db, Habit, HabitLog, SubHabit } from '../db/schema';

export type SubHabitState = 'completed' | 'failed' | 'pending';

export interface SubHabitSummary {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  /** 0-100, completed / total. 0 when there are no sub-habits. */
  pct: number;
}

export interface SubHabitGroup {
  topic: string;
  items: SubHabit[];
}

export const UNGROUPED_TOPIC = 'General';

/** Effective state of one sub-habit for a given day's log. */
export function getSubHabitState(sub: SubHabit, log?: HabitLog | null): SubHabitState {
  return log?.subHabitsState?.[sub.id] ?? (sub.completed ? 'completed' : 'pending');
}

/** Group sub-habits by topic, preserving `order` then insertion order. */
export function groupSubHabitsByTopic(subHabits: SubHabit[] = []): SubHabitGroup[] {
  const sorted = [...subHabits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const map = new Map<string, SubHabit[]>();
  for (const sub of sorted) {
    const key = sub.topic?.trim() || UNGROUPED_TOPIC;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(sub);
  }
  return Array.from(map, ([topic, items]) => ({ topic, items }));
}

export function summarizeSubHabits(subHabits: SubHabit[] = [], log?: HabitLog | null): SubHabitSummary {
  let completed = 0;
  let failed = 0;
  for (const sub of subHabits) {
    const state = getSubHabitState(sub, log);
    if (state === 'completed') completed++;
    else if (state === 'failed') failed++;
  }
  const total = subHabits.length;
  return {
    total,
    completed,
    failed,
    pending: total - completed - failed,
    pct: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/**
 * Parent status derived from sub-habit progress.
 *  - all sub-habits completed            -> 'completed'
 *  - some completed or some failed        -> 'partial'
 *  - nothing touched                      -> keep current status ('skipped' is always preserved)
 */
export function deriveHabitStatus(
  summary: SubHabitSummary,
  current?: HabitLog['status']
): HabitLog['status'] {
  if (current === 'skipped') return 'skipped';
  if (summary.total === 0) return current ?? 'partial';
  if (summary.completed === summary.total) return 'completed';
  if (summary.completed > 0 || summary.failed > 0) return 'partial';
  return current === 'completed' ? 'partial' : current ?? 'partial';
}

/**
 * Toggle one sub-habit for a date and keep the parent log consistent.
 * `target` is the state the caller wants; if the sub-habit is already in it,
 * it is reset to 'pending' (toggle semantics).
 */
export async function setSubHabitState(
  habit: Habit,
  subId: string,
  target: Exclude<SubHabitState, 'pending'>,
  dateStr: string
): Promise<void> {
  const subHabits = habit.subHabits ?? [];
  const sub = subHabits.find((s) => s.id === subId);
  if (!sub) return;

  const existing = await db.habitLogs.where('[habitId+date]').equals([habit.id, dateStr]).first();
  const current = getSubHabitState(sub, existing);
  const next: SubHabitState = current === target ? 'pending' : target;

  const subHabitsState: Record<string, SubHabitState> = { ...(existing?.subHabitsState ?? {}) };
  // Materialise untouched siblings so the summary is stable regardless of the legacy `completed` flag.
  for (const s of subHabits) {
    if (!(s.id in subHabitsState)) subHabitsState[s.id] = getSubHabitState(s, existing);
  }
  subHabitsState[subId] = next;

  const summary = summarizeSubHabits(subHabits, { subHabitsState } as HabitLog);
  const status = deriveHabitStatus(summary, existing?.status);
  const value = summary.total === 0 ? 0 : summary.completed / summary.total;
  const loggedAt = new Date().toISOString();

  if (existing) {
    await db.habitLogs.update(existing.id, { subHabitsState, status, value, loggedAt });
  } else {
    await db.habitLogs.add({
      id: `log-${Date.now()}`,
      habitId: habit.id,
      date: dateStr,
      status,
      value,
      subHabitsState,
      loggedAt,
    });
  }
}

/** Starter sub-topic templates offered while creating a habit, keyed by habit category. */
export const SUB_HABIT_TEMPLATES: Record<string, Array<Pick<SubHabit, 'title' | 'topic' | 'activity' | 'estimatedMinutes'>>> = {
  'Learning & Growth': [
    { topic: 'Reading', title: 'Read assigned chapter', activity: 'Read and highlight key terms', estimatedMinutes: 30 },
    { topic: 'Practice', title: 'Hands-on lab / exercise', activity: 'Complete one practical exercise', estimatedMinutes: 45 },
    { topic: 'Review', title: 'Recall & notes', activity: 'Write a 5-line summary from memory', estimatedMinutes: 15 },
  ],
  'Fitness & Health': [
    { topic: 'Warm-up', title: 'Mobility warm-up', activity: '5 minutes of dynamic stretching', estimatedMinutes: 5 },
    { topic: 'Main set', title: 'Primary workout', activity: 'Complete the planned sets', estimatedMinutes: 40 },
    { topic: 'Recovery', title: 'Cool-down', activity: 'Stretch and hydrate', estimatedMinutes: 10 },
  ],
  'Work & Projects': [
    { topic: 'Plan', title: 'Define top outcome', activity: 'Write the single outcome for this session', estimatedMinutes: 5 },
    { topic: 'Execute', title: 'Deep work block', activity: 'Distraction-free focused work', estimatedMinutes: 50 },
    { topic: 'Wrap-up', title: 'Log progress', activity: 'Record what shipped and what is next', estimatedMinutes: 5 },
  ],
};

/** Maps free-form habit categories (Health, Study, Growth, ...) onto the starter-template families. */
export function templatesFor(category: string) {
  const c = (category || '').toLowerCase();
  let key = category;
  if (/health|fitness|wellbeing|mindful/.test(c)) key = 'Fitness & Health';
  else if (/learn|study|growth|skill|read/.test(c)) key = 'Learning & Growth';
  else if (/work|product|project/.test(c)) key = 'Work & Projects';
  return SUB_HABIT_TEMPLATES[key] ?? [];
}

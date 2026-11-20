import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import { Habit, HabitLog, Task } from '../db/schema';

export type Granularity = 'day' | 'week';

export interface SeriesOptions {
  /** Number of days ending at `today` (inclusive). */
  days: number;
  granularity: Granularity;
  today?: Date;
  /** 0 = Sunday … 6 = Saturday. Only used for weekly buckets. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export interface HabitPoint {
  key: string;
  label: string;
  /** Habit-days that were scheduled in this bucket. */
  scheduled: number;
  completed: number;
  partial: number;
  skipped: number;
  /** Scheduled, past, and not logged (or explicitly logged as failed). */
  missed: number;
  /** Scheduled today and not yet logged — never counted as missed. */
  pending: number;
  /** completed / (scheduled − skipped), 0–100. */
  ratePct: number;
  /** Trailing 7-bucket moving average of ratePct. */
  ratePctMA: number;
}

export interface TaskPoint {
  key: string;
  label: string;
  /** Tasks whose completedAt falls in the bucket. */
  completed: number;
  /** Tasks due in the bucket, incomplete, and the due date has passed. */
  overdue: number;
  /** Tasks due in the bucket, incomplete, due date today or later. */
  open: number;
  /** completed / (completed + overdue + open), 0–100. */
  ratePct: number;
  completedMA: number;
}

const DAY_FMT = 'yyyy-MM-dd';

/** Is `habit` expected on `day`? Uses startDate (falls back to createdAt) and custom weekdays. */
export function isHabitScheduled(habit: Habit, day: Date): boolean {
  const dayStr = format(day, DAY_FMT);
  const begins = habit.startDate || habit.createdAt?.slice(0, 10);
  if (begins && dayStr < begins) return false;
  if (habit.frequencyMode === 'custom' && habit.selectedDays && habit.selectedDays.length > 0) {
    return habit.selectedDays.includes(day.getDay());
  }
  return true;
}

function bucketKey(day: Date, g: Granularity, weekStartsOn: number): { key: string; label: string } {
  if (g === 'week') {
    const start = startOfWeek(day, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    return { key: format(start, DAY_FMT), label: `Wk ${format(start, 'MMM d')}` };
  }
  return { key: format(day, DAY_FMT), label: format(day, 'MMM d') };
}

/** Inclusive list of day Dates for the requested window. */
export function windowDays(days: number, today: Date = new Date()): Date[] {
  const out: Date[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

export function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  });
}

export function buildHabitSeries(habits: Habit[], logs: HabitLog[], opts: SeriesOptions): HabitPoint[] {
  const today = opts.today ?? new Date();
  const todayStr = format(today, DAY_FMT);
  const weekStartsOn = opts.weekStartsOn ?? 1;

  const logIndex = new Map<string, HabitLog>();
  logs.forEach((l) => logIndex.set(`${l.habitId}|${l.date}`, l));

  const buckets = new Map<string, HabitPoint>();
  for (const day of windowDays(opts.days, today)) {
    const dayStr = format(day, DAY_FMT);
    const { key, label } = bucketKey(day, opts.granularity, weekStartsOn);
    if (!buckets.has(key)) {
      buckets.set(key, { key, label, scheduled: 0, completed: 0, partial: 0, skipped: 0, missed: 0, pending: 0, ratePct: 0, ratePctMA: 0 });
    }
    const b = buckets.get(key)!;

    for (const habit of habits) {
      if (!isHabitScheduled(habit, day)) continue;
      b.scheduled++;
      const log = logIndex.get(`${habit.id}|${dayStr}`);
      if (!log) {
        if (dayStr < todayStr) b.missed++;
        else b.pending++;
        continue;
      }
      switch (log.status) {
        case 'completed': b.completed++; break;
        case 'partial': b.partial++; break;
        case 'skipped': b.skipped++; break;
        default: b.missed++; // 'failed'
      }
    }
  }

  const points = Array.from(buckets.values());
  points.forEach((p) => {
    const denom = p.scheduled - p.skipped;
    p.ratePct = denom > 0 ? Math.round((p.completed / denom) * 1000) / 10 : 0;
  });
  const ma = movingAverage(points.map((p) => p.ratePct));
  points.forEach((p, i) => (p.ratePctMA = ma[i]));
  return points;
}

export function buildTaskSeries(tasks: Task[], opts: SeriesOptions): TaskPoint[] {
  const today = opts.today ?? new Date();
  const todayStr = format(today, DAY_FMT);
  const weekStartsOn = opts.weekStartsOn ?? 1;

  const buckets = new Map<string, TaskPoint>();
  const days = windowDays(opts.days, today);
  const keyOfDateStr = (dateStr: string): string | null => {
    const d = parseISO(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    if (differenceInCalendarDays(today, d) < 0 || differenceInCalendarDays(today, d) >= opts.days) return null;
    return bucketKey(d, opts.granularity, weekStartsOn).key;
  };

  for (const day of days) {
    const { key, label } = bucketKey(day, opts.granularity, weekStartsOn);
    if (!buckets.has(key)) buckets.set(key, { key, label, completed: 0, overdue: 0, open: 0, ratePct: 0, completedMA: 0 });
  }

  for (const t of tasks) {
    if (t.status === 'cancelled') continue;
    if (t.status === 'completed' && t.completedAt) {
      const k = keyOfDateStr(t.completedAt.slice(0, 10));
      if (k) buckets.get(k)!.completed++;
    }
    if (t.status !== 'completed' && t.dueDate) {
      const k = keyOfDateStr(t.dueDate);
      if (k) {
        if (t.dueDate < todayStr) buckets.get(k)!.overdue++;
        else buckets.get(k)!.open++;
      }
    }
  }

  const points = Array.from(buckets.values());
  points.forEach((p) => {
    const denom = p.completed + p.overdue + p.open;
    p.ratePct = denom > 0 ? Math.round((p.completed / denom) * 1000) / 10 : 0;
  });
  const ma = movingAverage(points.map((p) => p.completed));
  points.forEach((p, i) => (p.completedMA = ma[i]));
  return points;
}

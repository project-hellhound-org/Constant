import { describe, it, expect } from 'vitest';
import { buildHabitSeries, buildTaskSeries, isHabitScheduled, movingAverage } from '../engine/analyticsSeries';
import type { Habit, HabitLog, Task } from '../db/schema';

// Wed 7 Oct 2026 (local)
const TODAY = new Date(2026, 9, 7, 12, 0, 0);

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Study', category: 'Learning & Growth', color: '#000',
  archived: 0, createdAt: '2026-01-01T00:00:00.000Z', startDate: '2026-01-01', ...over,
});
const log = (date: string, status: HabitLog['status'], habitId = 'h1'): HabitLog => ({
  id: `${habitId}-${date}`, habitId, date, status, value: status === 'completed' ? 1 : 0, loggedAt: date,
});
const task = (over: Partial<Task>): Task => ({
  id: 't', title: 't', status: 'todo', priority: 'medium',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});

describe('isHabitScheduled', () => {
  it('respects custom weekdays and start date', () => {
    const h = habit({ frequencyMode: 'custom', selectedDays: [1, 3] }); // Mon, Wed
    expect(isHabitScheduled(h, new Date(2026, 9, 7))).toBe(true);  // Wed
    expect(isHabitScheduled(h, new Date(2026, 9, 8))).toBe(false); // Thu
    expect(isHabitScheduled(habit({ startDate: '2026-10-08' }), new Date(2026, 9, 7))).toBe(false);
  });
});

describe('buildHabitSeries', () => {
  it('counts unlogged past days as missed but today as pending', () => {
    const s = buildHabitSeries([habit()], [log('2026-10-06', 'completed')], { days: 3, granularity: 'day', today: TODAY });
    expect(s.map((p) => [p.key, p.completed, p.missed, p.pending])).toEqual([
      ['2026-10-05', 0, 1, 0],
      ['2026-10-06', 1, 0, 0],
      ['2026-10-07', 0, 0, 1],
    ]);
  });

  it('excludes skipped days from the rate denominator', () => {
    const s = buildHabitSeries(
      [habit()],
      [log('2026-10-05', 'completed'), log('2026-10-06', 'skipped'), log('2026-10-07', 'completed')],
      { days: 3, granularity: 'day', today: TODAY }
    );
    const weekly = buildHabitSeries(
      [habit()],
      [log('2026-10-05', 'completed'), log('2026-10-06', 'skipped'), log('2026-10-07', 'completed')],
      { days: 3, granularity: 'week', today: TODAY, weekStartsOn: 1 }
    );
    expect(s[1].ratePct).toBe(0);            // only skipped -> denominator 0 -> 0, not NaN
    expect(weekly).toHaveLength(1);
    expect(weekly[0].scheduled).toBe(3);
    expect(weekly[0].ratePct).toBe(100);     // 2 completed / (3 scheduled - 1 skipped)
  });

  it('aggregates by week starting Monday', () => {
    const s = buildHabitSeries([habit()], [], { days: 14, granularity: 'week', today: TODAY, weekStartsOn: 1 });
    // 14 days ending Wed 7 Oct start Thu 24 Sep, so the first bucket is a PARTIAL week (Thu-Sun = 4 days).
    expect(s.map((p) => p.key)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05']);
    expect(s.map((p) => p.scheduled)).toEqual([4, 7, 3]);
  });
});

describe('buildTaskSeries', () => {
  it('splits due tasks into overdue vs open and counts completions by day', () => {
    const tasks = [
      task({ id: 'a', status: 'completed', completedAt: '2026-10-06T09:00:00.000Z', dueDate: '2026-10-06' }),
      task({ id: 'b', dueDate: '2026-10-05' }),
      task({ id: 'c', dueDate: '2026-10-07' }),
      task({ id: 'd', status: 'cancelled', dueDate: '2026-10-05' }),
    ];
    const s = buildTaskSeries(tasks, { days: 3, granularity: 'day', today: TODAY });
    expect(s.map((p) => [p.key, p.completed, p.overdue, p.open])).toEqual([
      ['2026-10-05', 0, 1, 0],
      ['2026-10-06', 1, 0, 0],
      ['2026-10-07', 0, 0, 1],
    ]);
  });

  it('ignores items outside the window', () => {
    const s = buildTaskSeries([task({ dueDate: '2026-01-01' })], { days: 7, granularity: 'day', today: TODAY });
    expect(s.every((p) => p.overdue === 0 && p.open === 0)).toBe(true);
  });
});

describe('movingAverage', () => {
  it('uses available points at the start of the window', () => {
    expect(movingAverage([10, 20, 30], 2)).toEqual([10, 15, 25]);
  });
});

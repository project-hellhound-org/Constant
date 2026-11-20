import { describe, expect, it } from 'vitest';
import { buildTaskSummary, dueHabitReminders, dueTaskSummaries } from '../notifications/schedule';
import type { DoItem, Habit, HabitLog, Task } from '../db/schema';

const at = (hhmm: string, day = '2026-11-20') => new Date(`${day}T${hhmm}:00`); // Friday
const habit = (o: Partial<Habit> = {}): Habit => ({ id: 'h1', name: 'Drink water', category: 'Health', color: '#000', archived: 0, createdAt: '', reminderTimes: ['08:00', '20:00'], ...o } as Habit);
const log = (o: Partial<HabitLog> = {}): HabitLog => ({ id: 'l1', habitId: 'h1', date: '2026-11-20', status: 'completed', value: 1, loggedAt: '', ...o });
const task = (o: Partial<Task> = {}): Task => ({ id: 't1', title: 'Write report', status: 'todo', priority: 'medium', dueDate: '2026-11-20', createdAt: '', updatedAt: '', ...o } as Task);
const step = (o: Partial<DoItem> = {}): DoItem => ({ id: 's1', taskId: 't1', title: 'Outline', completed: false, order: 0, createdAt: '', updatedAt: '', ...o });

describe('habit reminders', () => {
  it('fires morning and evening reminders at their times, once', () => {
    expect(dueHabitReminders(at('07:59'), [habit()], [], new Set())).toHaveLength(0);
    const morning = dueHabitReminders(at('08:00'), [habit()], [], new Set());
    expect(morning.map((n) => n.key)).toEqual(['habit:h1:2026-11-20:08:00']);
    expect(dueHabitReminders(at('08:05'), [habit()], [], new Set(morning.map((n) => n.key)))).toHaveLength(0);
    expect(dueHabitReminders(at('20:01'), [habit()], [], new Set(morning.map((n) => n.key))).map((n) => n.key)).toEqual(['habit:h1:2026-11-20:20:00']);
  });
  it('does not replay reminders older than the grace window', () => {
    expect(dueHabitReminders(at('09:31'), [habit({ reminderTimes: ['08:00'] })], [], new Set())).toHaveLength(0);
  });
  it('skips completed/skipped, paused, archived and off-day habits', () => {
    expect(dueHabitReminders(at('08:00'), [habit()], [log()], new Set())).toHaveLength(0);
    expect(dueHabitReminders(at('08:00'), [habit()], [log({ status: 'skipped' })], new Set())).toHaveLength(0);
    expect(dueHabitReminders(at('08:00'), [habit({ paused: true })], [], new Set())).toHaveLength(0);
    expect(dueHabitReminders(at('08:00'), [habit({ frequencyMode: 'custom', selectedDays: [1] })], [], new Set())).toHaveLength(0); // Friday=5
    expect(dueHabitReminders(at('08:00'), [habit()], [], new Set(), false)).toHaveLength(0);
  });
});

describe('daily task summary', () => {
  it('lists unfinished tasks with open steps', () => {
    const s = buildTaskSummary(at('20:00'), [task(), task({ id: 't2', title: 'Gym plan', status: 'completed' })], [step(), step({ id: 's2', completed: true })]);
    expect(s).toMatchObject({ total: 2, done: 1, openSteps: 1 });
    expect(s.body).toContain('Write report (1 step left)');
  });
  it('supports once, twice and custom schedules', () => {
    const base = { enabled: true } as const;
    expect(dueTaskSummaries(at('20:00'), { ...base, mode: 'once', times: ['20:00'] }, [task()], [], new Set())).toHaveLength(1);
    const twice = { ...base, mode: 'twice' as const, times: ['12:00', '20:00'] };
    expect(dueTaskSummaries(at('12:00'), twice, [task()], [], new Set())).toHaveLength(1);
    expect(dueTaskSummaries(at('13:00'), twice, [task()], [], new Set(['tasks:2026-11-20:12:00']))).toHaveLength(0);
    expect(dueTaskSummaries(at('15:30'), { ...base, mode: 'custom', times: ['09:00', '15:30'] }, [task()], [], new Set())).toHaveLength(1);
    expect(dueTaskSummaries(at('20:00'), { enabled: false, mode: 'once', times: ['20:00'] }, [task()], [], new Set())).toHaveLength(0);
  });
});

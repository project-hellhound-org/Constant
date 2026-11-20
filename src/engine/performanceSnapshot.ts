import { format, parseISO } from 'date-fns';
import { AppSettings, DailySnapshotData, Goal, Habit, HabitLog, Task } from '../db/schema';
import { isHabitScheduled } from './analyticsSeries';
import { calculateCurrentStreak } from './streakEngine';

export interface SnapshotInput {
  dateStr: string; // yyyy-MM-dd
  habits: Habit[];
  habitLogs: HabitLog[];
  tasks: Task[];
  goals: Goal[];
  weights?: AppSettings['productivityWeights'];
}

export interface PerformanceSnapshot extends DailySnapshotData {
  /** null when there is nothing scheduled/recorded for the day (never a made-up number). */
  scoreValue: number | null;
}

const DASH = '—';

/**
 * Pure computation of the Performance Snapshot for one date.
 * Every figure comes from stored data; where data does not exist the value is "—" / 0,
 * never a placeholder score.
 */
export function computePerformanceSnapshot(input: SnapshotInput): PerformanceSnapshot {
  const { dateStr, habits, habitLogs, tasks, goals } = input;
  const weights = input.weights ?? { habitWeight: 50, taskWeight: 40, focusWeight: 0, goalWeight: 10 };
  const day = parseISO(dateStr);

  // Habits: scheduled for that weekday/start-date vs completed that date
  const scheduled = habits.filter((h) => isHabitScheduled(h, day));
  const scheduledIds = new Set(scheduled.map((h) => h.id));
  const habitsDone = habitLogs.filter((l) => l.date === dateStr && l.status === 'completed' && scheduledIds.has(l.habitId)).length;
  const habitPct = scheduled.length > 0 ? (habitsDone / scheduled.length) * 100 : null;

  // Tasks relevant to the day: due that day, or completed that day
  const completedToday = tasks.filter((t) => t.status === 'completed' && t.completedAt?.startsWith(dateStr));
  const dueToday = tasks.filter((t) => t.dueDate === dateStr && t.status !== 'cancelled');
  const relevantIds = new Set([...completedToday, ...dueToday].map((t) => t.id));
  const taskPct = relevantIds.size > 0 ? (completedToday.length / relevantIds.size) * 100 : null;

  const isOpen = (t: Task) => t.status !== 'completed' && t.status !== 'cancelled';
  const overdue = tasks.filter((t) => isOpen(t) && ((t.dueDate && t.dueDate < dateStr) || (t.endDate && t.endDate < dateStr))).length;

  // Time logged: only recorded completion times
  const minutes = completedToday.reduce((sum, t) => sum + (t.completionTimeMinutes ?? 0), 0);
  const timeLogged = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  // Focus efficiency: planned daily limit vs actual completion time, only where both exist
  const measured = completedToday.filter((t) => t.dailyTimeLimitMinutes && t.completionTimeMinutes);
  const focusPct =
    measured.length > 0
      ? Math.round(measured.reduce((s, t) => s + Math.min(1, t.dailyTimeLimitMinutes! / t.completionTimeMinutes!), 0) / measured.length * 100)
      : null;

  const achieved = goals.filter((g) => g.status === 'achieved' || (g.targetValue > 0 && g.currentValue >= g.targetValue)).length;
  const goalPct = goals.length > 0 ? (achieved / goals.length) * 100 : null;

  // Weighted score over the components that actually have data (weights renormalised)
  const parts: Array<[number | null, number]> = [
    [habitPct, weights.habitWeight],
    [taskPct, weights.taskWeight],
    [focusPct, weights.focusWeight],
    [goalPct, weights.goalWeight],
  ];
  const usable = parts.filter(([v, w]) => v !== null && w > 0) as Array<[number, number]>;
  const weightSum = usable.reduce((s, [, w]) => s + w, 0);
  const scoreValue = weightSum > 0 ? Math.round(usable.reduce((s, [v, w]) => s + v * w, 0) / weightSum) : null;

  const { currentStreak } = calculateCurrentStreak(habitLogs, tasks);

  const statusCount = (...statuses: Task['status'][]) => tasks.filter((t) => statuses.includes(t.status)).length;

  return {
    scoreValue,
    productivityScore: scoreValue === null ? DASH : `${scoreValue}/100`,
    habitCompletion: `${habitsDone}/${scheduled.length}`,
    taskCompletion: `${completedToday.length}/${relevantIds.size}`,
    timeLogged,
    focusEfficiency: focusPct === null ? DASH : `${focusPct}%`,
    goalsProgress: `${achieved}/${goals.length}`,
    overdueTasks: overdue,
    currentStreak: `${currentStreak} days`,
    dailyCompletionRate: scoreValue === null ? DASH : `${scoreValue}%`,
    taskReviewStats: {
      planned: relevantIds.size,
      completed: completedToday.length,
      remaining: statusCount('planned', 'remaining', 'todo', 'in_progress'),
      overdue,
      cancelled: statusCount('cancelled'),
      deferred: statusCount('deferred'),
    },
  };
}

export const todayString = () => format(new Date(), 'yyyy-MM-dd');

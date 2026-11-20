import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera } from 'lucide-react';
import { db } from '../db/schema';
import { computePerformanceSnapshot, todayString } from '../engine/performanceSnapshot';

const Tile: React.FC<{ label: string; value: React.ReactNode; accent?: string }> = ({ label, value, accent }) => (
  <div style={{ background: 'var(--surface-sunken)', padding: '0.55rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</span>
    <strong style={{ display: 'block', fontSize: '1.05rem', marginTop: '0.1rem', color: accent ?? 'var(--text-primary)' }}>{value}</strong>
  </div>
);

/** Compact Performance Snapshot, designed to sit in the top corner of the Analytics page. */
export const PerformanceSnapshotCard: React.FC = () => {
  const [dateStr, setDateStr] = useState(todayString());
  const habits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const habitLogs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('default'));

  const snap = useMemo(
    () => computePerformanceSnapshot({ dateStr, habits, habitLogs, tasks, goals, weights: settings?.productivityWeights }),
    [dateStr, habits, habitLogs, tasks, goals, settings?.productivityWeights]
  );

  return (
    <section className="liquid-panel" aria-label="Performance snapshot" style={{ padding: '1rem 1.1rem', width: '100%', maxWidth: '460px', marginLeft: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Camera size={16} style={{ color: 'var(--accent-secondary)' }} /> Performance Snapshot
        </h3>
        <input
          type="date"
          className="form-input"
          aria-label="Snapshot date"
          value={dateStr}
          max={todayString()}
          onChange={(e) => e.target.value && setDateStr(e.target.value)}
          style={{ width: 'auto', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        <Tile label="PRODUCTIVITY" value={snap.productivityScore} accent="var(--accent-secondary)" />
        <Tile label="HABITS" value={snap.habitCompletion} />
        <Tile label="TASKS" value={snap.taskCompletion} />
        <Tile label="TIME LOGGED" value={snap.timeLogged} />
        <Tile label="FOCUS EFF." value={snap.focusEfficiency} />
        <Tile label="OVERDUE" value={snap.overdueTasks} accent={snap.overdueTasks > 0 ? 'var(--danger)' : 'var(--accent-secondary)'} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.65rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>Streak: <strong style={{ color: 'var(--text-primary)' }}>{snap.currentStreak}</strong></span>
        <span>Goals: <strong style={{ color: 'var(--text-primary)' }}>{snap.goalsProgress}</strong></span>
        <span>Open: <strong style={{ color: 'var(--text-primary)' }}>{snap.taskReviewStats.remaining}</strong></span>
        <span>Cancelled: <strong style={{ color: 'var(--text-primary)' }}>{snap.taskReviewStats.cancelled}</strong></span>
        <span>Deferred: <strong style={{ color: 'var(--text-primary)' }}>{snap.taskReviewStats.deferred}</strong></span>
      </div>
    </section>
  );
};

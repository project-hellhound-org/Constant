import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BarChart2, TrendingUp } from 'lucide-react';
import { db } from '../db/schema';
import { buildHabitSeries, buildTaskSeries, Granularity } from '../engine/analyticsSeries';
import { PerformanceSnapshotCard } from '../components/PerformanceSnapshotCard';
import { AnalyticsPanels } from '../components/AnalyticsPanels';

const COLORS = {
  completed: 'var(--success)',
  partial: 'var(--warning)',
  skipped: 'var(--chart-7)',
  missed: 'var(--danger)',
  pending: 'var(--text-disabled)',
  open: 'var(--chart-2)',
  overdue: 'var(--danger)',
  line: 'var(--chart-1)',
  avg: 'var(--warning)',
};

const AXIS = { fontSize: 11, fill: 'var(--text-muted)' } as const;
const GRID = 'var(--border-color)';
const tooltipProps = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text-primary)', fontWeight: 700 },
  cursor: { fill: 'var(--surface-hover)' },
} as const;

const ChartCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode; table?: React.ReactNode }> = ({ title, subtitle, children, table }) => (
  <div style={{ background: 'var(--surface-sunken)', padding: '1.1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', minWidth: 0 }}>
    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h4>
    <p className="subtitle" style={{ fontSize: '0.75rem', margin: '0.15rem 0 0.75rem' }}>{subtitle}</p>
    <div style={{ width: '100%', height: 280 }}>{children}</div>
    {table && (
      <details style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <summary style={{ cursor: 'pointer' }}>View data table</summary>
        <div style={{ overflowX: 'auto', marginTop: '0.4rem' }}>{table}</div>
      </details>
    )}
  </div>
);

function DataTable<T extends { key: string; label: string }>({ rows, cols }: { rows: T[]; cols: Array<[string, (r: T) => React.ReactNode]> }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '2px 8px' }}>Period</th>
          {cols.map(([h]) => <th key={h} style={{ textAlign: 'right', padding: '2px 8px' }}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td style={{ padding: '2px 8px' }}>{r.label}</td>
            {cols.map(([h, f]) => <td key={h} style={{ textAlign: 'right', padding: '2px 8px' }}>{f(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Segmented: React.FC<{ value: string; options: Array<[string, string]>; onChange: (v: string) => void; label: string }> = ({ value, options, onChange, label }) => (
  <div role="radiogroup" aria-label={label} style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
    {options.map(([v, text]) => (
      <button
        key={v}
        type="button"
        role="radio"
        aria-checked={value === v}
        onClick={() => onChange(v)}
        style={{ padding: '0.4rem 0.85rem', border: 0, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', background: value === v ? 'var(--accent-primary)' : 'var(--bg-primary)', color: value === v ? 'var(--text-on-accent)' : 'var(--text-secondary)' }}
      >
        {text}
      </button>
    ))}
  </div>
);

export const AnalyticsView: React.FC = () => {
  const habits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const habitLogs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const doItems = useLiveQuery(() => db.doItems.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [days, setDays] = useState(30);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const weekStartsOn = ((settings?.weekStartDay ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6);

  const habitSeries = useMemo(() => buildHabitSeries(habits, habitLogs, { days, granularity, weekStartsOn }), [habits, habitLogs, days, granularity, weekStartsOn]);
  const taskSeries = useMemo(() => buildTaskSeries(tasks, { days, granularity, weekStartsOn }), [tasks, days, granularity, weekStartsOn]);

  const totals = useMemo(() => {
    const h = habitSeries.reduce((a, p) => ({ scheduled: a.scheduled + p.scheduled, completed: a.completed + p.completed, skipped: a.skipped + p.skipped }), { scheduled: 0, completed: 0, skipped: 0 });
    const denom = h.scheduled - h.skipped;
    const t = taskSeries.reduce((a, p) => ({ completed: a.completed + p.completed, overdue: a.overdue + p.overdue, open: a.open + p.open }), { completed: 0, overdue: 0, open: 0 });
    return { habitCompleted: h.completed, habitPct: denom > 0 ? Math.round((h.completed / denom) * 100) : 0, taskCompleted: t.completed, taskOverdue: t.overdue, taskOpen: t.open };
  }, [habitSeries, taskSeries]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const tickProps = { ...AXIS, interval: 'preserveStartEnd' as const, minTickGap: 18 };
  const unit = granularity === 'week' ? 'week' : 'day';

  return (
    <div className="view-container">
      {/* Header with Performance Snapshot in the top corner */}
      <div className="view-header" style={{ alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}>
          <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: 4 }}>{greeting}, {settings?.userName || 'there'} · Consistency today, a brighter tomorrow.</p>
          <h1 className="view-header-title">Performance Analytics</h1>
          <p className="view-header-subtitle">
            Stacked columns show what happened each {unit}; lines show the trend. Rates exclude skipped days, and today's unlogged habits count as pending — never missed.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
            <Segmented label="Time range" value={String(days)} onChange={(v) => setDays(Number(v))} options={[['7', '7 days'], ['30', '30 days'], ['90', '90 days']]} />
            <Segmented label="Granularity" value={granularity} onChange={(v) => setGranularity(v as Granularity)} options={[['day', 'Daily'], ['week', 'Weekly']]} />
          </div>
        </div>
        <div style={{ flex: '0 1 460px', minWidth: 300 }}>
          <PerformanceSnapshotCard />
        </div>
      </div>

      {/* Summary cards for the selected range */}
      <div className="stat-badge-grid">
        <div className="liquid-panel flip-card-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-secondary)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>HABIT COMPLETION · {days}D</span>
            <Activity size={18} />
          </div>
          <div className="hero-stat-number">{totals.habitPct}<span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>%</span></div>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{totals.habitCompleted} completed check-ins</span>
        </div>
        <div className="liquid-panel flip-card-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>TASKS COMPLETED · {days}D</span>
            <TrendingUp size={18} />
          </div>
          <div className="hero-stat-number">{totals.taskCompleted}</div>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{totals.taskOverdue} overdue · {totals.taskOpen} open</span>
        </div>
        <div className="liquid-panel flip-card-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-secondary)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>ACTIVE ROUTINES</span>
            <BarChart2 size={18} />
          </div>
          <div className="hero-stat-number">{habits.length}</div>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Tracked habit specifications</span>
        </div>
      </div>

      {/* HABITS */}
      <div className="liquid-panel flip-card-item" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-secondary)', margin: 0 }}>
          <Activity size={22} /> Habit Trends
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
          <ChartCard
            title="Habit check-ins by outcome"
            subtitle={`Stacked columns per ${unit}: completed, partial, skipped, missed, pending`}
            table={<DataTable rows={habitSeries} cols={[['Done', (r) => r.completed], ['Partial', (r) => r.partial], ['Skipped', (r) => r.skipped], ['Missed', (r) => r.missed], ['Pending', (r) => r.pending]]} />}
          >
            <ResponsiveContainer>
              <BarChart data={habitSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} {...tickProps} />
                <YAxis allowDecimals={false} tick={AXIS} />
                <Tooltip {...tooltipProps} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" name="Completed" stackId="h" fill={COLORS.completed} />
                <Bar dataKey="partial" name="Partial" stackId="h" fill={COLORS.partial} />
                <Bar dataKey="skipped" name="Skipped" stackId="h" fill={COLORS.skipped} />
                <Bar dataKey="missed" name="Missed" stackId="h" fill={COLORS.missed} />
                <Bar dataKey="pending" name="Pending" stackId="h" fill={COLORS.pending} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Habit completion rate (%)"
            subtitle={`Per ${unit} with a 7-point moving average`}
            table={<DataTable rows={habitSeries} cols={[['Rate %', (r) => r.ratePct], ['7-pt avg %', (r) => r.ratePctMA]]} />}
          >
            <ResponsiveContainer>
              <LineChart data={habitSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} {...tickProps} />
                <YAxis domain={[0, 100]} unit="%" tick={AXIS} />
                <Tooltip {...tooltipProps} formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ratePct" name="Completion rate" stroke={COLORS.line} strokeWidth={2.5} dot={habitSeries.length <= 31} activeDot={{ r: 5 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="ratePctMA" name="7-pt average" stroke={COLORS.avg} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* TASKS */}
      <div className="liquid-panel flip-card-item" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--warning)', margin: 0 }}>
          <TrendingUp size={22} /> Task Trends
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
          <ChartCard
            title="Task outcomes"
            subtitle={`Stacked columns per ${unit}: completed, overdue, still open (by due date)`}
            table={<DataTable rows={taskSeries} cols={[['Completed', (r) => r.completed], ['Overdue', (r) => r.overdue], ['Open', (r) => r.open]]} />}
          >
            <ResponsiveContainer>
              <BarChart data={taskSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} {...tickProps} />
                <YAxis allowDecimals={false} tick={AXIS} />
                <Tooltip {...tooltipProps} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" name="Completed" stackId="t" fill={COLORS.completed} />
                <Bar dataKey="overdue" name="Overdue" stackId="t" fill={COLORS.overdue} />
                <Bar dataKey="open" name="Open" stackId="t" fill={COLORS.open} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Tasks completed (trend)"
            subtitle={`Completions per ${unit} with a 7-point moving average`}
            table={<DataTable rows={taskSeries} cols={[['Completed', (r) => r.completed], ['7-pt avg', (r) => r.completedMA]]} />}
          >
            <ResponsiveContainer>
              <LineChart data={taskSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} {...tickProps} />
                <YAxis allowDecimals={false} tick={AXIS} />
                <Tooltip {...tooltipProps} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke={COLORS.completed} strokeWidth={2.5} dot={taskSeries.length <= 31} activeDot={{ r: 5 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="completedMA" name="7-pt average" stroke={COLORS.avg} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      <AnalyticsPanels habits={habits} logs={habitLogs} tasks={tasks} items={doItems} days={days} />
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { differenceInHours, format, parseISO, subDays } from 'date-fns';
import { Habit, HabitLog, Task, DoItem } from '../db/schema';
import { calculateHabitStats } from '../engine/streakEngine';
import { habitIcon } from './ui';

const VARS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];
const FIXED_CATS = ['Learning', 'Health & Fitness', 'Work & Projects', 'Personal', 'Finance', 'Other'];

const normCat = (raw?: string) => {
  const c = (raw || '').toLowerCase();
  if (/learn|study|growth|skill|read/.test(c)) return 'Learning';
  if (/health|fitness|well|mindful|sleep/.test(c)) return 'Health & Fitness';
  if (/work|project|product/.test(c)) return 'Work & Projects';
  if (/personal|family|home/.test(c)) return 'Personal';
  if (/financ|money|budget/.test(c)) return 'Finance';
  return 'Other';
};
const TIME_CATS = ['Deep Work', 'Learning', 'Meetings', 'Planning', 'Admin', 'Other'];
const timeCat = (t?: Task) => {
  const s = `${t?.category || ''} ${(t?.tags || []).join(' ')} ${t?.title || ''}`.toLowerCase();
  if (/meeting|call|sync/.test(s)) return 'Meetings';
  if (/plan|review/.test(s)) return 'Planning';
  if (/admin|email|invoice|finance/.test(s)) return 'Admin';
  if (/learn|study|course|read/.test(s)) return 'Learning';
  if (/deep|build|develop|project|code|work/.test(s)) return 'Deep Work';
  return 'Other';
};

const Panel: React.FC<{ title: string; icon?: React.ReactNode; control?: React.ReactNode; children: React.ReactNode }> = ({ title, control, children }) => (
  <section className="liquid-panel" aria-label={title} style={{ minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: '0.8rem' }}>
      <h3 className="panel-title">{title}</h3>{control}
    </div>
    {children}
  </section>
);

const Select: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
  <select aria-label={label} className="form-select" value={value} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 30, padding: '0.15rem 0.5rem', fontSize: '0.78rem' }}>{options.map((o) => <option key={o}>{o}</option>)}</select>
);

const Donut: React.FC<{ data: { name: string; value: number }[]; center: string; sub: string }> = ({ data, center, sub }) => {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div style={{ position: 'relative', width: 150, height: 150, flex: 'none' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={total ? data : [{ name: 'none', value: 1 }]} dataKey="value" innerRadius={50} outerRadius={70} stroke="var(--bg-surface)" strokeWidth={2} isAnimationActive={false}>
          {(total ? data : [{ name: 'none', value: 1 }]).map((d, i) => <Cell key={d.name} fill={total ? VARS[i % VARS.length] : 'var(--progress-track)'} />)}
        </Pie></PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <strong className="num" style={{ fontSize: '1.4rem' }}>{center}</strong><span className="subtitle" style={{ fontSize: '0.7rem' }}>{sub}</span>
      </div>
    </div>
  );
};

const Legend: React.FC<{ rows: { name: string; label: string; pct: number }[] }> = ({ rows }) => (
  <ul style={{ listStyle: 'none', flex: 1, fontSize: '0.8rem', minWidth: 0 }}>
    {rows.map((r, i) => <li key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 0' }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: VARS[i % VARS.length] }} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span><span className="num">{r.label}</span><span className="num subtitle" style={{ width: 36, textAlign: 'right' }}>{r.pct}%</span></li>)}
  </ul>
);

interface Props { habits: Habit[]; logs: HabitLog[]; tasks: Task[]; items: DoItem[]; days: number }

export const AnalyticsPanels: React.FC<Props> = ({ habits, logs, tasks, items, days }) => {
  const [catSrc, setCatSrc] = useState('All Items');
  const [timeSrc, setTimeSrc] = useState('Tasks');
  const [metric, setMetric] = useState('Completion Rate');
  const [period, setPeriod] = useState('30 Days');

  const category = useMemo(() => {
    const counts = new Map<string, number>(FIXED_CATS.map((c) => [c, 0]));
    if (catSrc !== 'Tasks') habits.forEach((h) => counts.set(normCat(h.category), (counts.get(normCat(h.category)) || 0) + 1));
    if (catSrc !== 'Habits') tasks.filter((t) => t.status !== 'cancelled').forEach((t) => counts.set(normCat(t.category), (counts.get(normCat(t.category)) || 0) + 1));
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    return { total, rows: [...counts.entries()].map(([name, v]) => ({ name, value: v, label: String(v), pct: total ? Math.round((v / total) * 100) : 0 })) };
  }, [habits, tasks, catSrc]);

  const time = useMemo(() => {
    const since = format(subDays(new Date(), days), 'yyyy-MM-dd');
    const mins = new Map<string, number>(TIME_CATS.map((c) => [c, 0]));
    if (timeSrc === 'Tasks') {
      for (const it of items) { if (!it.completed || !it.durationMinutes || (it.completedAt || '').slice(0, 10) < since) continue; const c = timeCat(tasks.find((t) => t.id === it.taskId)); mins.set(c, (mins.get(c) || 0) + it.durationMinutes); }
    } else {
      for (const l of logs) { if (l.status !== 'completed' || l.date < since) continue; const h = habits.find((x) => x.id === l.habitId); const m = (h?.subHabits || []).reduce((a, s) => a + (s.estimatedMinutes || 0), 0); const c = normCat(h?.category) === 'Learning' ? 'Learning' : 'Other'; mins.set(c, (mins.get(c) || 0) + m); }
    }
    const total = [...mins.values()].reduce((a, b) => a + b, 0);
    const fmt = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
    return { total, fmt, rows: [...mins.entries()].map(([name, v]) => ({ name, value: v, label: fmt(v), pct: total ? Math.round((v / total) * 100) : 0 })) };
  }, [items, tasks, logs, habits, timeSrc, days]);

  const top = useMemo(() => {
    const now = new Date();
    return habits.map((h) => { const s = calculateHabitStats(h, logs, now, 'pause'); return { h, rate: s.completionRate30Days, streak: s.currentStreak, longest: s.longestStreak }; })
      .sort((a, b) => (metric === 'Current Streak' ? b.streak - a.streak : b.rate - a.rate)).slice(0, 3);
  }, [habits, logs, metric]);

  const insights = useMemo(() => {
    const n = period === '7 Days' ? 7 : period === '90 Days' ? 90 : 30;
    const since = format(subDays(new Date(), n), 'yyyy-MM-dd'); const today = format(new Date(), 'yyyy-MM-dd');
    const inRange = tasks.filter((t) => t.status !== 'cancelled' && (t.dueDate || t.createdAt.slice(0, 10)) >= since);
    const done = inRange.filter((t) => t.status === 'completed');
    const overdue = inRange.filter((t) => t.status !== 'completed' && t.dueDate && t.dueDate < today);
    const open = inRange.filter((t) => t.status !== 'completed');
    const pct = (x: number) => (inRange.length ? Math.round((x / inRange.length) * 100) : 0);
    const hours = done.filter((t) => t.completedAt).map((t) => differenceInHours(parseISO(t.completedAt as string), parseISO(t.createdAt)));
    const avg = hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null;
    const byDay = new Map<string, number>(); done.forEach((t) => { if (t.completedAt) { const d = format(parseISO(t.completedAt), 'EEEE'); byDay.set(d, (byDay.get(d) || 0) + 1); } });
    const best = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    return [['Total Tasks', String(inRange.length)], ['Completed', `${done.length} (${pct(done.length)}%)`], ['Overdue', `${overdue.length} (${pct(overdue.length)}%)`], ['Still Open', `${open.length} (${pct(open.length)}%)`],
      ['Average Completion Time', avg === null ? '—' : avg >= 24 ? `${Math.round(avg / 24)}d` : `${avg}h`], ['Most Active Day', best]] as [string, string][];
  }, [tasks, period]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
      <Panel title="Category Breakdown" control={<Select label="Category source" value={catSrc} options={['All Items', 'Habits', 'Tasks']} onChange={setCatSrc} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Donut data={category.rows} center={String(category.total)} sub="Total Items" /><Legend rows={category.rows} /></div>
      </Panel>
      <Panel title="Time Distribution" control={<Select label="Time source" value={timeSrc} options={['Tasks', 'Habits']} onChange={setTimeSrc} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Donut data={time.rows} center={time.fmt(time.total)} sub="Total Time" /><Legend rows={time.rows} /></div>
        <p className="subtitle" style={{ fontSize: '0.72rem', marginTop: 8 }}>Logged minutes from completed steps in the last {days} days.</p>
      </Panel>
      <Panel title="Top Habits" control={<Select label="Ranking metric" value={metric} options={['Completion Rate', 'Current Streak']} onChange={setMetric} />}>
        {top.length === 0 ? <p className="subtitle">No habits yet.</p> : top.map((t, i) => { const Icon = habitIcon(t.h); const v = metric === 'Current Streak' ? t.streak : t.rate; return (
          <div key={t.h.id} style={{ display: 'grid', gridTemplateColumns: '24px 22px 1fr 44px', alignItems: 'center', gap: 10, padding: '0.45rem 0' }}>
            <span className="num chip chip-neutral" style={{ justifyContent: 'center' }}>{i + 1}</span><Icon size={16} aria-hidden="true" style={{ color: 'var(--accent-secondary)' }} />
            <div><div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{t.h.name}</div><div className="progress-bar-track" style={{ height: 5, marginTop: 4 }}><div className="progress-bar-fill" style={{ width: `${Math.min(100, metric === 'Current Streak' ? (v / Math.max(1, top[0].streak)) * 100 : v)}%` }} /></div></div>
            <span className="num" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{metric === 'Current Streak' ? `${v}d` : `${v}%`}</span>
          </div>); })}
      </Panel>
      <Panel title="Task Insights" control={<Select label="Insights period" value={period} options={['7 Days', '30 Days', '90 Days']} onChange={setPeriod} />}>
        <dl>{insights.map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid var(--divider)', fontSize: '0.85rem' }}><dt style={{ color: 'var(--text-secondary)' }}>{k}</dt><dd className="num" style={{ fontWeight: 600 }}>{v}</dd></div>)}</dl>
      </Panel>
    </div>
  );
};

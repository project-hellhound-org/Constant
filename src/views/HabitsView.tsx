import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, getDay, isAfter, startOfMonth, startOfWeek, subDays, subWeeks } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Plus, MoreVertical, GripVertical, Check, ChevronLeft, ChevronRight, Flame, Clock, Search, Star, Target, BarChart2, Leaf, CalendarDays, Layers, X } from 'lucide-react';
import { db, Habit, HabitLog } from '../db/schema';
import { ActiveTab } from '../App';
import { AddHabitModal } from '../components/AddHabitModal';
import { calculateHabitStats } from '../engine/streakEngine';
import { getSubHabitState, setSubHabitState, summarizeSubHabits } from '../engine/subHabitEngine';
import { normalizeHabitCategory } from '../engine/habitCategories';
import { ProgressRing, Delta, PanelHeader, habitIcon, formatHabitTime } from '../components/ui';

type Tab = 'overview' | 'habits' | 'routines' | 'streaks' | 'calendar' | 'insights';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Leaf size={15} /> }, { id: 'habits', label: 'Habits', icon: <Layers size={15} /> },
  { id: 'routines', label: 'Routines', icon: <Clock size={15} /> }, { id: 'streaks', label: 'Streaks', icon: <Flame size={15} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={15} /> }, { id: 'insights', label: 'Insights', icon: <BarChart2 size={15} /> },
];
const CHART_VARS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const scheduledOn = (h: Habit, d: Date) => h.frequencyMode === 'custom' && h.selectedDays?.length ? h.selectedDays.includes(getDay(d)) : true;
const toMin = (h: Habit) => { if (!h.startTime) return null; const [hh, mm] = h.startTime.split(':').map(Number); return ((hh % 12) + (h.amPm === 'PM' ? 12 : 0)) * 60 + (mm || 0); };

interface Props { setActiveTab?: (tab: ActiveTab) => void }

export const HabitsView: React.FC<Props> = ({ setActiveTab }) => {
  const allHabits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const logs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [tab, setTab] = useState<Tab>('overview');
  const [date, setDate] = useState(new Date());
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<Habit | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pageMenu, setPageMenu] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calMonth, setCalMonth] = useState(new Date());

  const today = new Date();
  const dateStr = ymd(date);
  const isFuture = isAfter(date, today) && dateStr !== ymd(today);
  const rule = settings?.streakSkipRule || 'pause';

  const habits = useMemo(() => [...allHabits].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.createdAt.localeCompare(b.createdAt)), [allHabits]);
  const active = habits.filter((h) => !h.paused);
  const logOf = (h: Habit, d: string) => logs.find((l) => l.habitId === h.id && l.date === d);
  const doneOn = (h: Habit, d: string) => logOf(h, d)?.status === 'completed';
  const pctOn = (d: Date) => { const s = active.filter((h) => scheduledOn(h, d)); return s.length ? Math.round((s.filter((h) => doneOn(h, ymd(d))).length / s.length) * 100) : 0; };

  const stats = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calculateHabitStats>>();
    for (const h of habits) m.set(h.id, calculateHabitStats(h, logs, new Date(), rule));
    return m;
  }, [habits, logs, rule]);

  // ---------- Summary ----------
  const visible = active.filter((h) => scheduledOn(h, today));
  const doneToday = visible.filter((h) => doneOn(h, ymd(today))).length;
  const todayPct = visible.length ? Math.round((doneToday / visible.length) * 100) : 0;
  const avg = (from: number) => { let t = 0; for (let i = from; i < from + 7; i++) t += pctOn(subDays(today, i)); return Math.round(t / 7); };
  const weekAvg = avg(0), prevAvg = avg(7);
  const bestStreak = Math.max(0, ...habits.map((h) => stats.get(h.id)?.currentStreak || 0));
  const goalHabitIds = new Set(goals.flatMap((g) => g.relatedHabitIds || []));
  const goalHabits = habits.filter((h) => goalHabitIds.has(h.id));
  const onTrack = goalHabits.filter((h) => (stats.get(h.id)?.completionRate30Days || 0) >= 60).length;

  // ---------- Actions ----------
  const stamp = () => new Date().toISOString();
  const setStatus = async (h: Habit, status: HabitLog['status'] | 'pending') => {
    if (isFuture) return;
    const ex = await db.habitLogs.where('[habitId+date]').equals([h.id, dateStr]).first();
    if (status === 'pending') { if (ex) await db.habitLogs.delete(ex.id); return; }
    const subs = h.subHabits || [];
    const subHabitsState = status === 'completed' && subs.length ? Object.fromEntries(subs.map((s) => [s.id, 'completed'])) : ex?.subHabitsState;
    const patch = { status, value: status === 'completed' ? 1 : 0, loggedAt: stamp(), ...(subHabitsState ? { subHabitsState } : {}) };
    if (ex) await db.habitLogs.update(ex.id, patch as any);
    else await db.habitLogs.add({ id: `log-${Date.now()}-${h.id}`, habitId: h.id, date: dateStr, ...patch } as HabitLog);
  };
  const toggle = (h: Habit) => setStatus(h, doneOn(h, dateStr) ? 'pending' : 'completed');
  const markAll = async () => { for (const h of shown) if (!doneOn(h, dateStr)) await setStatus(h, 'completed'); };
  const togglePause = (h: Habit) => db.habits.update(h.id, { paused: !h.paused, updatedAt: stamp() });
  const remove = async (h: Habit) => { if (confirm(`Delete "${h.name}" and its history?`)) { await db.habits.delete(h.id); await db.habitLogs.where('habitId').equals(h.id).delete(); } };
  const reorder = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = habits.map((h) => h.id); const from = ids.indexOf(fromId), to = ids.indexOf(toId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await db.transaction('rw', db.habits, async () => { for (let i = 0; i < ids.length; i++) await db.habits.update(ids[i], { order: i }); });
  };
  const move = (h: Habit, dir: -1 | 1) => { const i = habits.findIndex((x) => x.id === h.id); const t = habits[i + dir]; if (t) reorder(h.id, t.id); };

  const shown = habits.filter((h) => scheduledOn(h, date) && (!query || `${h.name} ${h.category} ${h.description || ''}`.toLowerCase().includes(query.toLowerCase())));

  // ---------- Categories ----------
  const catCounts = useMemo(() => { const m = new Map<string, number>(); for (const h of active) { const c = normalizeHabitCategory(h.category); m.set(c, (m.get(c) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [active]);

  // ---------- Weekly grid ----------
  const weekStart = startOfWeek(subWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ---------- Upcoming ----------
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const upcoming = visible.filter((h) => !doneOn(h, ymd(today)) && toMin(h) !== null && (toMin(h) as number) >= nowMin).sort((a, b) => (toMin(a) as number) - (toMin(b) as number)).slice(0, 4);

  const openEdit = (h: Habit | null) => { setEdit(h); setModal(true); setMenuFor(null); };

  const renderSubHabits = (h: Habit) => {
    const log = logOf(h, dateStr);
    const summary = summarizeSubHabits(h.subHabits, log);
    return (
      <ul aria-label={`Sub-topics of ${h.name}`} style={{ listStyle: 'none', margin: '0 0 0.6rem 3.4rem', padding: '0.5rem 0.75rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.3rem 0.9rem' }}>
        {(h.subHabits || []).map((sub) => {
          const st = getSubHabitState(sub, log);
          return (
            <li key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.2rem 0' }}>
              <button type="button" role="checkbox" aria-checked={st === 'completed'} aria-label={`${sub.title}: mark ${st === 'completed' ? 'incomplete' : 'complete'}`} disabled={isFuture} className={`check-square ${st === 'completed' ? 'is-done' : ''}`} style={{ width: 18, height: 18 }} onClick={() => setSubHabitState(h, sub.id, 'completed', dateStr)}>{st === 'completed' && <Check size={12} />}</button>
              <span style={{ fontSize: '0.84rem', textDecoration: st === 'completed' ? 'line-through' : 'none', color: st === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{sub.title}</span>
              {sub.topic && <span className="chip chip-neutral" style={{ padding: '0 .4rem' }}>{sub.topic}</span>}
            </li>);
        })}
        <li className="subtitle num" style={{ gridColumn: '1 / -1', fontSize: '0.72rem' }}>{summary.completed}/{summary.total} sub-topics · {summary.pct}%</li>
      </ul>
    );
  };

  const renderRow = (h: Habit) => {
    const log = logOf(h, dateStr); const done = log?.status === 'completed';
    const Icon = habitIcon(h); const time = formatHabitTime(h); const hasSubs = !!h.subHabits?.length;
    const summary = hasSubs ? summarizeSubHabits(h.subHabits, log) : null;
    const ringPct = done ? 100 : summary ? summary.pct : 0;
    const s = stats.get(h.id);
    return (
      <React.Fragment key={h.id}>
        <div draggable onDragStart={() => setDragId(h.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) reorder(dragId, h.id); setDragId(null); }} className="row-hover"
          style={{ display: 'grid', gridTemplateColumns: '18px 24px 28px minmax(0, 1fr) 96px 30px 84px 28px', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.4rem', borderTop: '1px solid var(--divider)', opacity: dragId === h.id ? 0.5 : 1, borderRadius: 'var(--radius-sm)' }}>
          <GripVertical size={16} aria-hidden="true" style={{ color: 'var(--text-disabled)', cursor: 'grab' }} />
          <button type="button" role="checkbox" aria-checked={done} aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: ${h.name}`} disabled={isFuture} className={`check-square ${done ? 'is-done' : ''}`} onClick={() => toggle(h)}>{done && <Check size={14} />}</button>
          <Icon size={20} aria-hidden="true" style={{ color: 'var(--accent-secondary)' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.95rem', textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : 'var(--text-primary)' }}>{h.name}</strong>
              <span className="chip chip-neutral">{normalizeHabitCategory(h.category)}</span>
              {summary && <span className="chip chip-info num">{summary.completed}/{summary.total}</span>}
              {log?.status === 'skipped' && <span className="chip chip-warning">Skipped</span>}
              {log?.status === 'failed' && <span className="chip chip-danger">Missed</span>}
            </div>
            <div className="subtitle" style={{ fontSize: '0.78rem' }}>
              {h.description || (hasSubs ? `${h.subHabits!.length} sub-topics` : 'No sub-topics')}
              {done && log?.loggedAt && <span className="num"> · done {format(new Date(log.loggedAt), 'h:mm a')}</span>}
            </div>
          </div>
          {time && !done ? <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: 'var(--text-secondary)' }}><Clock size={14} />{time}</span>
            : <button type="button" className="btn btn-secondary btn-xs" disabled={isFuture || done} onClick={() => setStatus(h, 'completed')}>{done ? 'Logged' : '+ Log'}</button>}
          <ProgressRing pct={ringPct} size={26} stroke={3} label="" />
          <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', fontWeight: 600 }}><Flame size={14} aria-hidden="true" style={{ color: 'var(--warning)' }} />{s?.currentStreak || 0} days</span>
          <div style={{ position: 'relative' }}>
            <button type="button" className="link-action" aria-label={`More options for ${h.name}`} aria-haspopup="menu" aria-expanded={menuFor === h.id} onClick={() => setMenuFor(menuFor === h.id ? null : h.id)}><MoreVertical size={16} /></button>
            {menuFor === h.id && (
              <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 30, minWidth: 170, background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-elevated)', padding: 4, display: 'flex', flexDirection: 'column' }}>
                {([['Edit', () => openEdit(h)], ['Skip today', () => setStatus(h, 'skipped')], ['Mark missed', () => setStatus(h, 'failed')], ['Move up', () => move(h, -1)], ['Move down', () => move(h, 1)], [h.paused ? 'Resume' : 'Pause', () => togglePause(h)], ['Delete', () => remove(h)]] as [string, () => void][]).map(([label, fn]) => (
                  <button key={label} role="menuitem" type="button" className="row-hover" onClick={() => { fn(); setMenuFor(null); }} style={{ textAlign: 'left', padding: '0.45rem 0.7rem', background: 'none', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: label === 'Delete' ? 'var(--danger)' : 'var(--text-primary)' }}>{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        {hasSubs && renderSubHabits(h)}
      </React.Fragment>
    );
  };

  // ---------- Panels ----------
  const summaryCards = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
      <div className="liquid-panel" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}><ProgressRing pct={todayPct} size={60} /><div><strong>Today's Completion</strong><div className="subtitle num" style={{ fontSize: '0.8rem' }}>{doneToday} of {visible.length} habits</div></div></div>
      <div className="liquid-panel"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Flame size={22} style={{ color: 'var(--warning)' }} /><span className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{bestStreak} days</span></div><div style={{ fontWeight: 600 }}>Current Streak</div><div className="subtitle" style={{ fontSize: '0.78rem' }}>Best active habit streak</div></div>
      <div className="liquid-panel"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><BarChart2 size={22} style={{ color: 'var(--success)' }} /><span className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{weekAvg}%</span></div><div style={{ fontWeight: 600 }}>Weekly Average</div><Delta value={weekAvg - prevAvg} suffix="%" text="vs last week" /></div>
      <div className="liquid-panel"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Star size={22} style={{ color: 'var(--info)' }} /><span className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{active.length}</span></div><div style={{ fontWeight: 600 }}>Active Habits</div><div className="subtitle" style={{ fontSize: '0.78rem' }}>{habits.length - active.length} on pause</div></div>
      <div className="liquid-panel"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Target size={22} style={{ color: 'var(--danger)' }} /><span className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{goalHabits.length}</span></div><div style={{ fontWeight: 600 }}>Goal Habits</div><div className="subtitle" style={{ fontSize: '0.78rem' }}>{onTrack} on track</div></div>
    </div>
  );

  const trackerPanel = (
    <section className="liquid-panel" aria-label="Daily habit tracker">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <h3 className="panel-title"><span>{dateStr === ymd(today) ? 'Today' : format(date, 'EEEE')}</span><span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>• {format(date, 'MMMM d, yyyy')}</span></h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Previous day" onClick={() => setDate(subDays(date, 1))}><ChevronLeft size={16} /></button>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><ChevronRight size={16} /></button>
          <button type="button" className="btn btn-secondary btn-xs" onClick={markAll} disabled={isFuture || shown.length === 0}>Mark All Complete</button>
        </div>
      </div>
      {isFuture && <p className="chip chip-info" style={{ marginBottom: 8 }}>Future dates are read-only.</p>}
      {shown.length === 0 ? <p className="subtitle" style={{ padding: '1.5rem 0', textAlign: 'center' }}>{habits.length === 0 ? 'No habits yet. Use Add Habit to create your first routine.' : 'No habits scheduled for this day.'}</p> : <div>{shown.map(renderRow)}</div>}
    </section>
  );

  const weeklyPanel = (
    <section className="liquid-panel" aria-label="Weekly consistency">
      <PanelHeader title="Weekly Consistency" right={
        <select className="form-select" aria-label="Week" style={{ minHeight: 32, padding: '0.2rem 0.6rem', fontSize: '0.8rem' }} value={weekOffset} onChange={(e) => setWeekOffset(Number(e.target.value))}>
          <option value={0}>This Week</option><option value={1}>Last Week</option><option value={2}>2 Weeks Ago</option>
        </select>} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%', fontSize: '0.75rem' }}>
          <thead><tr><th /> {weekDays.map((d) => <th key={d.toISOString()} scope="col" title={format(d, 'EEEE')} style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{format(d, 'EEEEE')}</th>)}</tr></thead>
          <tbody>
            {active.map((h) => (
              <tr key={h.id}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap', paddingRight: 8 }}>{h.name}</th>
                {weekDays.map((d) => {
                  const st = logOf(h, ymd(d))?.status;
                  const bg = st === 'completed' ? 'var(--heatmap-100)' : st === 'partial' ? 'var(--heatmap-50)' : st === 'skipped' || st === 'failed' ? 'var(--heatmap-25)' : 'var(--heatmap-0)';
                  return <td key={d.toISOString()} title={`${h.name}, ${format(d, 'EEE d')}: ${st || 'no record'}`} style={{ height: 20, minWidth: 20, background: bg, borderRadius: 4, textAlign: 'center', color: st === 'completed' ? 'var(--text-on-accent)' : 'var(--text-primary)' }}>{st === 'completed' ? <Check size={12} aria-label="completed" /> : st === 'partial' ? '½' : st === 'skipped' ? '–' : st === 'failed' ? '×' : ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active.length > 0 && (() => { const ranked = active.map((h) => ({ h, n: weekDays.filter((d) => doneOn(h, ymd(d))).length })).sort((a, b) => b.n - a.n); const low = ranked[ranked.length - 1]; return <p className="subtitle" style={{ fontSize: '0.75rem', marginTop: 8 }}>Most engaged: <strong>{ranked[0].h.name}</strong> ({ranked[0].n}/7). Needs attention: <strong>{low.h.name}</strong> ({low.n}/7).</p>; })()}
    </section>
  );

  const categoriesPanel = (
    <section className="liquid-panel" aria-label="Habit categories">
      <PanelHeader title="Habit Categories" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', width: 130, height: 130, flex: 'none' }}>
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={catCounts.map(([name, value]) => ({ name, value }))} dataKey="value" innerRadius={42} outerRadius={62} stroke="var(--bg-surface)" strokeWidth={2} isAnimationActive={false}>{catCounts.map(([n], i) => <Cell key={n} fill={CHART_VARS[i % CHART_VARS.length]} />)}</Pie></PieChart></ResponsiveContainer>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><strong className="num" style={{ fontSize: '1.4rem' }}>{active.length}</strong><span className="subtitle" style={{ fontSize: '0.7rem' }}>Habits</span></div>
        </div>
        <ul style={{ listStyle: 'none', flex: 1, fontSize: '0.82rem' }}>
          {catCounts.map(([n, c], i) => <li key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: CHART_VARS[i % CHART_VARS.length] }} /><span style={{ flex: 1 }}>{n}</span><span className="num">{c} ({Math.round((c / active.length) * 100)}%)</span></li>)}
        </ul>
      </div>
    </section>
  );

  const upcomingPanel = (
    <section className="liquid-panel" aria-label="Upcoming habits">
      <PanelHeader title="Upcoming Habits" action={{ label: 'View Calendar', onClick: () => setTab('calendar') }} />
      {upcoming.length === 0 ? <p className="subtitle" style={{ fontSize: '0.85rem' }}>No more timed habits today.</p> : (
        <ul style={{ listStyle: 'none' }}>{upcoming.map((h) => { const Icon = habitIcon(h); return <li key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.45rem 0' }}><Icon size={18} aria-hidden="true" style={{ color: 'var(--accent-secondary)' }} /><span style={{ flex: 1, fontWeight: 500 }}>{h.name}</span><span className="num subtitle">{formatHabitTime(h)}</span><Clock size={14} aria-hidden="true" style={{ color: 'var(--text-muted)' }} /></li>; })}</ul>
      )}
    </section>
  );

  // ---------- Other tabs ----------
  const habitsTab = (
    <section className="liquid-panel"><PanelHeader title="All Habits" />
      {habits.length === 0 ? <p className="subtitle">No habits yet.</p> : habits.map((h) => { const s = stats.get(h.id)!; return (
        <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.7rem 0', borderTop: '1px solid var(--divider)', flexWrap: 'wrap', opacity: h.paused ? 0.65 : 1 }}>
          <div style={{ flex: 1, minWidth: 200 }}><strong>{h.name}</strong> <span className="chip chip-neutral">{h.category}</span> {h.paused && <span className="chip chip-warning">Paused</span>}<div className="subtitle num" style={{ fontSize: '0.78rem' }}>Streak {s.currentStreak} · Longest {s.longestStreak} · 30-day {s.completionRate30Days}%</div></div>
          <div style={{ width: 160 }} className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${s.completionRate30Days}%` }} /></div>
          <button className="btn btn-secondary btn-xs" onClick={() => openEdit(h)}>Edit</button>
          <button className="btn btn-secondary btn-xs" onClick={() => togglePause(h)}>{h.paused ? 'Resume' : 'Pause'}</button>
          <button className="btn btn-danger btn-xs" onClick={() => remove(h)}>Delete</button>
        </div>); })}
    </section>
  );

  const routinesTab = (() => {
    const slot = (h: Habit) => { const m = toMin(h); return m === null ? 'Anytime' : m < 12 * 60 ? 'Morning' : m < 17 * 60 ? 'Afternoon' : 'Evening'; };
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {['Morning', 'Afternoon', 'Evening', 'Anytime'].map((s) => (
          <section key={s} className="liquid-panel"><PanelHeader title={`${s} routine`} />
            {active.filter((h) => slot(h) === s).map((h) => <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid var(--divider)' }}><span>{h.name}</span><span className="num subtitle">{formatHabitTime(h) || ''}</span></div>)}
            {active.filter((h) => slot(h) === s).length === 0 && <p className="subtitle" style={{ fontSize: '0.82rem' }}>No habits in this routine.</p>}
          </section>))}
      </div>);
  })();

  const streaksTab = (
    <section className="liquid-panel"><PanelHeader title="Streaks" />
      {[...habits].sort((a, b) => (stats.get(b.id)?.currentStreak || 0) - (stats.get(a.id)?.currentStreak || 0)).map((h, i) => (
        <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0', borderTop: '1px solid var(--divider)' }}>
          <span className="num" style={{ width: 24, color: 'var(--text-muted)' }}>{i + 1}</span><span style={{ flex: 1, fontWeight: 600 }}>{h.name}</span>
          <span className="num" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Flame size={15} style={{ color: 'var(--warning)' }} />{stats.get(h.id)?.currentStreak || 0} days</span>
          <span className="subtitle num" style={{ fontSize: '0.8rem' }}>best {stats.get(h.id)?.longestStreak || 0}</span>
        </div>))}
    </section>
  );

  const calendarTab = (() => {
    const days = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
    const lead = (getDay(days[0]) + 6) % 7;
    return (
      <section className="liquid-panel"><PanelHeader title={format(calMonth, 'MMMM yyyy')} right={<div style={{ display: 'flex', gap: 6 }}><button className="btn btn-secondary btn-icon" aria-label="Previous month" onClick={() => setCalMonth(addMonths(calMonth, -1))}><ChevronLeft size={16} /></button><button className="btn btn-secondary btn-icon" aria-label="Next month" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight size={16} /></button></div>} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 560 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="subtitle" style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>{d}</div>)}
          {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
          {days.map((d) => { const p = pctOn(d); const future = isAfter(d, today);
            const bg = future ? 'transparent' : p >= 100 ? 'var(--heatmap-100)' : p >= 75 ? 'var(--heatmap-75)' : p >= 50 ? 'var(--heatmap-50)' : p > 0 ? 'var(--heatmap-25)' : 'var(--heatmap-0)';
            return <button key={d.toISOString()} type="button" title={`${format(d, 'MMM d')}: ${p}%`} onClick={() => { setDate(d); setTab('overview'); }} className="num" style={{ aspectRatio: '1', borderRadius: 6, border: '1px solid var(--border-color)', background: bg, color: p >= 75 && !future ? 'var(--text-on-accent)' : 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem' }}>{format(d, 'd')}</button>; })}
        </div>
      </section>);
  })();

  const insightsTab = (
    <section className="liquid-panel"><PanelHeader title="Performance (30 days)" />
      {[...habits].sort((a, b) => (stats.get(b.id)?.completionRate30Days || 0) - (stats.get(a.id)?.completionRate30Days || 0)).map((h) => { const r = stats.get(h.id)?.completionRate30Days || 0; return (
        <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 44px', gap: 12, alignItems: 'center', padding: '0.45rem 0' }}><span>{h.name}</span><div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${r}%` }} /></div><span className="num" style={{ textAlign: 'right' }}>{r}%</span></div>); })}
      <p className="subtitle" style={{ fontSize: '0.8rem', marginTop: 10 }}>7-day average {weekAvg}% ({weekAvg - prevAvg >= 0 ? '+' : ''}{weekAvg - prevAvg}% vs previous week).</p>
    </section>
  );

  return (
    <div className="view-container">
      <div className="view-header" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="view-header-title">Habits</h1>
          <p className="view-header-subtitle">Build better habits. A more consistent you.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flex: '1 1 auto', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 0.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', width: 'min(320px, 100%)' }}>
            <Search size={15} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
            <input aria-label="Search habits" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && query && shown.length === 0) setActiveTab?.('insights'); }} placeholder="Search habits, routines, or ask AI…" style={{ flex: 1, background: 'none', border: 0, outline: 'none', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
          </div>
          <button className="btn btn-primary" onClick={() => openEdit(null)}><Plus size={16} /> Add Habit</button>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary btn-icon" aria-label="More habit actions" aria-haspopup="menu" aria-expanded={pageMenu} onClick={() => setPageMenu(!pageMenu)}><MoreVertical size={16} /></button>
            {pageMenu && <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 40, minWidth: 190, background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-elevated)', padding: 4, display: 'flex', flexDirection: 'column' }}>
              {([['Mark all complete', markAll], ['Ask Smart Insights', () => setActiveTab?.('insights')]] as [string, () => void][]).map(([l, fn]) => <button key={l} role="menuitem" className="row-hover" onClick={() => { fn(); setPageMenu(false); }} style={{ textAlign: 'left', padding: '0.45rem 0.7rem', background: 'none', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>{l}</button>)}
            </div>}
          </div>
        </div>
      </div>

      <div className="tabbar" role="tablist" aria-label="Habit sections">
        {TABS.map((t) => <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>{t.icon}{t.label}</button>)}
      </div>

      {tab === 'overview' && (<>
        {summaryCards}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
          {trackerPanel}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{weeklyPanel}{categoriesPanel}{upcomingPanel}</div>
        </div>
      </>)}
      {tab === 'habits' && habitsTab}
      {tab === 'routines' && routinesTab}
      {tab === 'streaks' && streaksTab}
      {tab === 'calendar' && calendarTab}
      {tab === 'insights' && insightsTab}

      <AddHabitModal isOpen={modal} onClose={() => { setModal(false); setEdit(null); }} habitToEdit={edit} />
    </div>
  );
};

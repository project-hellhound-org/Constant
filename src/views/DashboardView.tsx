import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO, isSameDay } from 'date-fns';
import { Calendar, CheckSquare, Clock, Leaf, Plus, Zap, ChevronRight, FileText, Play, Pause, Check, MoreHorizontal, TrendingUp, Square } from 'lucide-react';
import { db, Habit, Task } from '../db/schema';
import { ActiveTab } from '../App';
import { AddHabitModal } from '../components/AddHabitModal';
import { AddTaskModal } from '../components/AddTaskModal';
import { ProgressRing, Delta, PanelHeader, habitIcon, formatHabitTime } from '../components/ui';
import { money, useCurrency } from '../lib/currency';
import { relativeTime } from '../notepad/noteUtils';
import { useFocus, minutesOn, formatMinutes } from '../lib/focus';

interface Props { setActiveTab: (tab: ActiveTab) => void }

type Row = { key: string; title: string; category: string; minutes: number | null; label: string | null; status: 'completed' | 'in_progress' | 'high' | 'medium' | 'low' | 'open'; done: boolean; toggle?: () => void; partial?: number };

const toMinutes = (time?: string | null, amPm?: 'AM' | 'PM'): number | null => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const hh = amPm ? (h % 12) + (amPm === 'PM' ? 12 : 0) : h;
  return hh * 60 + (m || 0);
};
const label12 = (mins: number) => { const h = Math.floor(mins / 60); const m = mins % 60; return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };

const STATUS_CHIP: Record<Row['status'], { text: string; cls: string } | null> = {
  completed: { text: 'Completed', cls: 'chip-success' }, in_progress: { text: 'In Progress', cls: 'chip-warning' },
  high: { text: 'High', cls: 'chip-danger' }, medium: { text: 'Medium', cls: 'chip-warning' }, low: { text: 'Low', cls: 'chip-info' }, open: null,
};

export const DashboardView: React.FC<Props> = ({ setActiveTab }) => {
  const habitsAll = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const logs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const doItems = useLiveQuery(() => db.doItems.toArray()) || [];
  const txs = useLiveQuery(() => db.financeTransactions.toArray()) || [];
  const notes = useLiveQuery(() => db.notes.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('default'));
  const focus = useFocus();
  const [currency] = useCurrency();

  const [habitModal, setHabitModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [habitToEdit] = useState<Habit | null>(null);

  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const habits = habitsAll.filter((h) => !h.paused);
  const userName = settings?.userName || 'there';
  const hr = now.getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

  const data = useMemo(() => {
    const doneOn = (d: string) => habits.filter((h) => logs.some((l) => l.habitId === h.id && l.date === d && l.status === 'completed')).length;
    const habitsDone = doneOn(today), habitsDoneY = doneOn(yesterday);
    const dueToday = tasks.filter((t) => t.dueDate === today && t.status !== 'cancelled');
    const tasksDone = dueToday.filter((t) => t.status === 'completed').length;
    const completedOn = (d: string) => tasks.filter((t) => t.status === 'completed' && (t.completedAt || '').slice(0, 10) === d).length;
    const tasksDoneDelta = completedOn(today) - completedOn(yesterday);
    const totalItems = habits.length + dueToday.length;
    const progress = totalItems ? Math.round(((habitsDone + tasksDone) / totalItems) * 100) : 0;

    // Schedule rows
    const rows: Row[] = [];
    for (const h of habits) {
      const log = logs.find((l) => l.habitId === h.id && l.date === today);
      const done = log?.status === 'completed';
      const m = toMinutes(h.startTime, h.amPm);
      rows.push({ key: `h-${h.id}`, title: h.name, category: h.category, minutes: m, label: m !== null ? label12(m) : null,
        status: done ? 'completed' : log?.status === 'partial' ? 'in_progress' : 'open', done, partial: log?.status === 'partial' ? Math.round((log.value || 0.5) * 100) : undefined,
        toggle: async () => {
          const ex = await db.habitLogs.where('[habitId+date]').equals([h.id, today]).first();
          if (ex) await db.habitLogs.update(ex.id, { status: done ? 'failed' : 'completed', value: done ? 0 : 1, loggedAt: new Date().toISOString() });
          else await db.habitLogs.add({ id: `log-${Date.now()}`, habitId: h.id, date: today, status: 'completed', value: 1, loggedAt: new Date().toISOString() });
        } });
    }
    for (const t of dueToday) {
      const m = toMinutes(t.dueTime);
      rows.push({ key: `t-${t.id}`, title: t.title, category: t.tags?.[0] ? `#${t.tags[0]}` : 'Task', minutes: m, label: m !== null ? label12(m) : null,
        status: t.status === 'completed' ? 'completed' : (t.priority === 'critical' ? 'high' : t.priority) as Row['status'], done: t.status === 'completed',
        toggle: () => db.tasks.update(t.id, { status: t.status === 'completed' ? 'todo' : 'completed', completedAt: t.status === 'completed' ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }) });
    }
    for (const it of doItems.filter((i) => i.scheduledDate === today)) {
      const parent = tasks.find((t) => t.id === it.taskId);
      const m = toMinutes(it.scheduledTime);
      rows.push({ key: `d-${it.id}`, title: it.title, category: parent?.title || 'Task step', minutes: m, label: m !== null ? label12(m) : null,
        status: it.completed ? 'completed' : 'open', done: it.completed,
        toggle: () => db.doItems.update(it.id, { completed: !it.completed, completedAt: it.completed ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }) });
    }
    rows.sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));

    // Consistency: last 7 days; a day counts when at least half of active habits were completed.
    const days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
    const week = days.map((d) => { const ds = format(d, 'yyyy-MM-dd'); const n = doneOn(ds); return { d, ok: habits.length > 0 && n / habits.length >= 0.5 }; });
    const okDays = week.filter((w) => w.ok).length;

    // Task overview
    const crit = tasks.filter((t) => t.priority === 'critical' && t.status !== 'cancelled');
    const open = tasks.filter((t) => !['completed', 'cancelled'].includes(t.status));
    const openIds = new Set(open.map((t) => t.id));
    const openSteps = doItems.filter((i) => openIds.has(i.taskId));
    const allT = tasks.filter((t) => t.status !== 'cancelled');

    // Finance (this month vs last month)
    const inMonth = (d: Date) => txs.filter((x) => { const dt = parseISO(x.date); return dt >= startOfMonth(d) && dt <= endOfMonth(d); });
    const sum = (arr: typeof txs, type: string) => arr.filter((x) => x.type === type).reduce((a, x) => a + x.amount, 0);
    const cur = inMonth(now), prev = inMonth(subMonths(now, 1));
    const income = sum(cur, 'income'), spend = sum(cur, 'expense');
    const pIncome = sum(prev, 'income'), pSpend = sum(prev, 'expense');
    const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

    return {
      habitsDone, habitsDelta: habitsDone - habitsDoneY, tasksTotal: dueToday.length, tasksDone, tasksDoneDelta, progress, rows, week, okDays,
      crit: { done: crit.filter((t) => t.status === 'completed').length, total: crit.length },
      active: { done: openSteps.filter((i) => i.completed).length, total: openSteps.length },
      completed: { done: allT.filter((t) => t.status === 'completed').length, total: allT.length },
      income, spend, savings: income - spend, dIncome: pct(income, pIncome), dSpend: pct(spend, pSpend), dSave: pct(income - spend, pIncome - pSpend),
    };
  }, [habits, logs, tasks, doItems, txs, today, yesterday]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusToday = minutesOn(focus.sessions, today);
  const focusDelta = focusToday - minutesOn(focus.sessions, yesterday);
  const nextUp = data.rows.filter((r) => !r.done && r.minutes !== null && r.minutes >= nowMinutes).slice(0, 3);
  const latestNote = [...notes].filter((n) => n.kind !== 'wishlist').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const activeMin = focus.active ? Math.floor(focus.elapsedMs / 60000) : 0;
  const activeSec = focus.active ? Math.floor((focus.elapsedMs % 60000) / 1000) : 0;

  const bar = (done: number, total: number, color: string) => (
    <div className="progress-bar-track" style={{ height: 8 }} role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total || 1}>
      <div style={{ width: total ? `${(done / total) * 100}%` : 0, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );

  return (
    <div className="view-container">
      {/* 1. Header */}
      <div className="view-header" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="view-header-title">{greeting}, {userName}!</h1>
          <p className="view-header-subtitle">Your day, clearly in view.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn btn-secondary" onClick={() => setTaskModal(true)}><Plus size={16} /> Add Task</button>
          <button className="btn btn-primary" onClick={() => setHabitModal(true)}><Leaf size={16} /> Add Habit</button>
        </div>
      </div>

      {/* 2. Daily overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
        <div className="liquid-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ProgressRing pct={data.progress} size={76} />
          <div><strong style={{ fontSize: '1rem' }}>Today's Progress</strong><div className="subtitle" style={{ fontSize: '0.8rem' }}>{data.progress >= 60 ? "You're on track!" : 'Keep going!'}</div></div>
        </div>
        <div className="liquid-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}><Leaf size={24} /></span>
          <div><strong>Habits</strong><div className="num" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{data.habitsDone} / {habits.length} completed</div><Delta value={data.habitsDelta} text="from yesterday" /></div>
        </div>
        <div className="liquid-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}><CheckSquare size={24} /></span>
          <div><strong>Tasks</strong><div className="num" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{data.tasksDone} / {data.tasksTotal} completed</div><Delta value={data.tasksDoneDelta} text="from yesterday" /></div>
        </div>
        <div className="liquid-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}><Clock size={24} /></span>
          <div><strong>Focus Time</strong><div className="num" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatMinutes(focusToday)}</div><Delta value={focusDelta} suffix="m" text="from yesterday" /></div>
        </div>
      </div>

      {/* 3. Primary activity row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)', gap: '1rem' }}>
        <section className="liquid-panel" aria-label="Today's schedule">
          <PanelHeader icon={<Calendar size={18} />} title={`Today • ${format(now, 'EEEE, MMM d, yyyy')}`} action={{ label: 'View Calendar', onClick: () => setActiveTab('calendar') }} />
          {data.rows.length === 0 ? <p className="subtitle" style={{ padding: '1.25rem 0' }}>Nothing scheduled today. Add a habit or a task to get started.</p> : (
            <ul style={{ listStyle: 'none' }}>
              {data.rows.slice(0, 8).map((r) => {
                const chip = STATUS_CHIP[r.status];
                return (
                  <li key={r.key} className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.7rem 0.5rem', borderTop: '1px solid var(--divider)', borderRadius: 'var(--radius-sm)' }}>
                    {r.partial !== undefined && !r.done
                      ? <button type="button" aria-label={`Mark ${r.title} complete`} className="check-circle" style={{ color: 'var(--accent-primary)' }} onClick={r.toggle}><span style={{ width: 10, height: 10, borderRadius: '50%', background: `conic-gradient(var(--accent-primary) ${r.partial}%, transparent 0)` }} /></button>
                      : <button type="button" role="checkbox" aria-checked={r.done} aria-label={`${r.done ? 'Mark incomplete' : 'Mark complete'}: ${r.title}`} className={`check-circle ${r.done ? 'is-done' : ''}`} onClick={r.toggle}>{r.done && <Check size={14} />}</button>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, textDecoration: r.done ? 'line-through' : 'none', color: r.done ? 'var(--text-muted)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                      <div className="subtitle" style={{ fontSize: '0.75rem' }}>{r.category}</div>
                    </div>
                    <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: '0.82rem', minWidth: 92 }}><Clock size={14} />{r.label ?? 'Anytime'}</span>
                    <span style={{ minWidth: 86, textAlign: 'right' }}>{chip && <span className={`chip ${chip.cls}`}>{chip.text}</span>}</span>
                    <MoreHorizontal size={16} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="liquid-panel" aria-label="Next up">
          <PanelHeader icon={<Zap size={18} />} title="Next up" action={{ label: 'View All', onClick: () => setActiveTab('calendar') }} />
          {nextUp.length === 0 ? <p className="subtitle">No more timed items today.</p> : (
            <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.7rem', position: 'relative' }}>
              {nextUp.map((r) => (
                <li key={r.key} style={{ display: 'grid', gridTemplateColumns: '72px 12px 1fr', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="num" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent-primary)', justifySelf: 'center' }} />
                  <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.title}</div>
                    <div className="subtitle" style={{ fontSize: '0.74rem' }}>{r.category}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* 4. Secondary analytics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <section className="liquid-panel" aria-label="Habit consistency">
          <PanelHeader icon={<TrendingUp size={18} />} title="Habit Consistency" action={{ label: 'View Details', onClick: () => setActiveTab('habits') }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center' }}>
            {data.week.map((w) => (
              <div key={w.d.toISOString()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span className="subtitle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>{format(w.d, 'EEE')}</span>
                <span className={`check-square ${w.ok ? 'is-done' : ''}`} style={{ width: 28, height: 28, cursor: 'default' }} role="img" aria-label={`${format(w.d, 'EEEE')}: ${w.ok ? 'consistent' : 'not consistent'}`}>{w.ok && <Check size={15} />}</span>
              </div>
            ))}
          </div>
          <div className="num" style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)' }}><Leaf size={14} />{data.okDays} of 7 days · {Math.round((data.okDays / 7) * 100)}% consistency</div>
        </section>

        <section className="liquid-panel" aria-label="Task overview">
          <PanelHeader icon={<CheckSquare size={18} />} title="Task Overview" action={{ label: 'View All', onClick: () => setActiveTab('dolist') }} />
          {([['Critical', data.crit, 'var(--danger)'], ['Active', data.active, 'var(--warning)'], ['Completed', data.completed, 'var(--success)']] as const).map(([name, v, color]) => (
            <div key={name} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 48px', alignItems: 'center', gap: '0.7rem', padding: '0.45rem 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.88rem' }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />{name}</span>
              {bar(v.done, v.total, color)}
              <span className="num" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{v.done} / {v.total}</span>
            </div>
          ))}
        </section>

        <section className="liquid-panel" aria-label="Financial snapshot">
          <PanelHeader icon={<Square size={18} />} title="Financial Snapshot" action={{ label: 'View Details', onClick: () => setActiveTab('finance') }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', gap: '0.75rem' }}>
            {[['Income', data.income, data.dIncome], ['Spending', data.spend, data.dSpend], ['Savings', data.savings, data.dSave]].map(([label, val, d], i) => (
              <React.Fragment key={label as string}>
                {i > 0 && <span aria-hidden="true" style={{ background: 'var(--divider)' }} />}
                <div><div className="num" style={{ fontSize: '1.35rem', fontWeight: 700 }}>{money(val as number, currency)}</div><div className="subtitle" style={{ fontSize: '0.8rem' }}>{label}</div>
                  {d !== null && <span className="chip chip-neutral num" style={{ marginTop: 4 }}>{(d as number) >= 0 ? '↑' : '↓'} {Math.abs(d as number)}%</span>}</div>
              </React.Fragment>
            ))}
          </div>
          <p className="subtitle" style={{ fontSize: '0.72rem', marginTop: '0.75rem' }}>This month, compared with last month.</p>
        </section>
      </div>

      {/* 5. Bottom productivity row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1rem' }}>
        <button type="button" className="liquid-panel row-hover" onClick={() => setActiveTab('workspace')} style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left', cursor: 'pointer' }}>
          <FileText size={22} style={{ color: 'var(--text-secondary)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>Recent Notes</strong>
            <div className="subtitle" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {latestNote ? `${latestNote.title || 'Untitled'}${latestNote.tags?.[0] ? ` #${latestNote.tags[0].replace(/^#/, '')}` : ''}` : 'No notes yet. Open Workspace to write one.'}
            </div>
          </div>
          {latestNote && <span className="subtitle num" style={{ fontSize: '0.78rem' }}>{relativeTime(latestNote.updatedAt)}</span>}
          <ChevronRight size={18} aria-hidden="true" />
        </button>

        <div className="liquid-panel" style={{ background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'var(--text-on-accent)', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <button type="button" onClick={focus.toggle} aria-label={focus.active?.running ? 'Pause focus session' : focus.active ? 'Continue focus session' : 'Start focus session'} style={{ background: 'transparent', border: '2px solid currentColor', borderRadius: '50%', width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'inherit' }}>
            {focus.active?.running ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div style={{ flex: 1 }}>
            <strong>{focus.active ? (focus.active.running ? 'Focus Session Running' : 'Continue Focus Session') : 'Start Focus Session'}</strong>
            <div className="num" style={{ fontSize: '0.82rem', opacity: 0.9 }}>
              {focus.active ? `${String(activeMin).padStart(2, '0')}:${String(activeSec).padStart(2, '0')} of ${focus.active.targetMinutes} min` : '25 min'} • {focus.active?.category || 'Deep Work'}
            </div>
          </div>
          {focus.active && <button type="button" className="btn btn-xs" style={{ background: 'transparent', color: 'inherit', border: '1px solid currentColor' }} onClick={focus.finish}>Finish</button>}
        </div>
      </div>

      <AddHabitModal isOpen={habitModal} onClose={() => setHabitModal(false)} habitToEdit={habitToEdit} />
      <AddTaskModal isOpen={taskModal} onClose={() => setTaskModal(false)} />
    </div>
  );
};

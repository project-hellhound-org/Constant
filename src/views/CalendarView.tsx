import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, getDay, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Filter, Play, Plus, Pause } from 'lucide-react';
import { db, Habit, Task } from '../db/schema';
import { DailyReviewPanel } from '../components/DailyReviewPanel';
import { itemsForDate, toggleDoItem } from '../dolist/doService';
import { ProgressRing } from '../components/ui';
import { useFocus } from '../lib/focus';

type View = 'day' | 'week' | 'month' | 'agenda';
type Kind = 'task' | 'habit' | 'event' | 'focus';
type Chip = 'all' | 'task' | 'habit' | 'event' | 'focus' | 'personal' | 'work';
interface CalItem { id: string; kind: Kind; scope: 'work' | 'personal' | null; title: string; desc: string; start: number | null; end: number | null; done: boolean; toggle?: () => void }

const HOUR_H = 52, FIRST_H = 6, LAST_H = 22;
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const mins = (t?: string | null, amPm?: 'AM' | 'PM') => { if (!t) return null; const [h, m] = t.split(':').map(Number); if (Number.isNaN(h)) return null; return (amPm ? (h % 12) + (amPm === 'PM' ? 12 : 0) : h) * 60 + (m || 0); };
const t12 = (m: number) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const kindOf = (title: string): Kind => (/meeting|call|sync|lunch|dinner|family|movie/i.test(title) ? 'event' : /focus|deep|study|course|lab|project/i.test(title) ? 'focus' : 'task');
const KIND_COLOR: Record<Kind, string> = { task: 'var(--chart-1)', habit: 'var(--success)', event: 'var(--chart-5)', focus: 'var(--chart-6)' };
const KIND_LABEL: Record<Kind, string> = { task: 'Task', habit: 'Habit', event: 'Event', focus: 'Focus' };
const scheduledOn = (h: Habit, d: Date) => h.frequencyMode === 'custom' && h.selectedDays?.length ? h.selectedDays.includes(getDay(d)) : true;

export const CalendarView: React.FC = () => {
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const habitsAll = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const logs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const doItems = useLiveQuery(() => db.doItems.toArray()) || [];
  const focus = useFocus();

  const [selected, setSelected] = useState(new Date());
  const [view, setView] = useState<View>('week');
  const [chip, setChip] = useState<Chip>('all');
  const [mini, setMini] = useState(new Date());
  const [note, setNote] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [showDone, setShowDone] = useState(true);

  const habits = habitsAll.filter((h) => !h.paused);
  const today = new Date();
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const itemsOn = (d: Date): CalItem[] => {
    const ds = ymd(d); const out: CalItem[] = [];
    for (const h of habits) {
      if (!scheduledOn(h, d)) continue;
      const log = logs.find((l) => l.habitId === h.id && l.date === ds); const s = mins(h.startTime, h.amPm);
      const dur = (h.subHabits || []).reduce((a, x) => a + (x.estimatedMinutes || 0), 0) || 45;
      out.push({ id: `h-${h.id}`, kind: 'habit', scope: null, title: h.name, desc: h.category, start: s, end: s === null ? null : s + dur, done: log?.status === 'completed',
        toggle: async () => { const ex = await db.habitLogs.where('[habitId+date]').equals([h.id, ds]).first(); if (ex?.status === 'completed') await db.habitLogs.delete(ex.id); else if (ex) await db.habitLogs.update(ex.id, { status: 'completed', value: 1, loggedAt: new Date().toISOString() }); else await db.habitLogs.add({ id: `log-${Date.now()}`, habitId: h.id, date: ds, status: 'completed', value: 1, loggedAt: new Date().toISOString() }); } });
    }
    for (const it of itemsForDate(doItems, ds)) {
      const parent: Task | undefined = taskById.get(it.taskId); const s = mins(it.scheduledTime);
      const cat = (parent?.category || '').toLowerCase();
      out.push({ id: `d-${it.id}`, kind: kindOf(`${it.title} ${parent?.title || ''}`), scope: /work/.test(cat) ? 'work' : /personal|family|health/.test(cat) ? 'personal' : null, title: it.title, desc: parent?.title || 'Task step',
        start: s, end: s === null ? null : s + (it.durationMinutes || 60), done: it.completed, toggle: () => toggleDoItem(it) });
    }
    for (const t of tasks) {
      if (t.dueDate !== ds || t.status === 'cancelled') continue; const s = mins(t.dueTime); const cat = (t.category || '').toLowerCase();
      out.push({ id: `t-${t.id}`, kind: 'task', scope: /work/.test(cat) ? 'work' : /personal|family|health/.test(cat) ? 'personal' : null, title: `Due: ${t.title}`, desc: t.category || 'Task deadline', start: s, end: s === null ? null : s + 30,
        done: t.status === 'completed', toggle: () => db.tasks.update(t.id, { status: t.status === 'completed' ? 'planned' : 'completed', completedAt: t.status === 'completed' ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }) });
    }
    return out.filter((i) => (chip === 'all' || chip === i.kind || chip === i.scope) && (showDone || !i.done)).sort((a, b) => (a.start ?? 9999) - (b.start ?? 9999));
  };

  // Heatmap score (same formula as before the redesign)
  const dayScore = (day: Date) => {
    const d = ymd(day);
    const hDone = logs.filter((l) => l.date === d && l.status === 'completed').length;
    const dayTasks = tasks.filter((t) => t.dueDate === d || t.endDate === d);
    const tDone = tasks.filter((t) => (t.dueDate === d || t.endDate === d || t.completedAt?.startsWith(d)) && t.status === 'completed');
    const hPct = habitsAll.length ? (hDone / habitsAll.length) * 100 : 0;
    const tPct = dayTasks.length ? (tDone.length / dayTasks.length) * 100 : tDone.length ? 80 : 0;
    return Math.min(Math.round(habitsAll.length ? hPct * 0.5 + tPct * 0.5 : tPct), 100);
  };
  const heat = (s: number) => (s === 0 ? 'var(--heatmap-0)' : s <= 30 ? 'var(--heatmap-25)' : s <= 60 ? 'var(--heatmap-50)' : s <= 80 ? 'var(--heatmap-75)' : 'var(--heatmap-100)');

  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const range = view === 'day' ? format(selected, 'MMM d, yyyy') : view === 'month' ? format(selected, 'MMMM yyyy') : `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`;
  const step = (dir: 1 | -1) => setSelected(view === 'day' ? addDays(selected, dir) : view === 'month' ? addMonths(selected, dir) : addDays(selected, 7 * dir));

  const todays = itemsOn(selected);
  const countOf = (k: Kind[]) => { const a = todays.filter((i) => k.includes(i.kind)); return `${a.filter((i) => i.done).length} / ${a.length}`; };
  const all = todays; const pct = all.length ? Math.round((all.filter((i) => i.done).length / all.length) * 100) : 0;
  const focusItem = todays.find((i) => i.kind === 'focus' && !i.done && i.start !== null) || todays.find((i) => i.start !== null && !i.done);
  const nowMin = today.getHours() * 60 + today.getMinutes();

  const grid = (days: Date[]) => {
    const hours = Array.from({ length: LAST_H - FIRST_H + 1 }, (_, i) => FIRST_H + i);
    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${days.length}, minmax(110px, 1fr))`, minWidth: days.length === 1 ? 0 : 760 }}>
          <div />
          {days.map((d) => { const isT = isSameDay(d, today); return (
            <button key={d.toISOString()} type="button" onClick={() => setSelected(d)} style={{ textAlign: 'center', padding: '0.5rem 0', border: 0, borderBottom: '1px solid var(--border-color)', background: isSameDay(d, selected) ? 'var(--accent-soft)' : 'transparent', cursor: 'pointer', color: isT ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{format(d, 'EEE')}</div><div className="num subtitle" style={{ fontSize: '0.75rem' }}>{format(d, 'MMM d')}{isT ? ' · Today' : ''}</div>
            </button>); })}
          <div style={{ position: 'relative', height: hours.length * HOUR_H }}>{hours.map((h) => <div key={h} className="num subtitle" style={{ position: 'absolute', top: (h - FIRST_H) * HOUR_H - 7, right: 8, fontSize: '0.7rem' }}>{t12(h * 60).replace(':00', '')}</div>)}</div>
          {days.map((d) => {
            const timed = itemsOn(d).filter((i) => i.start !== null); const lanes: number[] = []; const lane = new Map<string, number>();
            for (const it of timed) { let l = lanes.findIndex((e) => e <= (it.start as number)); if (l === -1) { l = lanes.length; lanes.push(0); } lanes[l] = it.end as number; lane.set(it.id, l); }
            const n = Math.max(1, lanes.length);
            return (
              <div key={d.toISOString()} style={{ position: 'relative', height: hours.length * HOUR_H, borderLeft: '1px solid var(--divider)', backgroundImage: `repeating-linear-gradient(to bottom, var(--divider) 0, var(--divider) 1px, transparent 1px, transparent ${HOUR_H}px)`, background: undefined }}>
                {hours.map((h) => <div key={h} aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: (h - FIRST_H) * HOUR_H, borderTop: '1px solid var(--divider)' }} />)}
                {isSameDay(d, today) && nowMin >= FIRST_H * 60 && nowMin <= (LAST_H + 1) * 60 && <div aria-label={`Current time ${t12(nowMin)}`} style={{ position: 'absolute', left: 0, right: 0, top: ((nowMin - FIRST_H * 60) / 60) * HOUR_H, borderTop: '2px solid var(--danger)', zIndex: 3 }}><span className="num" style={{ position: 'absolute', right: 2, top: -9, fontSize: '0.62rem', background: 'var(--danger)', color: 'var(--bg-primary)', padding: '0 4px', borderRadius: 3 }}>{t12(nowMin)}</span></div>}
                {timed.map((it) => { const top = (((it.start as number) - FIRST_H * 60) / 60) * HOUR_H; const h = Math.max((((it.end as number) - (it.start as number)) / 60) * HOUR_H - 2, 26); const l = lane.get(it.id) || 0;
                  if (top < 0 || top > hours.length * HOUR_H) return null;
                  return (
                    <button key={it.id} type="button" onClick={it.toggle} aria-label={`${KIND_LABEL[it.kind]}: ${it.title}, ${t12(it.start as number)} to ${t12(it.end as number)}${it.done ? ', completed' : ''}. Toggle completion`}
                      style={{ position: 'absolute', top, height: h, left: `calc(${(l / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, overflow: 'hidden', textAlign: 'left', padding: '3px 6px', borderRadius: 6, cursor: 'pointer', zIndex: 2, borderLeft: `3px solid ${KIND_COLOR[it.kind]}`, border: `1px solid color-mix(in srgb, ${KIND_COLOR[it.kind]} 40%, transparent)`, borderLeftWidth: 3, background: `color-mix(in srgb, ${KIND_COLOR[it.kind]} 12%, var(--bg-surface))`, color: 'var(--text-primary)', fontSize: '0.72rem', opacity: it.done ? 0.7 : 1 }}>
                      <div style={{ fontWeight: 700, textDecoration: it.done ? 'line-through' : 'none', display: 'flex', gap: 4, alignItems: 'center' }}>{it.done && <Check size={11} />}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span></div>
                      <div className="num subtitle" style={{ fontSize: '0.66rem' }}>{t12(it.start as number)} – {t12(it.end as number)}</div>
                    </button>); })}
              </div>); })}
        </div>
      </div>);
  };

  const monthGrid = (() => {
    const start = startOfWeek(startOfMonth(selected), { weekStartsOn: 1 }); const days = eachDayOfInterval({ start, end: endOfWeek(endOfMonth(selected), { weekStartsOn: 1 }) });
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="subtitle" style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600 }}>{d}</div>)}
        {days.map((d) => { const sc = dayScore(d); const inM = isSameMonth(d, selected); return (
          <button key={d.toISOString()} type="button" onClick={() => { setSelected(d); setView('day'); }} title={`${format(d, 'MMM d')}: ${sc}% activity`} style={{ minHeight: 74, padding: 8, textAlign: 'left', borderRadius: 8, cursor: 'pointer', border: isSameDay(d, selected) ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', background: inM ? heat(sc) : 'var(--surface-sunken)', opacity: inM ? 1 : 0.5, color: sc > 60 && inM ? 'var(--text-on-accent)' : 'var(--text-primary)' }}>
            <div className="num" style={{ fontWeight: isSameDay(d, today) ? 800 : 600 }}>{format(d, 'd')}{isSameDay(d, today) ? ' · Today' : ''}</div><div className="num" style={{ fontSize: '0.7rem', marginTop: 4 }}>{sc}%</div>
          </button>); })}
      </div>);
  })();

  const agendaList = (days: Date[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {days.map((d) => { const its = itemsOn(d); if (!its.length) return null; return (
        <section key={d.toISOString()} aria-label={format(d, 'EEEE, MMM d')}><h4 style={{ fontSize: '0.9rem', marginBottom: 6 }}>{format(d, 'EEEE, MMM d')}</h4>{its.map((i) => rowFor(i))}</section>); })}
    </div>);

  const rowFor = (i: CalItem) => (
    <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '70px 12px 1fr 24px', alignItems: 'center', gap: 10, padding: '0.5rem 0', borderTop: '1px solid var(--divider)' }}>
      <span className="num subtitle" style={{ fontSize: '0.76rem' }}>{i.start !== null ? t12(i.start) : 'Anytime'}</span>
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: KIND_COLOR[i.kind] }} />
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: '0.88rem', textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>{i.title}</div><div className="subtitle" style={{ fontSize: '0.74rem' }}>{KIND_LABEL[i.kind]} · {i.desc}</div></div>
      <button type="button" role="checkbox" aria-checked={i.done} aria-label={`${i.done ? 'Mark incomplete' : 'Mark complete'}: ${i.title}`} className={`check-circle ${i.done ? 'is-done' : ''}`} style={{ width: 20, height: 20 }} onClick={i.toggle}>{i.done && <Check size={12} />}</button>
    </div>);

  const miniDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(mini), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(mini), { weekStartsOn: 0 }) });
  const CHIPS: [Chip, string][] = [['all', 'All'], ['task', 'Tasks'], ['habit', 'Habits'], ['event', 'Events'], ['focus', 'Focus'], ['personal', 'Personal'], ['work', 'Work']];
  const running = focus.active?.running;

  return (
    <div className="view-container">
      <div className="view-header" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="subtitle" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}><CalendarIcon size={13} /> CALENDAR</div>
          <h1 className="view-header-title" style={{ fontSize: '2.1rem' }}>Organize Your Day, Your Way.</h1>
          <p className="view-header-subtitle">Bring together your tasks, habits, and important events in a single, unified timeline.</p>
        </div>
        <blockquote style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: 12, maxWidth: 220, fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>“Discipline turns plans into reality.”</blockquote>
      </div>

      {/* Daily Review stays pinned near the top of the Calendar */}
      <DailyReviewPanel dateStr={ymd(selected)} onDateChange={(d) => { setSelected(parseISO(d)); setMini(parseISO(d)); }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => setSelected(new Date())}>Today</button>
        <button className="btn btn-secondary btn-icon" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft size={16} /></button>
        <button className="btn btn-secondary btn-icon" aria-label="Next" onClick={() => step(1)}><ChevronRight size={16} /></button>
        <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.9rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', fontWeight: 600, fontSize: '0.88rem' }}><CalendarIcon size={15} />{range}<ChevronDown size={14} /></span>
        <div role="radiogroup" aria-label="Calendar view" style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginLeft: 'auto' }}>
          {(['day', 'week', 'month', 'agenda'] as View[]).map((v) => <button key={v} type="button" role="radio" aria-checked={view === v} className="btn btn-xs" style={{ borderRadius: 0, height: 38, background: view === v ? 'var(--accent-primary)' : 'var(--bg-surface)', color: view === v ? 'var(--text-on-accent)' : 'var(--text-primary)' }} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-secondary" aria-haspopup="menu" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}><Filter size={15} /> Filter</button>
          {filterOpen && <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 40, minWidth: 200, background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-elevated)', padding: '0.6rem 0.8rem' }}>
            <label style={{ display: 'flex', gap: 8, fontSize: '0.85rem', alignItems: 'center' }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed items</label></div>}
        </div>
      </div>

      <div className="tabbar" role="group" aria-label="Calendar categories">
        {CHIPS.map(([c, l]) => <button key={c} type="button" aria-pressed={chip === c} className={`tab ${chip === c ? 'is-active' : ''}`} onClick={() => setChip(c)}>{l}</button>)}
        <button type="button" className="tab" onClick={() => setNote('Additional calendars are not supported yet — tasks, habits and steps already appear here.')}><Plus size={14} /> Add Calendar</button>
      </div>
      {note && <p role="status" className="chip chip-info" style={{ alignSelf: 'flex-start' }}>{note}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1rem', alignItems: 'start' }}>
        <section className="liquid-panel" aria-label="Calendar" style={{ padding: '0.75rem' }}>
          {view === 'week' && grid(weekDays)}
          {view === 'day' && grid([selected])}
          {view === 'month' && monthGrid}
          {view === 'agenda' && agendaList(Array.from({ length: 14 }, (_, i) => addDays(today, i)))}
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section className="liquid-panel" aria-label="Today summary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h3 className="panel-title">{isSameDay(selected, today) ? 'Today' : format(selected, 'EEEE')}</h3><div className="subtitle" style={{ fontSize: '0.8rem' }}>{format(selected, 'EEEE, MMMM d, yyyy')}</div></div>
              <div style={{ display: 'flex', gap: 4 }}><button className="btn btn-secondary btn-icon" aria-label="Previous day" onClick={() => setSelected(subDays(selected, 1))}><ChevronLeft size={14} /></button><button className="btn btn-secondary btn-icon" aria-label="Next day" onClick={() => setSelected(addDays(selected, 1))}><ChevronRight size={14} /></button></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 10 }}>
              <ProgressRing pct={pct} size={84} />
              <ul style={{ listStyle: 'none', fontSize: '0.85rem' }}>{([['Tasks', ['task'] as Kind[]], ['Habits', ['habit'] as Kind[]], ['Events', ['event', 'focus'] as Kind[]]] as [string, Kind[]][]).map(([l, k]) => <li key={l} className="num" style={{ padding: '2px 0' }}><strong>{countOf(k)}</strong> {l}</li>)}</ul>
            </div>
          </section>

          <section className="liquid-panel" aria-label="Focus block" style={{ background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85 }}>FOCUS BLOCK</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, margin: '2px 0' }}>{focusItem?.title || 'Deep Work'}</div>
            <div className="num" style={{ fontSize: '0.85rem', opacity: 0.9 }}>{focusItem?.start != null ? `${t12(focusItem.start)} – ${t12(focusItem.end as number)}` : 'No time set'}</div>
            <button className="btn" style={{ marginTop: 12, background: 'var(--bg-surface)', color: 'var(--text-primary)' }} onClick={() => { if (focus.active) focus.toggle(); else focus.start(focusItem?.title || 'Deep Work', focusItem?.start != null ? Math.max(5, Math.round(((focusItem.end as number) - focusItem.start) )) : 25); }}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? 'Pause Focus' : focus.active ? 'Resume Focus' : 'Start Focus'}</button>
          </section>

          <section className="liquid-panel" aria-label="Mini calendar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>{format(mini, 'MMMM yyyy')}</strong>
              <div style={{ display: 'flex', gap: 4 }}><button className="btn btn-secondary btn-icon" aria-label="Previous month" onClick={() => setMini(addMonths(mini, -1))}><ChevronLeft size={14} /></button><button className="btn btn-secondary btn-icon" aria-label="Next month" onClick={() => setMini(addMonths(mini, 1))}><ChevronRight size={14} /></button></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', fontSize: '0.75rem' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="subtitle" style={{ fontWeight: 600 }}>{d}</span>)}
              {miniDays.map((d) => <button key={d.toISOString()} type="button" aria-label={format(d, 'EEEE, MMMM d')} aria-current={isSameDay(d, selected) ? 'date' : undefined} onClick={() => { setSelected(d); setMini(d); }} className="num" style={{ height: 28, borderRadius: '50%', border: 0, cursor: 'pointer', background: isSameDay(d, selected) ? 'var(--accent-primary)' : 'transparent', color: isSameDay(d, selected) ? 'var(--text-on-accent)' : isSameMonth(d, mini) ? 'var(--text-primary)' : 'var(--text-disabled)', fontWeight: isSameDay(d, today) ? 800 : 500, outline: isSameDay(d, today) ? '1px solid var(--accent-primary)' : 'none' }}>{format(d, 'd')}</button>)}
            </div>
          </section>

          <section className="liquid-panel" aria-label="Today's overview" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ProgressRing pct={pct} size={64} />
            <div style={{ fontSize: '0.85rem' }}><strong style={{ display: 'block', marginBottom: 2 }}>Today's Overview</strong><span className="num">{countOf(['task'])} Tasks · {countOf(['habit'])} Habits · {countOf(['event', 'focus'])} Events</span></div>
          </section>
        </aside>
      </div>

    </div>
  );
};

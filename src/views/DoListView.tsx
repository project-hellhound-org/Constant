import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Calendar, Check, ChevronDown, ChevronRight, Edit3, Info, List, ListFilter, LayoutGrid, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import { db, Task } from '../db/schema';
import { AddTaskModal } from '../components/AddTaskModal';
import { DoItemList } from '../dolist/DoItemList';
import { deleteTaskWithItems, setTaskCompleted, summarizeDoItems, syncTaskStatus } from '../dolist/doService';
import { ProgressRing } from '../components/ui';

type Filter = 'all' | 'today' | 'upcoming' | 'completed' | 'high' | 'personal';
type View = 'list' | 'board';
type Sort = 'due' | 'priority' | 'created';
const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_CHIP: Record<string, string> = { critical: 'chip-danger', high: 'chip-danger', medium: 'chip-warning', low: 'chip-info' };
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const DoListView: React.FC = () => {
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const items = useLiveQuery(() => db.doItems.toArray()) || [];

  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<View>('list');
  const [sort, setSort] = useState<Sort>('due');
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [tagDraft, setTagDraft] = useState<string | null>(null);

  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const byTask = useMemo(() => { const m = new Map<string, typeof items>(); items.forEach((i) => m.set(i.taskId, [...(m.get(i.taskId) ?? []), i])); return m; }, [items]);
  const live = tasks.filter((t) => t.status !== 'cancelled');
  const isDone = (t: Task) => t.status === 'completed';

  const preds: Record<Filter, (t: Task) => boolean> = {
    all: () => true,
    today: (t) => !isDone(t) && (t.dueDate === todayIso || (byTask.get(t.id) ?? []).some((i) => i.scheduledDate === todayIso && !i.completed)),
    upcoming: (t) => !isDone(t) && !!t.dueDate && t.dueDate > todayIso,
    completed: isDone,
    high: (t) => !isDone(t) && (t.priority === 'high' || t.priority === 'critical'),
    personal: (t) => (t.category || '').toLowerCase() === 'personal',
  };
  const FILTERS: [Filter, string][] = [['all', 'All Tasks'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['completed', 'Completed'], ['high', 'High Priority'], ['personal', 'Personal']];
  const count = (f: Filter) => live.filter(preds[f]).length;

  const q = query.trim().toLowerCase();
  const visible = live.filter(preds[filter]).filter((t) => !q || `${t.title} ${t.description || ''} ${(t.tags || []).join(' ')} ${(byTask.get(t.id) ?? []).map((i) => i.title).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => sort === 'priority' ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

  const selected = tasks.find((t) => t.id === selectedId) || null;
  const sel = selected ? summarizeDoItems(byTask.get(selected.id) ?? []) : null;
  const todayDone = live.filter((t) => isDone(t) && (t.completedAt || '').slice(0, 10) === todayIso).length;
  const todayDue = live.filter((t) => t.dueDate === todayIso || ((t.completedAt || '').slice(0, 10) === todayIso)).length;
  const todayPct = todayDue ? Math.round((todayDone / todayDue) * 100) : 0;

  const patch = (id: string, p: Partial<Task>) => db.tasks.update(id, { ...p, updatedAt: new Date().toISOString() });
  const remove = async (t: Task) => { const n = byTask.get(t.id)?.length ?? 0; if (confirm(`Delete "${t.title}"${n ? ` and its ${n} subtask${n === 1 ? '' : 's'}` : ''}?`)) { await deleteTaskWithItems(t.id); if (selectedId === t.id) setSelectedId(null); } };
  const openEdit = (t: Task | null) => { setTaskToEdit(t); setModal(true); setMenuFor(null); };
  const toggleExpand = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const card = (t: Task) => {
    const mine = byTask.get(t.id) ?? []; const pr = summarizeDoItems(mine); const done = isDone(t); const open = expanded.has(t.id);
    const overdue = !done && !!t.dueDate && t.dueDate < todayIso;
    return (
      <article key={t.id} aria-label={t.title} className="liquid-panel" onClick={() => setSelectedId(t.id)} style={{ padding: '1rem 1.1rem', cursor: 'pointer', borderColor: selectedId === t.id ? 'var(--accent-primary)' : undefined, borderLeftWidth: selectedId === t.id ? 3 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <button type="button" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${t.title}`} className="link-action" style={{ padding: 2, marginTop: 2 }} onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
          <button type="button" role="checkbox" aria-checked={done} aria-label={`${done ? 'Reopen' : 'Complete'} task ${t.title}`} className={`check-square ${done ? 'is-done' : ''}`} style={{ marginTop: 2 }} onClick={(e) => { e.stopPropagation(); setTaskCompleted(t.id, !done); }}>{done && <Check size={14} />}</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>{t.title}</strong>
              {pr.total > 0 && <span className="num subtitle" style={{ fontSize: '0.8rem' }}>{pr.done}/{pr.total}</span>}
              {done && <span className="chip chip-success"><Check size={11} /> Completed</span>}
              {overdue && <span className="chip chip-danger">Overdue</span>}
            </div>
            {t.description && <p className="subtitle" style={{ fontSize: '0.84rem', margin: '2px 0 6px' }}>{t.description}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className={`chip ${PRIORITY_CHIP[t.priority]}`}>{title(t.priority)}</span>
              {t.category && <span className="chip chip-neutral">{t.category}</span>}
              {t.dueDate && <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: overdue ? 'var(--danger)' : 'var(--text-secondary)' }}><Calendar size={13} />{format(new Date(`${t.dueDate}T00:00`), 'MMM d, yyyy')}</span>}
            </div>
          </div>
          <div style={{ width: 120, paddingTop: 6 }} aria-hidden={pr.total === 0}>{pr.total > 0 && <div className="progress-bar-track" role="progressbar" aria-valuenow={pr.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.title} progress`}><div className="progress-bar-fill" style={{ width: `${pr.pct}%` }} /></div>}</div>
          <div style={{ position: 'relative' }}>
            <button type="button" className="link-action" aria-label={`More actions for ${t.title}`} aria-haspopup="menu" aria-expanded={menuFor === t.id} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === t.id ? null : t.id); }}><MoreHorizontal size={18} /></button>
            {menuFor === t.id && (
              <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 30, minWidth: 160, background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-elevated)', padding: 4, display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                {([['Edit', () => openEdit(t)], [done ? 'Reopen' : 'Mark complete', () => setTaskCompleted(t.id, !done)], ['Delete', () => remove(t)]] as [string, () => void][]).map(([l, fn]) => <button key={l} role="menuitem" className="row-hover" onClick={() => { fn(); setMenuFor(null); }} style={{ textAlign: 'left', padding: '0.45rem 0.7rem', background: 'none', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: l === 'Delete' ? 'var(--danger)' : 'var(--text-primary)' }}>{l}</button>)}
              </div>
            )}
          </div>
        </div>
        {open && <div style={{ marginTop: 10, marginLeft: 44 }} onClick={(e) => e.stopPropagation()}><DoItemList taskId={t.id} hideHeader /></div>}
      </article>
    );
  };

  const board = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
      {([['Planned', (t: Task) => ['planned', 'todo', 'backlog', 'remaining', 'deferred'].includes(t.status)], ['In progress', (t: Task) => t.status === 'in_progress' || t.status === 'overdue'], ['Done', isDone]] as [string, (t: Task) => boolean][]).map(([label, p]) => (
        <section key={label} aria-label={label}><h3 className="panel-title" style={{ marginBottom: 8 }}>{label} <span className="chip chip-neutral num">{visible.filter(p).length}</span></h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{visible.filter(p).map(card)}</div></section>
      ))}
    </div>
  );

  return (
    <div className="view-container">
      <div className="view-header" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="view-header-title">Tasks</h1>
          <p className="view-header-subtitle">Break down big goals into actionable steps. Complete subtasks to finish your tasks.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 0.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', width: 'min(300px, 100%)' }}>
            <Search size={15} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
            <input aria-label="Search tasks, subtasks and tags" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks, subtasks, tags…" style={{ flex: 1, background: 'none', border: 0, outline: 'none', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
          </div>
          <div role="radiogroup" aria-label="Task view" style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {([['list', 'List', <List size={14} key="l" />], ['board', 'Board', <LayoutGrid size={14} key="b" />]] as [View, string, React.ReactNode][]).map(([v, l, ic]) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} className="btn btn-xs" style={{ borderRadius: 0, background: view === v ? 'var(--accent-primary)' : 'var(--bg-surface)', color: view === v ? 'var(--text-on-accent)' : 'var(--text-primary)', height: 38 }} onClick={() => setView(v)}>{ic}{l}</button>))}
          </div>
          <div style={{ position: 'relative' }}>
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Sort and filter" aria-haspopup="menu" aria-expanded={sortOpen} onClick={() => setSortOpen(!sortOpen)} style={{ height: 40 }}><ListFilter size={16} /></button>
            {sortOpen && <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 40, minWidth: 180, background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-elevated)', padding: 4 }}>
              {([['due', 'Sort by due date'], ['priority', 'Sort by priority'], ['created', 'Sort by newest']] as [Sort, string][]).map(([s, l]) => <button key={s} role="menuitemradio" aria-checked={sort === s} className="row-hover" onClick={() => { setSort(s); setSortOpen(false); }} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0.45rem 0.7rem', background: 'none', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>{l}{sort === s && <Check size={14} />}</button>)}
            </div>}
          </div>
          <button className="btn btn-primary" onClick={() => openEdit(null)}><Plus size={16} /> New Task</button>
        </div>
      </div>

      <div className="tabbar" role="tablist" aria-label="Task filters">
        {FILTERS.map(([id, label]) => <button key={id} role="tab" type="button" aria-selected={filter === id} className="tab" onClick={() => setFilter(id)}>{label} <span className="num chip chip-neutral" style={{ padding: '0 .45rem' }}>{count(id)}</span></button>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(300px, 1fr)', gap: '1rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tasks.length === 0 ? (
            <div className="liquid-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <h3 style={{ fontSize: '1.3rem' }}>No tasks yet</h3>
              <p className="subtitle" style={{ maxWidth: 420, margin: '0.5rem auto 1.25rem' }}>Add a task, then break it into subtasks. The task completes itself when every subtask is done.</p>
              <button className="btn btn-primary" onClick={() => openEdit(null)}><Plus size={16} /> Add first task</button>
            </div>
          ) : visible.length === 0 ? <div className="liquid-panel subtitle" style={{ textAlign: 'center' }}>Nothing matches this filter.</div>
            : view === 'board' ? board : visible.map(card)}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} aria-label="Task details">
          <section className="liquid-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ProgressRing pct={todayPct} size={64} />
            <div><strong>Today's Progress</strong><div className="subtitle num" style={{ fontSize: '0.82rem' }}>{todayDone} / {todayDue} completed</div></div>
          </section>

          {!selected ? <section className="liquid-panel subtitle" style={{ textAlign: 'center' }}>Select a task to see its details.</section> : (<>
            <section className="liquid-panel" aria-label="Task inspector">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <input key={`t-${selected.id}-${selected.updatedAt}`} aria-label="Task name" className="form-input" defaultValue={selected.title} style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 600, border: 'transparent', background: 'transparent', paddingLeft: 0 }}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== selected.title) patch(selected.id, { title: v }); }} />
                <button className="btn btn-secondary btn-xs" onClick={() => openEdit(selected)}><Edit3 size={13} /> Edit</button>
              </div>
              <textarea key={`d-${selected.id}-${selected.updatedAt}`} aria-label="Task description" className="form-textarea" rows={2} defaultValue={selected.description || ''} placeholder="Add a description" style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
                onBlur={(e) => { if (e.target.value !== (selected.description || '')) patch(selected.id, { description: e.target.value }); }} />
              <dl style={{ display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 10, alignItems: 'center', fontSize: '0.85rem' }}>
                <dt className="subtitle">Priority</dt>
                <dd><select aria-label="Priority" className="form-select" value={selected.priority} onChange={(e) => patch(selected.id, { priority: e.target.value as Task['priority'] })}>{['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{title(p)}</option>)}</select></dd>
                <dt className="subtitle">Category</dt>
                <dd><input aria-label="Category" className="form-input" list="task-category-options-inspector" defaultValue={selected.category || ''} key={`c-${selected.id}`} placeholder="e.g. Learning" onBlur={(e) => patch(selected.id, { category: e.target.value.trim() || undefined })} /><datalist id="task-category-options-inspector">{['Learning', 'Work', 'Health', 'Personal'].map((c) => <option key={c} value={c} />)}</datalist></dd>
                <dt className="subtitle">Due Date</dt>
                <dd><input aria-label="Due date" type="date" className="form-input" value={selected.dueDate || ''} onChange={(e) => patch(selected.id, { dueDate: e.target.value || undefined })} /></dd>
                <dt className="subtitle">Status</dt>
                <dd>{isDone(selected) ? <span className="chip chip-success"><Check size={11} /> Completed</span> : <span className="chip chip-warning">{title(selected.status.replace('_', ' '))}</span>}</dd>
                <dt className="subtitle">Tags</dt>
                <dd style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(selected.tags || []).map((g) => <span key={g} className="chip chip-neutral">#{g}<button type="button" aria-label={`Remove tag ${g}`} className="link-action" style={{ padding: 0 }} onClick={() => patch(selected.id, { tags: (selected.tags || []).filter((x) => x !== g) })}><X size={11} /></button></span>)}
                  {tagDraft === null ? <button type="button" className="btn btn-secondary btn-xs" aria-label="Add tag" onClick={() => setTagDraft('')}><Plus size={12} /></button>
                    : <input autoFocus aria-label="New tag" className="form-input" style={{ width: 110, minHeight: 28, padding: '0.15rem 0.5rem' }} value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { const v = tagDraft.trim().replace(/^#/, ''); if (v && !(selected.tags || []).includes(v)) patch(selected.id, { tags: [...(selected.tags || []), v] }); setTagDraft(null); } if (e.key === 'Escape') setTagDraft(null); }} onBlur={() => setTagDraft(null)} />}
                </dd>
              </dl>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Progress</div>
                <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${sel?.pct || 0}%` }} /></div>
                <div className="num subtitle" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: 4 }}><span>{sel?.done || 0} / {sel?.total || 0} subtasks completed</span><span>{sel?.pct || 0}%</span></div>
              </div>
            </section>

            <section className="liquid-panel" aria-label="Subtasks">
              <h3 className="panel-title" style={{ marginBottom: 8 }}>Subtasks ({sel?.total || 0})</h3>
              <DoItemList taskId={selected.id} hideHeader placeholder="Add subtask…" />
            </section>

            <section className="liquid-panel" aria-label="Completion behavior">
              <h3 className="panel-title" style={{ fontSize: '0.95rem' }}>Completion Behavior <Info size={14} aria-hidden="true" style={{ color: 'var(--text-muted)' }} /></h3>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                <span>Mark this task as completed when all subtasks are completed.</span>
                <input type="checkbox" role="switch" aria-label="Auto-complete when all subtasks are completed" checked={selected.autoComplete !== false}
                  onChange={async (e) => { await patch(selected.id, { autoComplete: e.target.checked }); if (e.target.checked) await syncTaskStatus(selected.id); }} style={{ width: 38, height: 20 }} />
              </label>
            </section>
          </>)}
        </aside>
      </div>

      <AddTaskModal isOpen={modal} onClose={() => setModal(false)} taskToEdit={taskToEdit} />
    </div>
  );
};

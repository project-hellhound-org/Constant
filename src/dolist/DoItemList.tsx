import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { db, DoItem } from '../db/schema';
import { addDoItem, deleteDoItem, scheduleDoItem, summarizeDoItems, toggleDoItem } from './doService';

const whenLabel = (i: DoItem): string | null => {
  if (!i.scheduledDate) return null;
  const d = parseISO(i.scheduledDate);
  const day = isValid(d) ? format(d, 'MMM d') : i.scheduledDate;
  return i.scheduledTime ? `${day} · ${i.scheduledTime}` : day;
};

interface Props {
  taskId: string;
  /** Hide the progress header when the parent already shows it. */
  hideHeader?: boolean;
  placeholder?: string;
}

/**
 * The Do-List of one task: checklist steps that can optionally be scheduled.
 * Single component used everywhere a task's steps are shown or edited.
 */
export const DoItemList: React.FC<Props> = ({ taskId, hideHeader, placeholder = 'Add a step…' }) => {
  const items = useLiveQuery(() => db.doItems.where('taskId').equals(taskId).sortBy('order'), [taskId]) || [];
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const progress = summarizeDoItems(items);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await addDoItem(taskId, { title, scheduledDate: date, scheduledTime: time });
    setTitle('');
    setDate('');
    setTime('');
    setShowSchedule(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {!hideHeader && items.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            <span>Do-List ({progress.done}/{progress.total})</span>
            <strong style={{ color: progress.pct === 100 ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>{progress.pct}%</strong>
          </div>
          <div className="progress-bar-track" style={{ height: '6px' }}>
            <div className="progress-bar-fill" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {items.map((item) => {
          const when = whenLabel(item);
          return (
            <li key={item.id} style={{ padding: '0.45rem 0.65rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <button type="button" aria-label={item.completed ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`} aria-pressed={item.completed} onClick={() => toggleDoItem(item)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {item.completed ? <CheckCircle2 size={18} style={{ color: 'var(--accent-secondary)' }} /> : <Circle size={18} style={{ color: 'var(--text-muted)' }} />}
                </button>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.completed ? 'line-through' : 'none' }}>{item.title}</span>
                {when && <span style={{ fontSize: '0.7rem', color: 'var(--accent-secondary)', background: 'var(--accent-soft)', padding: '0.1rem 0.45rem', borderRadius: 10, whiteSpace: 'nowrap' }}>{when}</span>}
                <button type="button" className="btn btn-icon btn-xs" aria-label={`Schedule "${item.title}"`} aria-expanded={editingId === item.id} onClick={() => setEditingId(editingId === item.id ? null : item.id)} style={{ padding: 2, color: item.scheduledDate ? 'var(--accent-secondary)' : 'var(--text-muted)' }}>
                  <CalendarClock size={14} />
                </button>
                <button type="button" className="btn btn-icon btn-xs" aria-label={`Delete "${item.title}"`} onClick={() => deleteDoItem(item)} style={{ padding: 2, color: 'var(--danger)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
              {editingId === item.id && (
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  <input type="date" aria-label="Scheduled date" className="form-input" style={{ width: 'auto', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} value={item.scheduledDate ?? ''} onChange={(e) => scheduleDoItem(item, e.target.value, item.scheduledTime)} />
                  <input type="time" aria-label="Scheduled time" className="form-input" style={{ width: 'auto', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} disabled={!item.scheduledDate} value={item.scheduledTime ?? ''} onChange={(e) => scheduleDoItem(item, item.scheduledDate, e.target.value)} />
                  {item.scheduledDate && <button type="button" className="btn btn-secondary btn-xs" onClick={() => scheduleDoItem(item)}>Clear</button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={submit} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ flex: '1 1 160px', fontSize: '0.85rem' }} placeholder={placeholder} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New Do-List step" />
        {showSchedule && (
          <>
            <input type="date" aria-label="New step date" className="form-input" style={{ width: 'auto', fontSize: '0.78rem' }} value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" aria-label="New step time" className="form-input" style={{ width: 'auto', fontSize: '0.78rem' }} disabled={!date} value={time} onChange={(e) => setTime(e.target.value)} />
          </>
        )}
        <button type="button" className="btn btn-icon btn-xs" aria-label="Toggle scheduling for new step" aria-pressed={showSchedule} onClick={() => setShowSchedule((v) => !v)} style={{ color: showSchedule ? 'var(--accent-secondary)' : 'var(--text-muted)' }}>
          <CalendarClock size={16} />
        </button>
        <button type="submit" className="btn btn-primary btn-xs" disabled={!title.trim()}><Plus size={14} /> Add</button>
      </form>
    </div>
  );
};

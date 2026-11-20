import React, { useEffect, useState } from 'react';
<<<<<<< HEAD
import { TimeListEditor } from '../notifications/TimeListEditor';
import { sortTimes } from '../notifications/schedule';
=======
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
import { format } from 'date-fns';
import { Sparkles, X } from 'lucide-react';
import { db, Habit, SubHabit } from '../db/schema';
import { HABIT_CATEGORIES, normalizeHabitCategory, parseSubTopics } from '../engine/habitCategories';

interface AddHabitModalProps { isOpen: boolean; onClose: () => void; habitToEdit?: Habit | null }

const DAYS = [{ label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 }];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** One panel: name, category, sub-topics (single input), start date + time, frequency. */
export const AddHabitModal: React.FC<AddHabitModalProps> = ({ isOpen, onClose, habitToEdit }) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Health');
  const [subText, setSubText] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [time, setTime] = useState('08:00');
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [frequencyMode, setFrequencyMode] = useState<'everyday' | 'custom'>('everyday');
  const [selectedDays, setSelectedDays] = useState<number[]>(ALL_DAYS);
<<<<<<< HEAD
  const [reminders, setReminders] = useState<string[]>([]);
=======
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e

  useEffect(() => {
    if (habitToEdit) {
      setName(habitToEdit.name || ''); setCategory(normalizeHabitCategory(habitToEdit.category));
      setSubText((habitToEdit.subHabits || []).map((s) => s.title).join('\n'));
      setStartDate(habitToEdit.startDate || todayStr); setTime(habitToEdit.startTime || '08:00'); setAmPm(habitToEdit.amPm || 'AM');
      setFrequencyMode(habitToEdit.frequencyMode === 'custom' ? 'custom' : 'everyday'); setSelectedDays(habitToEdit.selectedDays?.length ? habitToEdit.selectedDays : ALL_DAYS);
<<<<<<< HEAD
      setReminders(habitToEdit.reminderTimes || []);
    } else {
      setName(''); setCategory('Health'); setSubText(''); setStartDate(todayStr); setTime('08:00'); setAmPm('AM'); setFrequencyMode('everyday'); setSelectedDays(ALL_DAYS); setReminders([]);
=======
    } else {
      setName(''); setCategory('Health'); setSubText(''); setStartDate(todayStr); setTime('08:00'); setAmPm('AM'); setFrequencyMode('everyday'); setSelectedDays(ALL_DAYS);
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
    }
  }, [habitToEdit, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const toggleDay = (d: number) => setSelectedDays((cur) => (cur.includes(d) ? (cur.length > 1 ? cur.filter((x) => x !== d) : cur) : [...cur, d].sort()));

  const buildSubHabits = (): SubHabit[] => {
    const existing = new Map((habitToEdit?.subHabits || []).map((s) => [s.title.toLowerCase(), s]));
    return parseSubTopics(subText).map((title, i) => {
      const prev = existing.get(title.toLowerCase());
      return prev ? { ...prev, title, order: i } : { id: `sh-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`, title, order: i, completed: false };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
<<<<<<< HEAD
    const common = { name: name.trim(), category, frequencyMode, selectedDays: frequencyMode === 'everyday' ? ALL_DAYS : selectedDays, startDate, startTime: time, amPm, reminderTimes: sortTimes(reminders), subHabits: buildSubHabits() };
=======
    const common = { name: name.trim(), category, frequencyMode, selectedDays: frequencyMode === 'everyday' ? ALL_DAYS : selectedDays, startDate, startTime: time, amPm, subHabits: buildSubHabits() };
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
    if (habitToEdit) await db.habits.update(habitToEdit.id, { ...common, updatedAt: new Date().toISOString() });
    else await db.habits.add({ id: `habit-${Date.now()}`, ...common, color: 'var(--text-primary)', difficulty: 'medium', archived: 0, createdAt: new Date().toISOString() } as Habit);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }} onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label={habitToEdit ? 'Edit habit' : 'Create habit'} onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="liquid-panel liquid-panel-elevated" style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem', padding: '1.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.25rem' }}><Sparkles size={19} style={{ color: 'var(--accent-secondary)' }} />{habitToEdit ? 'Edit Habit' : 'Create New Habit'}</h3>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="habit-name">Habit Name</label>
          <input id="habit-name" className="form-input" required autoFocus maxLength={60} placeholder="e.g. Study Path" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="habit-category">Category</label>
          <select id="habit-category" className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {HABIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="habit-subtopics">Sub-Topics <span className="subtitle" style={{ fontWeight: 400 }}>(optional · one per line)</span></label>
          <textarea id="habit-subtopics" className="form-textarea" rows={4} placeholder={'EC-Council\nCisco\nNetworking'} value={subText} onChange={(e) => setSubText(e.target.value)} style={{ resize: 'vertical' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
          <div className="form-group"><label className="form-label" htmlFor="habit-start">Start Date</label><input id="habit-start" type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="form-group"><span className="form-label" id="habit-time-label">Scheduled Time</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input aria-labelledby="habit-time-label" type="time" className="form-input" style={{ flex: 1 }} value={time} onChange={(e) => setTime(e.target.value)} />
              <div role="radiogroup" aria-label="AM or PM" style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {(['AM', 'PM'] as const).map((p) => <button key={p} type="button" role="radio" aria-checked={amPm === p} className="btn btn-xs" style={{ borderRadius: 0, height: 40, background: amPm === p ? 'var(--accent-primary)' : 'var(--bg-surface)', color: amPm === p ? 'var(--text-on-accent)' : 'var(--text-primary)' }} onClick={() => setAmPm(p)}>{p}</button>)}
              </div>
            </div>
          </div>
        </div>

        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="form-label" style={{ marginBottom: 6 }}>Days Frequency</legend>
          <div role="radiogroup" aria-label="Frequency" style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 10 }}>
            {([['everyday', 'Everyday'], ['custom', 'Custom days']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={frequencyMode === v} className="btn btn-xs" style={{ borderRadius: 0, height: 36, background: frequencyMode === v ? 'var(--accent-primary)' : 'var(--bg-surface)', color: frequencyMode === v ? 'var(--text-on-accent)' : 'var(--text-primary)' }} onClick={() => setFrequencyMode(v)}>{l}</button>)}
          </div>
          {frequencyMode === 'custom' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAYS.map((d) => { const on = selectedDays.includes(d.value); return <button key={d.value} type="button" aria-pressed={on} className="btn btn-xs" onClick={() => toggleDay(d.value)} style={{ minWidth: 48, background: on ? 'var(--accent-primary)' : 'var(--bg-surface)', color: on ? 'var(--text-on-accent)' : 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>{d.label}</button>; })}
            </div>)}
        </fieldset>

<<<<<<< HEAD
        <div className="form-group">
          <label className="form-label" htmlFor="habit-reminders">Reminder times <span className="subtitle" style={{ fontWeight: 400 }}>(pop-up notification on scheduled days)</span></label>
          <TimeListEditor id="habit-reminders" value={reminders} onChange={setReminders} presets={[{ label: 'Morning', time: '08:00' }, { label: 'Evening', time: '20:00' }]} />
        </div>

=======
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>{habitToEdit ? 'Save Changes' : 'Create Habit'}</button>
        </div>
      </form>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { BookOpen, ChevronDown, ChevronUp, Plus, Star, Trash2 } from 'lucide-react';
import { db, DailyReview, DailyReviewEntry } from '../db/schema';
import { computePerformanceSnapshot } from '../engine/performanceSnapshot';

interface Props {
  /** yyyy-MM-dd */
  dateStr: string;
  onDateChange: (dateStr: string) => void;
}

/** Entries shown for a review, including a read-only legacy entry from the old single-text review. */
function entriesOf(review?: DailyReview): Array<DailyReviewEntry & { legacy?: boolean }> {
  if (!review) return [];
  const list = [...(review.entries ?? [])] as Array<DailyReviewEntry & { legacy?: boolean }>;
  const legacyText = review.unifiedReviewNotes || review.accomplished;
  if (legacyText && list.length === 0) {
    list.unshift({ id: 'legacy', text: legacyText, rating: review.rating, createdAt: review.completedAt || review.createdAt || '', legacy: true });
  }
  return list;
}

/**
 * Daily Review, hosted at the bottom of the Calendar.
 * Pick any past date and APPEND a reflection to it; earlier entries are never overwritten.
 */
export const DailyReviewPanel: React.FC<Props> = ({ dateStr, onDateChange }) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const review = useLiveQuery(() => db.dailyReviews.get(dateStr), [dateStr]);
  const habits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const habitLogs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [text, setText] = useState('');
  const [rating, setRating] = useState(4);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);

  const entries = useMemo(() => entriesOf(review), [review]);

  const handleAppend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const entry: DailyReviewEntry = { id: `rev-${Date.now()}`, text: text.trim(), rating, createdAt: now };
      const snapshotData = computePerformanceSnapshot({ dateStr, habits, habitLogs, tasks, goals, weights: settings?.productivityWeights });
      const prior = await db.dailyReviews.get(dateStr);
      const existingEntries = prior?.entries ?? [];
      // Preserve a legacy single-text review as the first entry so nothing is lost on first append.
      const legacyText = prior?.unifiedReviewNotes || prior?.accomplished;
      const carried: DailyReviewEntry[] =
        existingEntries.length === 0 && legacyText
          ? [{ id: `rev-legacy-${dateStr}`, text: legacyText, rating: prior?.rating, createdAt: prior?.completedAt || prior?.createdAt || now }]
          : [];
      await db.dailyReviews.put({
        ...(prior ?? { id: dateStr, date: dateStr, createdAt: now }),
        id: dateStr,
        date: dateStr,
        entries: [...carried, ...existingEntries, entry],
        rating,
        snapshotData,
        updatedAt: now,
        completedAt: now,
      });
      setText('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    const prior = await db.dailyReviews.get(dateStr);
    if (!prior?.entries) return;
    await db.dailyReviews.update(dateStr, { entries: prior.entries.filter((x) => x.id !== entryId), updatedAt: new Date().toISOString() });
  };

  return (
    <section className="liquid-panel" aria-label="Daily review" style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <BookOpen size={20} style={{ color: 'var(--accent-secondary)' }} /> Daily Review
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {!open && entries.length > 0 && (
          <span className="subtitle" style={{ fontSize: '0.78rem' }}>{entries.length} entr{entries.length === 1 ? 'y' : 'ies'} for this date</span>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Review date
          <input
            type="date"
            className="form-input"
            value={dateStr}
            max={todayStr}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
          />
        </label>
        <button type="button" className="btn btn-secondary btn-xs" aria-expanded={open} aria-label={open ? 'Collapse daily review' : 'Expand daily review'} onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        </div>
      </div>

      {open && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 220, overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              No review recorded for {format(new Date(`${dateStr}T00:00:00`), 'EEEE, MMM d')}. Take a moment to reflect on it.
            </p>
          ) : (
            entries.map((en) => (
              <article key={en.id} style={{ padding: '0.7rem 0.85rem', background: 'var(--surface-sunken)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  <span>
                    {en.createdAt ? format(new Date(en.createdAt), 'MMM d, h:mm a') : 'Earlier reflection'}
                    {en.rating ? <span style={{ color: 'var(--warning)' }}> · {'★'.repeat(en.rating)}</span> : null}
                  </span>
                  {!en.legacy && (
                    <button type="button" className="btn btn-danger btn-icon btn-xs" aria-label="Delete this entry" onClick={() => handleDelete(en.id)}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)', lineHeight: 1.55 }}>{en.text}</div>
              </article>
            ))
          )}
        </div>

        <form onSubmit={handleAppend} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div role="radiogroup" aria-label="Day rating" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '0.3rem' }}>Rating</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className={`btn ${rating >= n ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.3rem 0.5rem' }}
                onClick={() => setRating(n)}
              >
                <Star size={14} fill={rating >= n ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <textarea
            className="form-textarea"
            rows={3}
            aria-label="Review text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Accomplishments, blockers, and what carries forward to tomorrow…"
            style={{ fontSize: '0.9rem', lineHeight: 1.55 }}
          />
          <button type="submit" className="btn btn-primary" disabled={!text.trim() || saving} style={{ alignSelf: 'flex-start' }}>
            <Plus size={16} /> {entries.length > 0 ? 'Append to this day' : 'Add review'}
          </button>
        </form>
      </div>
      )}
    </section>
  );
};

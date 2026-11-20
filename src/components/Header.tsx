import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ActiveTab } from '../App';
import { StreakFlameIndicator } from './StreakFlameIndicator';
import { StreakFreezeModal } from './StreakFreezeModal';
import { calculateCurrentStreak } from '../engine/streakEngine';
<<<<<<< HEAD
import { Sparkles, Calendar, Search } from 'lucide-react';
=======
import { Sparkles, Calendar, PanelRightClose, Search } from 'lucide-react';
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
import { format } from 'date-fns';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
<<<<<<< HEAD
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
=======
  onToggleDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onToggleDrawer }) => {
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
  const todayStr = format(new Date(), 'EEEE, MMMM d, yyyy');
  const todayIso = format(new Date(), 'yyyy-MM-dd');

  const habits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const allHabitLogs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const allTasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const todayHabitLogs = allHabitLogs.filter((l) => l.date === todayIso);
  const settings = useLiveQuery(() => db.settings.get('default'));

  const completedTodayCount = todayHabitLogs.filter((l) => l.status === 'completed').length;
  const totalHabitCount = habits.length || 1;
  const completionPct = habits.length > 0 ? Math.round((completedTodayCount / totalHabitCount) * 100) : 100;

  const savedEarned = settings?.streakFreezeEarned || 0;
  const { currentStreak, freezeEarned, isFreezeShieldActive } = calculateCurrentStreak(allHabitLogs, allTasks, savedEarned);

  // Auto-sync earned freeze count to settings database when reaching 5 consecutive day milestones
  const totalAvailableFreezes = Math.max(savedEarned, freezeEarned);
  if (freezeEarned > savedEarned && settings) {
    db.settings.update('default', { streakFreezeEarned: freezeEarned }).catch(() => {});
  }

  const hasFreeze = totalAvailableFreezes > 0 || isFreezeShieldActive;
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const notes = useLiveQuery(() => db.notes.toArray()) || [];
  const [clock, setClock] = useState(new Date());
  React.useEffect(() => { const id = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(id); }, []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const results: { key: string; label: string; kind: string; tab: ActiveTab }[] = q.length < 2 ? [] : [
    ...habits.filter((h) => h.name.toLowerCase().includes(q) || h.category.toLowerCase().includes(q)).map((h) => ({ key: 'h' + h.id, label: h.name, kind: 'Habit', tab: 'habits' as ActiveTab })),
    ...allTasks.filter((t) => t.title.toLowerCase().includes(q) || (t.tags || []).some((g) => g.toLowerCase().includes(q))).map((t) => ({ key: 't' + t.id, label: t.title, kind: 'Task', tab: 'dolist' as ActiveTab })),
    ...notes.filter((n) => n.title.toLowerCase().includes(q) || (n.tags || []).some((g) => g.toLowerCase().includes(q))).map((n) => ({ key: 'n' + n.id, label: n.title || 'Untitled', kind: 'Note', tab: 'workspace' as ActiveTab })),
  ].slice(0, 8);
  const go = (tab: ActiveTab) => { setActiveTab(tab); setQuery(''); setSearchOpen(false); };

  return (
<<<<<<< HEAD
    <header style={{ height: 'var(--header-height)', background: 'var(--chrome-bg, var(--bg-secondary))', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 90 }}>
=======
    <header style={{ height: 'var(--header-height)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 90 }}>
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
      <div style={{ position: 'relative', flex: '1 1 360px', maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', height: 42, padding: '0 0.85rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <Search size={16} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <input ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].tab); if (e.key === 'Escape') { setQuery(''); searchRef.current?.blur(); } }}
            aria-label="Search habits, tasks, notes" placeholder="Search habits, tasks, notes…" style={{ flex: 1, minWidth: 0, background: 'none', border: 0, outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
          <kbd style={{ font: 'inherit', fontSize: '0.7rem', padding: '0.1rem 0.4rem', border: '1px solid var(--border-color)', borderRadius: 5, color: 'var(--text-muted)', background: 'var(--surface-sunken)' }}>⌘ K</kbd>
        </div>
        {searchOpen && q.length >= 2 && (
          <ul role="listbox" style={{ position: 'absolute', top: 48, left: 0, right: 0, listStyle: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-elevated)', padding: '0.3rem', zIndex: 120 }}>
            {results.length === 0 && <li className="subtitle" style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>No matches</li>}
            {results.map((r) => (
              <li key={r.key} role="option" aria-selected={false}>
                <button type="button" className="row-hover" onMouseDown={() => go(r.tab)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0.5rem 0.7rem', background: 'none', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left', fontSize: '0.88rem' }}>
                  <span>{r.label}</span><span className="chip chip-neutral">{r.kind}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
        <div className="num" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }} title={todayStr}>
          <Calendar size={14} aria-hidden="true" />
          <span>{format(clock, 'EEE, MMM d, yyyy')} · {format(clock, 'h:mm a')}</span>
        </div>
        <StreakFlameIndicator completionPct={completionPct} currentStreak={currentStreak} hasStreakFreeze={hasFreeze} onOpenFreezeModal={() => setIsFreezeModalOpen(true)} />
        <button className="btn btn-primary btn-xs" onClick={() => setActiveTab('insights')}><Sparkles size={12} /> AI Analyst</button>
<<<<<<< HEAD
=======
        {onToggleDrawer && (
          <button className="btn btn-secondary btn-icon" onClick={onToggleDrawer} aria-label="Toggle contextual drawer" title="Toggle contextual drawer"><PanelRightClose size={17} /></button>
        )}
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
      </div>

      <StreakFreezeModal
        isOpen={isFreezeModalOpen}
        onClose={() => setIsFreezeModalOpen(false)}
        earnedCount={settings?.streakFreezeEarned || 1}
        activeUntil={settings?.streakFreezeActiveUntil}
      />
    </header>
  );
};



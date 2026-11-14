import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownUp, Clock, FileText, Gift, Notebook, Pin, Plus, Search, Star } from 'lucide-react';
import { db, NoteItem } from '../db/schema';
import { NoteEditor } from '../notepad/NoteEditor';
import { NoteInspector } from '../notepad/NoteInspector';
import { NEXT_SORT, NoteFilter, NoteSort, SORT_LABELS, filterNotes, noteColor, previewText, relativeTime, sortNotes } from '../notepad/noteUtils';
import { format, parseISO } from 'date-fns';

const FILTERS: Array<{ id: NoteFilter; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All notes', icon: <FileText size={16} /> },
  { id: 'pinned', label: 'Pinned', icon: <Pin size={16} /> },
  { id: 'recent', label: 'Recent', icon: <Clock size={16} /> },
  { id: 'favorites', label: 'Favorites', icon: <Star size={16} /> },
  { id: 'wishlist', label: 'Wishlist', icon: <Gift size={16} /> },
];

const newId = () => `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Notepad — the Workspace. One place for notes AND wishlist items.
 * Left: searchable, filterable list. Right: the rich-text editor for the selected note.
 */
export const NotepadView: React.FC = () => {
  const notes = useLiveQuery(() => db.notes.toArray());
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<NoteSort>('edited');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusTitleFor, setFocusTitleFor] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const all = notes ?? [];
  const visible = useMemo(() => sortNotes(filterNotes(all, { filter, query }), sort), [all, filter, query, sort]);
  const selected = all.find((n) => n.id === selectedId) ?? visible[0] ?? null;

  const createNote = async () => {
    const now = new Date().toISOString();
    const wish = filter === 'wishlist';
    const note: NoteItem = {
      id: newId(),
      title: '',
      content: '<p></p>',
      format: 'html',
      kind: wish ? 'wishlist' : 'note',
      tags: [],
      pinned: false,
      wishlist: wish ? { status: 'saved', priority: 'medium' } : undefined,
      createdAt: now,
      updatedAt: now,
    };
    // Decide selection + focus BEFORE the write: the live query can re-render (and mount the editor
    // for a note that sorts first) before an `await` resumes, which would skip focusing the title.
    setQuery('');
    if (filter === 'pinned' || filter === 'recent') setFilter('all');
    setSelectedId(note.id);
    setFocusTitleFor(note.id);
    await db.notes.add(note);
  };

  const duplicate = async (n: NoteItem) => {
    const now = new Date().toISOString();
    const copy: NoteItem = { ...n, id: newId(), title: `${n.title || 'Untitled'} (copy)`, pinned: false, favorite: false, locked: false, createdAt: now, updatedAt: now };
    await db.notes.add(copy);
    setSelectedId(copy.id);
  };

  const remove = async (n: NoteItem) => {
    if (!confirm(`Delete "${n.title || 'Untitled'}"? This cannot be undone.`)) return;
    const idx = visible.findIndex((v) => v.id === n.id);
    await db.notes.delete(n.id);
    const next = visible[idx + 1] ?? visible[idx - 1];
    setSelectedId(next?.id ?? null);
  };

  const togglePin = (n: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    void db.notes.update(n.id, { pinned: !n.pinned });
  };

  const loading = notes === undefined;
  const wishMode = filter === 'wishlist';

  return (
    <div className="view-container np-page">
      <div className="view-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="subtitle" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em' }}>WORKSPACE</div>
          <h1 className="view-header-title">Notepad</h1>
          <p className="view-header-subtitle">Capture ideas, organise knowledge, and turn thoughts into action.</p>
        </div>
      </div>

      <div className="np-topbar">
        <label className="np-search">
          <Search size={18} />
          <input ref={searchRef} type="search" placeholder="Search notes…" aria-label="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
          <kbd>Ctrl + K</kbd>
        </label>
        <div className="np-filters" role="radiogroup" aria-label="Filter notes">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={filter === f.id ? 'is-on' : ''} onClick={() => setFilter(f.id)}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>
        <button type="button" className="np-new" onClick={createNote}>
          <Plus size={18} /> {wishMode ? 'New wish' : 'New note'}
        </button>
      </div>

      <div className="np-layout">
        <aside className="np-list-card" aria-label="Your notes">
          <div className="np-list-head">
            <h2>Notes</h2>
            <span>{visible.length} {visible.length === 1 ? 'note' : 'notes'}</span>
            <button type="button" aria-label={`Sorted by ${SORT_LABELS[sort]}. Change sort order`} title={`Sorted by: ${SORT_LABELS[sort]}`} onClick={() => setSort(NEXT_SORT[sort])}>
              <ArrowDownUp size={18} />
            </button>
          </div>

          <div className="np-list" role="listbox" aria-label="Notes">
            {loading ? null : visible.length === 0 ? (
              <div className="np-empty">
                <Notebook size={34} />
                {all.length === 0 ? (
                  <>
                    <strong>Your notepad is empty</strong>
                    <p>Jot down ideas, study plans, links, and things you want to get.</p>
                    <button type="button" className="np-new" onClick={createNote}><Plus size={16} /> Write your first note</button>
                  </>
                ) : (
                  <>
                    <strong>Nothing found</strong>
                    <p>{query ? `No ${wishMode ? 'wishes' : 'notes'} match “${query}”.` : filter === 'pinned' ? 'Pin a note with the star to keep it here.' : `No ${wishMode ? 'wishlist items' : 'notes'} in this view yet.`}</p>
                  </>
                )}
              </div>
            ) : (
              visible.map((n) => {
                const color = noteColor(n);
                const isSel = selected?.id === n.id;
                return (
                  <div
                    key={n.id}
                    role="option"
                    aria-selected={isSel}
                    tabIndex={0}
                    className={`np-item${isSel ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(n.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(n.id); } }}
                  >
                    <span className="np-icon" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{n.kind === 'wishlist' ? <Gift size={20} /> : <FileText size={20} />}</span>
                    <span className="np-item-main">
                      <strong>{n.title || 'Untitled'}</strong>
                      <span className="np-preview">{previewText(n) || 'No content'}</span>
                      <span className="np-meta">{format(parseISO(n.createdAt), 'MMM d, yyyy')} • Edited {relativeTime(n.updatedAt)}</span>
                    </span>
                    <button type="button" className={`np-star${n.pinned ? ' is-on' : ''}`} aria-label={n.pinned ? `Unpin ${n.title || 'Untitled'}` : `Pin ${n.title || 'Untitled'}`} aria-pressed={!!n.pinned} onClick={(e) => togglePin(n, e)}>
                      <Star size={20} fill={n.pinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {selected ? (
          <>
            <NoteEditor
              key={selected.id}
              note={selected}
              autoFocusTitle={focusTitleFor === selected.id}
              onDelete={remove}
              onDuplicate={duplicate}
            />
            <NoteInspector key={`insp-${selected.id}`} note={selected} onDuplicate={duplicate} onDelete={remove} />
          </>
        ) : (
          <section className="np-editor np-editor-empty" aria-label="Note editor">
            <Notebook size={44} />
            <p>{loading ? '' : 'Select a note, or start a new one.'}</p>
          </section>
        )}
      </div>
    </div>
  );
};

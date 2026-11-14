import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { format, parseISO } from 'date-fns';
import {
  Bold, CalendarDays, CheckCircle2, CheckSquare, Code, Copy, Gift, Italic, Link2, List, ListOrdered, Loader2,
  Maximize2, Minimize2, MoreHorizontal, Pin, PinOff, Plus, Redo2, Trash2, Underline as UnderlineIcon, Undo2, X, FileText,
} from 'lucide-react';
import { db, NoteItem, WishlistMeta } from '../db/schema';
import { textToHtml } from '../lib/html';
import { addTag, contentToText, countWords, normalizeUrl, relativeTime } from './noteUtils';

const AUTOSAVE_MS = 600;
type Status = 'saved' | 'saving' | 'error';

interface Props {
  note: NoteItem;
  autoFocusTitle?: boolean;
  onDelete: (n: NoteItem) => void;
  onDuplicate: (n: NoteItem) => void;
}

const DEFAULT_WISH: WishlistMeta = { status: 'saved', priority: 'medium' };

/**
 * One note. Keyed by note id in the parent, so every note gets a fresh editor.
 * Autosaves (debounced) and ALWAYS flushes pending edits when the note is switched or the view is left.
 */
export const NoteEditor: React.FC<Props> = ({ note, autoFocusTitle, onDelete, onDuplicate }) => {
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [status, setStatus] = useState<Status>('saved');
  const [savedAt, setSavedAt] = useState<string>(note.updatedAt);
  const [, forceTick] = useState(0);
  const [words, setWords] = useState(() => countWords(contentToText(note)));
  const [fullscreen, setFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [wish, setWish] = useState<WishlistMeta>(note.wishlist ?? DEFAULT_WISH);
  const [costDraft, setCostDraft] = useState(note.wishlist?.estimatedCost?.toString() ?? '');
  const [urlDraft, setUrlDraft] = useState(note.wishlist?.url ?? '');

  const isWish = note.kind === 'wishlist';
  const menuRef = useRef<HTMLDivElement>(null);

  // ── autosave plumbing: refs so the unmount flush never reads stale state ──
  const latest = useRef({ title: note.title, content: note.content });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    const now = new Date().toISOString();
    if (alive.current) setStatus('saving');
    try {
      await db.notes.update(note.id, { title: latest.current.title, content: latest.current.content, format: 'html', updatedAt: now });
      if (alive.current) {
        setStatus('saved');
        setSavedAt(now);
      }
    } catch {
      dirty.current = true;
      if (alive.current) setStatus('error');
    }
  }, [note.id]);

  const schedule = useCallback(() => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  const touch = useCallback(async (patch: Partial<NoteItem>) => {
    const now = new Date().toISOString();
    await db.notes.update(note.id, { ...patch, updatedAt: now });
    if (alive.current) setSavedAt(now);
  }, [note.id]);

  const initialHtml = useMemo(() => (note.format === 'html' ? note.content : textToHtml(note.content)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' } },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: isWish ? 'Why do you want this? Add notes, links, or steps…' : 'Start writing…' }),
    ],
    content: initialHtml,
    editorProps: { attributes: { class: 'notepad-prose', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Note body' } },
    onUpdate: ({ editor: ed }) => {
      latest.current.content = ed.getHTML();
      setWords(countWords(ed.getText({ blockSeparator: ' ' })));
      schedule();
    },
  });

  useEffect(() => { editor?.setEditable(!note.locked); }, [editor, note.locked]);

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: !!ed?.isActive('bold'),
      italic: !!ed?.isActive('italic'),
      underline: !!ed?.isActive('underline'),
      code: !!ed?.isActive('code'),
      bullet: !!ed?.isActive('bulletList'),
      ordered: !!ed?.isActive('orderedList'),
      task: !!ed?.isActive('taskList'),
      link: !!ed?.isActive('link'),
      canUndo: !!ed?.can().undo(),
      canRedo: !!ed?.can().redo(),
    }),
  });

  // Flush on leave (switching notes, navigating to another page, closing the window)
  useEffect(() => {
    alive.current = true;
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
      alive.current = false;
    };
  }, [flush]);

  // Keep "Saved 2 min ago" fresh
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Esc exits fullscreen / closes menu; click outside closes menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menuOpen) setMenuOpen(false);
      else if (fullscreen) setFullscreen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [menuOpen, fullscreen]);

  const onTitle = (v: string) => {
    setTitle(v);
    latest.current.title = v;
    schedule();
  };

  const commitTags = async (next: string[]) => {
    setTags(next);
    await touch({ tags: next });
  };

  const submitTag = async () => {
    const next = addTag(tags, tagDraft);
    setTagDraft('');
    setAddingTag(false);
    if (next !== tags) await commitTags(next);
  };

  const openLink = () => {
    if (!editor) return;
    setLinkDraft(editor.getAttributes('link').href ?? '');
    setLinkError(false);
    setLinkOpen((v) => !v);
  };

  const applyLink = () => {
    if (!editor) return;
    if (!linkDraft.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const href = normalizeUrl(linkDraft);
    if (!href) return setLinkError(true);
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinkOpen(false);
  };

  const commitWish = async (patch: Partial<WishlistMeta>) => {
    const next = { ...wish, ...patch };
    setWish(next);
    await touch({ wishlist: next });
  };

  const statusLabel = status === 'saving' ? 'Saving…' : status === 'error' ? 'Could not save — retrying on next edit' : `Saved ${relativeTime(savedAt)}`;

  const tb = (label: string, icon: React.ReactNode, on: boolean, run: () => void, disabled = false) => (
    <button type="button" className={`np-tool${on ? ' is-on' : ''}`} aria-label={label} title={label} aria-pressed={on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {icon}
    </button>
  );

  const chain = () => editor!.chain().focus();

  return (
    <section className={`np-editor${fullscreen ? ' is-fullscreen' : ''}${note.locked ? ' is-locked' : ''}`} aria-label="Note editor">
      <header className="np-editor-head">
        <input
          className="np-title"
          value={title}
          autoFocus={autoFocusTitle}
          placeholder={isWish ? 'Untitled wish' : 'Untitled note'}
          aria-label="Note title"
          readOnly={!!note.locked}
          onChange={(e) => onTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), editor?.commands.focus('start'))}
        />
        <span className={`np-saved${status === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
          {status === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {statusLabel}
        </span>
        <div className="np-menu-wrap" ref={menuRef}>
          <button type="button" className="np-more" aria-label="Note actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="np-menu" role="menu">
              <button role="menuitem" onClick={() => { setMenuOpen(false); void flush().then(() => touch({ pinned: !note.pinned })); }}>
                {note.pinned ? <PinOff size={15} /> : <Pin size={15} />} {note.pinned ? 'Unpin' : 'Pin to top'}
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); void flush().then(() => db.notes.get(note.id)).then((n) => n && onDuplicate(n)); }}>
                <Copy size={15} /> Duplicate
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); void flush().then(() => touch(isWish ? { kind: 'note' } : { kind: 'wishlist', wishlist: note.wishlist ?? DEFAULT_WISH })); }}>
                {isWish ? <FileText size={15} /> : <Gift size={15} />} {isWish ? 'Convert to note' : 'Convert to wishlist item'}
              </button>
              <button role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); onDelete(note); }}>
                <Trash2 size={15} /> Delete
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="np-tags" aria-label="Tags">
        {tags.map((t) => (
          <span key={t} className="np-tag">
            {t}
            <button type="button" aria-label={`Remove tag ${t}`} onClick={() => commitTags(tags.filter((x) => x !== t))}><X size={13} /></button>
          </span>
        ))}
        {addingTag ? (
          <input
            className="np-tag-input"
            autoFocus
            aria-label="New tag"
            value={tagDraft}
            maxLength={24}
            onChange={(e) => setTagDraft(e.target.value)}
            onBlur={submitTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); void submitTag(); }
              if (e.key === 'Escape') { setTagDraft(''); setAddingTag(false); }
            }}
          />
        ) : (
          <button type="button" className="np-tag np-tag-add" onClick={() => setAddingTag(true)}><Plus size={13} /> Add tag</button>
        )}
      </div>

      {isWish && (
        <div className="np-wish" aria-label="Wishlist details">
          <label>Status
            <select value={wish.status} onChange={(e) => commitWish({ status: e.target.value as WishlistMeta['status'] })}>
              <option value="saved">Saved</option><option value="in_progress">In progress</option><option value="acquired">Acquired</option><option value="archived">Archived</option>
            </select>
          </label>
          <label>Priority
            <select value={wish.priority} onChange={(e) => commitWish({ priority: e.target.value as WishlistMeta['priority'] })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </label>
          <label>Est. cost
            <input inputMode="decimal" placeholder="0" value={costDraft} onChange={(e) => setCostDraft(e.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={() => { const n = parseFloat(costDraft); void commitWish({ estimatedCost: Number.isFinite(n) ? n : undefined }); }} />
          </label>
          <label className="np-wish-url">Link
            <input type="url" placeholder="https://…" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
              onBlur={() => { const u = urlDraft.trim() ? normalizeUrl(urlDraft) : undefined; if (u === null) return; void commitWish({ url: u }); if (u) setUrlDraft(u); }} />
          </label>
        </div>
      )}

      <div className="np-toolbar" role="toolbar" aria-label="Formatting">
        {tb('Bold (Ctrl+B)', <Bold size={17} />, active?.bold ?? false, () => chain().toggleBold().run())}
        {tb('Italic (Ctrl+I)', <Italic size={17} />, active?.italic ?? false, () => chain().toggleItalic().run())}
        {tb('Underline (Ctrl+U)', <UnderlineIcon size={17} />, active?.underline ?? false, () => chain().toggleUnderline().run())}
        {tb('Inline code', <Code size={17} />, active?.code ?? false, () => chain().toggleCode().run())}
        <span className="np-sep" />
        {tb('Bulleted list', <List size={17} />, active?.bullet ?? false, () => chain().toggleBulletList().run())}
        {tb('Numbered list', <ListOrdered size={17} />, active?.ordered ?? false, () => chain().toggleOrderedList().run())}
        {tb('Checklist', <CheckSquare size={17} />, active?.task ?? false, () => chain().toggleTaskList().run())}
        {tb('Link', <Link2 size={17} />, (active?.link ?? false) || linkOpen, openLink)}
        <span className="np-spacer" />
        {tb('Undo', <Undo2 size={17} />, false, () => chain().undo().run(), !(active?.canUndo))}
        {tb('Redo', <Redo2 size={17} />, false, () => chain().redo().run(), !(active?.canRedo))}
        {tb(fullscreen ? 'Exit full screen (Esc)' : 'Full screen', fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />, fullscreen, () => setFullscreen((v) => !v))}
      </div>

      {linkOpen && (
        <div className="np-linkbar">
          <input autoFocus aria-label="Link address" aria-invalid={linkError} placeholder="Paste a link, e.g. https://tryhackme.com" value={linkDraft}
            onChange={(e) => { setLinkDraft(e.target.value); setLinkError(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setLinkOpen(false); }} />
          <button type="button" className="btn btn-primary btn-xs" onClick={applyLink}>{linkDraft.trim() ? 'Apply' : 'Remove link'}</button>
          {linkError && <span role="alert">Use a web or mail link (http, https, mailto).</span>}
        </div>
      )}

      <div className="np-body" onClick={(e) => { if (e.target === e.currentTarget) editor?.commands.focus('end'); }}>
        <EditorContent editor={editor} />
      </div>

      <footer className="np-foot">
        <span><CalendarDays size={16} /> Created {format(parseISO(note.createdAt), 'MMM d, yyyy')} • Updated {format(parseISO(savedAt), 'MMM d, yyyy')}</span>
        <span className="np-words">{words} word{words === 1 ? '' : 's'}</span>
      </footer>
    </section>
  );
};

import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Copy, Download, ExternalLink, Link2, Lock, Plus, Star, Trash2, Unlock, X, FolderInput } from 'lucide-react';
import { db, NoteItem } from '../db/schema';
import { addTag, contentToText, normalizeUrl } from './noteUtils';

interface Props { note: NoteItem; onDuplicate: (n: NoteItem) => void; onDelete: (n: NoteItem) => void }

const slug = (s: string) => (s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';

/** Right-hand inspector: metadata, tags, related items and lifecycle actions for the selected note. */
export const NoteInspector: React.FC<Props> = ({ note, onDuplicate, onDelete }) => {
  const [tagDraft, setTagDraft] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const [moving, setMoving] = useState(false);
  const patch = (p: Partial<NoteItem>) => db.notes.update(note.id, { ...p, updatedAt: new Date().toISOString() });
  const touchless = (p: Partial<NoteItem>) => db.notes.update(note.id, p); // metadata toggles do not count as an edit
  const locked = !!note.locked;
  const tags = note.tags ?? [];

  const exportMd = () => {
    const body = `# ${note.title || 'Untitled'}\n\n${tags.length ? tags.map((t) => `#${t}`).join(' ') + '\n\n' : ''}${contentToText(note)}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${slug(note.title)}.md`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = normalizeUrl(linkUrl);
    if (!url || url.startsWith('mailto:')) return setLinkError('Enter a valid http(s) link.');
    await patch({ related: [...(note.related ?? []), { id: `rel-${Date.now()}`, title: linkTitle.trim() || new URL(url).hostname, url }] });
    setLinkTitle(''); setLinkUrl(''); setLinkError('');
  };

  const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.35rem 0', fontSize: '0.84rem' }}><span className="subtitle">{label}</span><span>{children}</span></div>;
  const Switch: React.FC<{ label: string; on: boolean; onChange: (v: boolean) => void }> = ({ label, on, onChange }) => <input type="checkbox" role="switch" aria-label={label} checked={on} onChange={(e) => onChange(e.target.checked)} style={{ width: 36, height: 18 }} />;

  return (
    <aside className="np-inspector" aria-label="Note details" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
      <section className="liquid-panel" style={{ padding: '1rem' }}>
        <h3 className="panel-title" style={{ marginBottom: 6 }}>Note Details</h3>
        <Row label="Created"><span className="num">{format(parseISO(note.createdAt), 'MMM d, yyyy · h:mm a')}</span></Row>
        <Row label="Updated"><span className="num">{format(parseISO(note.updatedAt), 'MMM d, yyyy · h:mm a')}</span></Row>
        <Row label="Category"><input aria-label="Category" className="form-input" style={{ minHeight: 30, padding: '0.15rem 0.5rem', width: 130 }} defaultValue={note.category ?? ''} key={`${note.id}-${note.category ?? ''}`} placeholder="e.g. Security" disabled={locked} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (note.category ?? '')) void touchless({ category: v || undefined }); }} /></Row>
        <Row label="Status"><span className="chip chip-success">{note.kind === 'wishlist' ? (note.wishlist?.status ?? 'saved') : 'Active'}</span></Row>
        <Row label="Pinned"><Switch label="Pinned" on={!!note.pinned} onChange={(v) => void touchless({ pinned: v })} /></Row>
        <Row label="Favorite"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Star size={14} fill={note.favorite ? 'currentColor' : 'none'} aria-hidden="true" /><Switch label="Favorite" on={!!note.favorite} onChange={(v) => void touchless({ favorite: v })} /></span></Row>
      </section>

      <section className="liquid-panel" style={{ padding: '1rem' }}>
        <h3 className="panel-title" style={{ marginBottom: 8 }}>Tags</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {tags.map((t) => <span key={t} className="chip chip-neutral">#{t}{!locked && <button type="button" className="link-action" style={{ padding: 0 }} aria-label={`Remove ${t} from details`} onClick={() => void patch({ tags: tags.filter((x) => x !== t) })}><X size={11} /></button>}</span>)}
          {!locked && <input aria-label="Add tag from details" className="form-input" placeholder="Add tag" value={tagDraft} style={{ width: 96, minHeight: 28, padding: '0.1rem 0.5rem' }} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const next = addTag(tags, tagDraft); if (next !== tags) void patch({ tags: next }); setTagDraft(''); } }} />}
          {tags.length === 0 && locked && <span className="subtitle" style={{ fontSize: '0.8rem' }}>No tags</span>}
        </div>
      </section>

      <section className="liquid-panel" style={{ padding: '1rem' }}>
        <h3 className="panel-title" style={{ marginBottom: 8 }}>Related Items</h3>
        {(note.related ?? []).length === 0 && <p className="subtitle" style={{ fontSize: '0.8rem' }}>No linked resources.</p>}
        {(note.related ?? []).map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0', borderTop: '1px solid var(--divider)' }}>
            <Link2 size={15} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div><div className="subtitle" style={{ fontSize: '0.7rem' }}>External Link</div></div>
            <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open ${r.title}`} className="link-action"><ExternalLink size={15} /></a>
            {!locked && <button type="button" className="link-action" aria-label={`Remove ${r.title}`} onClick={() => void patch({ related: (note.related ?? []).filter((x) => x.id !== r.id) })}><X size={14} /></button>}
          </div>))}
        {!locked && (
          <form onSubmit={addLink} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <input aria-label="Related link title" className="form-input" placeholder="Title (optional)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} style={{ minHeight: 32 }} />
            <div style={{ display: 'flex', gap: 6 }}><input aria-label="Related link URL" className="form-input" placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={{ minHeight: 32, flex: 1 }} /><button type="submit" className="btn btn-secondary btn-xs" aria-label="Add related link"><Plus size={13} /></button></div>
            {linkError && <span role="alert" className="chip chip-danger" style={{ alignSelf: 'flex-start' }}>{linkError}</span>}
          </form>)}
      </section>

      <section className="liquid-panel" style={{ padding: '1rem' }}>
        <h3 className="panel-title" style={{ marginBottom: 8 }}>Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button type="button" className="btn btn-secondary btn-xs" onClick={() => onDuplicate(note)}><Copy size={13} /> Duplicate</button>
          <button type="button" className="btn btn-secondary btn-xs" aria-expanded={moving} disabled={locked} onClick={() => setMoving(!moving)}><FolderInput size={13} /> Move</button>
          <button type="button" className="btn btn-secondary btn-xs" onClick={exportMd}><Download size={13} /> Export</button>
          <button type="button" className="btn btn-secondary btn-xs" aria-pressed={locked} onClick={() => void touchless({ locked: !locked })}>{locked ? <Unlock size={13} /> : <Lock size={13} />} {locked ? 'Unlock' : 'Lock'}</button>
          <button type="button" className="btn btn-danger btn-xs" style={{ gridColumn: '1 / -1' }} disabled={locked} onClick={() => onDelete(note)}><Trash2 size={13} /> Delete</button>
        </div>
        {moving && <div style={{ marginTop: 8 }}><label className="form-label" htmlFor="np-move">Move to category</label><input id="np-move" className="form-input" autoFocus placeholder="Category name" onKeyDown={(e) => { if (e.key === 'Enter') { void touchless({ category: (e.target as HTMLInputElement).value.trim() || undefined }); setMoving(false); } }} /></div>}
        {locked && <p className="subtitle" style={{ fontSize: '0.74rem', marginTop: 8 }}>Locked: editing, tag changes and deletion are disabled.</p>}
      </section>
    </aside>
  );
};

import { differenceInCalendarDays, differenceInMinutes, format, parseISO } from 'date-fns';
import type { NoteItem } from '../db/schema';

export type NoteFilter = 'all' | 'pinned' | 'recent' | 'favorites' | 'wishlist';
export type NoteSort = 'edited' | 'created' | 'title';

export const RECENT_DAYS = 7;
export const SORT_LABELS: Record<NoteSort, string> = { edited: 'Recently edited', created: 'Date created', title: 'Title A–Z' };
export const NEXT_SORT: Record<NoteSort, NoteSort> = { edited: 'created', created: 'title', title: 'edited' };

/** Visible text of stored note content (rich HTML, or legacy plain text). Block boundaries become spaces. */
export function contentToText(note: Pick<NoteItem, 'content' | 'format'>): string {
  const raw = note.content ?? '';
  if (note.format !== 'html') return raw.replace(/\s+/g, ' ').trim();
  const spaced = raw.replace(/<\/(p|li|h[1-6]|div|ul|ol|blockquote|pre)>|<br\s*\/?>/gi, ' ');
  if (typeof DOMParser !== 'undefined') {
    return (new DOMParser().parseFromString(spaced, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return spaced.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export const countWords = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

export function previewText(note: NoteItem, max = 72): string {
  const text = contentToText(note);
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** "just now", "5 min ago", "3 hours ago", "1 day ago", then an absolute date after 30 days. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = parseISO(iso);
  const mins = differenceInMinutes(now, then);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const days = differenceInCalendarDays(now, then);
  if (days < 1) {
    const h = Math.floor(mins / 60);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (days <= 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return format(then, 'MMM d, yyyy');
}

export function filterNotes(notes: NoteItem[], opts: { filter: NoteFilter; query: string; now?: Date }): NoteItem[] {
  const now = opts.now ?? new Date();
  const q = opts.query.trim().toLowerCase();
  return notes.filter((n) => {
    if (opts.filter === 'pinned' && !n.pinned) return false;
    if (opts.filter === 'favorites' && !n.favorite) return false;
    if (opts.filter === 'wishlist' && n.kind !== 'wishlist') return false;
    if (opts.filter === 'recent' && differenceInCalendarDays(now, parseISO(n.updatedAt)) > RECENT_DAYS) return false;
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      contentToText(n).toLowerCase().includes(q) ||
      (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  });
}

/** Pinned notes float to the top (except in the Pinned filter, where it is moot); then the chosen order. */
export function sortNotes(notes: NoteItem[], sort: NoteSort): NoteItem[] {
  const cmp = (a: NoteItem, b: NoteItem) =>
    sort === 'title'
      ? (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, { sensitivity: 'base' })
      : (sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt));
  return [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || cmp(a, b));
}

/** Normalise a user-typed tag: trim, drop leading #, collapse spaces, cap length. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, 24);
}

export function addTag(tags: string[] = [], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return tags;
  return [...tags, tag];
}

/** Only web and mail links are allowed; bare domains get https://. Returns null when unusable. */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

const PALETTE = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-6)'];
/** Stable icon colour per note (explicit `color` wins). */
export function noteColor(note: Pick<NoteItem, 'id' | 'color'>): string {
  if (note.color) return note.color;
  let h = 0;
  for (const ch of note.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

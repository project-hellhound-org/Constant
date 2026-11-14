// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { addTag, contentToText, countWords, filterNotes, normalizeUrl, previewText, relativeTime, sortNotes } from '../notepad/noteUtils';
import type { NoteItem } from '../db/schema';

const NOW = new Date('2026-10-10T12:00:00');
const note = (o: Partial<NoteItem>): NoteItem => ({
  id: 'n', title: 'T', content: '<p>x</p>', format: 'html', createdAt: '2026-10-01T09:00:00', updatedAt: '2026-10-01T09:00:00', ...o,
});

describe('text extraction', () => {
  it('flattens rich text with spaces between blocks and decodes entities', () => {
    const n = note({ content: '<h2>Core</h2><ul><li><p>OSI</p></li><li><p>TCP &amp; IP</p></li></ul>' });
    expect(contentToText(n)).toBe('Core OSI TCP & IP');
    expect(countWords(contentToText(n))).toBe(5);
  });
  it('treats un-migrated legacy content as plain text (no tag stripping)', () => {
    expect(contentToText({ content: 'a <b> c\n\nd', format: undefined })).toBe('a <b> c d');
  });
  it('truncates previews', () => {
    expect(previewText(note({ content: `<p>${'word '.repeat(40)}</p>` }), 20).endsWith('…')).toBe(true);
    expect(countWords('')).toBe(0);
  });
});

describe('relativeTime', () => {
  it.each([
    ['2026-10-10T11:59:40', 'just now'],
    ['2026-10-10T11:50:00', '10 min ago'],
    ['2026-10-10T09:00:00', '3 hours ago'],
    ['2026-10-09T23:00:00', '1 day ago'],
    ['2026-10-05T10:00:00', '5 days ago'],
    ['2026-07-01T10:00:00', 'Jul 1, 2026'],
  ])('%s -> %s', (iso, out) => expect(relativeTime(iso, NOW)).toBe(out));
});

describe('filter + sort', () => {
  const notes = [
    note({ id: 'a', title: 'Cybersecurity study plan', updatedAt: '2026-10-10T10:00:00', pinned: true, tags: ['Study'] }),
    note({ id: 'b', title: 'Laptop', kind: 'wishlist', updatedAt: '2026-10-09T10:00:00' }),
    note({ id: 'c', title: 'Old idea', content: '<p>secret sauce</p>', updatedAt: '2026-08-01T10:00:00' }),
  ];
  it('filters by tab', () => {
    expect(filterNotes(notes, { filter: 'pinned', query: '', now: NOW }).map((n) => n.id)).toEqual(['a']);
    expect(filterNotes(notes, { filter: 'wishlist', query: '', now: NOW }).map((n) => n.id)).toEqual(['b']);
    expect(filterNotes(notes, { filter: 'recent', query: '', now: NOW }).map((n) => n.id)).toEqual(['a', 'b']);
  });
  it('searches title, body and tags case-insensitively', () => {
    expect(filterNotes(notes, { filter: 'all', query: 'SAUCE', now: NOW }).map((n) => n.id)).toEqual(['c']);
    expect(filterNotes(notes, { filter: 'all', query: 'study', now: NOW }).map((n) => n.id)).toEqual(['a']);
  });
  it('floats pinned notes first, then sorts', () => {
    expect(sortNotes(notes, 'edited').map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(sortNotes(notes, 'title').map((n) => n.id)).toEqual(['a', 'b', 'c']); // pinned first, then Laptop < Old idea
  });
});

describe('tags and urls', () => {
  it('normalises and de-duplicates tags', () => {
    expect(addTag(['Study'], ' #study ')).toEqual(['Study']);
    expect(addTag(['Study'], '#Security')).toEqual(['Study', 'Security']);
    expect(addTag([], '   ')).toEqual([]);
  });
  it('allows only safe link schemes', () => {
    expect(normalizeUrl('tryhackme.com')).toBe('https://tryhackme.com/');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,hi')).toBeNull();
    expect(normalizeUrl('mailto:a@b.co')).toBe('mailto:a@b.co');
  });
});

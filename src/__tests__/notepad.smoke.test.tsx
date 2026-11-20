// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { db, NoteItem } from '../db/schema';
import { NotepadView } from '../views/NotepadView';

// jsdom lacks a few layout APIs ProseMirror touches
beforeAll(() => {
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {} };
  (Range.prototype as any).getBoundingClientRect = () => rect;
  (Range.prototype as any).getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
  (document as any).elementFromPoint = () => null;
  Element.prototype.scrollIntoView = () => {};
});

const iso = (d: string) => new Date(d).toISOString();
const base = (o: Partial<NoteItem>): NoteItem => ({ id: 'n', title: 'T', content: '<p>x</p>', format: 'html', kind: 'note', tags: [], createdAt: iso('2026-10-08T09:00:00'), updatedAt: iso('2026-10-08T09:00:00'), ...o });

const STUDY = base({
  id: 'study', title: 'Cybersecurity study plan', pinned: true, tags: ['Study', 'Security'],
  content: '<h2>1. Core Topics</h2><ul><li><p>Networking fundamentals</p></li></ul><h2>2. Weekly Goals</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Complete Nmap</p></li><li data-type="taskItem" data-checked="false"><p>Write a lab report</p></li></ul><p>See <a href="https://tryhackme.com">https://tryhackme.com</a></p>',
  updatedAt: new Date().toISOString(),
});
const WEEKLY = base({ id: 'weekly', title: 'Weekly priorities', content: '<p>Main goals for this week</p>', updatedAt: iso('2026-10-09T09:00:00') });
const LAPTOP = base({ id: 'laptop', title: 'Laptop', kind: 'wishlist', wishlist: { status: 'saved', priority: 'high', estimatedCost: 80000 }, content: '<p>For labs</p>', updatedAt: iso('2026-09-01T09:00:00') });
const LEGACY = base({ id: 'legacy', title: 'Old plain note', format: undefined, content: 'Just text\n\nsecond para', updatedAt: iso('2026-08-01T09:00:00') });

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const list = () => within(screen.getByRole('listbox', { name: 'Notes' }));
const option = (name: RegExp | string) => list().getByRole('option', { name });

describe('Notepad: list, search and filters', () => {
  it('shows an empty state, and "Write your first note" creates a note with the title focused', async () => {
    render(<NotepadView />);
    fireEvent.click(await screen.findByRole('button', { name: /Write your first note/ }));
    await waitFor(async () => expect(await db.notes.count()).toBe(1));
    const created = (await db.notes.toArray())[0];
    expect(created).toMatchObject({ kind: 'note', format: 'html', title: '' });
    const title = await screen.findByLabelText('Note title');
    expect(document.activeElement).toBe(title);
    expect(option(/Untitled/)).toBeTruthy();
  });

  it('lists notes with preview + meta, pinned first, and a correct count', async () => {
    await db.notes.bulkAdd([WEEKLY, STUDY, LAPTOP]);
    render(<NotepadView />);
    await screen.findByRole('option', { name: /Cybersecurity study plan/ });
    expect(screen.getByText('3 notes')).toBeTruthy();
    const names = within(screen.getByRole('listbox', { name: 'Notes' })).getAllByRole('option').map((o) => within(o).getByText(/./, { selector: 'strong' }).textContent);
    expect(names).toEqual(['Cybersecurity study plan', 'Weekly priorities', 'Laptop']); // pinned, then most recently edited
    expect(within(option(/Weekly priorities/)).getByText('Main goals for this week')).toBeTruthy();
    expect(within(option(/Cybersecurity/)).getByText(/Edited just now/)).toBeTruthy();
  });

  it('filters: Pinned / Recent / Wishlist, and search by title, body and tag', async () => {
    await db.notes.bulkAdd([WEEKLY, STUDY, LAPTOP, LEGACY]);
    render(<NotepadView />);
    await screen.findByRole('option', { name: /Laptop/ });

    fireEvent.click(screen.getByRole('radio', { name: 'Pinned' }));
    expect(screen.getByText('1 note')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Wishlist' }));
    expect(within(screen.getByRole('listbox', { name: 'Notes' })).getAllByRole('option')).toHaveLength(1);
    expect(option(/Laptop/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'All notes' }));

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'second para' } }); // body of the legacy plain-text note
    expect(within(screen.getByRole('listbox', { name: 'Notes' })).getAllByRole('option')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'security' } });      // tag
    expect(option(/Cybersecurity/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'zzz-nothing' } });
    expect(await screen.findByText('Nothing found')).toBeTruthy();
  });

  it('Ctrl+K focuses search; the sort button cycles and announces the order', async () => {
    await db.notes.bulkAdd([WEEKLY, STUDY]);
    render(<NotepadView />);
    await screen.findByRole('option', { name: /Weekly priorities/ });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByLabelText('Search notes'));
    const sort = screen.getByRole('button', { name: /Sorted by Recently edited/ });
    fireEvent.click(sort);
    expect(screen.getByRole('button', { name: /Sorted by Date created/ })).toBeTruthy();
  });

  it('the star pins and unpins without opening the note', async () => {
    await db.notes.bulkAdd([WEEKLY, LAPTOP]);
    render(<NotepadView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pin Laptop' }));
    await waitFor(async () => expect((await db.notes.get('laptop'))!.pinned).toBe(true));
  });
});

describe('Notepad: editor', () => {
  it('renders rich content faithfully: headings, lists, checklist state, links, word count and dates', async () => {
    await db.notes.add(STUDY);
    render(<NotepadView />);
    const body = await screen.findByLabelText('Note body');
    await waitFor(() => expect(body.querySelector('h2')?.textContent).toBe('1. Core Topics'));
    expect(body.querySelectorAll('ul[data-type="taskList"] li')).toHaveLength(2);
    expect(body.querySelectorAll('li[data-checked="true"]')).toHaveLength(1);
    expect(body.querySelector('a')?.getAttribute('href')).toContain('tryhackme.com');
    expect(screen.getByLabelText('Note title')).toHaveProperty('value', 'Cybersecurity study plan');
    expect(screen.getByText(/Created Oct 8, 2026/)).toBeTruthy();
    expect(screen.getByText(/\d+ words?/)).toBeTruthy();
    // full toolbar from the design
    for (const label of ['Bold (Ctrl+B)', 'Italic (Ctrl+I)', 'Underline (Ctrl+U)', 'Inline code', 'Bulleted list', 'Numbered list', 'Checklist', 'Link', 'Undo', 'Redo', 'Full screen']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('shows legacy plain-text notes as readable paragraphs', async () => {
    await db.notes.add(LEGACY);
    render(<NotepadView />);
    const body = await screen.findByLabelText('Note body');
    await waitFor(() => expect(body.querySelectorAll('p')).toHaveLength(2));
    expect(body.textContent).toContain('Just text');
  });

  it('autosaves the title after a pause, and shows saved status', async () => {
    await db.notes.add(WEEKLY);
    render(<NotepadView />);
    fireEvent.change(await screen.findByLabelText('Note title'), { target: { value: 'Renamed' } });
    await waitFor(async () => expect((await db.notes.get('weekly'))!.title).toBe('Renamed'), { timeout: 3000 });
    expect(await screen.findByText(/Saved just now/)).toBeTruthy();
  });

  it('REGRESSION: an edit made right before leaving the page is not lost', async () => {
    await db.notes.add(WEEKLY);
    const view = render(<NotepadView />);
    fireEvent.change(await screen.findByLabelText('Note title'), { target: { value: 'Typed then left immediately' } });
    view.unmount(); // well inside the autosave debounce
    await waitFor(async () => expect((await db.notes.get('weekly'))!.title).toBe('Typed then left immediately'));
  });

  it('REGRESSION: switching notes flushes the one you were editing', async () => {
    await db.notes.bulkAdd([WEEKLY, LAPTOP]);
    render(<NotepadView />);
    fireEvent.change(await screen.findByLabelText('Note title'), { target: { value: 'Edited weekly' } });
    fireEvent.click(await screen.findByRole('option', { name: /Laptop/ }));
    await waitFor(async () => expect((await db.notes.get('weekly'))!.title).toBe('Edited weekly'));
    expect(await screen.findByDisplayValue('Laptop')).toBeTruthy();
  });

  it('autosaves body edits made in the editor', async () => {
    await db.notes.add(WEEKLY);
    render(<NotepadView />);
    const body = await screen.findByLabelText('Note body');
    await waitFor(() => expect(body.querySelector('p')).toBeTruthy());
    const p = body.querySelector('p')!;
    await act(async () => {
      p.textContent = 'Main goals for this week, plus more words here';
      await new Promise((r) => setTimeout(r, 50));
    });
    await waitFor(async () => expect((await db.notes.get('weekly'))!.content).toContain('plus more words here'), { timeout: 3000 });
  });

  it('tags: add (normalised, no duplicates) and remove', async () => {
    await db.notes.add(WEEKLY);
    render(<NotepadView />);
    fireEvent.click(await screen.findByRole('button', { name: /Add tag/ }));
    const input = screen.getByLabelText('New tag');
    fireEvent.change(input, { target: { value: '#Study' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(async () => expect((await db.notes.get('weekly'))!.tags).toEqual(['Study']));
    fireEvent.click(screen.getByRole('button', { name: /Add tag/ }));
    const again = screen.getByLabelText('New tag');
    fireEvent.change(again, { target: { value: 'study' } });
    fireEvent.keyDown(again, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 50));
    expect((await db.notes.get('weekly'))!.tags).toEqual(['Study']); // duplicate ignored
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag Study' }));
    await waitFor(async () => expect((await db.notes.get('weekly'))!.tags).toEqual([]));
  });

  it('link bar rejects unsafe schemes and accepts web links', async () => {
    await db.notes.add(WEEKLY);
    render(<NotepadView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Link' }));
    const input = screen.getByLabelText('Link address');
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByLabelText('Link address')).toBeNull());
  });

  it('action menu: pin, duplicate, convert to wishlist, delete (with confirmation)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await db.notes.add(WEEKLY);
    render(<NotepadView />);
    const open = async () => fireEvent.click(await screen.findByRole('button', { name: 'Note actions' }));

    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Pin to top/ }));
    await waitFor(async () => expect((await db.notes.get('weekly'))!.pinned).toBe(true));

    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Convert to wishlist item/ }));
    await waitFor(async () => expect((await db.notes.get('weekly'))!.kind).toBe('wishlist'));
    expect(await screen.findByLabelText('Wishlist details')).toBeTruthy();

    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }));
    await waitFor(async () => expect(await db.notes.count()).toBe(2));
    expect((await db.notes.toArray()).some((n) => n.title === 'Weekly priorities (copy)' && !n.pinned)).toBe(true);

    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    await waitFor(async () => expect(await db.notes.count()).toBe(1));
  });

  it('wishlist: "New wish" creates a wishlist item whose details persist', async () => {
    await db.notes.add(base({ id: 'seed', title: 'Seed' }));
    render(<NotepadView />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Wishlist' }));
    fireEvent.click(screen.getByRole('button', { name: /New wish/ }));
    await waitFor(async () => expect((await db.notes.toArray()).filter((n) => n.kind === 'wishlist')).toHaveLength(1));
    const details = within(await screen.findByLabelText('Wishlist details'));
    fireEvent.change(details.getByLabelText('Status'), { target: { value: 'in_progress' } });
    fireEvent.change(details.getByLabelText('Est. cost'), { target: { value: '1200.5' } });
    fireEvent.blur(details.getByLabelText('Est. cost'));
    fireEvent.change(details.getByLabelText('Link'), { target: { value: 'shop.example.com/x' } });
    fireEvent.blur(details.getByLabelText('Link'));
    await waitFor(async () => {
      const w = (await db.notes.toArray()).find((n) => n.kind === 'wishlist')!;
      expect(w.wishlist).toMatchObject({ status: 'in_progress', estimatedCost: 1200.5, url: 'https://shop.example.com/x' });
    });
  });

  it('full screen toggles and Esc exits', async () => {
    await db.notes.add(WEEKLY);
    render(<NotepadView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Full screen' }));
    expect(screen.getByLabelText('Note editor').className).toContain('is-fullscreen');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByLabelText('Note editor').className).not.toContain('is-fullscreen');
  });
});

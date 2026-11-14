// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { db } from '../db/schema';
import { NotepadView } from '../views/NotepadView';

const now = new Date().toISOString();
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.notes.add({ id: 'n1', title: 'Cybersecurity study plan', content: '<p>Roadmap</p>', format: 'html', kind: 'note', tags: ['security'], pinned: true, createdAt: now, updatedAt: now });
});
afterEach(cleanup);

describe('Workspace inspector', () => {
  it('shows details, tags, related items and actions for the selected note', async () => {
    render(<NotepadView />);
    const insp = await screen.findByLabelText('Note details', { selector: 'aside' });
    expect(insp).toBeTruthy();
    for (const t of ['Note Details', 'Tags', 'Related Items', 'Actions']) expect(screen.getByText(t)).toBeTruthy();
    for (const a of [/Duplicate/, /Move/, /Export/, /Lock/, /Delete/]) expect(screen.getAllByRole('button', { name: a }).length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: /Favorites/ })).toBeTruthy();
  });

  it('favorite toggle persists and the Favorites filter finds the note', async () => {
    render(<NotepadView />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Favorite' }));
    await waitFor(async () => expect((await db.notes.get('n1'))!.favorite).toBe(true));
    fireEvent.click(screen.getByRole('radio', { name: /Favorites/ }));
    expect(await screen.findByRole('option', { name: /Cybersecurity study plan/ })).toBeTruthy();
  });

  it('adds only http(s) related links; rejects javascript: URLs', async () => {
    render(<NotepadView />);
    fireEvent.change(await screen.findByLabelText('Related link URL'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add related link' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((await db.notes.get('n1'))!.related ?? []).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Related link URL'), { target: { value: 'tryhackme.com' } });
    fireEvent.change(screen.getByLabelText('Related link title'), { target: { value: 'TryHackMe labs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add related link' }));
    await waitFor(async () => expect((await db.notes.get('n1'))!.related?.[0]).toMatchObject({ title: 'TryHackMe labs', url: 'https://tryhackme.com/' }));
    const link = await screen.findByRole('link', { name: 'Open TryHackMe labs' });
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('Lock makes the title read-only and disables delete in the inspector', async () => {
    render(<NotepadView />);
    fireEvent.click(await screen.findByRole('button', { name: /^Lock/ }));
    await waitFor(async () => expect((await db.notes.get('n1'))!.locked).toBe(true));
    await waitFor(() => expect((screen.getByLabelText('Note title') as HTMLInputElement).readOnly).toBe(true));
    const del = screen.getAllByRole('button', { name: /Delete/ }).find((b) => (b as HTMLButtonElement).disabled);
    expect(del).toBeTruthy();
  });
});

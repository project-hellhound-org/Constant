// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { format } from 'date-fns';
import { db } from '../db/schema';
import { DoListView } from '../views/DoListView';

const today = format(new Date(), 'yyyy-MM-dd');
const now = new Date().toISOString();
const task = (id: string, title: string, extra: object = {}) => ({ id, title, status: 'planned' as const, priority: 'medium' as const, createdAt: now, updatedAt: now, ...extra });
const step = (id: string, taskId: string, title: string, order: number, extra: object = {}) => ({ id, taskId, title, completed: false, order, createdAt: now, updatedAt: now, ...extra });

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.tasks.bulkAdd([task('a', 'Write report', { dueDate: '2099-01-01' }), task('b', 'Plan trip')]);
  await db.doItems.bulkAdd([step('a1', 'a', 'Outline', 0), step('a2', 'a', 'Draft', 1, { scheduledDate: today, scheduledTime: '09:00' }), step('b1', 'b', 'Book flights', 0)]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const card = async (title: string) => within(await screen.findByRole('article', { name: title }));

const expand = async (name: string) => { fireEvent.click(await screen.findByRole('button', { name: `Expand ${name}` })); };

describe('To-Do view (tasks + subtasks in one place)', () => {
  it('shows each task with progress; expanding reveals its subtasks', async () => {
    render(<DoListView />);
    const a = await card('Write report');
    expect(a.getByText('0/2')).toBeTruthy();
    await expand('Write report');
    expect(await a.findByText('Outline')).toBeTruthy();
    expect(await a.findByText('Draft')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /All Tasks/ })).toBeTruthy();
  });

  it('finishing the last subtask completes the task; unchecking re-opens it', async () => {
    render(<DoListView />);
    const a = await card('Write report');
    await expand('Write report');
    fireEvent.click(await a.findByRole('button', { name: 'Mark "Outline" done' }));
    fireEvent.click(await a.findByRole('button', { name: 'Mark "Draft" done' }));
    await waitFor(async () => expect((await db.tasks.get('a'))!.status).toBe('completed'));
    await waitFor(() => expect(a.getByRole('checkbox', { name: 'Reopen task Write report' })).toBeTruthy());
    fireEvent.click(await a.findByRole('button', { name: 'Mark "Draft" not done' }));
    await waitFor(async () => expect((await db.tasks.get('a'))!.status).toBe('in_progress'));
  });

  it('Completion Behavior toggle off stops automatic parent completion', async () => {
    render(<DoListView />);
    fireEvent.click(await screen.findByRole('article', { name: 'Plan trip' }));
    const toggle = await screen.findByRole('switch', { name: /Auto-complete when all subtasks/ });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(toggle);
    await waitFor(async () => expect((await db.tasks.get('b'))!.autoComplete).toBe(false));
    await expand('Plan trip');
    const b = await card('Plan trip');
    fireEvent.click(await b.findByRole('button', { name: 'Mark "Book flights" done' }));
    await waitFor(async () => expect((await db.doItems.get('b1'))!.completed).toBe(true));
    expect((await db.tasks.get('b'))!.status).toBe('planned');
  });

  it('filter tabs show counts and filter; inspector edits priority, tags and category', async () => {
    render(<DoListView />);
    expect(await screen.findByRole('tab', { name: /Today\s*1/ })).toBeTruthy();   // Draft is scheduled today
    expect(screen.getByRole('tab', { name: /Upcoming\s*1/ })).toBeTruthy();       // Write report due 2099
    fireEvent.click(screen.getByRole('tab', { name: /Completed/ }));
    expect(await screen.findByText('Nothing matches this filter.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /All Tasks/ }));
    fireEvent.click(await screen.findByRole('article', { name: 'Plan trip' }));
    fireEvent.change(await screen.findByLabelText('Priority'), { target: { value: 'high' } });
    await waitFor(async () => expect((await db.tasks.get('b'))!.priority).toBe('high'));
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const input = screen.getByLabelText('New tag');
    fireEvent.change(input, { target: { value: 'travel' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(async () => expect((await db.tasks.get('b'))!.tags).toEqual(['travel']));
    fireEvent.blur(screen.getByLabelText('Category'), { target: { value: 'Personal' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Personal' } });
    fireEvent.blur(screen.getByLabelText('Category'));
    await waitFor(async () => expect((await db.tasks.get('b'))!.category).toBe('Personal'));
    expect(screen.getByRole('tab', { name: /Personal\s*1/ })).toBeTruthy();
  });

  it('adds a scheduled subtask inline from the expanded card', async () => {
    render(<DoListView />);
    await expand('Plan trip');
    const b = await card('Plan trip');
    fireEvent.click(await b.findByRole('button', { name: 'Toggle scheduling for new step' }));
    fireEvent.change(b.getByLabelText('New Do-List step'), { target: { value: 'Pack bags' } });
    fireEvent.change(b.getByLabelText('New step date'), { target: { value: today } });
    fireEvent.click(b.getByRole('button', { name: /^Add$/ }));
    await waitFor(async () => expect((await db.doItems.where('taskId').equals('b').toArray()).find((i) => i.title === 'Pack bags')?.scheduledDate).toBe(today));
  });

  it('deleting a task removes its steps (after confirmation)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DoListView />);
    fireEvent.click(await screen.findByRole('button', { name: 'More actions for Write report' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await waitFor(async () => expect(await db.tasks.get('a')).toBeUndefined());
    expect(await db.doItems.where('taskId').equals('a').count()).toBe(0);
    expect(await db.doItems.where('taskId').equals('b').count()).toBe(1);
  });

  it('"New Task" opens the creation panel with Do-List steps', async () => {
    render(<DoListView />);
    fireEvent.click(await screen.findByRole('button', { name: /New Task/ }));
    expect(await screen.findByText(/Do-List Steps/)).toBeTruthy();
  });
});

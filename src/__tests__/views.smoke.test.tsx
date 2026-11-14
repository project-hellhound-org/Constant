// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { format } from 'date-fns';
import { db } from '../db/schema';
import { AnalyticsView } from '../views/AnalyticsView';
import { CalendarView } from '../views/CalendarView';
import { HabitsView } from '../views/HabitsView';
import { NotepadView } from '../views/NotepadView';
import { DoListView } from '../views/DoListView';
import { AddHabitModal } from '../components/AddHabitModal';
import { AddTaskModal } from '../components/AddTaskModal';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { Sidebar } from '../components/Sidebar';

const today = format(new Date(), 'yyyy-MM-dd');
const now = new Date().toISOString();

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.add({ id: 'default', userName: 'Tester', theme: 'light', accentColor: '#fff', themeId: 'sage-minimal', fontId: 'inter', backgroundId: 'sage-leaves', weekStartDay: 1, productivityWeights: { habitWeight: 50, taskWeight: 40, focusWeight: 0, goalWeight: 10 }, streakSkipRule: 'pause', streakFreezeEarned: 0, consecutiveDays100Pct: 0 });
  await db.habits.add({
    id: 'h1', name: 'Study Cybersecurity', category: 'Learning & Growth', color: '#000', archived: 0, createdAt: now, startDate: '2026-01-01',
    subHabits: [
      { id: 's1', title: 'TCP handshake', topic: 'Networking', activity: 'Trace it in Wireshark', estimatedMinutes: 30, completed: false, order: 0 },
      { id: 's2', title: 'Port scanning lab', topic: 'Practice', completed: false, order: 1 },
    ],
  });
  await db.tasks.add({ id: 't1', title: 'Write report', status: 'todo', priority: 'high', dueDate: today, createdAt: now, updatedAt: now });
});
afterEach(cleanup);

describe('changed views render without runtime errors', () => {
  it('Analytics: snapshot in the corner + stacked column and line charts, range controls work', async () => {
    render(<AnalyticsView />);
    expect(await screen.findByLabelText('Performance snapshot')).toBeTruthy();
    expect(screen.getByText('Habit check-ins by outcome')).toBeTruthy();
    expect(screen.getByText('Habit completion rate (%)')).toBeTruthy();
    expect(screen.getByText('Task outcomes')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '90 days' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }));
    expect(screen.getByText(/Per week/)).toBeTruthy();
    // old removed sections must be gone
    expect(screen.queryByText(/Daily Review & Performance Snapshots/)).toBeNull();
  });

  it('Snapshot shows "—" instead of a made-up score when nothing is recorded', async () => {
    await db.habits.clear();
    await db.tasks.clear();
    render(<AnalyticsView />);
    const card = await screen.findByLabelText('Performance snapshot');
    expect(within(card).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(card).queryByText('82/100')).toBeNull();
  });

  it('Calendar: daily review at the top appends (never overwrites) for the chosen date', async () => {
    render(<CalendarView />);
    const panel = await screen.findByLabelText('Daily review');
    // Pinned near the TOP of the calendar: it must come before the timeline and the Today summary
    expect(panel.compareDocumentPosition(await screen.findByLabelText('Calendar')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.compareDocumentPosition(await screen.findByLabelText('Today summary')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const text = within(panel).getByLabelText('Review text');
    fireEvent.change(text, { target: { value: 'First reflection' } });
    fireEvent.click(within(panel).getByRole('button', { name: /Add review/ }));
    await waitFor(async () => expect((await db.dailyReviews.get(today))?.entries?.length).toBe(1));

    fireEvent.change(within(panel).getByLabelText('Review text'), { target: { value: 'Second reflection' } });
    fireEvent.click(await within(panel).findByRole('button', { name: /Append to this day/ }));
    await waitFor(async () => expect((await db.dailyReviews.get(today))?.entries?.map((e) => e.text)).toEqual(['First reflection', 'Second reflection']));
    expect((await db.dailyReviews.get(today))!.snapshotData).toBeDefined();

    // pick a different date -> it is a different review record
    fireEvent.change(within(panel).getByLabelText('Review date'), { target: { value: '2026-10-01' } });
    await within(panel).findByText(/No review recorded/);
  });

  it('Calendar: week view by default with category chips, agenda, focus block and mini calendar', async () => {
    render(<CalendarView />);
    expect((await screen.findByRole('radio', { name: 'Week' })).getAttribute('aria-checked')).toBe('true');
    for (const c of ['All', 'Tasks', 'Habits', 'Events', 'Focus', 'Personal', 'Work']) expect(screen.getByRole('button', { name: c })).toBeTruthy();
    expect(screen.queryByLabelText('Agenda')).toBeNull();            // agenda / tasks / habits box was removed
    expect(screen.queryByRole('tab', { name: 'Habits' })).toBeNull();
    expect(screen.getByLabelText('Focus block')).toBeTruthy();
    expect(screen.getByLabelText('Mini calendar')).toBeTruthy();
    expect(screen.getByLabelText("Today's overview")).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(await screen.findByText('Mon')).toBeTruthy();
  });

  it('Calendar: legacy single-text review is preserved when the first entry is appended', async () => {
    await db.dailyReviews.add({ id: today, date: today, unifiedReviewNotes: 'old text', rating: 3 });
    render(<CalendarView />);
    const panel = await screen.findByLabelText('Daily review');
    await within(panel).findByText('old text');
    fireEvent.change(within(panel).getByLabelText('Review text'), { target: { value: 'new text' } });
    fireEvent.click(within(panel).getByRole('button', { name: /Append to this day/ }));
    await waitFor(async () => expect((await db.dailyReviews.get(today))?.entries?.map((e) => e.text)).toEqual(['old text', 'new text']));
  });

  it('Habits: sub-topics are visible directly under the parent; ticking all completes it', async () => {
    render(<HabitsView />);
    const list = await screen.findByRole('list', { name: /Sub-topics of/ });   // no click needed to reveal
    expect(list).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Toggle sub-habits of/ })).toBeNull();
    expect(screen.getByText('Networking')).toBeTruthy();
    expect(screen.getByText('Practice')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /TCP handshake: mark complete/ }));
    await waitFor(async () => expect((await db.habitLogs.toArray())[0]?.status).toBe('partial'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Port scanning lab: mark complete/ }));
    await waitFor(async () => expect((await db.habitLogs.toArray())[0]?.status).toBe('completed'));
    expect(await screen.findByText(/2\/2 sub-topics · 100%/)).toBeTruthy();
  });

  it('Habits: six tabs, five summary cards, weekly consistency, categories and upcoming panels', async () => {
    render(<HabitsView />);
    for (const t of ['Overview', 'Habits', 'Routines', 'Streaks', 'Calendar', 'Insights']) expect(await screen.findByRole('tab', { name: new RegExp(t) })).toBeTruthy();
    for (const c of [/Today's Completion/, /Current Streak/, /Weekly Average/, /Active Habits/, /Goal Habits/]) expect(screen.getAllByText(c).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Weekly consistency')).toBeTruthy();
    expect(screen.getByLabelText('Habit categories')).toBeTruthy();
    expect(screen.getByLabelText('Upcoming habits')).toBeTruthy();
  });

  it('Habits: checking a habit stores a timestamped log, unchecking removes it', async () => {
    render(<HabitsView />);
    const box = await screen.findByRole('checkbox', { name: /Mark complete: / });
    fireEvent.click(box);
    await waitFor(async () => { const l = (await db.habitLogs.toArray())[0]; expect(l?.status).toBe('completed'); expect(l?.loggedAt).toBeTruthy(); });
    fireEvent.click(await screen.findByRole('checkbox', { name: /Mark incomplete: / }));
    await waitFor(async () => expect(await db.habitLogs.count()).toBe(0));
  });

  it('Task modal has no start date field; habit modal is one panel with five categories', async () => {
    const { unmount } = render(<AddTaskModal isOpen onClose={() => {}} />);
    expect(screen.queryByText(/Start Date/)).toBeNull();
    expect(screen.getByText(/Tasks have no start date/)).toBeTruthy();
    expect(screen.getByText(/Do-List Steps/)).toBeTruthy();
    unmount();
    render(<AddHabitModal isOpen onClose={() => {}} />);
    for (const l of ['Habit Name', 'Category', /Sub-Topics/, 'Start Date', 'Scheduled Time']) expect(screen.getAllByText(l).length).toBeGreaterThan(0);
    expect(screen.getByText('Days Frequency')).toBeTruthy();
    const options = Array.from((screen.getByLabelText('Category') as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(['Health', 'Learning', 'Work', 'Growth', 'WellBeing']);
    expect(screen.getAllByRole('textbox', { name: /Sub-Topics/ })).toHaveLength(1);      // single input area
    expect(screen.getByRole('radio', { name: 'AM' })).toBeTruthy();
    expect(document.querySelectorAll('h4').length).toBe(0);                               // no stacked sub-panels
  });

  it('Sidebar: To-Do List and Workspace present; Tasks / Wishlist / Notes & Tags / Daily Review entries removed', async () => {
    render(<Sidebar activeTab="dashboard" setActiveTab={() => {}} />);
    expect(await screen.findByText('To-Do List')).toBeTruthy();
    expect(screen.getByText('Workspace')).toBeTruthy();
    for (const gone of ['Tasks', 'Daily Review', 'Wishlist', 'Notes & Tags']) expect(screen.queryByText(gone)).toBeNull();
  });

  it('Markdown renders as HTML elements rather than raw markers', () => {
    const { container } = render(<MarkdownMessage text={'## Plan\n\n1. **Do** it\n2. `code`'} />);
    expect(container.querySelector('h2')?.textContent).toBe('Plan');
    expect(container.querySelectorAll('ol li').length).toBe(2);
    expect(container.textContent).not.toContain('**');
  });
});

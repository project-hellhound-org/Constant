// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { format } from 'date-fns';
import { db } from '../db/schema';
import { FinanceView } from '../views/FinanceView';
import { AddHabitModal } from '../components/AddHabitModal';
import { normalizeHabitCategory, parseSubTopics, HABIT_CATEGORIES } from '../engine/habitCategories';

const today = format(new Date(), 'yyyy-MM-dd');
const now = new Date().toISOString();
configure({ asyncUtilTimeout: 5000 }); // slower CI machines: PBKDF2 / IndexedDB waits
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.add({ id: 'default', userName: 'R' } as any);
  await db.financeAccounts.bulkAdd([{ id: 'a1', name: 'Main Bank', type: 'bank', balance: 1000, currency: 'USD', createdAt: now }, { id: 'a2', name: 'Wallet', type: 'cash', balance: 50, currency: 'USD', createdAt: now }]);
  await db.financeTransactions.bulkAdd([
    { id: 't1', type: 'expense', amount: 1000, accountId: 'a1', category: 'Food', date: today, createdAt: now },
    { id: 't2', type: 'expense', amount: 20, accountId: 'a2', category: 'Transport', date: today, createdAt: now },
  ]);
});
afterEach(cleanup);

describe('Finance: accounts can be edited and removed', () => {
  it('edits an account name, type and balance', async () => {
    render(<FinanceView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit account Main Bank' }));
    expect(await screen.findByText('Edit Financial Account')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Chase Checking/), { target: { value: 'Primary Bank' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Account' }));
    await waitFor(async () => expect(await db.financeAccounts.get('a1')).toMatchObject({ name: 'Primary Bank', balance: 1500 }));
    expect(await db.financeAccounts.count()).toBe(2);
  });
  it('deletes an account (and its transactions) only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<FinanceView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account Main Bank' }));
    expect(await db.financeAccounts.count()).toBe(2);                           // cancelled
    fireEvent.click(screen.getByRole('button', { name: 'Delete account Main Bank' }));
    await waitFor(async () => expect(await db.financeAccounts.get('a1')).toBeUndefined());
    expect(await db.financeTransactions.get('t1')).toBeUndefined();            // its transaction went with it
    expect(await db.financeTransactions.get('t2')).toBeTruthy();               // other account untouched
    expect(confirm.mock.calls[1][0]).toMatch(/1 transaction/);
  });
});

describe('Finance: the selected currency is retained and reflected everywhere', () => {
  it('persists the currency, applies it to the category breakdown and stamps new entries', async () => {
    render(<FinanceView />);
    const select = (await screen.findAllByLabelText('Currency'))[0];
    expect((select as HTMLSelectElement).value).toBe('USD');
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).toEqual(expect.arrayContaining(['USD', 'INR', 'RUB']));
    fireEvent.change(select, { target: { value: 'INR' } });
    await waitFor(async () => expect((await db.settings.get('default'))!.financeCurrency).toBe('INR'));
    const breakdown = await screen.findByLabelText('Category breakdown');
    await waitFor(() => expect(breakdown.textContent).toContain('₹'));
    expect(breakdown.textContent).not.toContain('$');
    // the add-transaction form follows the same currency
    expect((screen.getByLabelText('Amount').closest('form')!.querySelector('#tx-currency') as HTMLSelectElement).value).toBe('INR');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '75' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Bills' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Transaction' }));
    await waitFor(async () => expect((await db.financeTransactions.toArray()).find((t) => t.category === 'Bills')?.currency).toBe('INR'));
  });
  it('keeps the currency across remounts until it is manually changed (RUB)', async () => {
    await db.settings.update('default', { financeCurrency: 'RUB' });
    const cur = async () => ((await screen.findAllByLabelText('Currency'))[0] as HTMLSelectElement).value;
    const { unmount } = render(<FinanceView />);
    await waitFor(async () => expect(await cur()).toBe('RUB'));
    unmount();
    render(<FinanceView />);
    await waitFor(async () => expect(await cur()).toBe('RUB'));
    expect((await screen.findByLabelText('Category breakdown')).textContent).toMatch(/₽|RUB/);
  });
});

describe('Habit categories and single-panel creation', () => {
  it('only five categories exist and legacy ones map onto them', () => {
    expect([...HABIT_CATEGORIES]).toEqual(['Health', 'Learning', 'Work', 'Growth', 'WellBeing']);
    const map: Record<string, string> = { 'Fitness & Health': 'Health', 'Learning & Growth': 'Learning', 'Work & Projects': 'Work', Study: 'Learning', Productivity: 'Work', Mindfulness: 'WellBeing', Wellbeing: 'WellBeing', Growth: 'Growth', '': 'Health', Weird: 'Growth' };
    for (const [from, to] of Object.entries(map)) expect(normalizeHabitCategory(from)).toBe(to);
  });
  it('parses the single sub-topics box (lines or commas, de-duplicated)', () => {
    expect(parseSubTopics('EC-Council\nCisco, Networking\n  cisco \n\n')).toEqual(['EC-Council', 'Cisco', 'Networking']);
  });
  it('creates a habit with category and sub-topics from one panel', async () => {
    render(<AddHabitModal isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Habit Name'), { target: { value: 'Study Path' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Learning' } });
    fireEvent.change(screen.getByLabelText(/Sub-Topics/), { target: { value: 'EC-Council\nCisco\nNetworking' } });
    fireEvent.click(screen.getByRole('radio', { name: 'PM' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Custom days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fri' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Habit' }));
    await waitFor(async () => expect(await db.habits.count()).toBe(1));
    const h = (await db.habits.toArray())[0];
    expect(h).toMatchObject({ name: 'Study Path', category: 'Learning', amPm: 'PM', frequencyMode: 'custom' });
    expect(h.subHabits!.map((s) => s.title)).toEqual(['EC-Council', 'Cisco', 'Networking']);
    expect(h.selectedDays).not.toContain(5);   // Custom days start with every day on; clicking Fri turned it off
    expect(h.selectedDays).toHaveLength(6);
  });
  it('editing keeps ids and progress of sub-topics that are still listed', async () => {
    await db.habits.add({ id: 'h', name: 'Study Path', category: 'Learning', frequencyMode: 'everyday', archived: 0, createdAt: now, subHabits: [{ id: 'keep', title: 'Cisco', order: 0, completed: true }, { id: 'drop', title: 'Old', order: 1, completed: false }] } as any);
    const habit = (await db.habits.get('h'))!;
    render(<AddHabitModal isOpen onClose={() => {}} habitToEdit={habit} />);
    const box = screen.getByLabelText(/Sub-Topics/) as HTMLTextAreaElement;
    expect(box.value).toBe('Cisco\nOld');
    fireEvent.change(box, { target: { value: 'Cisco\nNetworking' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(async () => expect((await db.habits.get('h'))!.subHabits!.map((s) => s.title)).toEqual(['Cisco', 'Networking']));
    const subs = (await db.habits.get('h'))!.subHabits!;
    expect(subs[0].id).toBe('keep'); expect(subs[0].completed).toBe(true);
    expect(subs[1].id).not.toBe('drop');
  });
});

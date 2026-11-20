// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configure, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { format } from 'date-fns';
import { db } from '../db/schema';
import { FinanceView } from '../views/FinanceView';
import { TransactionForm } from '../components/TransactionForm';

const today = format(new Date(), 'yyyy-MM-dd');
const now = new Date().toISOString();
configure({ asyncUtilTimeout: 5000 }); // slower CI machines: PBKDF2 / IndexedDB waits
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.financeAccounts.bulkAdd([{ id: 'a1', name: 'Main Bank', type: 'bank', balance: 1000, currency: 'USD', createdAt: now }, { id: 'a2', name: 'Savings', type: 'savings', balance: 500, currency: 'USD', createdAt: now }]);
  await db.financeTransactions.bulkAdd([
    { id: 't1', type: 'income', amount: 3000, accountId: 'a1', category: 'Salary', date: today, createdAt: now },
    { id: 't2', type: 'expense', amount: 1000, accountId: 'a1', category: 'Food', date: today, createdAt: now },
  ]);
});
afterEach(cleanup);

describe('Finance overview', () => {
  it('shows summary cards, charts, breakdown, add-transaction panel and accounts', async () => {
    render(<FinanceView />);
    expect(await screen.findByText('Total Income')).toBeTruthy();
    expect(screen.getByText('Total Expenses')).toBeTruthy();
    expect(screen.getByText('Total Savings')).toBeTruthy();
    expect(screen.getByLabelText('Spending by category')).toBeTruthy();
    expect(screen.getByLabelText('Income vs expenses vs savings')).toBeTruthy();
    expect(screen.getByLabelText('Category breakdown')).toBeTruthy();
    expect(screen.getByLabelText('Add transaction')).toBeTruthy();
    expect(screen.getByLabelText('Accounts')).toBeTruthy();
    for (const f of ['Amount', 'Account', 'Category', 'Date', 'Time', 'Merchant (optional)', 'Description (optional)', 'Notes (optional)']) expect(screen.getByLabelText(f)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Month' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('TransactionForm', () => {
  it('saves a new expense and updates the account balance', async () => {
    const accounts = await db.financeAccounts.toArray();
    render(<TransactionForm accounts={accounts} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Transport' } });
    fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'metro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Transaction' }));
    await waitFor(async () => expect(await db.financeTransactions.count()).toBe(3));
    expect((await db.financeAccounts.get('a1'))!.balance).toBe(960);
    const saved = (await db.financeTransactions.toArray()).find((t) => t.category === 'Transport')!;
    expect(saved.notes).toBe('metro'); expect(saved.currency).toBe('USD'); expect(saved.time).toBeTruthy();
  });
  it('editing an amount corrects the balance instead of leaving it stale', async () => {
    const accounts = await db.financeAccounts.toArray();
    const tx = (await db.financeTransactions.get('t2'))!;
    render(<TransactionForm accounts={accounts} transaction={tx} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Transaction' }));
    await waitFor(async () => expect((await db.financeTransactions.get('t2'))!.amount).toBe(1200));
    expect((await db.financeAccounts.get('a1'))!.balance).toBe(800); // 1000 + 1000 (undo) - 1200
  });
  it('rejects an empty amount and a same-account transfer', async () => {
    const accounts = await db.financeAccounts.toArray();
    render(<TransactionForm accounts={accounts} onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Transaction' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(await db.financeTransactions.count()).toBe(2);
  });
});

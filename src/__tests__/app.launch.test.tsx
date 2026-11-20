// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { ThemeProvider } from '../theme/ThemeProvider';
import { db } from '../db/schema';
import { RESET_EVENT } from '../views/SettingsView';
import { resetAllDataToInitialState } from '../db/seed';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await Promise.all(db.tables.map((t) => t.clear())); });
afterEach(cleanup);

const mount = () => render(<ThemeProvider><App /></ThemeProvider>);

describe('App launch', () => {
  it('shows CONSTANT / Personalized Routine Tracker, then the sign-up portal on first launch', async () => {
    mount();
    expect(await screen.findByLabelText(/CONSTANT, Personalized Routine Tracker, loading/)).toBeTruthy();
    expect(screen.getByText('CONSTANT')).toBeTruthy();
    expect(screen.getByText('Personalized Routine Tracker')).toBeTruthy();
    expect(await screen.findByRole('form', { name: 'Create account' }, { timeout: 5000 })).toBeTruthy();
  }, 10000);

  it('create account -> dashboard -> reset returns to a blank sign-up', async () => {
    mount();
    await screen.findByRole('form', { name: 'Create account' }, { timeout: 5000 });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rithish' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'r@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'correct-horse' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }));
    expect(await screen.findByText(/Rithish!/, {}, { timeout: 5000 })).toBeTruthy();   // dashboard greeting
    expect(screen.getByRole('navigation', { name: 'Modules' })).toBeTruthy();

    await act(async () => { await resetAllDataToInitialState(); window.dispatchEvent(new Event(RESET_EVENT)); });
    const form = await screen.findByRole('form', { name: 'Create account' }, { timeout: 5000 });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
    expect(form).toBeTruthy();
    expect(await db.habits.count()).toBe(0);
    expect(screen.queryByRole('navigation', { name: 'Modules' })).toBeNull();
  }, 15000);

<<<<<<< HEAD
  it('a returning user stays signed in after restarting the app and is greeted by name', async () => {
    mount();
    await screen.findByRole('form', { name: 'Create account' }, { timeout: 5000 });
    cleanup();
    const { createAccount } = await import('../auth/account');
    await createAccount({ name: 'Rithish', email: 'r@example.com', password: 'correct-horse' }); // starts a persisted session
    sessionStorage.clear(); // closing the app clears sessionStorage; the persisted session must survive
    mount();
    expect(await screen.findByText(/Good (morning|afternoon|evening), Rithish/, {}, { timeout: 5000 })).toBeTruthy(); // launch greeting
    expect(await screen.findByRole('navigation', { name: 'Modules' }, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Sign in' })).toBeNull();
  }, 15000);

  it('after signing out (or an expired session) the sign-in form is shown', async () => {
    const { createAccount, endSession } = await import('../auth/account');
    await createAccount({ name: 'Rithish', email: 'r@example.com', password: 'correct-horse' });
    endSession();
=======
  it('a returning user sees the sign-in form (not the app) until authenticated', async () => {
    mount();
    await screen.findByRole('form', { name: 'Create account' }, { timeout: 5000 });
    cleanup(); sessionStorage.clear();
    const { createAccount } = await import('../auth/account');
    await createAccount({ name: 'Rithish', email: 'r@example.com', password: 'correct-horse' });
    sessionStorage.clear();
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
    mount();
    expect(await screen.findByRole('form', { name: 'Sign in' }, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Modules' })).toBeNull();
  }, 15000);
});

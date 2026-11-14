// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { db } from '../db/schema';
import { AIEnginePanel } from '../components/AIEnginePanel';
import { getAISettings } from '../services/aiProviderService';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline')))); // Ollama tag discovery
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('AIEnginePanel persistence (regression: settings reverted when leaving the menu)', () => {
  it('keeps cloud AND local config after navigating away immediately, then returning', async () => {
    const first = render(<AIEnginePanel />);
    await screen.findByText('Local Model (Ollama)', { exact: false });

    // configure LOCAL
    type('Model Name', 'qwen2.5:3b-instruct');
    // switch to CLOUD (saves immediately) and configure it
    fireEvent.click(screen.getByRole('radio', { name: /Cloud Model/ }));
    type(/API Key/, 'sk-live-ABCD1234');
    type('Base URL *', 'https://openrouter.ai/api/v1');
    type('Model Name *', 'anthropic/claude-sonnet');

    // User clicks another sidebar item right away — well inside the 600ms autosave debounce.
    first.unmount();

    // Come back (new mount = what navigating back to Settings does)
    render(<AIEnginePanel />);
    await screen.findByText('Cloud Model (Generic API)', { exact: false });
    await waitFor(() => expect((screen.getByLabelText(/API Key/) as HTMLInputElement).value).toBe('sk-live-ABCD1234'));
    expect((screen.getByRole('radio', { name: /Cloud Model/ })).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText('Base URL *') as HTMLInputElement).value).toBe('https://openrouter.ai/api/v1');
    expect((screen.getByLabelText('Model Name *') as HTMLInputElement).value).toBe('anthropic/claude-sonnet');

    // …and the LOCAL profile was not clobbered by switching modes
    fireEvent.click(screen.getByRole('radio', { name: /Local Model/ }));
    expect((screen.getByLabelText('Model Name') as HTMLInputElement).value).toBe('qwen2.5:3b-instruct');

    const stored = await getAISettings();
    expect(stored.profiles!.cloud.apiKey).toBe('sk-live-ABCD1234');
  });

  it('the explicit Save button persists immediately and reports it', async () => {
    render(<AIEnginePanel />);
    await screen.findByText('Local Model (Ollama)', { exact: false });
    fireEvent.click(screen.getByRole('radio', { name: /Cloud Model/ }));
    type(/API Key/, 'sk-explicit');
    fireEvent.click(screen.getByRole('button', { name: /Save AI Configuration/ }));
    await waitFor(async () => expect((await getAISettings()).profiles!.cloud.apiKey).toBe('sk-explicit'));
    await screen.findByText(/Saved/);
  });

  it('warns when cloud mode is active without an API key', async () => {
    render(<AIEnginePanel />);
    await screen.findByText('Local Model (Ollama)', { exact: false });
    fireEvent.click(screen.getByRole('radio', { name: /Cloud Model/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

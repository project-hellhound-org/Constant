import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';
import type { AIProviderProfile, AISettings } from '../db/schema';
import {
  DEFAULT_AI_SETTINGS,
  getAISettings,
  maskApiKey,
  saveAISettings,
  testAIConnection,
} from '../services/aiProviderService';

type Tone = NonNullable<AISettings['tone']>;

interface Draft {
  mode: 'local' | 'cloud';
  profiles: { local: AIProviderProfile; cloud: AIProviderProfile };
  temperature: number;
  tone: Tone;
  behavioralFramework: string;
}

type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'error'; message: string };

const AUTOSAVE_DELAY_MS = 600;

const toDraft = (s: AISettings): Draft => ({
  mode: s.mode,
  profiles: { local: { ...s.profiles!.local }, cloud: { ...s.profiles!.cloud } },
  temperature: s.temperature ?? 0.7,
  tone: (s.tone ?? 'analytical') as Tone,
  behavioralFramework: s.behavioralFramework ?? '',
});

/**
 * Self-contained AI engine configuration.
 *
 * Persistence guarantees (these fix "settings revert when I leave the page"):
 *  - hydrates from the database exactly ONCE, so later renders never overwrite user edits;
 *  - Local and Cloud profiles are stored independently — switching mode never rewrites either;
 *  - every edit is autosaved (debounced); the mode toggle and the Save button save immediately;
 *  - pending edits are flushed on unmount / page hide, so navigating away cannot lose them.
 */
export const AIEnginePanel: React.FC = () => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>(['llama3.1', 'qwen2.5:3b-instruct', 'gemma2:2b', 'mistral']);

  const draftRef = useRef<Draft | null>(null);
  const lastSavedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const persist = useCallback(async (): Promise<boolean> => {
    const snapshot = draftRef.current;
    if (!snapshot) return true;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSavedRef.current) return true;
    if (mountedRef.current) setStatus({ kind: 'saving' });
    try {
      await saveAISettings({
        mode: snapshot.mode,
        profiles: snapshot.profiles,
        temperature: snapshot.temperature,
        tone: snapshot.tone,
        behavioralFramework: snapshot.behavioralFramework,
      });
      lastSavedRef.current = serialized;
      if (mountedRef.current) setStatus({ kind: 'saved', at: new Date() });
      return true;
    } catch (err: any) {
      if (mountedRef.current) setStatus({ kind: 'error', message: err?.message || 'Could not save AI configuration.' });
      return false;
    }
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const update = useCallback(
    (fn: (d: Draft) => Draft, immediate = false) => {
      if (!draftRef.current) return;
      const next = fn(draftRef.current);
      draftRef.current = next;
      setDraft(next);
      setTestResult(null);
      clearTimer();
      if (immediate) void persist();
      else timerRef.current = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
    },
    [persist]
  );

  const updateProfile = (mode: 'local' | 'cloud', patch: Partial<AIProviderProfile>) =>
    update((d) => ({ ...d, profiles: { ...d.profiles, [mode]: { ...d.profiles[mode], ...patch } } }));

  // One-time hydration + flush-on-leave.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    getAISettings().then((s) => {
      if (cancelled) return;
      const initial = toDraft(s);
      draftRef.current = initial;
      lastSavedRef.current = JSON.stringify(initial);
      setDraft(initial);
    });

    const flush = () => {
      clearTimer();
      void persist();
    };
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush(); // navigating to another menu must not lose pending edits
    };
  }, [persist]);

  // Discover installed Ollama models from the configured local endpoint.
  const localEndpoint = draft?.profiles.local.endpoint;
  useEffect(() => {
    if (!localEndpoint) return;
    let origin: string;
    try {
      origin = new URL(localEndpoint).origin;
    } catch {
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`${origin}/api/tags`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          const names: string[] = Array.isArray(data?.models) ? data.models.map((m: any) => m.name) : [];
          if (names.length > 0) setLocalModels(names);
        })
        .catch(() => {});
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [localEndpoint]);

  if (!draft) {
    return (
      <div className="liquid-panel flip-card-item">
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={20} style={{ color: 'var(--accent-secondary)' }} /> AI Engine Setup
        </h3>
        <p className="subtitle" style={{ marginTop: '0.75rem' }}>Loading saved configuration…</p>
      </div>
    );
  }

  const { mode } = draft;
  const profile = draft.profiles[mode];

  const handleTest = async () => {
    setTestResult(null);
    setIsTesting(true);
    const res = await testAIConnection({
      ...DEFAULT_AI_SETTINGS,
      mode,
      provider: mode === 'local' ? 'ollama' : 'cloud',
      model: profile.model,
      endpoint: profile.endpoint,
      apiKey: profile.apiKey,
      temperature: draft.temperature,
      tone: draft.tone,
      behavioralFramework: draft.behavioralFramework,
    });
    setIsTesting(false);
    setTestResult(res);
  };

  const handleSaveNow = async () => {
    clearTimer();
    await persist();
  };

  const cloudMissingKey = mode === 'cloud' && !draft.profiles.cloud.apiKey.trim();

  return (
    <div className="liquid-panel flip-card-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Sparkles size={20} style={{ color: 'var(--accent-secondary)' }} /> AI Engine Setup
        </h3>
        <span role="status" aria-live="polite" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: status.kind === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}>
          {status.kind === 'saving' && (<><Loader2 size={14} className="animate-spin" /> Saving…</>)}
          {status.kind === 'saved' && (<><CheckCircle2 size={14} style={{ color: 'var(--accent-secondary)' }} /> Saved {status.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>)}
          {status.kind === 'error' && (<><AlertCircle size={14} /> {status.message}</>)}
          {status.kind === 'idle' && 'Changes save automatically'}
        </span>
      </div>

      {/* Mode selector — only changes which profile is ACTIVE; both profiles are kept. */}
      <div role="radiogroup" aria-label="AI provider mode" style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'local'}
          className={`btn ${mode === 'local' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '0.85rem', fontSize: '0.95rem' }}
          onClick={() => update((d) => ({ ...d, mode: 'local' }), true)}
        >
          🏠 Local Model (Ollama)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'cloud'}
          className={`btn ${mode === 'cloud' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '0.85rem', fontSize: '0.95rem' }}
          onClick={() => update((d) => ({ ...d, mode: 'cloud' }), true)}
        >
          ☁️ Cloud Model (Generic API)
        </button>
      </div>

      {mode === 'local' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-local-model">Model Name</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="ai-local-model"
                type="text"
                className="form-input"
                style={{ flex: 1 }}
                placeholder="e.g. llama3.1, qwen2.5, mistral..."
                value={draft.profiles.local.model}
                onChange={(e) => updateProfile('local', { model: e.target.value })}
              />
              {localModels.length > 0 && (
                <select
                  className="form-select"
                  style={{ width: '160px' }}
                  aria-label="Installed local models"
                  value={localModels.includes(draft.profiles.local.model) ? draft.profiles.local.model : ''}
                  onChange={(e) => e.target.value && updateProfile('local', { model: e.target.value })}
                >
                  <option value="">Select Local...</option>
                  {localModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-local-endpoint">Base URL / Endpoint</label>
            <input
              id="ai-local-endpoint"
              type="text"
              className="form-input"
              value={draft.profiles.local.endpoint}
              onChange={(e) => updateProfile('local', { endpoint: e.target.value })}
              placeholder="http://localhost:11434/v1/chat/completions"
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-local-key">
              API Key (optional — only for secured/remote Ollama gateways) {profile.apiKey && <span className="subtitle">({maskApiKey(profile.apiKey)})</span>}
            </label>
            <input
              id="ai-local-key"
              type="password"
              autoComplete="off"
              className="form-input"
              value={draft.profiles.local.apiKey}
              onChange={(e) => updateProfile('local', { apiKey: e.target.value })}
              placeholder="Leave empty for a default local Ollama install"
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-cloud-key">
              API Key * {draft.profiles.cloud.apiKey && <span className="subtitle">({maskApiKey(draft.profiles.cloud.apiKey)})</span>}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="ai-cloud-key"
                type={showApiKey ? 'text' : 'password'}
                autoComplete="off"
                className="form-input"
                style={{ flex: 1, paddingRight: '2.5rem' }}
                value={draft.profiles.cloud.apiKey}
                onChange={(e) => updateProfile('cloud', { apiKey: e.target.value })}
                placeholder="Enter your API Key..."
              />
              <button
                type="button"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="subtitle" style={{ fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
              Stored only in this device's local database (not encrypted) and sent only to the Base URL below.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-cloud-endpoint">Base URL *</label>
              <input
                id="ai-cloud-endpoint"
                type="text"
                className="form-input"
                value={draft.profiles.cloud.endpoint}
                onChange={(e) => updateProfile('cloud', { endpoint: e.target.value })}
                placeholder="e.g. https://api.openai.com/v1 or https://openrouter.ai/api/v1"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-cloud-model">Model Name *</label>
              <input
                id="ai-cloud-model"
                type="text"
                className="form-input"
                value={draft.profiles.cloud.model}
                onChange={(e) => updateProfile('cloud', { model: e.target.value })}
                placeholder="e.g. gpt-4o-mini, deepseek-chat, llama-3.1-70b"
              />
            </div>
          </div>
          {cloudMissingKey && (
            <p role="alert" style={{ margin: 0, fontSize: '0.825rem', color: 'var(--warning)' }}>
              Cloud mode is selected but no API key is saved yet — Smart Insights will use the offline analytical engine until you add one.
            </p>
          )}
        </div>
      )}

      {/* Personalisation shared by both modes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-tone">Response Tone</label>
          <select id="ai-tone" className="form-select" value={draft.tone} onChange={(e) => update((d) => ({ ...d, tone: e.target.value as Tone }))}>
            <option value="analytical">Analytical</option>
            <option value="motivational">Motivational</option>
            <option value="concise">Concise</option>
            <option value="strict">Strict</option>
            <option value="coaching">Coaching</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-temp">Temperature: {draft.temperature.toFixed(1)}</label>
          <input
            id="ai-temp"
            type="range"
            min={0}
            max={1.5}
            step={0.1}
            value={draft.temperature}
            onChange={(e) => update((d) => ({ ...d, temperature: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
          />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" style={{ fontWeight: 600 }} htmlFor="ai-framework">Behavioral Framework</label>
          <textarea
            id="ai-framework"
            className="form-textarea"
            rows={2}
            value={draft.behavioralFramework}
            onChange={(e) => update((d) => ({ ...d, behavioralFramework: e.target.value }))}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={handleSaveNow} style={{ padding: '0.65rem 1.25rem' }}>
          <Save size={16} /> Save AI Configuration
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={isTesting} style={{ padding: '0.65rem 1.25rem' }}>
          {isTesting ? 'Testing Connection...' : 'Test AI Connection'}
        </button>
        {testResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: testResult.success ? 'var(--accent-primary)' : 'var(--danger)', fontWeight: 600 }}>
            {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

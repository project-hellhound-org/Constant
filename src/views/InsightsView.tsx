import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, subDays } from 'date-fns';
import { Sparkles, Send, Plus, Trash2, Bot, User, AlertTriangle, RotateCcw, Paperclip, Mic, ArrowRight, ChevronRight, History, Activity, X, Calendar, BarChart2, Check, Clock, Flame, Target, TrendingUp, Moon, ListChecks, Lightbulb, Heart, Compass } from 'lucide-react';
import { db, AIMessage } from '../db/schema';
import { queryAIAssistant } from '../services/aiProviderService';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { calculateHabitStats } from '../engine/streakEngine';
import { useFocus, minutesOn, formatMinutes } from '../lib/focus';
import { ActiveTab } from '../App';

const CATEGORIES = ['General', 'Habits', 'Tasks', 'Focus', 'Routines', 'Calendar', 'Finance', 'Wellbeing', 'Goals', 'Productivity', 'Trends'];
const SUGGESTIONS: { title: string; prompt: string; icon: React.ReactNode }[] = [
  { title: 'My current status', prompt: 'Give me a summary of today', icon: <ListChecks size={18} /> },
  { title: 'Task insights', prompt: 'Show my pending and overdue tasks', icon: <Check size={18} /> },
  { title: 'Routine optimization', prompt: 'Suggest a better daily routine', icon: <Clock size={18} /> },
  { title: 'Habit analysis', prompt: 'Which habit needs attention?', icon: <Activity size={18} /> },
  { title: 'Weekly review', prompt: 'Summarize my progress this week', icon: <BarChart2 size={18} /> },
  { title: 'Calendar overview', prompt: 'What do I have planned today?', icon: <Calendar size={18} /> },
  { title: 'Focus & productivity', prompt: 'How can I improve my focus?', icon: <Compass size={18} /> },
  { title: 'Goal guidance', prompt: 'Am I on track with my goals?', icon: <Target size={18} /> },
  { title: 'Wellbeing check', prompt: 'How is my overall balance?', icon: <Heart size={18} /> },
];
const CLEAR_KEY = 'habitos.insightRecentCleared.v1';
const MAX_ATTACH = 100_000;

interface Props { setActiveTab?: (t: ActiveTab) => void }

export const InsightsView: React.FC<Props> = ({ setActiveTab }) => {
  const [activeConvId, setActiveConvId] = useState('default-conv');
  const [category, setCategory] = useState('General');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasRenderError, setHasRenderError] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [attachError, setAttachError] = useState('');
  const [clearedAt, setClearedAt] = useState(() => localStorage.getItem(CLEAR_KEY) || '');
  const [listening, setListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const focus = useFocus();

  const aiSettings = useLiveQuery(() => db.aiSettings.get('default'));
  const settings = useLiveQuery(() => db.settings.get('default'));
  const habits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray()) || [];
  const logs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const tasks = useLiveQuery(() => db.tasks.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];
  const conversations = useLiveQuery(async () => { try { return (await db.aiConversations.toArray()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); } catch { return []; } }) || [];
  const activeMessages = useLiveQuery(async () => { try { return activeConvId ? await db.aiMessages.where('conversationId').equals(activeConvId).sortBy('timestamp') : []; } catch { return []; } }, [activeConvId]) || [];
  const allUserMessages = useLiveQuery(async () => { try { return (await db.aiMessages.toArray()).filter((m) => m.sender === 'user').sort((a, b) => b.timestamp.localeCompare(a.timestamp)); } catch { return []; } }) || [];

  useEffect(() => { (async () => { try { if (!(await db.aiConversations.get('default-conv'))) await db.aiConversations.add({ id: 'default-conv', title: 'Productivity Architecture & Pattern Analysis', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); } catch { /* ignore */ } })(); }, []);
  useEffect(() => { const t = setTimeout(() => { try { chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' }); } catch { /* ignore */ } }, 120); return () => clearTimeout(t); }, [activeMessages.length, isLoading]);

  // ---------- context ----------
  const today = format(new Date(), 'yyyy-MM-dd');
  const active = habits.filter((h) => !h.paused);
  const doneToday = active.filter((h) => logs.some((l) => l.habitId === h.id && l.date === today && l.status === 'completed')).length;
  const pending = tasks.filter((t) => !['completed', 'cancelled'].includes(t.status));
  const overdue = pending.filter((t) => t.dueDate && t.dueDate < today);
  const streak = Math.max(0, ...habits.map((h) => calculateHabitStats(h, logs, new Date(), 'pause').currentStreak));
  const activeGoals = goals.filter((g) => (g.status ?? 'active') === 'active');
  const goalsOnTrack = activeGoals.filter((g) => g.targetValue > 0 && g.currentValue / g.targetValue >= 0.5).length;
  const focusToday = minutesOn(focus.sessions, today);
  const avgFor = (from: number) => { let t = 0; for (let i = from; i < from + 7; i++) { const d = format(subDays(new Date(), i), 'yyyy-MM-dd'); t += active.length ? active.filter((h) => logs.some((l) => l.habitId === h.id && l.date === d && l.status === 'completed')).length / active.length : 0; } return Math.round((t / 7) * 100); };
  const wk = avgFor(0), pwk = avgFor(7);

  const quick = useMemo(() => [
    wk >= pwk ? { title: 'Keep the momentum!', text: 'Your consistency is improving this week.', icon: <TrendingUp size={20} />, tone: 'success' }
              : { title: 'Consistency dipped', text: `Down ${pwk - wk} pts vs last week. Restart with one easy habit today.`, icon: <TrendingUp size={20} />, tone: 'warning' },
    pending.length === 0 ? { title: 'Empty task list', text: 'Consider planning your tasks for the coming days.', icon: <Clock size={20} />, tone: 'warning' }
      : overdue.length ? { title: `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`, text: 'Reschedule or finish the oldest one first.', icon: <Clock size={20} />, tone: 'danger' }
      : { title: 'Tasks on track', text: `${pending.length} open, none overdue.`, icon: <Check size={20} />, tone: 'success' },
    focusToday === 0 ? { title: 'Focus opportunity', text: 'No focus sessions today. A short session can boost productivity.', icon: <Moon size={20} />, tone: 'info' }
      : { title: 'Focus logged', text: `${formatMinutes(focusToday)} of focus time today.`, icon: <Check size={20} />, tone: 'success' },
  ], [wk, pwk, pending.length, overdue.length, focusToday]);

  // ---------- chat ----------
  const handleCreate = async () => { try { const id = `conv-${Date.now()}`; await db.aiConversations.add({ id, title: `Analysis Session ${conversations.length + 1}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); setActiveConvId(id); } catch { /* ignore */ } };
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this conversation session history?')) return;
    try { await db.aiConversations.delete(id); await db.aiMessages.where('conversationId').equals(id).delete(); if (activeConvId === id) setActiveConvId(conversations.find((c) => c.id !== id)?.id || 'default-conv'); } catch { /* ignore */ }
  };

  const send = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;
    const att = attachment;
    setInput(''); setAttachment(null);
    const shown = att ? `${text}\n\n📎 ${att.name}` : text;
    const modelText = `${category !== 'General' ? `[Focus area: ${category}]\n` : ''}${text}${att ? `\n\n[Attached file: ${att.name}]\n${att.text}` : ''}`;
    try {
      await db.aiMessages.add({ id: `msg-${Date.now()}`, conversationId: activeConvId, sender: 'user', text: shown, timestamp: new Date().toISOString() } as AIMessage);
      await db.aiConversations.update(activeConvId, { updatedAt: new Date().toISOString(), title: activeMessages.length === 0 ? text.slice(0, 32) : undefined });
      setIsLoading(true);
      const ac = new AbortController(); abortRef.current = ac;
      const aid = `msg-${Date.now() + 1}`;
      await db.aiMessages.add({ id: aid, conversationId: activeConvId, sender: 'assistant', text: '...', timestamp: new Date().toISOString() } as AIMessage);
      const res = await queryAIAssistant(modelText, undefined, ac.signal, async (chunk) => { await db.aiMessages.update(aid, { text: chunk }); });
      await db.aiMessages.update(aid, { text: res.text, metadata: { actionCards: res.actionCards, suggestedPrompts: res.suggestedPrompts, metricsUsed: res.metricsUsed } });
    } catch { /* surfaced through the stored assistant message */ } finally { setIsLoading(false); abortRef.current = null; }
  };

  const reset = async () => { try { await db.aiConversations.clear(); await db.aiMessages.clear(); await db.aiConversations.add({ id: 'default-conv', title: 'Productivity Architecture & Pattern Analysis', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); setActiveConvId('default-conv'); setHasRenderError(false); } catch { /* ignore */ } };

  const onFile = (f: File | undefined) => {
    setAttachError('');
    if (!f) return;
    if (!/\.(txt|md|csv|json)$/i.test(f.name)) return setAttachError('Attach a .txt, .md, .csv or .json file.');
    if (f.size > MAX_ATTACH) return setAttachError('File is too large (100 KB max).');
    const r = new FileReader(); r.onload = () => setAttachment({ name: f.name, text: String(r.result || '') }); r.onerror = () => setAttachError('Could not read that file.'); r.readAsText(f);
  };
  const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const dictate = () => {
    if (!SR || listening) return;
    const rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = false;
    rec.onresult = (e: any) => setInput((p) => `${p}${p ? ' ' : ''}${e.results[0][0].transcript}`);
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    setListening(true); rec.start();
  };

  const recent = useMemo(() => { const seen = new Set<string>(); const out: string[] = []; for (const m of allUserMessages) { const t = m.text.split('\n')[0].trim(); if (m.timestamp <= clearedAt || !t || seen.has(t)) continue; seen.add(t); out.push(t); if (out.length === 6) break; } return out; }, [allUserMessages, clearedAt]);

  if (hasRenderError) return (<div className="liquid-panel" style={{ padding: '3rem', textAlign: 'center' }}><AlertTriangle size={36} style={{ color: 'var(--danger)' }} /><h3>Smart Insights recovery</h3><button className="btn btn-primary" onClick={reset} style={{ marginTop: '1rem' }}><RotateCcw size={16} /> Reset workspace</button></div>);

  const userName = settings?.userName || 'there';
  const hr = new Date().getHours(); const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const activeModel = aiSettings?.model || (aiSettings?.mode === 'cloud' ? 'gpt-4o-mini' : 'llama3.1');
  const toneVar = (t: string) => (t === 'success' ? 'var(--success)' : t === 'warning' ? 'var(--warning)' : t === 'danger' ? 'var(--danger)' : 'var(--info)');
  const ctx: [React.ReactNode, string, string][] = [
    [<Calendar size={16} key="a" />, 'Date', format(new Date(), 'EEE, MMM d, yyyy')], [<BarChart2 size={16} key="b" />, 'Active Habits', `${doneToday} / ${active.length} completed`],
    [<Check size={16} key="c" />, 'Tasks', `${pending.length} pending`], [<Clock size={16} key="d" />, 'Focus Time', `${formatMinutes(focusToday)} today`],
    [<Flame size={16} key="e" />, 'Current Streak', `${streak} day${streak === 1 ? '' : 's'}`], [<Target size={16} key="f" />, 'Active Goals', `${goalsOnTrack} / ${activeGoals.length} on track`],
  ];

  return (
    <div className="view-container" style={{ height: 'calc(100vh - var(--header-height))', overflow: 'hidden', paddingBottom: '1.25rem', gap: '0.9rem' }}>
      <div className="view-header" style={{ alignItems: 'center', flex: 'none' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={28} /></span>
          <div><h1 className="view-header-title">Smart Insights</h1><p className="view-header-subtitle" style={{ maxWidth: 620 }}>Talk with your personal AI about your habits, tasks, routines, focus, and life goals. Get insights, analysis, and personalized recommendations.</p></div>
        </div>
        <blockquote style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: 12, maxWidth: 220, fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>“Your data, your story, smarter decisions.”</blockquote>
      </div>

      <div className="tabbar" role="tablist" aria-label="Insight categories" style={{ flex: 'none' }}>
        {CATEGORIES.map((c) => <button key={c} role="tab" type="button" aria-selected={category === c} className="tab" onClick={() => setCategory(c)}>{c}</button>)}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '1rem', alignItems: 'stretch' }}>
        <main className="liquid-panel" aria-label="AI assistant" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', padding: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 'none', padding: '0.8rem 1.25rem', borderBottom: '1px solid var(--divider)' }}>
            <label className="form-label" htmlFor="session" style={{ margin: 0 }}>Session</label>
            <select id="session" className="form-select" style={{ minHeight: 32, padding: '0.2rem 0.6rem', maxWidth: 280 }} value={activeConvId} onChange={(e) => setActiveConvId(e.target.value)}>{conversations.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            <button type="button" className="btn btn-secondary btn-xs" onClick={handleCreate}><Plus size={13} /> New Session</button>
            <button type="button" className="btn btn-danger btn-xs" aria-label="Delete this session" onClick={() => handleDelete(activeConvId)}><Trash2 size={13} /></button>
          </div>

          <div className="chat-feed" role="log" aria-label="Chat history" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <section aria-label="Welcome" style={{ display: 'flex', gap: '0.9rem' }}>
            <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-primary)', color: 'var(--text-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Sparkles size={20} /></span>
            <div style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: 4 }}>{greet}, {userName}! 👋</h2>
              <p>I'm your Smart Insights AI, here to help you understand your progress, find patterns, and suggest personalized actions for a more productive and balanced life.</p>
              <p style={{ marginTop: 8 }}>You can ask me anything about your habits, tasks, routines, focus sessions, calendar, finance, or overall wellbeing. I'll analyze your data and give you clear, actionable insights.</p>
            </div>
          </section>

          <section aria-label="Suggested questions">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>Try asking about...</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s.title} type="button" className="liquid-panel liquid-panel-interactive" disabled={isLoading} onClick={() => send(s.prompt)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 0.9rem', textAlign: 'left', cursor: 'pointer' }}>
                  <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{s.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: '0.88rem' }}>{s.title}</strong><span className="subtitle" style={{ fontSize: '0.76rem' }}>{s.prompt}</span></span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>))}
            </div>
          </section>

          {recent.length > 0 && (
            <section aria-label="Recent questions">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h3 style={{ fontSize: '0.85rem', display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-sans)' }}><History size={14} /> Recent questions</h3>
                <button type="button" className="btn btn-secondary btn-xs" onClick={() => { const now = new Date().toISOString(); localStorage.setItem(CLEAR_KEY, now); setClearedAt(now); }}>Clear</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 6 }}>
                {recent.map((q) => <button key={q} type="button" className="row-hover" onClick={() => send(q)} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left' }}><ChevronRight size={13} aria-hidden="true" /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q}</span><ArrowRight size={13} aria-hidden="true" /></button>)}
              </div>
            </section>)}

          {activeMessages.length > 0 && (
            <section aria-label="Conversation" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--divider)', paddingTop: '1rem' }}>
              {activeMessages.map((m) => (
                <div key={m.id} style={{ display: 'flex', gap: 10, alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
                  <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.sender === 'user' ? 'var(--accent-primary)' : 'var(--surface-sunken)', color: m.sender === 'user' ? 'var(--text-on-accent)' : 'var(--accent-primary)' }}>{m.sender === 'user' ? <User size={16} /> : <Bot size={16} />}</span>
                  <div style={{ padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', background: m.sender === 'user' ? 'var(--accent-primary)' : 'var(--surface-sunken)', color: m.sender === 'user' ? 'var(--text-on-accent)' : 'var(--text-primary)', border: m.sender === 'user' ? 'none' : '1px solid var(--border-color)', fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: m.sender === 'user' ? 'pre-wrap' : undefined }}>
                    {m.sender === 'user' ? m.text : <MarkdownMessage text={m.text} />}
                  </div>
                </div>))}
              {isLoading && <span className="subtitle" role="status" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem' }}><Activity size={16} className="animate-spin" /> Analyzing your data…</span>}
              <div ref={chatEndRef} />
            </section>)}

          </div>

          <form onSubmit={(e) => { e.preventDefault(); void send(); }} aria-label="Message composer" style={{ flex: 'none', borderTop: '1px solid var(--divider)', padding: '0.9rem 1.25rem 1rem', background: 'var(--bg-surface)' }}>
            {attachment && <span className="chip chip-info" style={{ marginBottom: 6 }}><Paperclip size={11} /> {attachment.name}<button type="button" className="link-action" style={{ padding: 0 }} aria-label="Remove attachment" onClick={() => setAttachment(null)}><X size={11} /></button></span>}
            {attachError && <p role="alert" className="chip chip-danger" style={{ marginBottom: 6 }}>{attachError}</p>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json" hidden aria-label="Attachment file" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" className="btn btn-secondary btn-icon" aria-label="Attach file" style={{ height: 44 }} onClick={() => fileRef.current?.click()}><Paperclip size={17} /></button>
              <textarea className="form-textarea" rows={1} aria-label="Ask anything" placeholder="Ask anything about your habits, tasks, routines, or productivity..." value={input} disabled={isLoading} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 140 }} />
              <button type="button" className="btn btn-secondary btn-icon" aria-label={SR ? (listening ? 'Listening…' : 'Voice input') : 'Voice input (not supported in this browser)'} aria-pressed={listening} disabled={!SR} title={SR ? 'Dictate a message' : 'Voice input is not supported in this browser'} style={{ height: 44 }} onClick={dictate}><Mic size={17} /></button>
              <button type="submit" className="btn btn-primary btn-icon" aria-label="Send" disabled={isLoading || !input.trim()} style={{ height: 44, width: 44 }}><Send size={17} /></button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: '0.74rem', flexWrap: 'wrap' }} className="subtitle">
              <span>Press Enter to send · Shift + Enter for new line</span>
              <button type="button" className="link-action" onClick={() => setActiveTab?.('settings')} title="Change the model in Settings & AI">{activeModel} · {aiSettings?.mode === 'cloud' ? 'Cloud' : 'Local'} ▾</button>
            </div>
          </form>
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, overflowY: 'auto' }}>
          <section className="liquid-panel" aria-label="Current context">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><h3 className="panel-title">Current Context</h3><span className="chip chip-success"><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />Live</span></div>
            {ctx.map(([ic, l, v]) => <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.45rem 0', borderTop: '1px solid var(--divider)', fontSize: '0.85rem' }}><span aria-hidden="true" style={{ color: 'var(--accent-secondary)' }}>{ic}</span><span style={{ flex: 1 }}>{l}</span><strong className="num">{v}</strong></div>)}
          </section>
          <section className="liquid-panel" aria-label="Quick insights">
            <h3 className="panel-title" style={{ marginBottom: 8 }}><Lightbulb size={16} /> Quick Insights</h3>
            {quick.map((q) => <div key={q.title} style={{ display: 'flex', gap: 10, padding: '0.6rem', marginBottom: 6, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', borderLeft: `3px solid ${toneVar(q.tone)}` }}><span aria-hidden="true" style={{ color: toneVar(q.tone) }}>{q.icon}</span><div><strong style={{ fontSize: '0.85rem' }}>{q.title}</strong><div className="subtitle" style={{ fontSize: '0.78rem' }}>{q.text}</div></div></div>)}
          </section>
        </aside>
      </div>
    </div>
  );
};

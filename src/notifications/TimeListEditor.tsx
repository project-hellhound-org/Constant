import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { isValidTime, sortTimes } from './schedule';

const label12 = (t: string) => { const h = Number(t.slice(0, 2)); return `${h % 12 === 0 ? 12 : h % 12}:${t.slice(3)} ${h < 12 ? 'AM' : 'PM'}`; };

/** Editable list of "HH:mm" times shown as removable chips, plus quick presets. */
export const TimeListEditor: React.FC<{ id: string; value: string[]; onChange: (v: string[]) => void; presets?: { label: string; time: string }[]; max?: number }> = ({ id, value, onChange, presets, max = 8 }) => {
  const [draft, setDraft] = useState('');
  const add = (t: string) => { if (isValidTime(t) && value.length < max) onChange(sortTimes([...value, t])); setDraft(''); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
        <input id={id} type="time" aria-label="Reminder time" className="form-input" style={{ flex: 1, minWidth: 0 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="button" className="btn btn-secondary" disabled={!isValidTime(draft) || value.length >= max} onClick={() => add(draft)} style={{ height: 40, flex: 'none' }}><Plus size={14} /> Add time</button>
      </div>
      {presets && <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>{presets.map((p) => <button key={p.time} type="button" className="btn btn-secondary btn-xs" onClick={() => add(p.time)}>{p.label} · {label12(p.time)}</button>)}</div>}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', minHeight: 28 }} aria-live="polite">
        {value.length === 0 && <span className="subtitle" style={{ fontSize: '0.8rem' }}>No times set.</span>}
        {sortTimes(value).map((t) => <span key={t} className="chip chip-neutral" style={{ gap: 6 }}>{label12(t)}<button type="button" aria-label={`Remove ${label12(t)}`} onClick={() => onChange(value.filter((x) => x !== t))} style={{ background: 'none', border: 0, padding: 0, display: 'inline-flex', cursor: 'pointer', color: 'inherit' }}><X size={12} /></button></span>)}
      </div>
    </div>
  );
};

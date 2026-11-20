import React from 'react';
import {
  BookOpen, Dumbbell, Droplet, Flower2, PenLine, Laptop, Moon, Leaf, Brain, Utensils, Footprints, Code2, Heart, Target, ArrowUpRight, ArrowDownRight, LucideIcon,
} from 'lucide-react';
import { Habit } from '../db/schema';

/** Circular progress. Colors come from tokens; the % is always also printed as text. */
export const ProgressRing: React.FC<{ pct: number; size?: number; stroke?: number; label?: string }> = ({ pct, size = 72, stroke = 7, label }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role="img" aria-label={`${clamped}% complete`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--progress-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--progress-fill)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)} style={{ transition: 'stroke-dashoffset 300ms ease' }} />
      </svg>
      <div className="num" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.24 }}>
        {label ?? `${Math.round(clamped)}%`}
      </div>
    </div>
  );
};

/** Compact delta, with an arrow so direction is not conveyed by color alone. */
export const Delta: React.FC<{ value: number; suffix?: string; text?: string }> = ({ value, suffix = '', text }) => {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.75rem', fontWeight: 600, color: up ? 'var(--success)' : 'var(--danger)' }}>
      <Icon size={13} />{up ? '+' : '−'}{Math.abs(value)}{suffix}{text ? ` ${text}` : ''}
    </span>
  );
};

export const PanelHeader: React.FC<{ icon?: React.ReactNode; title: string; action?: { label: string; onClick: () => void }; right?: React.ReactNode }> = ({ icon, title, action, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.9rem' }}>
    <h3 className="panel-title">{icon}{title}</h3>
    {right}
    {action && <button type="button" className="link-action" onClick={action.onClick}>{action.label} →</button>}
  </div>
);

const ICON_RULES: [RegExp, LucideIcon][] = [
  [/read|book/i, BookOpen], [/workout|gym|fitness|exercise|train/i, Dumbbell], [/water|hydrat/i, Droplet], [/medit|mindful|yoga/i, Flower2],
  [/journal|write|note/i, PenLine], [/social|screen|phone/i, Laptop], [/sleep|bed|rest/i, Moon], [/walk|run|steps/i, Footprints],
  [/code|dev|tool|project/i, Code2], [/eat|diet|nutri|meal/i, Utensils], [/study|learn|skill|course|cyber/i, Brain], [/health|wellbeing/i, Heart],
];
export function habitIcon(h: Pick<Habit, 'name' | 'category'>): LucideIcon {
  const hay = `${h.name} ${h.category}`;
  for (const [re, Icon] of ICON_RULES) if (re.test(hay)) return Icon;
  return h.category ? Leaf : Target;
}

export const formatHabitTime = (h: Pick<Habit, 'startTime' | 'amPm'>): string | null => {
  if (!h.startTime) return null;
  return `${h.startTime}${h.amPm ? ' ' + h.amPm : ''}`;
};


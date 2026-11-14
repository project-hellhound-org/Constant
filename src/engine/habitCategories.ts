/** The only habit categories offered in the app. */
export const HABIT_CATEGORIES = ['Health', 'Learning', 'Work', 'Growth', 'WellBeing'] as const;
export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

/** Maps any legacy / free-form category onto one of the five supported categories. */
export function normalizeHabitCategory(raw?: string | null): HabitCategory {
  const c = (raw || '').trim().toLowerCase();
  if (!c) return 'Health';
  const exact = HABIT_CATEGORIES.find((x) => x.toLowerCase() === c);
  if (exact) return exact;
  if (/well|mind|medit|sleep|journal|gratitude|balance/.test(c)) return 'WellBeing';
  if (/health|fitness|exercise|workout|nutrition|diet/.test(c)) return 'Health';
  if (/learn|study|read|course|skill|education/.test(c)) return 'Learning';
  if (/work|product|project|career|business|focus/.test(c)) return 'Work';
  if (/grow|personal|habit|self/.test(c)) return 'Growth';
  return 'Growth';
}

/** Turns the single Sub-Topics text area into a clean list (one per line or comma separated). */
export function parseSubTopics(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/\r?\n|,/)) {
    const t = part.trim().replace(/\s+/g, ' ').slice(0, 80);
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k); out.push(t);
    if (out.length >= 40) break;
  }
  return out;
}

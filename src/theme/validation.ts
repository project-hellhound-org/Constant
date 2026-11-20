import { THEMES, THEME_LIST, FONTS, DEFAULT_PREFERENCE, ThemeDefinition, ThemeId, FontId, ThemePreference } from './themes';
import { BACKGROUND_BY_ID, BackgroundId } from './backgrounds';

/** Every theme must define each of these (also the tokens components rely on). */
export const REQUIRED_TOKENS = [
  '--bg-primary', '--bg-secondary', '--bg-surface', '--bg-elevated', '--surface-sunken', '--surface-hover', '--overlay',
  '--text-primary', '--text-secondary', '--text-muted', '--text-disabled', '--text-on-accent',
  '--border-color', '--border-hover', '--divider',
  '--accent-primary', '--accent-hover', '--accent-secondary', '--accent-highlight', '--accent-soft', '--focus-ring',
  '--success', '--warning', '--danger', '--info', '--success-bg', '--warning-bg', '--danger-bg', '--info-bg',
  '--progress-track', '--progress-fill',
  '--heatmap-0', '--heatmap-25', '--heatmap-50', '--heatmap-75', '--heatmap-100',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-grid', '--chart-axis',
  '--radius-sm', '--radius-md', '--radius-lg', '--shadow-panel', '--shadow-elevated',
] as const;

export function validateTheme(theme: ThemeDefinition): string[] {
  const errors: string[] = [];
  if (!theme.id || !theme.name) errors.push('missing id or name');
  for (const t of REQUIRED_TOKENS) {
    const v = theme.tokens[t];
    if (!v || !v.trim()) errors.push(`${theme.id}: missing token ${t}`);
  }
  return errors;
}

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(THEMES, v);
export const isFontId = (v: unknown): v is FontId => typeof v === 'string' && FONTS.some((f) => f.id === v);
export const isBackgroundId = (v: unknown): v is BackgroundId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(BACKGROUND_BY_ID, v);

/** Turns any stored/untrusted value into a safe preference. Unknown values fall back to defaults. */
export function normalizePreference(raw: unknown): ThemePreference {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    themeId: isThemeId(r.themeId) ? r.themeId : migrateLegacyThemeId(r.themeId) ?? DEFAULT_PREFERENCE.themeId,
    fontId: isFontId(r.fontId) ? r.fontId : DEFAULT_PREFERENCE.fontId,
    backgroundId: isBackgroundId(r.backgroundId) ? r.backgroundId : DEFAULT_PREFERENCE.backgroundId,
  };
}

/** Removed themes / environments map to the closest remaining theme. */
export function migrateLegacyThemeId(legacy: unknown): ThemeId | null {
  if (legacy === 'rain_forest' || legacy === 'foggy_mist' || legacy === 'porcelain-ink') return 'sage-minimal';
  return null;
}

// ---- WCAG contrast helpers (used by tests and by the Settings preview) ----
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
const lum = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export { THEME_LIST };

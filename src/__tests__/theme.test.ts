// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { THEME_LIST, THEMES, FONTS, DEFAULT_PREFERENCE } from '../theme/themes';
import { BACKGROUNDS } from '../theme/backgrounds';
import { validateTheme, normalizePreference, migrateLegacyThemeId, contrastRatio } from '../theme/validation';
import { computeAdaptive, MIN_TEXT_CONTRAST, MIN_CANVAS_CONTRAST } from '../theme/adaptive';
import { applyTheme } from '../theme/resolver';

describe('registry', () => {
  it('has exactly three themes, five fonts and ten backgrounds', () => {
    expect(THEME_LIST.map((t) => t.id)).toEqual(['sage-minimal', 'warm-monochrome', 'dark-mode']);
    expect(FONTS).toHaveLength(5);
    expect(BACKGROUNDS).toHaveLength(10);
    expect(new Set(BACKGROUNDS.map((b) => b.id)).size).toBe(10);
    expect(BACKGROUNDS.map((b) => b.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it.each(THEME_LIST)('$id defines every required token', (t) => { expect(validateTheme(t)).toEqual([]); });
  it('Warm Monochrome is a darker palette than Sage Minimal', () => {
    expect(THEMES['warm-monochrome'].appearance).toBe('dark');
    expect(THEMES['dark-mode'].appearance).toBe('dark');
    expect(THEMES['sage-minimal'].appearance).toBe('light');
  });
});

describe('WCAG AA contrast of the base tokens', () => {
  const pairs: [string, string, number][] = [
    ['--text-primary', '--bg-surface', 7], ['--text-primary', '--bg-primary', 7], ['--text-secondary', '--bg-surface', 4.5], ['--text-secondary', '--bg-primary', 4.5],
    ['--text-muted', '--bg-surface', 4.5], ['--text-muted', '--bg-primary', 4.5], ['--text-primary', '--bg-elevated', 7], ['--text-primary', '--surface-sunken', 7],
    ['--text-on-accent', '--accent-primary', 4.5], ['--text-on-accent', '--accent-hover', 4.5], ['--accent-primary', '--bg-surface', 4.5], ['--accent-secondary', '--bg-surface', 4.5],
    ['--success', '--bg-surface', 4.5], ['--warning', '--bg-surface', 4.5], ['--danger', '--bg-surface', 4.5], ['--info', '--bg-surface', 4.5],
    ['--focus-ring', '--bg-surface', 3], ['--border-hover', '--bg-surface', 1.5],
    ['--text-on-accent', '--heatmap-75', 4.5], ['--text-on-accent', '--heatmap-100', 4.5], ['--text-primary', '--heatmap-0', 7], ['--text-primary', '--heatmap-25', 4.5], ['--text-primary', '--heatmap-50', 4.5],
  ];
  for (const t of THEME_LIST) for (const [fg, bg, min] of pairs) {
    it(`${t.id}: ${fg} on ${bg} >= ${min}`, () => { expect(contrastRatio(t.tokens[fg], t.tokens[bg])).toBeGreaterThanOrEqual(min); });
  }
});

describe('dynamic adaptation: every theme x every background stays readable', () => {
  for (const t of THEME_LIST) for (const b of BACKGROUNDS) {
    it(`${t.id} on ${b.name}`, () => {
      const a = computeAdaptive(t, b);
      // incidental text directly on the (scrimmed) canvas, worst-case region of the artwork
      expect(contrastRatio(t.tokens['--text-muted'], a.worstCanvasHex)).toBeGreaterThanOrEqual(MIN_CANVAS_CONTRAST);
      expect(contrastRatio(t.tokens['--text-primary'], a.worstCanvasHex)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      // text on translucent panels over the same worst-case region
      expect(contrastRatio(t.tokens['--text-muted'], a.worstPanelHex)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(a.panelAlpha).toBeGreaterThanOrEqual(0.86);
      expect(a.panelAlpha).toBeLessThanOrEqual(1);
    });
  }
  it('adapts: the same background needs a different scrim for light and dark themes', () => {
    const misty = BACKGROUNDS.find((b) => b.id === 'misty-forest')!;
    const onSage = computeAdaptive(THEMES['sage-minimal'], misty);
    const onDark = computeAdaptive(THEMES['dark-mode'], misty);
    expect(onSage.scrimTop).not.toBe(onDark.scrimTop);
  });
});

describe('preference validation and migration', () => {
  it('falls back to defaults for invalid, missing or malicious values', () => {
    expect(normalizePreference(null)).toEqual(DEFAULT_PREFERENCE);
    expect(normalizePreference({ themeId: '<style>', fontId: 'comic', backgroundId: '../../x' })).toEqual(DEFAULT_PREFERENCE);
  });
  it('keeps valid values', () => {
    expect(normalizePreference({ themeId: 'dark-mode', fontId: 'serif', backgroundId: 'carbon-hex' })).toEqual({ themeId: 'dark-mode', fontId: 'serif', backgroundId: 'carbon-hex' });
  });
  it('maps removed themes to Sage Minimal', () => {
    for (const old of ['porcelain-ink', 'rain_forest', 'foggy_mist']) { expect(migrateLegacyThemeId(old)).toBe('sage-minimal'); expect(normalizePreference({ themeId: old }).themeId).toBe('sage-minimal'); }
    expect(migrateLegacyThemeId('other')).toBeNull();
  });
});

describe('applyTheme', () => {
  beforeEach(() => { document.documentElement.removeAttribute('style'); });
  it('writes tokens, font, background and adaptive values', () => {
    applyTheme({ themeId: 'dark-mode', fontId: 'serif', backgroundId: 'cosmic-nebula' });
    const r = document.documentElement;
    expect(r.getAttribute('data-theme')).toBe('dark-mode');
    expect(r.getAttribute('data-appearance')).toBe('dark');
    expect(r.getAttribute('data-bg')).toBe('cosmic-nebula');
    expect(r.style.getPropertyValue('--font-sans')).toContain('Source Serif 4');
    expect(r.style.getPropertyValue('--bg-image')).toContain('url(');
    expect(r.style.getPropertyValue('--bg-scrim')).toContain('linear-gradient');
    expect(r.style.getPropertyValue('--bg-surface')).toMatch(/^rgba\(/);
    expect(r.style.getPropertyValue('--accent-primary')).toBe(THEMES['dark-mode'].tokens['--accent-primary']);
  });
  it('rejects unregistered theme ids', () => {
    applyTheme({ themeId: 'evil' as any, fontId: 'inter', backgroundId: 'sage-leaves' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('sage-minimal');
  });
});

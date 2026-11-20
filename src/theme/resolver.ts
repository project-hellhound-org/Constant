import { THEMES, FONTS, ThemePreference } from './themes';
import { BACKGROUND_BY_ID } from './backgrounds';
import { computeAdaptive, hexToRgbString, parseHex } from './adaptive';
import { normalizePreference } from './validation';

/**
 * Resolves a preference into CSS custom properties on <html>. Pure DOM work: no React re-render,
 * no network, no database access. Text/surface colours are adapted to the chosen background.
 */
export function applyTheme(pref: ThemePreference, root: HTMLElement = document.documentElement): ThemePreference {
  const safe = normalizePreference(pref);
  const theme = THEMES[safe.themeId];
  const font = FONTS.find((f) => f.id === safe.fontId)!;
  const bg = BACKGROUND_BY_ID[safe.backgroundId];
  const ad = computeAdaptive(theme, bg);

  for (const [k, v] of Object.entries(theme.tokens)) root.style.setProperty(k, v);

  // Typography
  root.style.setProperty('--font-sans', font.body);
  root.style.setProperty('--font-heading', font.heading);

  // Panels become slightly translucent only as far as contrast allows.
  const surfaceRgb = hexToRgbString(theme.tokens['--bg-surface']);
  const panel = `rgba(${surfaceRgb}, ${ad.panelAlpha})`;
  for (const k of ['--bg-surface', '--card-bg', '--surface-color', '--surface-paper']) root.style.setProperty(k, panel);
  // Sidebar / header chrome lets the artwork show through at the same opacity as panels.
  root.style.setProperty('--chrome-bg', `rgba(${hexToRgbString(theme.tokens['--bg-secondary'])}, ${Math.min(1, ad.panelAlpha + 0.06)})`);

  // Background image + adaptive scrim
  const [r, g, b] = parseHex(theme.tokens['--bg-primary']);
  root.style.setProperty('--bg-image', `url("${bg.url}")`);
  root.style.setProperty('--bg-scrim', `linear-gradient(rgba(${r}, ${g}, ${b}, ${ad.scrimTop}), rgba(${r}, ${g}, ${b}, ${ad.scrimTop}))`);
  root.style.setProperty('--panel-alpha', String(ad.panelAlpha));

  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-appearance', theme.appearance);
  root.setAttribute('data-bg', bg.id);
  root.style.colorScheme = theme.appearance;
  return safe;
}

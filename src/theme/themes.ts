/**
 * Theme registry — single source of truth for colors, fonts and backgrounds.
 * Components read CSS variables only. The resolver (resolver.ts + adaptive.ts) writes them,
 * and adapts scrim / panel opacity so text always has enough contrast on the chosen background.
 */
import { BackgroundId } from './backgrounds';
export type { BackgroundId } from './backgrounds';

export type ThemeId = 'sage-minimal' | 'warm-monochrome' | 'dark-mode';
export type FontId = 'inter' | 'plex' | 'manrope' | 'editorial' | 'serif';

export const DEFAULT_THEME_ID: ThemeId = 'sage-minimal';
export const DEFAULT_FONT_ID: FontId = 'inter';
export const DEFAULT_BACKGROUND_ID: BackgroundId = 'sage-leaves';

export interface ThemePreference { themeId: ThemeId; fontId: FontId; backgroundId: BackgroundId }
export const DEFAULT_PREFERENCE: ThemePreference = { themeId: DEFAULT_THEME_ID, fontId: DEFAULT_FONT_ID, backgroundId: DEFAULT_BACKGROUND_ID };

export interface FontDef { id: FontId; name: string; style: string; sample: string; body: string; heading: string }
const FALLBACK_SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const FALLBACK_SERIF = "Georgia, 'Times New Roman', serif";
export const FONTS: FontDef[] = [
  { id: 'inter', name: 'Inter', style: 'Clean Sans', sample: 'Aa', body: `'Inter', ${FALLBACK_SANS}`, heading: `'Inter', ${FALLBACK_SANS}` },
  { id: 'plex', name: 'IBM Plex Sans', style: 'Technical', sample: 'Aa', body: `'IBM Plex Sans', ${FALLBACK_SANS}`, heading: `'IBM Plex Sans', ${FALLBACK_SANS}` },
  { id: 'manrope', name: 'Manrope', style: 'Modern Geometric', sample: 'Aa', body: `'Manrope', ${FALLBACK_SANS}`, heading: `'Manrope', ${FALLBACK_SANS}` },
  { id: 'editorial', name: 'Newsreader + Inter', style: 'Editorial', sample: 'Aa', body: `'Inter', ${FALLBACK_SANS}`, heading: `'Newsreader', ${FALLBACK_SERIF}` },
  { id: 'serif', name: 'Source Serif 4', style: 'Classic Serif', sample: 'Aa', body: `'Source Serif 4', ${FALLBACK_SERIF}`, heading: `'Source Serif 4', ${FALLBACK_SERIF}` },
];

export type TokenMap = Record<string, string>;
export interface ThemeDefinition {
  id: ThemeId; name: string; tagline: string; description: string;
  appearance: 'light' | 'dark';
  swatches: { name: string; color: string }[];
  tokens: TokenMap;
}

const SHARED: TokenMap = {
  '--font-mono': "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  '--radius-sm': '8px', '--radius-md': '10px', '--radius-lg': '14px', '--radius-full': '9999px',
  '--glass-blur': 'none', '--header-height': '68px',
};

const sage: ThemeDefinition = {
  id: 'sage-minimal', name: 'Sage Minimal', tagline: 'Calm · Focused · Natural', appearance: 'light',
  description: 'Muted sage surfaces, dark forest typography and low-contrast dividers.',
  swatches: [{ name: 'Sage', color: '#E9EEE5' }, { name: 'Mist', color: '#F8FAF5' }, { name: 'Forest', color: '#355844' }],
  tokens: {
    ...SHARED,
    '--bg-primary': '#E9EEE5', '--bg-secondary': '#F1F4ED', '--bg-surface': '#F8FAF5', '--bg-elevated': '#FDFEFC',
    '--surface-sunken': '#E3E9DE', '--surface-hover': '#EAEFE5', '--surface-color': '#F8FAF5', '--surface-paper': '#F8FAF5', '--text-paper-dark': '#1E2B23',
    '--card-bg': '#F8FAF5', '--overlay': 'rgba(24, 36, 29, 0.45)',
    '--text-primary': '#1E2B23', '--text-secondary': '#46564C', '--text-muted': '#5A6A60', '--text-disabled': '#97A39B', '--text-on-accent': '#FFFFFF',
    '--border-color': '#D3DBCD', '--border-hover': '#B9C5B2', '--border-glow': '#A4B39C', '--divider': '#DEE4D9',
    '--accent-primary': '#355844', '--accent-hover': '#416A53', '--accent-secondary': '#4F7560', '--accent-highlight': '#3E7A5A',
    '--accent-soft': 'rgba(53, 88, 68, 0.10)', '--accent-glow': 'rgba(62, 122, 90, 0.22)', '--focus-ring': '#3E7A5A',
    '--success': '#2B7450', '--warning': '#85600A', '--danger': '#AE352C', '--info': '#2B6584',
    '--success-bg': 'rgba(43, 116, 80, 0.12)', '--warning-bg': 'rgba(133, 96, 10, 0.12)', '--danger-bg': 'rgba(174, 53, 44, 0.10)', '--info-bg': 'rgba(43, 101, 132, 0.10)',
    '--progress-track': '#DDE4D7', '--progress-fill': '#355844',
    '--heatmap-0': '#E3E9DE', '--heatmap-25': '#BDC9B5', '--heatmap-50': '#D3B15F', '--heatmap-75': '#A9622C', '--heatmap-100': '#2B7450',
    '--chart-1': '#355844', '--chart-2': '#C4903A', '--chart-3': '#5B84A0', '--chart-4': '#AE352C', '--chart-5': '#8A7FB0', '--chart-6': '#7FA88A', '--chart-7': '#8C968F',
    '--chart-grid': '#DDE4D7', '--chart-axis': '#5A6A60',
    '--shadow-panel': '0 1px 2px rgba(30, 43, 35, 0.05), 0 2px 10px rgba(30, 43, 35, 0.06)', '--shadow-elevated': '0 12px 36px rgba(30, 43, 35, 0.20)',
  },
};

const warm: ThemeDefinition = {
  id: 'warm-monochrome', name: 'Warm Monochrome', tagline: 'Refined · Warm · Understated', appearance: 'dark',
  description: 'A darker palette of espresso, taupe and parchment with a restrained bronze accent.',
  swatches: [{ name: 'Espresso', color: '#2A2520' }, { name: 'Taupe', color: '#38312A' }, { name: 'Bronze', color: '#D6AC72' }],
  tokens: {
    ...SHARED,
    '--bg-primary': '#2A2520', '--bg-secondary': '#322C26', '--bg-surface': '#38312A', '--bg-elevated': '#443B33',
    '--surface-sunken': '#2F2923', '--surface-hover': '#443C34', '--surface-color': '#38312A', '--surface-paper': '#38312A', '--text-paper-dark': '#F3EDE4',
    '--card-bg': '#38312A', '--overlay': 'rgba(12, 9, 6, 0.62)',
    '--text-primary': '#F3EDE4', '--text-secondary': '#D0C5B5', '--text-muted': '#B9AD9A', '--text-disabled': '#7D7366', '--text-on-accent': '#241C12',
    '--border-color': '#52483D', '--border-hover': '#6A5D4E', '--border-glow': '#7B6C59', '--divider': '#473F35',
    '--accent-primary': '#D6AC72', '--accent-hover': '#E3BE88', '--accent-secondary': '#C79A5E', '--accent-highlight': '#E0B67A',
    '--accent-soft': 'rgba(214, 172, 114, 0.15)', '--accent-glow': 'rgba(224, 182, 122, 0.30)', '--focus-ring': '#E0B67A',
    '--success': '#7CC79A', '--warning': '#E3B45B', '--danger': '#F08A7E', '--info': '#86B4D8',
    '--success-bg': 'rgba(124, 199, 154, 0.16)', '--warning-bg': 'rgba(227, 180, 91, 0.16)', '--danger-bg': 'rgba(240, 138, 126, 0.16)', '--info-bg': 'rgba(134, 180, 216, 0.16)',
    '--progress-track': '#4A4137', '--progress-fill': '#D6AC72',
    '--heatmap-0': '#3F372F', '--heatmap-25': '#5C5144', '--heatmap-50': '#7A6128', '--heatmap-75': '#D39A55', '--heatmap-100': '#7CC79A',
    '--chart-1': '#D6AC72', '--chart-2': '#7CC79A', '--chart-3': '#86B4D8', '--chart-4': '#F08A7E', '--chart-5': '#B9A2D6', '--chart-6': '#79C6C0', '--chart-7': '#A99F90',
    '--chart-grid': '#4A4137', '--chart-axis': '#B9AD9A',
    '--shadow-panel': '0 1px 2px rgba(0, 0, 0, 0.25), 0 2px 12px rgba(0, 0, 0, 0.22)', '--shadow-elevated': '0 14px 40px rgba(0, 0, 0, 0.5)',
  },
};

const dark: ThemeDefinition = {
  id: 'dark-mode', name: 'Dark Mode', tagline: 'Focused · Low-glare · Night', appearance: 'dark',
  description: 'Cool near-black surfaces with soft blue accents, tuned for low-light use.',
  swatches: [{ name: 'Night', color: '#0F1318' }, { name: 'Slate', color: '#1B2129' }, { name: 'Sky', color: '#7DB0EA' }],
  tokens: {
    ...SHARED,
    '--bg-primary': '#0F1318', '--bg-secondary': '#151A21', '--bg-surface': '#1B2129', '--bg-elevated': '#242C36',
    '--surface-sunken': '#141920', '--surface-hover': '#252E39', '--surface-color': '#1B2129', '--surface-paper': '#1B2129', '--text-paper-dark': '#E9EEF4',
    '--card-bg': '#1B2129', '--overlay': 'rgba(2, 4, 8, 0.68)',
    '--text-primary': '#E9EEF4', '--text-secondary': '#B8C2CE', '--text-muted': '#9EAAB8', '--text-disabled': '#6B7683', '--text-on-accent': '#0B1220',
    '--border-color': '#2A333F', '--border-hover': '#3B4756', '--border-glow': '#4B5A6C', '--divider': '#232C37',
    '--accent-primary': '#7DB0EA', '--accent-hover': '#95BFF0', '--accent-secondary': '#6FA3DE', '--accent-highlight': '#8DBBF0',
    '--accent-soft': 'rgba(125, 176, 234, 0.15)', '--accent-glow': 'rgba(141, 187, 240, 0.30)', '--focus-ring': '#8DBBF0',
    '--success': '#62CB93', '--warning': '#E5B552', '--danger': '#F28B82', '--info': '#7FB6F0',
    '--success-bg': 'rgba(98, 203, 147, 0.16)', '--warning-bg': 'rgba(229, 181, 82, 0.16)', '--danger-bg': 'rgba(242, 139, 130, 0.16)', '--info-bg': 'rgba(127, 182, 240, 0.16)',
    '--progress-track': '#2A333F', '--progress-fill': '#7DB0EA',
    '--heatmap-0': '#222A34', '--heatmap-25': '#34404E', '--heatmap-50': '#6B5B21', '--heatmap-75': '#D39A55', '--heatmap-100': '#62CB93',
    '--chart-1': '#7DB0EA', '--chart-2': '#E5B552', '--chart-3': '#62CB93', '--chart-4': '#F28B82', '--chart-5': '#B39DDB', '--chart-6': '#4DD0E1', '--chart-7': '#9AA7B5',
    '--chart-grid': '#2A333F', '--chart-axis': '#9EAAB8',
    '--shadow-panel': '0 1px 2px rgba(0, 0, 0, 0.35), 0 2px 12px rgba(0, 0, 0, 0.3)', '--shadow-elevated': '0 14px 40px rgba(0, 0, 0, 0.6)',
  },
};

export const THEMES: Record<ThemeId, ThemeDefinition> = { 'sage-minimal': sage, 'warm-monochrome': warm, 'dark-mode': dark };
export const THEME_LIST: ThemeDefinition[] = [sage, warm, dark];

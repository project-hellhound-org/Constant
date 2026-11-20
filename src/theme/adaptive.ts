import { BackgroundDef } from './backgrounds';
import { ThemeDefinition } from './themes';
import { contrastRatio } from './validation';

/**
 * Dynamic contrast engine. Given a theme and a background image it decides:
 *  - how strongly to tint ("scrim") the image so text placed directly on the canvas stays readable, and
 *  - how opaque the panel surfaces must be so panel text stays readable over the image.
 * It checks the worst-case part of the image (darkest for dark text, brightest for light text).
 */
export interface Adaptive {
  scrimTop: number;       // scrim alpha behind page titles (top of the canvas)
  scrimBody: number;      // scrim alpha for the rest of the canvas
  panelAlpha: number;     // opacity of translucent panel surfaces
  worstCanvasHex: string; // worst-case canvas colour after the scrim (used by tests)
  worstPanelHex: string;  // worst-case panel colour after blending
}

export const MIN_TEXT_CONTRAST = 4.5;
export const MIN_CANVAS_CONTRAST = 3; // incidental text directly on the image; titles sit on panel-backed headers
const SAFETY = 4.7; // margin above AA for panel text
<<<<<<< HEAD
/** The scrim may never hide more than this share of the artwork, otherwise the chosen background looks missing.
 *  Readability is guaranteed by the opaque-enough PANELS (every title and card sits on one), not by washing out the image. */
export const MAX_SCRIM = 0.5;
=======
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e

const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const parseHex = (hex: string): [number, number, number] => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const lumToGray = (L: number) => 255 * (L <= 0.0031308 ? 12.92 * L : 1.055 * Math.pow(L, 1 / 2.4) - 0.055);
const blend = (top: string, a: number, bottom: string) => { const t = parseHex(top), b = parseHex(bottom); return toHex(t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a)); };

export function computeAdaptive(theme: ThemeDefinition, bg: BackgroundDef): Adaptive {
  const t = theme.tokens;
  const dark = theme.appearance === 'dark';
  const worstL = dark ? bg.lum.p95 : bg.lum.p5; // light text fears bright spots; dark text fears dark spots
  const g = lumToGray(worstL); const worstImg = toHex(g, g, g);
  const canvas = t['--bg-primary'];
  const weakest = t['--text-muted'];

  // Scrim: tint the artwork with the theme canvas colour until incidental text is readable (>= 3:1).
  let scrim = 1;
  for (let a = 0.35; a <= 1.0001; a += 0.01) { if (contrastRatio(weakest, blend(canvas, a, worstImg)) >= MIN_CANVAS_CONTRAST + 0.2) { scrim = Math.round(a * 100) / 100; break; } }
<<<<<<< HEAD
  scrim = Math.min(scrim, MAX_SCRIM);
=======
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
  const worstCanvasHex = blend(canvas, scrim, worstImg);

  // Panels: as translucent as allowed while panel text keeps >= 4.5:1 over the worst-case canvas.
  const surface = t['--bg-surface'];
  let panelAlpha = 1;
<<<<<<< HEAD
  for (let a = 0.86; a <= 1.0001; a += 0.01) { if (contrastRatio(weakest, blend(surface, a, worstCanvasHex)) >= SAFETY) { panelAlpha = Math.min(1, Math.round(a * 100) / 100); break; } }
=======
  for (let a = 0.86; a <= 1.0001; a += 0.01) { if (contrastRatio(weakest, blend(surface, a, worstCanvasHex)) >= SAFETY) { panelAlpha = Math.round(a * 100) / 100; break; } }
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
  const worstPanelHex = blend(surface, panelAlpha, worstCanvasHex);
  return { scrimTop: scrim, scrimBody: scrim, panelAlpha, worstCanvasHex, worstPanelHex };
}

export const hexToRgbString = (hex: string) => parseHex(hex).join(', ');

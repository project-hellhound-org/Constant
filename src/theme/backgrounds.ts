/** Background templates. Generated from the supplied artwork; luminance percentiles feed the contrast engine. */
export type BackgroundId = 'sage-leaves' | 'misty-forest' | 'ink-sunrise' | 'bamboo-pavilion' | 'twilight-peaks' | 'lakeside-light' | 'emerald-waves' | 'cosmic-nebula' | 'golden-dragon' | 'carbon-hex';
export interface BackgroundDef { n: number; id: BackgroundId; name: string; group: 'light' | 'dark'; url: string; thumb: string; /** relative luminance percentiles of the artwork (0..1) */ lum: { p5: number; p50: number; p95: number } }

import full1 from '../assets/backgrounds/bg-01-sage-leaves.webp';
import thumb1 from '../assets/backgrounds/bg-01-sage-leaves-thumb.webp';
import full2 from '../assets/backgrounds/bg-02-misty-forest.webp';
import thumb2 from '../assets/backgrounds/bg-02-misty-forest-thumb.webp';
import full3 from '../assets/backgrounds/bg-03-ink-sunrise.webp';
import thumb3 from '../assets/backgrounds/bg-03-ink-sunrise-thumb.webp';
import full4 from '../assets/backgrounds/bg-04-bamboo-pavilion.webp';
import thumb4 from '../assets/backgrounds/bg-04-bamboo-pavilion-thumb.webp';
import full5 from '../assets/backgrounds/bg-05-twilight-peaks.webp';
import thumb5 from '../assets/backgrounds/bg-05-twilight-peaks-thumb.webp';
import full6 from '../assets/backgrounds/bg-06-lakeside-light.webp';
import thumb6 from '../assets/backgrounds/bg-06-lakeside-light-thumb.webp';
import full7 from '../assets/backgrounds/bg-07-emerald-waves.webp';
import thumb7 from '../assets/backgrounds/bg-07-emerald-waves-thumb.webp';
import full8 from '../assets/backgrounds/bg-08-cosmic-nebula.webp';
import thumb8 from '../assets/backgrounds/bg-08-cosmic-nebula-thumb.webp';
import full9 from '../assets/backgrounds/bg-09-golden-dragon.webp';
import thumb9 from '../assets/backgrounds/bg-09-golden-dragon-thumb.webp';
import full10 from '../assets/backgrounds/bg-10-carbon-hex.webp';
import thumb10 from '../assets/backgrounds/bg-10-carbon-hex-thumb.webp';

export const BACKGROUNDS: BackgroundDef[] = [
  { n: 1, id: 'sage-leaves', name: 'Sage Leaves', group: 'light', url: full1, thumb: thumb1, lum: { p5: 0.1298, p50: 0.7844, p95: 0.8546 } },
  { n: 2, id: 'misty-forest', name: 'Misty Forest', group: 'light', url: full2, thumb: thumb2, lum: { p5: 0.0248, p50: 0.3187, p95: 0.7937 } },
  { n: 3, id: 'ink-sunrise', name: 'Ink Sunrise', group: 'light', url: full3, thumb: thumb3, lum: { p5: 0.0342, p50: 0.5654, p95: 0.7587 } },
  { n: 4, id: 'bamboo-pavilion', name: 'Bamboo Pavilion', group: 'light', url: full4, thumb: thumb4, lum: { p5: 0.0286, p50: 0.6528, p95: 0.7953 } },
  { n: 5, id: 'twilight-peaks', name: 'Twilight Peaks', group: 'dark', url: full5, thumb: thumb5, lum: { p5: 0.0013, p50: 0.023, p95: 0.1558 } },
  { n: 6, id: 'lakeside-light', name: 'Lakeside Light', group: 'dark', url: full6, thumb: thumb6, lum: { p5: 0.0056, p50: 0.0552, p95: 0.5135 } },
  { n: 7, id: 'emerald-waves', name: 'Emerald Waves', group: 'dark', url: full7, thumb: thumb7, lum: { p5: 0.0016, p50: 0.004, p95: 0.0461 } },
  { n: 8, id: 'cosmic-nebula', name: 'Cosmic Nebula', group: 'dark', url: full8, thumb: thumb8, lum: { p5: 0.0002, p50: 0.0029, p95: 0.1248 } },
  { n: 9, id: 'golden-dragon', name: 'Golden Dragon', group: 'dark', url: full9, thumb: thumb9, lum: { p5: 0.0008, p50: 0.0031, p95: 0.2408 } },
  { n: 10, id: 'carbon-hex', name: 'Carbon Hex', group: 'dark', url: full10, thumb: thumb10, lum: { p5: 0.0015, p50: 0.0035, p95: 0.0122 } },
];
export const BACKGROUND_BY_ID: Record<string, BackgroundDef> = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]));

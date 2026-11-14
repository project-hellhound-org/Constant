import React from 'react';
import { AlertCircle, Check, Palette } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { FONTS, THEME_LIST, THEMES, ThemeDefinition } from './themes';
import { BACKGROUNDS, BACKGROUND_BY_ID } from './backgrounds';
import { computeAdaptive } from './adaptive';
import { contrastRatio } from './validation';

/** Miniature, self-contained rendering of a theme using the theme's own tokens. */
const MiniPreview: React.FC<{ theme: ThemeDefinition }> = ({ theme }) => {
  const t = theme.tokens;
  return (
    <div aria-hidden="true" style={{ background: t['--bg-primary'], border: `1px solid ${t['--border-color']}`, borderRadius: 8, padding: 10, display: 'flex', gap: 8, height: 104 }}>
      <div style={{ width: 28, background: t['--bg-secondary'], border: `1px solid ${t['--border-color']}`, borderRadius: 5, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 6, borderRadius: 3, background: t['--accent-primary'] }} /><div style={{ height: 6, borderRadius: 3, background: t['--border-color'] }} /><div style={{ height: 6, borderRadius: 3, background: t['--border-color'] }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t['--text-primary'], lineHeight: 1 }}>Good morning</div>
        <div style={{ background: t['--bg-surface'], border: `1px solid ${t['--border-color']}`, borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 4, width: '70%', borderRadius: 2, background: t['--text-secondary'] }} />
          <div style={{ height: 5, borderRadius: 3, background: t['--progress-track'] }}><div style={{ height: 5, width: '62%', borderRadius: 3, background: t['--progress-fill'] }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <span style={{ background: t['--accent-primary'], color: t['--text-on-accent'], fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>Primary</span>
          <span style={{ background: t['--bg-surface'], color: t['--text-primary'], border: `1px solid ${t['--border-color']}`, fontSize: 8, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>Secondary</span>
        </div>
      </div>
    </div>
  );
};

const optionStyle = (selected: boolean): React.CSSProperties => ({ textAlign: 'left', padding: '0.8rem', borderRadius: 'var(--radius-lg)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-primary)', border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' });

export const AppearanceSection: React.FC = () => {
  const { preference, setPreference, saveState } = useTheme();
  const theme = THEMES[preference.themeId];
  const bg = BACKGROUND_BY_ID[preference.backgroundId];
  const ad = computeAdaptive(theme, bg);
  const readable = contrastRatio(theme.tokens['--text-muted'], ad.worstCanvasHex);
  const groups: { label: string; items: typeof BACKGROUNDS }[] = [{ label: 'Light backgrounds', items: BACKGROUNDS.filter((b) => b.group === 'light') }, { label: 'Dark backgrounds', items: BACKGROUNDS.filter((b) => b.group === 'dark') }];

  return (
    <section className="liquid-panel" aria-labelledby="appearance-heading" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h3 id="appearance-heading" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Palette size={20} /> Appearance</h3>
        <p className="subtitle" style={{ fontSize: '0.875rem', marginTop: 4 }}>Choose a theme, font and background. Colors adapt automatically so text always stays readable.</p>
      </div>

      <div>
        <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Theme</h4>
        <div role="radiogroup" aria-label="Theme" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
          {THEME_LIST.map((t) => {
            const selected = preference.themeId === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={selected} onClick={() => setPreference({ themeId: t.id })} style={optionStyle(selected)}>
                <MiniPreview theme={t} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.7rem' }}>
                  <strong style={{ fontSize: '1rem' }}>{t.name}</strong>
                  {selected && <span className="chip chip-success"><Check size={12} /> Active</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{t.tagline}</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0.5rem', lineHeight: 1.45 }}>{t.description}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {t.swatches.map((s) => <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--text-muted)' }}><span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, border: '1px solid var(--border-hover)' }} />{s.name}</span>)}
                </div>
              </button>);
          })}
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Font</h4>
        <div role="radiogroup" aria-label="Font" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          {FONTS.map((f) => {
            const selected = preference.fontId === f.id;
            return (
              <button key={f.id} type="button" role="radio" aria-checked={selected} onClick={() => setPreference({ fontId: f.id })} style={optionStyle(selected)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: f.heading, fontSize: '1.9rem', fontWeight: 600, lineHeight: 1 }}>{f.sample}</span>
                  {selected && <Check size={16} aria-hidden="true" style={{ color: 'var(--accent-primary)' }} />}
                </div>
                <div style={{ fontFamily: f.body, fontSize: '0.9rem', fontWeight: 600, marginTop: 8 }}>{f.name}</div>
                <div style={{ fontFamily: f.body, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.style}</div>
                <div style={{ fontFamily: f.body, fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6 }}>Build better habits.</div>
              </button>);
          })}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <h4 style={{ fontSize: '0.95rem' }}>Background</h4>
          <span className="num" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }} aria-live="polite">Text contrast on {bg.name}: {readable.toFixed(1)}:1 ({readable >= 7 ? 'AAA' : 'AA'})</span>
        </div>
        {groups.map((g) => (
          <div key={g.label} style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{g.label}</div>
            <div role="radiogroup" aria-label={g.label} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {g.items.map((b) => {
                const selected = preference.backgroundId === b.id;
                return (
                  <button key={b.id} type="button" role="radio" aria-checked={selected} aria-label={`${b.name} background`} onClick={() => setPreference({ backgroundId: b.id })} style={{ ...optionStyle(selected), padding: 6 }}>
                    <div style={{ position: 'relative', aspectRatio: '2 / 1', borderRadius: 8, overflow: 'hidden', backgroundImage: `url("${b.thumb}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                      <span className="num" style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.66rem', fontWeight: 700, borderRadius: 5, padding: '1px 6px' }}>{String(b.n).padStart(2, '0')}</span>
                      {selected && <span style={{ position: 'absolute', top: 5, right: 5, background: 'var(--accent-primary)', color: 'var(--text-on-accent)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} /></span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, padding: '6px 2px 2px' }}>{b.name}</div>
                  </button>);
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ minHeight: 22, fontSize: '0.82rem' }} aria-live="polite">
        {saveState === 'saved' && <span style={{ color: 'var(--success)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Check size={14} /> Saved</span>}
        {saveState === 'error' && <span style={{ color: 'var(--danger)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><AlertCircle size={14} /> Could not save. Your previous appearance was kept.</span>}
      </div>
    </section>
  );
};

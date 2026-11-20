import React from 'react';

/** App identity: CONSTANT / Personalized Routine Tracker. */
export const Brand: React.FC<{ size?: 'sm' | 'lg'; align?: 'left' | 'center' }> = ({ size = 'sm', align = 'left' }) => {
  const big = size === 'lg';
  return (
    <div style={{ display: 'flex', flexDirection: big ? 'column' : 'row', alignItems: 'center', gap: big ? '1.1rem' : '0.75rem', textAlign: align }}>
      <div aria-hidden="true" style={{ width: big ? 76 : 40, height: big ? 76 : 40, borderRadius: big ? 22 : 11, background: 'var(--accent-primary)', color: 'var(--text-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: big ? '2.4rem' : '1.25rem', boxShadow: big ? 'var(--shadow-elevated)' : 'none' }}>C</div>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, letterSpacing: big ? '0.28em' : '0.16em', fontSize: big ? '2.1rem' : '1.05rem', lineHeight: 1.1, color: 'var(--text-primary)' }}>CONSTANT</div>
        <div style={{ fontSize: big ? '0.95rem' : '0.68rem', color: 'var(--text-secondary)', marginTop: big ? 6 : 2, letterSpacing: big ? '0.04em' : 0 }}>Personalized Routine Tracker</div>
      </div>
    </div>
  );
};

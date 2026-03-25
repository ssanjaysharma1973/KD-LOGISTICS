import React, { useState } from 'react';
import TripMonitor from './TripMonitor.jsx';
import Ledgers from './Ledgers.jsx';
import RoutesPage from './RoutesPage.jsx';

const TABS = [
  { key: 'monitor',  label: '🚦 Trip Monitor' },
  { key: 'ledgers',  label: '📒 Ledgers'      },
  { key: 'routes',   label: '🗺️ Routes & Live' },
];

export default function RouteOperations() {
  const [tab, setTab] = useState('monitor');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Combined Header + Tabs ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        borderRadius: 8, padding: '0 16px', marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minHeight: 44,
      }}>
        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 16, borderRight: '1px solid rgba(255,255,255,0.25)', marginRight: 4 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>🚦 Route Operations</h2>
          <div style={{ color: '#93c5fd', fontSize: 10, marginTop: 1 }}>Monitor trips, ledgers & live routes</div>
        </div>
        {/* Tabs inside header */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '5px 14px', border: 'none', cursor: 'pointer', borderRadius: 6,
                fontWeight: tab === t.key ? 700 : 500,
                fontSize: 12,
                background: tab === t.key ? 'rgba(255,255,255,0.22)' : 'transparent',
                color: tab === t.key ? '#fff' : '#bfdbfe',
                boxShadow: tab === t.key ? 'inset 0 0 0 1.5px rgba(255,255,255,0.45)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'monitor' && <TripMonitor />}
        {tab === 'ledgers' && <Ledgers />}
        {tab === 'routes'  && <RoutesPage />}
      </div>
    </div>
  );
}

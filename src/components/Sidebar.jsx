import React from "react";

export function MapComponent() {
  return <div>MapComponent placeholder</div>;
}

export default function Sidebar({ activeTab, setActiveTab, dashboardView, setDashboardView }) {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', emoji: '⊞', view: 'grid' },
    { key: 'tracker', label: 'Live Tracker', emoji: '🗺️' },
    { key: 'ewaybill', label: 'E-Way Bill Hub', emoji: '📄' },
    { key: 'vehicles', label: 'Vehicles', emoji: '🚗' },
    { key: 'trip-dispatch', label: 'Trip Dispatch', emoji: '🚚' },
    { key: 'munshi-ops', label: 'Munshi Hub', emoji: '📋' },
    { key: 'route-ops', label: 'Route Ops', emoji: '🚦' },
    { key: 'driver-portal', label: 'Driver Portal', emoji: '🚛' },
  ];

  const settingsItems = [
    { key: 'bulk-unloading-charges', label: 'Unloading Charges', emoji: '💰' },
    { key: 'poimanagement', label: 'POI & Discovery', emoji: '📍' },
    { key: 'route-memory', label: 'Learned Routes', emoji: '🧠' },
    { key: 'settings', label: 'Settings', emoji: '⚙️' },
  ];

  const isSettingsActive = settingsItems.some(item => activeTab === item.key);
  const [settingsOpen, setSettingsOpen] = React.useState(isSettingsActive);

  const CLIENT_NAME = 'ATUL LOGISTICS';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: '#fff', borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center', gap: 0,
      height: 46, paddingLeft: 16, paddingRight: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    }}>
      {/* Brand */}
      <h1 style={{
        fontSize: 13, fontWeight: 800, color: '#1e40af',
        margin: 0, marginRight: 18, whiteSpace: 'nowrap',
        textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0,
      }}>{CLIENT_NAME}</h1>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: '#e2e8f0', marginRight: 14, flexShrink: 0 }} />

      {/* Nav items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflowX: 'auto' }}>
        {navItems.map((item, idx) => {
          const isActive = activeTab === item.key && (!item.view || dashboardView === item.view);
          return (
            <button
              key={idx}
              onClick={() => { setActiveTab(item.key); if (item.view && setDashboardView) setDashboardView(item.view); }}
              style={{
                padding: '5px 11px', borderRadius: 6, border: 'none',
                background: isActive ? '#dbeafe' : 'transparent',
                color: isActive ? '#1e40af' : '#4b5563',
                fontWeight: isActive ? 700 : 500, fontSize: 12,
                cursor: 'pointer', whiteSpace: 'nowrap',
                borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                transition: 'all 0.12s',
              }}
            >
              {item.emoji} {item.label}
            </button>
          );
        })}

      </div>

      {/* Client Admin dropdown */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setSettingsOpen(o => !o)}
          style={{
            padding: '5px 11px', borderRadius: 6, border: 'none',
            background: isSettingsActive ? '#dbeafe' : 'transparent',
            color: isSettingsActive ? '#1e40af' : '#4b5563',
            fontWeight: isSettingsActive ? 700 : 500, fontSize: 12,
            cursor: 'pointer', whiteSpace: 'nowrap',
            borderBottom: isSettingsActive ? '2px solid #3b82f6' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          🛠️ Client Admin <span style={{ fontSize: 9 }}>{settingsOpen ? '▲' : '▼'}</span>
        </button>
        {settingsOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 170, zIndex: 300, padding: 6,
          }}>
            {settingsItems.map((item, idx) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={idx}
                  onClick={() => { setActiveTab(item.key); setSettingsOpen(false); }}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 6, border: 'none',
                    background: isActive ? '#dbeafe' : 'transparent',
                    color: isActive ? '#1e40af' : '#374151',
                    fontWeight: isActive ? 700 : 400, fontSize: 12,
                    cursor: 'pointer', textAlign: 'left', display: 'block',
                  }}
                >
                  {item.emoji} {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
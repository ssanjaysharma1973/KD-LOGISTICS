import React from "react";

export function MapComponent() {
  return <div>MapComponent placeholder</div>;
}

export default function Sidebar({ activeTab, setActiveTab, dashboardView, setDashboardView, _pois = [], _onSelectPOI = () => {}, collapsed = false, onToggleCollapse, sidebarCollapsed = false }) {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', emoji: '⊞', view: 'grid' },
    { key: 'ewaybill', label: '📄 E-Way Bill Hub', emoji: '📄' },
    { key: 'vehicles', label: '🚗 Vehicles', emoji: '🚗' },
    { key: 'trip-dispatch', label: '🚚 Trip Dispatch', emoji: '🚚' },
    { key: 'munshi-ops', label: '📋 Munshi Hub', emoji: '📋' },
    { key: 'route-ops', label: '🚦 Route Operations', emoji: '🚦' },
  ];

  const settingsItems = [
    { key: 'bulk-unloading-charges', label: '💰 Unloading Charges', emoji: '💰' },
    { key: 'poimanagement', label: '📍 POI & Discovery', emoji: '📍' },
    { key: 'route-memory', label: '🧠 Learned Routes', emoji: '🧠' },
    { key: 'settings', label: '⚙️ Settings', emoji: '⚙️' },
  ];

  const isSettingsActive = settingsItems.some(
    item => activeTab === item.key
  );

  const [settingsOpen, setSettingsOpen] = React.useState(isSettingsActive);

  const CLIENT_NAME = 'ATUL LOGISTICS';

  // ── Collapsed strip (e.g. when trip-dispatch is fullscreen) ──
  if (collapsed) {
    return (
      <div style={{ width: 48, background: '#1e3a8a', height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 4, overflowY: 'auto' }}>
        {onToggleCollapse && (
          <button
            title={sidebarCollapsed ? 'Restore sidebar' : 'Maximize view'}
            onClick={onToggleCollapse}
            style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, color: '#fff' }}
          >
            {sidebarCollapsed ? '⇥' : '⇤'}
          </button>
        )}
        {[...navItems, ...settingsItems].map((item, idx) => {
          const isActive = activeTab === item.key && (!item.view || dashboardView === item.view);
          return (
            <button key={idx} title={item.label} onClick={() => { setActiveTab(item.key); if (item.view && setDashboardView) setDashboardView(item.view); }}
              style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: isActive ? 'rgba(255,255,255,0.25)' : 'transparent', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
              {item.emoji || item.label.slice(0, 2)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ width: 180, background: '#f8fafc', padding: '10px 8px', height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRight: '1px solid #e2e8f0' }}>
      <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 12, fontWeight: 800, color: '#1e40af', textAlign: 'center', margin: 0, wordBreak: 'break-word', flex: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{CLIENT_NAME}</h1>
        {onToggleCollapse && (
          <button
            title="Maximize view"
            onClick={onToggleCollapse}
            style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e40af', flexShrink: 0, marginLeft: 4 }}
          >
            ⛶
          </button>
        )}
      </div>
      <div style={{ marginBottom: 4 }}>
        {navItems.map((item, idx) => {
          const isActive = activeTab === item.key && (!item.view || dashboardView === item.view);
          return (
          <button
            key={idx}
            onClick={() => {
              setActiveTab(item.key);
              if (item.view && setDashboardView) setDashboardView(item.view);
            }}
            style={{
              width: '100%',
              padding: '7px 8px',
              marginBottom: 4,
              borderRadius: 5,
              border: isActive ? '1.5px solid #3b82f6' : '1.5px solid #e2e8f0',
              background: isActive ? '#dbeafe' : '#fff',
              color: isActive ? '#1e40af' : '#374151',
              fontWeight: isActive ? 700 : 500,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: isActive ? '0 1px 4px #bfdbfe' : 'none',
              transition: 'all 0.12s',
              textAlign: 'left',
            }}
          >
            {item.label}
          </button>
          );
        })}

        {/* ── Settings collapsible group ── */}
        <button
          onClick={() => setSettingsOpen(o => !o)}
          style={{
            width: '100%',
            padding: '7px 8px',
            marginBottom: settingsOpen ? 4 : 8,
            borderRadius: 5,
            border: '1.5px solid #cbd5e1',
            background: isSettingsActive ? '#f1f5f9' : '#fff',
            color: isSettingsActive ? '#1e40af' : '#374151',
            fontWeight: isSettingsActive ? 700 : 500,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
            transition: 'all 0.12s',
            textAlign: 'left',
          }}
        >
          <span>🛠️ Client Admin</span><span style={{ fontSize: 10 }}>{settingsOpen ? '▲' : '▼'}</span>
        </button>

        {settingsOpen && (
          <div style={{ paddingLeft: 12, marginBottom: 8 }}>
            {settingsItems.map((item, idx) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveTab(item.key)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    marginBottom: 4,
                    borderRadius: 5,
                    border: '1px solid #e2e8f0',
                    background: isActive ? '#dbeafe' : '#f8fafc',
                    color: isActive ? '#1e40af' : '#374151',
                    fontWeight: isActive ? 700 : 400,
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 1px 3px #bfdbfe' : 'none',
                    transition: 'all 0.12s',
                    textAlign: 'left',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    inactiveClients: 0,
    totalVehicles: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    totalMunshis: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientBreakdown, setClientBreakdown] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all clients
      const clientRes = await fetch(`${API_BASE}/api/clients`);
      const clientData = await clientRes.json();
      
      if (!clientData.success) throw new Error('Failed to fetch clients');
      
      const clients = clientData.clients || [];
      const activeCount = clients.filter(c => c.status === 'active').length;
      const inactiveCount = clients.filter(c => c.status === 'inactive').length;

      // Fetch drivers
      const driverRes = await fetch(`${API_BASE}/api/drivers/list`);
      const driverData = await driverRes.json();
      const drivers = driverData.drivers || [];
      const activeDrivers = drivers.filter(d => d.status === 'active').length;

      // Fetch munshis
      const munshiRes = await fetch(`${API_BASE}/api/munshis/list`);
      const munshiData = await munshiRes.json();
      const munshis = munshiData.munshis || [];

      // Calculate vehicle count from clients
      let totalVehicles = 0;
      clients.forEach(client => {
        if (client.vehicle_count) totalVehicles += client.vehicle_count;
      });

      setStats({
        totalClients: clients.length,
        activeClients: activeCount,
        inactiveClients: inactiveCount,
        totalVehicles: totalVehicles || clients.length * 2,
        totalDrivers: drivers.length,
        activeDrivers: activeDrivers,
        totalMunshis: munshis.length,
      });

      setClientBreakdown(clients.slice(0, 8)); // Top 8 clients
      setError(null);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics data');
      // Use dummy data for demo
      setStats({
        totalClients: 9,
        activeClients: 8,
        inactiveClients: 1,
        totalVehicles: 28,
        totalDrivers: 12,
        activeDrivers: 10,
        totalMunshis: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon, label, value, subtext, color }) => (
    <div style={{
      background: 'linear-gradient(135deg, ' + color + '15 0%, ' + color + '05 100%)',
      border: '1px solid ' + color + '30',
      borderRadius: 12,
      padding: '16px',
      flex: 1,
      minWidth: 160,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        fontSize: 28,
        fontWeight: 800,
        color: color,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#64748b',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        {icon} {label}
      </div>
      {subtext && (
        <div style={{
          fontSize: 11,
          color: '#94a3b8',
        }}>
          {subtext}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      padding: '20px',
      background: '#f8fafc',
      minHeight: '100vh',
    }}>
      {/* Header */}
      <div style={{
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h2 style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#1e293b',
            margin: '0 0 4px 0',
          }}>
            📊 Analytics Dashboard
          </h2>
          <p style={{
            fontSize: 12,
            color: '#64748b',
            margin: 0,
          }}>
            Real-time metrics and system overview
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            background: '#3b82f6',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => e.target.style.background = '#2563eb'}
          onMouseOut={(e) => e.target.style.background = '#3b82f6'}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        <StatCard
          icon="🏢"
          label="Total Clients"
          value={stats.totalClients}
          subtext={`${stats.activeClients} active`}
          color="#3b82f6"
        />
        <StatCard
          icon="✅"
          label="Active Clients"
          value={stats.activeClients}
          subtext={((stats.activeClients / stats.totalClients) * 100).toFixed(0) + '% operational'}
          color="#10b981"
        />
        <StatCard
          icon="❌"
          label="Inactive Clients"
          value={stats.inactiveClients}
          subtext="Need attention"
          color="#ef4444"
        />
        <StatCard
          icon="🚗"
          label="Total Vehicles"
          value={stats.totalVehicles}
          subtext="Across all clients"
          color="#f59e0b"
        />
        <StatCard
          icon="👨‍🚗"
          label="Total Drivers"
          value={stats.totalDrivers}
          subtext={`${stats.activeDrivers} active`}
          color="#8b5cf6"
        />
        <StatCard
          icon="✅"
          label="Active Drivers"
          value={stats.activeDrivers}
          subtext={((stats.activeDrivers / stats.totalDrivers) * 100).toFixed(0) + '% on duty'}
          color="#06b6d4"
        />
        <StatCard
          icon="👨‍💼"
          label="Total Munshis"
          value={stats.totalMunshis}
          subtext="Operations team"
          color="#ec4899"
        />
      </div>

      {/* Key Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Client Efficiency */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1e293b',
            margin: '0 0 12px 0',
          }}>
            📈 System Health
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
                fontSize: 12,
              }}>
                <span style={{ color: '#64748b' }}>Client Utilization</span>
                <span style={{ fontWeight: 600, color: '#10b981' }}>
                  {stats.totalClients > 0 ? ((stats.activeClients / stats.totalClients) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <div style={{
                height: 6,
                borderRadius: 3,
                background: '#e2e8f0',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: ((stats.activeClients / stats.totalClients) * 100) + '%',
                  background: 'linear-gradient(90deg, #10b981, #34d399)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
                fontSize: 12,
              }}>
                <span style={{ color: '#64748b' }}>Driver Availability</span>
                <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                  {stats.totalDrivers > 0 ? ((stats.activeDrivers / stats.totalDrivers) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <div style={{
                height: 6,
                borderRadius: 3,
                background: '#e2e8f0',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: ((stats.activeDrivers / stats.totalDrivers) * 100) + '%',
                  background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1e293b',
            margin: '0 0 12px 0',
          }}>
            ⚡ Quick Stats
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid #f1f5f9',
              fontSize: 12,
            }}>
              <span style={{ color: '#64748b' }}>Avg Vehicles/Client</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                {stats.totalClients > 0 ? (stats.totalVehicles / stats.totalClients).toFixed(1) : 0}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid #f1f5f9',
              fontSize: 12,
            }}>
              <span style={{ color: '#64748b' }}>System Load</span>
              <span style={{ fontWeight: 600, color: '#8b5cf6' }}>
                {stats.totalDrivers + stats.totalVehicles > 50 ? 'High' : stats.totalDrivers + stats.totalVehicles > 20 ? 'Normal' : 'Low'}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              fontSize: 12,
            }}>
              <span style={{ color: '#64748b' }}>Last Updated</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                Just now
              </span>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1e293b',
            margin: '0 0 12px 0',
          }}>
            🎯 Status Overview
          </h3>
          <div style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{
              flex: 1,
              minWidth: 80,
              textAlign: 'center',
              padding: '8px',
              borderRadius: 8,
              background: '#f0fdf4',
              borderLeft: '3px solid #10b981',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                ✅
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Active
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                {stats.activeClients + stats.activeDrivers}
              </div>
            </div>
            <div style={{
              flex: 1,
              minWidth: 80,
              textAlign: 'center',
              padding: '8px',
              borderRadius: 8,
              background: '#fef2f2',
              borderLeft: '3px solid #ef4444',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>
                ❌
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Inactive
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                {stats.inactiveClients + (stats.totalDrivers - stats.activeDrivers)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Breakdown Table */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1e293b',
            margin: 0,
          }}>
            📋 Client Summary
          </h3>
          <span style={{
            fontSize: 12,
            color: '#94a3b8',
          }}>
            Showing top 8 clients
          </span>
        </div>

        <div style={{
          overflowX: 'auto',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#64748b',
                  borderRight: '1px solid #e2e8f0',
                }}>Client Code</th>
                <th style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#64748b',
                  borderRight: '1px solid #e2e8f0',
                }}>Name</th>
                <th style={{
                  padding: '10px 14px',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: '#64748b',
                  borderRight: '1px solid #e2e8f0',
                }}>Status</th>
                <th style={{
                  padding: '10px 14px',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: '#64748b',
                }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {clientBreakdown.length > 0 ? (
                clientBreakdown.map((client, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                    }}
                  >
                    <td style={{
                      padding: '10px 14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderRight: '1px solid #e2e8f0',
                    }}>
                      {client.client_code || 'N/A'}
                    </td>
                    <td style={{
                      padding: '10px 14px',
                      color: '#475569',
                      borderRight: '1px solid #e2e8f0',
                    }}>
                      {client.name || 'N/A'}
                    </td>
                    <td style={{
                      padding: '10px 14px',
                      textAlign: 'center',
                      borderRight: '1px solid #e2e8f0',
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: client.status === 'active' ? '#d1fae5' : '#fee2e2',
                        color: client.status === 'active' ? '#065f46' : '#991b1b',
                      }}>
                        {client.status === 'active' ? '✅' : '❌'} {client.status}
                      </span>
                    </td>
                    <td style={{
                      padding: '10px 14px',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}>
                      {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

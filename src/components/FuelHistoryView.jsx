import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

/**
 * Fuel History & Variance View Component
 * Shows driver's fuel advances, transactions, and variance tracking
 */
const FuelHistoryView = ({ driverId, clientId }) => {
  const [advances, setAdvances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [variance, setVariance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('advances');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch pending approvals (driver's advances)
        const appRes = await fetch(
          `/api/fuel/dashboard/pending-approvals${clientId ? `?client_id=${clientId}` : ''}`
        );
        const appData = await appRes.json();
        const driverAdvances = appData.approvals?.filter(a => a.driver_id === driverId) || [];
        setAdvances(driverAdvances);

        setError('');
      } catch (err) {
        setError('Failed to fetch fuel history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (driverId) {
      fetchData();
      // Refresh every 60 seconds
      const interval = setInterval(fetchData, 60000);
      return () => clearInterval(interval);
    }
  }, [driverId, clientId]);

  // Status badge helper
  const getStatusBadge = (status) => {
    const styles = {
      requested: { bg: '#fef3c7', text: '#92400e', icon: Clock },
      approved: { bg: '#dbeafe', text: '#1e40af', icon: CheckCircle },
      issued: { bg: '#dcfce7', text: '#166534', icon: CheckCircle },
      settled: { bg: '#e5e7eb', text: '#374151', icon: CheckCircle },
      rejected: { bg: '#fee2e2', text: '#7f1d1d', icon: AlertCircle },
    };

    const style = styles[status] || styles.requested;
    const Icon = style.icon;

    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: style.bg,
        color: style.text,
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600
      }}>
        <Icon size={12} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    );
  };

  return (
    <div style={{
      backgroundColor: '#f9fafb',
      borderRadius: 12,
      padding: 20,
      maxWidth: '100%'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#111' }}>
          🛢️ Fuel Advance History
        </h3>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb' }}>
          {['advances', 'stats'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px',
                backgroundColor: activeTab === tab ? 'white' : 'transparent',
                border: activeTab === tab ? '2px solid #7c3aed' : 'none',
                borderBottom: activeTab === tab ? undefined : '1px solid transparent',
                color: activeTab === tab ? '#7c3aed' : '#6b7280',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: activeTab === tab ? '8px 8px 0 0' : 0
              }}
            >
              {tab === 'advances' ? 'My Advances' : 'Statistics'}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start'
        }}>
          <AlertCircle size={18} color="#dc2626" />
          <span style={{ fontSize: 13, color: '#7f1d1d' }}>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          Loading fuel history...
        </div>
      )}

      {/* Advances Tab */}
      {!loading && activeTab === 'advances' && (
        <div>
          {advances.length === 0 ? (
            <div style={{
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: 6,
              padding: 20,
              textAlign: 'center',
              color: '#166534'
            }}>
              No fuel advances yet
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {advances.map(advance => (
                <div
                  key={advance.advance_id}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 16,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  {/* Header Row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12
                  }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#111' }}>
                        {advance.trip_no}
                      </strong>
                      <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                        {advance.from_poi_name} → {advance.to_poi_name}
                      </span>
                    </div>
                    {getStatusBadge(advance.approval_status)}
                  </div>

                  {/* Details */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 12,
                    fontSize: 12,
                    marginBottom: 12,
                    color: '#374151'
                  }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>Requested</span>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        ₹{advance.amount_requested}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Approved</span>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {advance.amount_approved ? `₹${advance.amount_approved}` : '—'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>Date</span>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {new Date(advance.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Bill Status */}
                  {advance.bill_uploaded && (
                    <div style={{
                      backgroundColor: '#dcfce7',
                      borderLeft: '3px solid #10b981',
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#166534',
                      marginBottom: 8
                    }}>
                      ✓ Bill uploaded: ₹{advance.bill_amount}
                    </div>
                  )}

                  {/* Variance */}
                  {advance.fuel_variance && (
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      fontSize: 12,
                      color: advance.fuel_variance > 0 ? '#dc2626' : '#16a34a'
                    }}>
                      <TrendingUp size={14} />
                      Variance: {advance.fuel_variance > 0 ? '+' : ''}{advance.fuel_variance} (settlement pending)
                    </div>
                  )}

                  {/* Remarks */}
                  {advance.remarks && (
                    <div style={{
                      fontSize: 11,
                      color: '#6b7280',
                      fontStyle: 'italic',
                      marginTop: 8,
                      borderTop: '1px solid #f3f4f6',
                      paddingTop: 8
                    }}>
                      "{advance.remarks}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {!loading && activeTab === 'stats' && (
        <div>
          {advances.length === 0 ? (
            <div style={{
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: 6,
              padding: 20,
              textAlign: 'center',
              color: '#166534'
            }}>
              No statistics available yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Total Requested */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  Total Requested
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>
                  ₹{advances.reduce((sum, a) => sum + a.amount_requested, 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                  {advances.length} advance{advances.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Total Approved */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  Total Approved
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
                  ₹{advances.filter(a => a.amount_approved).reduce((sum, a) => sum + (a.amount_approved || 0), 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                  {advances.filter(a => a.approval_status !== 'requested').length} approved
                </div>
              </div>

              {/* Pending Approvals */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  Pending Approval
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>
                  ₹{advances.filter(a => a.approval_status === 'requested').reduce((sum, a) => sum + a.amount_requested, 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                  {advances.filter(a => a.approval_status === 'requested').length} waiting
                </div>
              </div>

              {/* Bills Uploaded */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  Bills Uploaded
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>
                  {advances.filter(a => a.bill_uploaded).length}/{advances.length}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                  {Math.round((advances.filter(a => a.bill_uploaded).length / advances.length) * 100)}% completion
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FuelHistoryView;

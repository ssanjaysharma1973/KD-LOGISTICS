import React, { useState, useEffect } from 'react';
import { Check, X, Clock, AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

/**
 * Fuel Approval Dashboard Component
 * Munshi/Finance reviews and approves fuel advance requests
 */
const FuelApprovalDashboard = ({ userRole = 'munshi', clientId }) => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [approvalAmount, setApprovalAmount] = useState('');
  const [issuingAdvance, setIssuingAdvance] = useState(false);

  // Fetch pending approvals
  const fetchPendingApprovals = async () => {
    setLoading(true);
    try {
      const url = clientId 
        ? `/api/fuel/dashboard/pending-approvals?client_id=${clientId}`
        : `/api/fuel/dashboard/pending-approvals`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      setPendingApprovals(data.approvals || []);
      setError('');
    } catch (err) {
      setError('Failed to fetch pending approvals');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
    // Poll every 2 minutes
    const interval = setInterval(fetchPendingApprovals, 120000);
    return () => clearInterval(interval);
  }, [clientId]);

  const handleApprove = async (approval) => {
    setSelectedApproval(approval);
    setApprovalAmount(approval.amount_requested);
  };

  const submitApproval = async () => {
    if (!approvalAmount) {
      alert('Enter approval amount');
      return;
    }

    setIssuingAdvance(true);
    try {
      // Step 1: Approve
      const approveRes = await fetch(`${API_BASE}/api/fuel/advance/${selectedApproval.advance_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_amount: parseFloat(approvalAmount),
          approved_by: `${userRole}_${new Date().toISOString().split('T')[0]}`
        })
      });

      if (!approveRes.ok) {
        throw new Error('Failed to approve');
      }

      // Step 2: Issue (auto-issue for munshi approval)
      const issueRes = await fetch(`${API_BASE}/api/fuel/advance/${selectedApproval.advance_id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issued_amount: parseFloat(approvalAmount),
          issue_mode: 'cash',
          issued_by: `${userRole}_approved`
        })
      });

      if (issueRes.ok) {
        // Refresh list
        await fetchPendingApprovals();
        setSelectedApproval(null);
        setApprovalAmount('');
        alert('✓ Advance approved and issued!');
      } else {
        throw new Error('Failed to issue');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIssuingAdvance(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#f9fafb',
      borderRadius: 12,
      padding: 20,
      maxWidth: '100%'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>
          ⚡ Fuel Advance Approvals
        </h3>
        <button
          onClick={fetchPendingApprovals}
          style={{
            padding: '8px 12px',
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
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
          gap: 8
        }}>
          <AlertCircle size={18} color="#dc2626" />
          <span style={{ fontSize: 13, color: '#7f1d1d' }}>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: '#6b7280'
        }}>
          Loading pending approvals...
        </div>
      )}

      {/* No Pending */}
      {!loading && pendingApprovals.length === 0 && (
        <div style={{
          backgroundColor: '#dcfce7',
          border: '1px solid #86efac',
          borderRadius: 6,
          padding: 20,
          textAlign: 'center',
          color: '#166534'
        }}>
          ✓ No pending approvals. All caught up!
        </div>
      )}

      {/* Approval Cards */}
      {!loading && pendingApprovals.length > 0 && (
        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          {pendingApprovals.map((approval) => (
            <div
              key={approval.advance_id}
              style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 14, color: '#111' }}>
                    {approval.trip_no} • {approval.driver_name}
                  </strong>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                    {approval.from_poi_name} → {approval.to_poi_name}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  gap: 16,
                  fontSize: 13,
                  color: '#374151'
                }}>
                  <div>
                    <span style={{ color: '#6b7280' }}>Amount:</span> <strong>₹{approval.amount_requested}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Requested:</span> {new Date(approval.created_at).toLocaleString()}
                  </div>
                </div>
                {approval.remarks && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>
                    "{approval.remarks}"
                  </div>
                )}
              </div>

              {/* Approve Button */}
              <button
                onClick={() => handleApprove(approval)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginLeft: 12
                }}
              >
                <Check size={14} />
                Approve
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {selectedApproval && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: '90%',
            boxShadow: '0 20px 25px rgba(0,0,0,0.15)'
          }}>
            <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#111' }}>
              Approve Fuel Advance
            </h4>

            <div style={{
              backgroundColor: '#f3f4f6',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              fontSize: 13
            }}>
              <div style={{ marginBottom: 6 }}>
                <strong>Trip:</strong> {selectedApproval.trip_no}
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>Driver:</strong> {selectedApproval.driver_name}
              </div>
              <div>
                <strong>Requested:</strong> ₹{selectedApproval.amount_requested}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: '#374151'
              }}>
                Approval Amount (₹)
              </label>
              <input
                type="number"
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
                max={selectedApproval.amount_requested * 1.2}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Max: ₹{Math.round(selectedApproval.amount_requested * 1.2)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setSelectedApproval(null)}
                disabled={issuingAdvance}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: 6,
                  cursor: issuingAdvance ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitApproval}
                disabled={issuingAdvance}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  backgroundColor: issuingAdvance ? '#d1d5db' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: issuingAdvance ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Check size={14} />
                {issuingAdvance ? 'Processing...' : 'Approve & Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Footer */}
      {!loading && pendingApprovals.length > 0 && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: 6,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: '#92400e'
        }}>
          <Clock size={16} />
          <strong>{pendingApprovals.length}</strong> pending approval
          {pendingApprovals.length !== 1 ? 's' : ''} • Total: ₹
          {pendingApprovals.reduce((acc, a) => acc + a.amount_requested, 0).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default FuelApprovalDashboard;

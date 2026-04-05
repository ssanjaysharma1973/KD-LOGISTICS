import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, Send } from 'lucide-react';

/**
 * Fuel Advance Request Form Component
 * Allows drivers to request fuel advance for a trip
 */
const FuelAdvanceRequestForm = ({ tripId, driverId, onRequestSubmitted }) => {
  const [formData, setFormData] = useState({
    amount_requested: '',
    remarks: ''
  });

  const [tripInfo, setTripInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch trip details and fuel planning
  useEffect(() => {
    const fetchTripData = async () => {
      try {
        // Fetch trip details
        const tripRes = await fetch(`/api/trips/${tripId}`);
        const trip = await tripRes.json();

        // Get fuel plan
        const planRes = await fetch(`/api/fuel/plan/${tripId}`, { method: 'POST' });
        const plan = await planRes.json();

        setTripInfo({
          trip_no: trip.trip_no,
          vehicle_no: trip.vehicle_no,
          driver_name: trip.driver_name,
          from_poi: trip.from_poi_name,
          to_poi: trip.to_poi_name,
          expected_fuel: plan.fuel_plan.expected_fuel_ltr,
          fuel_limit: plan.fuel_plan.fuel_limit_amount,
          max_advance: plan.fuel_plan.max_advance,
          fuel_mode: plan.fuel_plan.fuel_mode
        });

        // Pre-fill suggested amount (80% of max)
        setFormData({
          amount_requested: Math.round(plan.fuel_plan.max_advance * 0.8),
          remarks: ''
        });
      } catch (err) {
        setError('Failed to fetch trip details');
        console.error(err);
      }
    };

    if (tripId) {
      fetchTripData();
    }
  }, [tripId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/fuel/advance/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          driver_id: driverId,
          amount_requested: parseFloat(formData.amount_requested),
          remarks: formData.remarks
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'created') {
        setSuccess(`✓ Advance request created! ID: ${data.advance_id}`);
        setFormData({ amount_requested: '', remarks: '' });
        
        // Callback to parent
        if (onRequestSubmitted) {
          onRequestSubmitted(data);
        }
      } else {
        setError(data.error || 'Failed to create request');
      }
    } catch (err) {
      setError('Error submitting request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#f9fafb',
      borderRadius: 12,
      padding: 20,
      maxWidth: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#111' }}>
        🛢️ Request Fuel Advance
      </h3>

      {/* Trip Info Card */}
      {tripInfo && (
        <div style={{
          backgroundColor: '#ede9fe',
          borderLeft: '4px solid #7c3aed',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 13
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Trip:</strong> {tripInfo.trip_no} | <strong>Vehicle:</strong> {tripInfo.vehicle_no}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Route:</strong> {tripInfo.from_poi} → {tripInfo.to_poi}
          </div>
          <div>
            <strong>Expected Fuel:</strong> {tripInfo.expected_fuel} L | <strong>Max Advance:</strong> ₹{tripInfo.max_advance}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Amount Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
            Amount Requested (₹) *
          </label>
          <input
            type="number"
            value={formData.amount_requested}
            onChange={(e) => setFormData({ ...formData, amount_requested: e.target.value })}
            min="100"
            max={tripInfo?.fuel_limit}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: error ? '2px solid #ef4444' : '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              boxSizing: 'border-box'
            }}
          />
          {tripInfo && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              Max: ₹{tripInfo.fuel_limit}
            </div>
          )}
        </div>

        {/* Remarks */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
            Remarks (Optional)
          </label>
          <textarea
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="E.g., Early morning start, high-traffic route, etc."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              minHeight: 80,
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            padding: 12,
            marginBottom: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start'
          }}>
            <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 13, color: '#7f1d1d' }}>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div style={{
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: 6,
            padding: 12,
            marginBottom: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'center'
          }}>
            <CheckCircle size={18} color="#16a34a" />
            <span style={{ fontSize: 13, color: '#166534' }}>{success}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: loading ? '#d1d5db' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#6d28d9')}
          onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#7c3aed')}
        >
          <Send size={16} />
          {loading ? 'Submitting...' : 'Request Advance'}
        </button>
      </form>

      {/* Info Footer */}
      <div style={{
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 6,
        padding: 12,
        marginTop: 16,
        fontSize: 12,
        color: '#0369a1'
      }}>
        <strong>ℹ️ Info:</strong> Your request will be reviewed by Munshi and approved within 1-2 hours.
      </div>
    </div>
  );
};

export default FuelAdvanceRequestForm;

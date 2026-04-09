import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

/**
 * Fuel Bill Upload Component
 * Drivers upload fuel receipt/bill after fueling up
 */
const FuelBillUpload = ({ tripId, driverId, onBillUploaded }) => {
  const [formData, setFormData] = useState({
    litres: '',
    amount: '',
    bill_number: '',
    location: '',
    remarks: ''
  });

  const [billImage, setBillImage] = useState(null);
  const [billImagePreview, setBillImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      setBillImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setBillImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.litres || !formData.amount || !formData.bill_number) {
      setError('Litres, Amount, and Bill Number are required');
      setLoading(false);
      return;
    }

    try {
      // Submit fuel transaction
      const response = await fetch(`${API_BASE}/api/fuel/transaction/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          litres: parseFloat(formData.litres),
          amount: parseFloat(formData.amount),
          bill_number: formData.bill_number,
          location: formData.location,
          remarks: formData.remarks
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'recorded') {
        setSuccess(`✓ Bill recorded successfully! Transaction ID: ${data.fuel_txn_id}`);
        setFormData({
          litres: '',
          amount: '',
          bill_number: '',
          location: '',
          remarks: ''
        });
        setBillImage(null);
        setBillImagePreview(null);

        if (onBillUploaded) {
          onBillUploaded(data);
        }

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to record bill');
      }
    } catch (err) {
      setError('Error uploading bill: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#f9fafb',
      borderRadius: 12,
      padding: 20,
      maxWidth: 600,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#111' }}>
        📋 Upload Fuel Bill
      </h3>

      <form onSubmit={handleSubmit}>
        {/* Image Upload */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 12,
            color: '#374151'
          }}>
            Bill Photo (optional)
          </label>

          {billImagePreview ? (
            <div style={{
              position: 'relative',
              marginBottom: 12,
              borderRadius: 8,
              overflow: 'hidden',
              maxWidth: 300
            }}>
              <img
                src={billImagePreview}
                alt="Bill preview"
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: 8,
                  border: '2px solid #10b981'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setBillImage(null);
                  setBillImagePreview(null);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundColor: '#f0f9ff',
                border: '2px dashed #0ea5e9',
                borderRadius: 8,
                padding: 24,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0f9ff'}
            >
              <Upload size={32} color="#0ea5e9" />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#0369a1', margin: '8px 0 4px' }}>
                Click to upload bill photo
              </p>
              <p style={{ fontSize: 11, color: '#0c4a6e', margin: 0 }}>
                PNG, JPG up to 5MB
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Form Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 16
        }}>
          {/* Litres */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              color: '#374151'
            }}>
              Litres *
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.litres}
              onChange={(e) => setFormData({ ...formData, litres: e.target.value })}
              placeholder="45.5"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Amount */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              color: '#374151'
            }}>
              Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="4500"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Bill Number */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 6,
            color: '#374151'
          }}>
            Bill Number *
          </label>
          <input
            type="text"
            value={formData.bill_number}
            onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
            placeholder="e.g., P2604050001"
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Location */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 6,
            color: '#374151'
          }}>
            Fuel Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g., Shell Pump, Highway 52"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Remarks */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 6,
            color: '#374151'
          }}>
            Remarks
          </label>
          <textarea
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="Any special notes..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              minHeight: 60,
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Calculated KMPL Info */}
        {formData.litres && formData.amount && (
          <div style={{
            backgroundColor: '#ede9fe',
            borderLeft: '4px solid #7c3aed',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 12
          }}>
            <div style={{ color: '#6366f1' }}>
              <strong>Rate:</strong> ₹{(formData.amount / formData.litres).toFixed(2)}/liter
            </div>
          </div>
        )}

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
            <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#7f1d1d' }}>{error}</span>
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
            <span style={{ fontSize: 12, color: '#166534' }}>{success}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: loading ? '#d1d5db' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <Upload size={16} />
          {loading ? 'Uploading...' : 'Submit Bill'}
        </button>
      </form>

      {/* Info */}
      <div style={{
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 6,
        padding: 12,
        marginTop: 16,
        fontSize: 11,
        color: '#0369a1'
      }}>
        ⓘ Fuel transactions are verified for duplicate bills and unusual patterns.
      </div>
    </div>
  );
};

export default FuelBillUpload;

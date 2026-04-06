import React, { useState } from 'react';
import { Lock, Truck, ArrowLeft } from 'lucide-react';

export default function ClientCodeLogin({ onLoginSuccess, onBack }) {
  const [stage, setStage] = useState('code'); // 'code', 'vehicle', or 'confirm'
  const [code, setCode] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeypadClick = (digit) => {
    if (stage === 'code') {
      if (digit === '⌫') {
        setCode(code.slice(0, -1));
      } else if (code.length < 4) {
        setCode(code + digit);
      }
    }
    setError('');
  };

  const handleCodeSubmit = async () => {
    if (code.length < 3) {
      setError('Code must be at least 3 digits');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/clients/get-by-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Invalid code');
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log('Client data:', data); // DEBUG
      setClientInfo(data);
      setVehicles(data.vehicles || []);
      setStage('vehicle');

    } catch (err) {
      setError('Connection failed: ' + err.message);
      console.error(err); // DEBUG
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSelect = (vehicle) => {
    console.log('Vehicle selected:', vehicle); // DEBUG
    setSelectedVehicle(vehicle);
    setStage('confirm');
  };

  const handleConfirmLogin = async () => {
    if (!selectedVehicle) {
      setError('Please select a vehicle');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call backend driver login to authenticate
      const res = await fetch('/api/drivers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_number: selectedVehicle.vehicle_number,
          pin: '999'  // Default test PIN
        })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      const data = await res.json();
      
      // Combine driver and vehicle info for DriverPage
      const sessionData = {
        vehicle_no: selectedVehicle.vehicle_number,
        vehicle_id: selectedVehicle.id,
        model: selectedVehicle.model,
        driver_name: data.driver.name,
        driver_id: data.driver.id,
        client_id: clientInfo.client_id,
        client_name: clientInfo.client_name
      };
      
      // Store in localStorage with key that DriverPage expects (persists across refresh)
      localStorage.setItem('driverPortal_session', JSON.stringify(sessionData));
      
      onLoginSuccess({
        client_id: clientInfo.client_id,
        client_name: clientInfo.client_name,
        vehicle: selectedVehicle,
        driver: data.driver
      });

    } catch (err) {
      setError('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStage('code');
    setVehicles([]);
    setSelectedVehicle(null);
    setClientInfo(null);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#1f2937',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        padding: '40px 32px',
        maxWidth: '420px',
        width: '100%',
        color: '#fff'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#fff'
          }}>
            <Truck size={40} />
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            margin: '0 0 8px 0'
          }}>DRIVER PORTAL</h1>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af',
            margin: 0
          }}>Atul Logistics</p>
        </div>

        {/* ===== STAGE 1: CODE ENTRY ===== */}
        {stage === 'code' && (
          <>
            <div style={{
              background: '#111827',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#9ca3af'
            }}>
              👉 Enter your <strong>CLIENT CODE</strong><br/>
              (Example: 001, 002, 003)
            </div>

            {/* Display */}
            <div style={{
              background: '#111827',
              border: '2px solid #667eea',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              textAlign: 'center',
              minHeight: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                letterSpacing: '4px',
                color: code ? '#667eea' : '#6b7280',
                fontFamily: 'monospace'
              }}>
                {code || '____'}
              </div>
            </div>

            {/* Keypad */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '24px'
            }}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadClick(digit)}
                  disabled={digit === ''}
                  style={{
                    padding: '18px',
                    background: digit === '' ? 'transparent' : '#374151',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: digit === '' ? 'default' : 'pointer'
                  }}
                  onMouseEnter={(e) => digit !== '' && (e.target.style.background = '#667eea')}
                  onMouseLeave={(e) => digit !== '' && (e.target.style.background = '#374151')}
                >
                  {digit}
                </button>
              ))}
            </div>

            {error && (
              <div style={{
                background: '#7f1d1d',
                color: '#fca5a5',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleCodeSubmit}
              disabled={code.length < 3 || loading}
              style={{
                width: '100%',
                padding: '14px',
                background: code.length >= 3 && !loading ? '#667eea' : '#6b7280',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: code.length >= 3 && !loading ? 'pointer' : 'not-allowed'
              }}
              onMouseEnter={(e) => code.length >= 3 && !loading && (e.target.style.background = '#5568d3')}
              onMouseLeave={(e) => code.length >= 3 && !loading && (e.target.style.background = '#667eea')}
            >
              {loading ? '🔄 Verifying...' : '✓ Continue'}
            </button>

            <div style={{
              marginTop: '20px',
              padding: '12px',
              background: '#111827',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#9ca3af',
              textAlign: 'center'
            }}>
              <strong>✅ Test Code:</strong> 001
            </div>
          </>
        )}

        {/* ===== STAGE 2: VEHICLE SELECTION ===== */}
        {stage === 'vehicle' && (
          <>
            <div style={{
              background: '#111827',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px'
            }}>
              <div style={{ color: '#9ca3af', marginBottom: '8px' }}>
                ✅ Client: <strong style={{ color: '#667eea' }}>{clientInfo?.client_name}</strong> (LOCKED)
              </div>
              <div style={{ color: '#9ca3af' }}>
                👇 Select your vehicle:
              </div>
            </div>

            {/* Vehicle List */}
            <div style={{ marginBottom: '24px' }}>
              {!vehicles || vehicles.length === 0 ? (
                <div style={{
                  background: '#111827',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#9ca3af'
                }}>
                  No vehicles available. Contact admin.
                </div>
              ) : (
                <>
                  <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '12px' }}>
                    Found {vehicles.length} vehicle(s):
                  </div>
                  {vehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      onClick={() => handleVehicleSelect(vehicle)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: '#374151',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#667eea'}
                      onMouseLeave={(e) => e.target.style.background = '#374151'}
                    >
                      🚚 {vehicle.vehicle_number} {vehicle.model && `(${vehicle.model})`}
                    </button>
                  ))}
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={handleBack}
                style={{
                  padding: '12px',
                  background: '#374151',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                disabled
                style={{
                  padding: '12px',
                  background: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'not-allowed',
                  fontSize: '13px'
                }}
              >
                Select vehicle
              </button>
            </div>
          </>
        )}

        {/* ===== STAGE 3: CONFIRM ===== */}
        {stage === 'confirm' && (
          <>
            <div style={{
              background: '#111827',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#9ca3af', marginBottom: '12px' }}>
                ✅ Ready to start with
              </div>
              <div style={{
                background: '#374151',
                padding: '16px',
                borderRadius: '6px',
                marginBottom: '12px'
              }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                  Client
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#667eea' }}>
                  {clientInfo?.client_name}
                </div>
              </div>
              <div style={{
                background: '#374151',
                padding: '16px',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                  Vehicle (LOCKED)
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#667eea' }}>
                  {selectedVehicle?.vehicle_number || '(empty)'}
                </div>
                {selectedVehicle?.model && (
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    {selectedVehicle.model}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div style={{
                background: '#7f1d1d',
                color: '#fca5a5',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                ❌ {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={handleBack}
                style={{
                  padding: '12px',
                  background: '#374151',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Change
              </button>
              <button
                onClick={handleConfirmLogin}
                disabled={loading}
                style={{
                  padding: '12px',
                  background: loading ? '#6b7280' : '#667eea',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => !loading && (e.target.style.background = '#5568d3')}
                onMouseLeave ={(e) => !loading && (e.target.style.background = '#667eea')}
              >
                {loading ? '🔄 Login...' : '✓ Login'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

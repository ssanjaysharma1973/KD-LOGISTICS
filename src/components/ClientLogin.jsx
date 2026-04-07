import React, { useState, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

export default function ClientLogin({ onLoginSuccess, onBack }) {
  const [clientCode, setClientCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  async function handleLogin() {
    if (!clientCode.trim()) {
      setError('Enter company ID');
      return;
    }
    if (!password) {
      setError('Enter password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = `${API_BASE}/api/clients/login`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_code: clientCode.trim().toUpperCase(),
          pin: password
        })
      });

      const data = await res.json();

      if (data.success && data.client) {
        // Store session in localStorage (persists across refresh)
        localStorage.setItem('clientPortal_session', JSON.stringify(data.client));
        onLoginSuccess(data);
      } else {
        setError(data.error || '❌ Invalid credentials');
        setPassword('');
        passwordRef.current?.focus();
      }
    } catch (err) {
      setError('Network error. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏢</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', margin: '0 0 8px 0' }}>
            Client Portal
          </h1>
          <p style={{ color: '#666', fontSize: '14px', margin: '0' }}>
            Enter your company credentials
          </p>
        </div>

        {/* Company ID Input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>
            Company ID
          </label>
          <input
            type="text"
            placeholder="e.g., CLIENT001"
            value={clientCode}
            onChange={(e) => {
              setClientCode(e.target.value.toUpperCase());
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s',
              borderColor: error ? '#ef4444' : '#ddd'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = error ? '#ef4444' : '#ddd'}
          />
        </div>

        {/* Password Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>
            PIN
          </label>
          <input
            ref={passwordRef}
            type="password"
            placeholder="Enter your PIN"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s',
              borderColor: error ? '#ef4444' : '#ddd'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = error ? '#ef4444' : '#ddd'}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '10px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading || !clientCode.trim() || !password}
          style={{
            width: '100%',
            padding: '12px',
            background: (loading || !clientCode.trim() || !password) ? '#ddd' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: (loading || !clientCode.trim() || !password) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginBottom: '12px'
          }}
          onMouseEnter={(e) => {
            if (!loading && clientCode.trim() && password) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          {loading ? '⏳ Checking...' : '🔓 Login'}
        </button>

        {/* Back Button */}
        <button
          onClick={onBack}
          style={{
            width: '100%',
            padding: '12px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            color: '#666',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#f5f5f5';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'white';
          }}
        >
          ← Back to Roles
        </button>

        {/* Test Credentials */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: '#f0f4ff',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#4c51bf',
          textAlign: 'center',
          borderLeft: '3px solid #667eea'
        }}>
          <strong>Test Credentials:</strong>
          <div>ID: CLIENT001 | PIN: 001</div>
        </div>
      </div>
    </div>
  );
}

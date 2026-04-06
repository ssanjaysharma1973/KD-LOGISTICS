import React, { useState, useEffect } from 'react';
import './styles/AdminPINLogin.css';

export default function AdminPINLogin({ onLoginSuccess, onBack }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [selectedClient, setSelectedClient] = useState('CLIENT_000'); // Default to CLIENT_000 (DevAdmin)
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPIN, setShowPIN] = useState(false);

  // Load clients on mount
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      // Filter clients - show all for admin to manage
      setClients(data.clients || []);
    } catch (e) {
      console.error('Error loading clients:', e);
    }
  };

  const handlePINInput = (digit) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleLogin = async () => {
    if (!username.trim() || !pin.trim()) {
      setError('Username and PIN required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin-pin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Success - store credentials and callback
      localStorage.setItem('adminPINLogin', JSON.stringify({
        admin_id: data.admin_id,
        username: data.username,
        name: data.name,
        role: data.role,
        client_id: data.client_id || selectedClient || 'all',
        selected_client: selectedClient || 'all',
        portal: 'admin_pin'
      }));

      onLoginSuccess({ ...data, selected_client: selectedClient || 'all' });
    } catch (err) {
      setError('Connection error. Try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    // Allow typing PIN digits directly
    if (e.key >= '0' && e.key <= '9' && pin.length < 6) {
      setPin(pin + e.key);
    } else if (e.key === 'Backspace') {
      setPin(pin.slice(0, -1));
    } else if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="admin-pin-login-container">
      <div className="admin-pin-login-card">
        {/* Header */}
        <div className="admin-pin-header">
          <div className="admin-pin-icon">👨‍💻</div>
          <h1>Admin / DevAdmin</h1>
          <p>PIN-based authentication</p>
        </div>

        {/* Username Input */}
        <div className="admin-pin-form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g., devadmin, sysadmin"
            className="admin-pin-input"
            onKeyPress={handleKeyPress}
            autoFocus
          />
        </div>

        {/* Client Selection */}
        <div className="admin-pin-form-group">
          <label>Select Client to Manage (Optional)</label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="admin-pin-input"
            style={{ cursor: 'pointer' }}
          >
            <option value="">-- All Clients --</option>
            {clients.map(client => (
              <option key={client.id} value={client.client_code}>
                {client.client_code} - {client.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Client Buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedClient('CLIENT_000');
              setUsername('devadmin');
            }}
            style={{
              padding: '8px 12px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            🔐 CLIENT_000 (DevAdmin)
          </button>
          <button
            type="button"
            onClick={() => setSelectedClient('CLIENT_001')}
            style={{
              padding: '8px 12px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            📌 CLIENT_001 (Atul)
          </button>
        </div>

        {/* PIN Display */}
        <div className="admin-pin-form-group">
          <label>
            PIN Code
            <button
              type="button"
              className="pin-toggle-btn"
              onClick={() => setShowPIN(!showPIN)}
            >
              {showPIN ? '🙈' : '👁️'}
            </button>
          </label>
          <div className="pin-display" onKeyDown={handleKeyPress} tabIndex="0" style={{ outline: 'none' }}>
            {pin.split('').map((digit, idx) => (
              <div key={idx} className="pin-dot">
                {showPIN ? digit : '•'}
              </div>
            ))}
            {pin.length < 6 && (
              <div className="pin-cursor">|</div>
            )}
          </div>
        </div>

        {/* PIN Keypad */}
        <div className="pin-keypad">
          <div className="keypad-row">
            <button onClick={() => handlePINInput('1')} className="keypad-btn">1</button>
            <button onClick={() => handlePINInput('2')} className="keypad-btn">2</button>
            <button onClick={() => handlePINInput('3')} className="keypad-btn">3</button>
          </div>
          <div className="keypad-row">
            <button onClick={() => handlePINInput('4')} className="keypad-btn">4</button>
            <button onClick={() => handlePINInput('5')} className="keypad-btn">5</button>
            <button onClick={() => handlePINInput('6')} className="keypad-btn">6</button>
          </div>
          <div className="keypad-row">
            <button onClick={() => handlePINInput('7')} className="keypad-btn">7</button>
            <button onClick={() => handlePINInput('8')} className="keypad-btn">8</button>
            <button onClick={() => handlePINInput('9')} className="keypad-btn">9</button>
          </div>
          <div className="keypad-row">
            <button onClick={() => handlePINInput('0')} className="keypad-btn">0</button>
            <button onClick={handleBackspace} className="keypad-btn keypad-action">⌫</button>
            <button onClick={handleClear} className="keypad-btn keypad-action">C</button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="admin-pin-error">
            ⚠️ {error}
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading || !username.trim() || !pin.trim()}
          className="admin-pin-login-btn"
        >
          {loading ? 'Verifying...' : 'Login'}
        </button>

        {/* Back Button */}
        <button onClick={onBack} className="admin-pin-back-btn">
          ← Back to Role Selection
        </button>
      </div>
    </div>
  );
}

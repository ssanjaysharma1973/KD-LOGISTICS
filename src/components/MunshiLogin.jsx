import React, { useState } from 'react';
import './styles/MunshiLogin.css';

export default function MunshiLogin({ onLoginSuccess, onBack }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPIN, setShowPIN] = useState(false);

  const handlePINInput = (digit) => {
    if (pin.length < 3) {
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
    if (!email.trim() || !pin.trim()) {
      setError('Email and PIN required');
      return;
    }

    if (!email.includes('@')) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/munshis/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.toLowerCase(), pin })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Success - store credentials and callback
      localStorage.setItem('munshiLogin', JSON.stringify({
        munshi_id: data.munshi_id,
        name: data.name,
        email: data.email,
        client_id: data.client_id,
        portal: 'munshi'
      }));

      onLoginSuccess(data);
    } catch (err) {
      setError('Connection error. Try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="munshi-login-container">
      <div className="munshi-login-card">
        {/* Header */}
        <div className="munshi-header">
          <div className="munshi-icon">👨‍💼</div>
          <h1>Munshi Portal</h1>
          <p>Email & PIN authentication</p>
        </div>

        {/* Email Input */}
        <div className="munshi-form-group">
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g., atul@example.com"
            className="munshi-input"
            onKeyPress={handleKeyPress}
            autoFocus
          />
        </div>

        {/* PIN Display */}
        <div className="munshi-form-group">
          <label>
            PIN Code (3 digits)
            <button
              type="button"
              className="pin-toggle-btn"
              onClick={() => setShowPIN(!showPIN)}
            >
              {showPIN ? '🙈' : '👁️'}
            </button>
          </label>
          <div className="pin-display">
            {pin.split('').map((digit, idx) => (
              <div key={idx} className="pin-dot">
                {showPIN ? digit : '•'}
              </div>
            ))}
            {pin.length < 3 && (
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
          <div className="munshi-error">
            ⚠️ {error}
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading || !email.trim() || pin.length !== 3}
          className="munshi-login-btn"
        >
          {loading ? 'Verifying...' : 'Login'}
        </button>

        {/* Back Button */}
        <button onClick={onBack} className="munshi-back-btn">
          ← Back to Role Selection
        </button>
      </div>

      {/* Test Credentials Info */}
      <div className="munshi-test-info">
        <p>
          <strong>🔐 Test Credentials (PIN: 999):</strong><br />
          📧 atul@example.com<br />
          📧 raj@example.com<br />
          📧 priya@example.com
        </p>
      </div>
    </div>
  );
}

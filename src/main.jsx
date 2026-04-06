import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.jsx';
import RoleSelectLogin from './components/RoleSelectLogin.jsx';
import ClientCodeLogin from './components/ClientCodeLogin.jsx';
import ClientLogin from './components/ClientLogin.jsx';
import MunshiLogin from './components/MunshiLogin.jsx';
import AdminPINLogin from './components/AdminPINLogin.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { TenantContext } from './TenantContext.jsx';
import { VehicleDataProvider } from './context/VehicleDataContext.jsx';
import { useState, useEffect } from 'react';

// Suppress React warnings about SVG viewBox with invalid CSS values
// This handles the error: <svg> attribute viewBox: Expected number, "0 0 100% 129px"
const originalError = console.error;
console.error = function(...args) {
  if (
    args[0]?.includes?.('viewBox') || 
    (typeof args[0] === 'string' && args[0].includes('attribute viewBox'))
  ) {
    // Suppress SVG viewBox errors - these are typically from mismatched renders
    return;
  }
  originalError.apply(console, args);
};

// Multi-role login system wrapper
function MultiRoleAppWrapper() {
  const [currentScreen, setCurrentScreen] = useState(() => {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const portalParam = urlParams.get('portal');
    
    if (portalParam === 'driver') return 'driver-login';
    if (portalParam === 'munshi') return 'munshi-login';
    if (portalParam === 'client') return 'client-login';
    if (portalParam === 'admin') return 'admin-login';
    
    // Check localStorage for persistent sessions (survives refresh)
    if (localStorage.getItem('driverPortal_session')) return 'app';
    if (localStorage.getItem('munshiPortal_session')) return 'app';
    if (localStorage.getItem('clientPortal_session')) return 'app';
    if (localStorage.getItem('adminPINLogin')) return 'app';
    
    // Otherwise show role selection
    return 'role-select';
  });
  const [selectedRole, setSelectedRole] = useState(null);

  // Check if user is already logged in from a previous session
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const portalParam = urlParams.get('portal');
    
    if (portalParam === 'driver') {
      const driverSession = localStorage.getItem('driverPortal_session');
      if (driverSession) {
        // Already logged in - go straight to App
        setCurrentScreen('app');
        setSelectedRole('driver');
      } else {
        // No session - show login
        setCurrentScreen('driver-login');
        setSelectedRole('driver');
      }
    } else if (portalParam === 'munshi') {
      const munshiSession = localStorage.getItem('munshiPortal_session');
      if (munshiSession) {
        setCurrentScreen('app');
        setSelectedRole('munshi');
      } else {
        setCurrentScreen('munshi-login');
        setSelectedRole('munshi');
      }
    } else if (portalParam === 'admin') {
      const adminSession = localStorage.getItem('adminPINLogin');
      if (adminSession) {
        setCurrentScreen('app');
        setSelectedRole('admin');
      } else {
        setCurrentScreen('admin-login');
        setSelectedRole('admin');
      }
    }
  }, []);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role === 'driver') {
      setCurrentScreen('driver-login');
    } else if (role === 'munshi') {
      setCurrentScreen('munshi-login');
    } else if (role === 'client') {
      setCurrentScreen('client-login');
    } else if (role === 'admin') {
      setCurrentScreen('admin-login');
    }
  };

  const handleClientLoginSuccess = (data) => {
    setCurrentScreen('app');
  };

  const handleDriverLoginSuccess = (data) => {
    setCurrentScreen('app');
  };

  const handleMunshiLoginSuccess = (data) => {
    setCurrentScreen('app');
  };

  const handleAdminLoginSuccess = (data) => {
    setCurrentScreen('app');
  };

  const handleBackToRole = () => {
    // Clear all sessions when going back to role select
    localStorage.removeItem('driverPortal_session');
    localStorage.removeItem('munshiPortal_session');
    localStorage.removeItem('clientPortal_session');
    localStorage.removeItem('adminPINLogin');
    setCurrentScreen('role-select');
    setSelectedRole(null);
  };

  // Role Selection Screen
  if (currentScreen === 'role-select') {
    return <RoleSelectLogin onSelectRole={handleRoleSelect} />;
  }

  // App with Portal (after successful login)
  if (currentScreen === 'app') {
    return <App />;
  }

  // Driver Portal - Client Code Login
  if (currentScreen === 'driver-login') {
    return <ClientCodeLogin onLoginSuccess={handleDriverLoginSuccess} onBack={handleBackToRole} />;
  }

  // Munshi Portal - Email + PIN Login
  if (currentScreen === 'munshi-login') {
    return <MunshiLogin onLoginSuccess={handleMunshiLoginSuccess} onBack={handleBackToRole} />;
  }

  // Client Portal - Company ID + PIN Login
  if (currentScreen === 'client-login') {
    return <ClientLogin onLoginSuccess={handleClientLoginSuccess} onBack={handleBackToRole} />;
  }

  // Admin Portal - Username + PIN Login
  if (currentScreen === 'admin-login') {
    return <AdminPINLogin onLoginSuccess={handleAdminLoginSuccess} onBack={handleBackToRole} />;
  }

  // Default fallback
  return <App />;
}

// Determine clientId from localStorage (set during login)
const storedClientId = localStorage.getItem('clientId') || 'CLIENT_001';        

createRoot(document.getElementById('root')).render(
  <TenantContext.Provider value={{ tenantKey: storedClientId }}>
    <VehicleDataProvider>
      <MultiRoleAppWrapper />
    </VehicleDataProvider>
  </TenantContext.Provider>,
)

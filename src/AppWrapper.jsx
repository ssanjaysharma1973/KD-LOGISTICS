import React, { useState, useEffect } from 'react';
import RoleSelectLogin from './components/RoleSelectLogin';
import ClientCodeLogin from './components/ClientCodeLogin';
import MunshiLogin from './components/MunshiLogin';
import AdminPINLogin from './components/AdminPINLogin';
import App from './App';

export default function AppWrapper() {
  const [currentScreen, setCurrentScreen] = useState(() => {
    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('portal') === 'driver') return 'driver-login';
    if (urlParams.get('portal') === 'munshi') return 'munshi-login';
    if (urlParams.get('portal') === 'admin') return 'admin-login';
    
    // Check localStorage for persistent login sessions (survives refresh)
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
    if (urlParams.get('portal') === 'driver') {
      setCurrentScreen('driver-login');
      setSelectedRole('driver');
    } else if (urlParams.get('portal') === 'munshi') {
      setCurrentScreen('munshi-login');
      setSelectedRole('munshi');
    } else if (urlParams.get('portal') === 'admin') {
      setCurrentScreen('admin-login');
      setSelectedRole('admin');
    } else if (currentScreen === 'role-select') {
      // If no URL param and we're at role-select, clear any existing session
      // This allows user to switch roles
      setSelectedRole(null);
    }
  }, []);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role === 'driver') {
      setCurrentScreen('driver-login');
    } else if (role === 'munshi') {
      setCurrentScreen('munshi-login');
    } else if (role === 'admin') {
      setCurrentScreen('admin-login');
    }
  };

  const handleDriverLoginSuccess = (data) => {
    // Navigate to driver portal
    window.location.href = '/?portal=driver';
  };

  const handleMunshiLoginSuccess = (data) => {
    // Navigate to munshi portal
    window.location.href = '/?portal=munshi';
  };

  const handleAdminLoginSuccess = (data) => {
    // Navigate to admin portal
    window.location.href = '/?portal=admin';
  };

  const handleBackToRole = () => {
    setCurrentScreen('role-select');
    setSelectedRole(null);
  };

  // Role Selection Screen
  if (currentScreen === 'role-select') {
    return <RoleSelectLogin onSelectRole={handleRoleSelect} />;
  }

  // Driver Portal - Client Code Login
  if (currentScreen === 'driver-login') {
    return <ClientCodeLogin onLoginSuccess={handleDriverLoginSuccess} onBack={handleBackToRole} />;
  }

  // Munshi Portal - Email + PIN Login
  if (currentScreen === 'munshi-login') {
    return <MunshiLogin onLoginSuccess={handleMunshiLoginSuccess} onBack={handleBackToRole} />;
  }

  // Admin Portal - Username + PIN Login
  if (currentScreen === 'admin-login') {
    return <AdminPINLogin onLoginSuccess={handleAdminLoginSuccess} onBack={handleBackToRole} />;
  }

  // Main App (dashboard/portals) - for persistent sessions
  if (currentScreen === 'app') {
    return <App />;
  }

  // Default: Main App (dashboard/portals)
  return <App />;
}

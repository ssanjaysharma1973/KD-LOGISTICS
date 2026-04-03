import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, getUser, getClientId } from './services/tokenManager.js';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [tenantId, setTenantId] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize from localStorage (set during login)
    const storedToken = getToken();
    const storedUser = getUser();
    const storedClientId = getClientId();

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      setTenantId(storedUser.clientId || storedClientId);
    }
    setLoading(false);
  }, []);

  const value = {
    tenantId,
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
};

export { TenantContext, useTenant };
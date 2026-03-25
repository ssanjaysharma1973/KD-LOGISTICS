import React from 'react';

export const TenantContext = React.createContext();

export function useTenant() {
  const context = React.useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

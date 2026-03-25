import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { TenantContext } from './TenantContext.js';
import { VehicleDataProvider } from './context/VehicleDataContext.jsx';

// AppWrapper component to handle login state
function AppWrapper() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  
  if (!isLoggedIn) {
    return <LoginPage />;
  }
  
  return <App />;
}

// Determine clientId from localStorage (set during login)
const storedClientId = localStorage.getItem('clientId') || 'CLIENT_001';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TenantContext.Provider value={{ tenantKey: storedClientId }}>
      <VehicleDataProvider>
        <AppWrapper />
      </VehicleDataProvider>
    </TenantContext.Provider>
  </StrictMode>,
)

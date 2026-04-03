import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { TenantContext } from './TenantContext.jsx';
import { VehicleDataProvider } from './context/VehicleDataContext.jsx';

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
  <TenantContext.Provider value={{ tenantKey: storedClientId }}>
    <VehicleDataProvider>
      <AppWrapper />
    </VehicleDataProvider>
  </TenantContext.Provider>,
)

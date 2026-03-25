// Load tenants configuration from .env (REACT_APP_TENANTS_JSON)
// Also include email-to-client mapping based on .env CLIENT*_EMAIL values

const DEFAULT_TENANTS = [
  {
    id: 'CLIENT_001',
    clientId: 'CLIENT_001',
    name: 'Atul Logistics',
    email: 'sanjaysec28@gmail.com', // From CLIENT1_EMAIL in .env
    allowedDomains: ['atul-logistics.com', 'atul.com', 'gmail.com'], // Allow gmail for testing
  },
  {
    id: 'CLIENT_002',
    clientId: 'CLIENT_002',
    name: 'Beta Logistics',
    email: 'contact@betalogistics.com',
    allowedDomains: ['betalogistics.com'],
  },
];

export function loadTenants() {
  try {
    // Try to parse REACT_APP_TENANTS_JSON from Vite environment
    const tenantsJson = import.meta.env.VITE_TENANTS_JSON;
    if (tenantsJson) {
      const parsed = JSON.parse(tenantsJson);
      return parsed;
    }
  } catch (e) {
    console.warn('Could not parse VITE_TENANTS_JSON:', e);
  }

  // Fallback to default configuration
  return DEFAULT_TENANTS;
}

export function findClientByEmail(email) {
  const tenants = loadTenants();
  const domain = email.split('@')[1]?.toLowerCase();

  // First, try exact email match
  const exactMatch = tenants.find(t => t.email?.toLowerCase() === email.toLowerCase());
  if (exactMatch) {
    return exactMatch.clientId;
  }

  // Then, try domain match
  const domainMatch = tenants.find(t => 
    t.allowedDomains?.some(d => d.toLowerCase() === domain)
  );
  if (domainMatch) {
    return domainMatch.clientId;
  }

  // Default to first tenant
  return tenants[0]?.clientId || 'CLIENT_001';
}

export function getTenants() {
  return loadTenants();
}

export function getTenantById(clientId) {
  const tenants = loadTenants();
  return tenants.find(t => t.clientId === clientId);
}

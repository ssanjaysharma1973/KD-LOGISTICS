/**
 * JWT utilities for multi-tenant authentication
 * Handles token generation and verification
 */

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '24h';

/**
 * Generate JWT token with client context
 * Returns: { token: 'eyJ...', expiresIn: '24h', clientId: 'CLIENT_001' }
 */
export function generateToken(payload) {
  // Simple JWT: header.payload.signature
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT'
  })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const expirySeconds = parseTokenExpiry(TOKEN_EXPIRY);
  
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + expirySeconds,
    iss: 'kd-logistics',
  })).toString('base64url');

  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`${header}.${body}`);
  const signature = hmac.digest('base64url');

  return {
    token: `${header}.${body}.${signature}`,
    expiresIn: TOKEN_EXPIRY,
    clientId: payload.clientId,
    userId: payload.userId,
    email: payload.email,
  };
}

/**
 * Verify JWT token - returns decoded payload or null if invalid
 */
export function verifyToken(token) {
  if (!token) return null;
  
  try {
    const [headerB64, bodyB64, signatureB64] = token.split('.');
    if (!headerB64 || !bodyB64 || !signatureB64) return null;

    // Verify signature
    const hmac = crypto.createHmac('sha256', JWT_SECRET);
    hmac.update(`${headerB64}.${bodyB64}`);
    const expectedSignature = hmac.digest('base64url');
    
    if (signatureB64 !== expectedSignature) {
      console.warn('[JWT] Signature mismatch');
      return null;
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString());

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn('[JWT] Token expired');
      return null;
    }

    return payload;
  } catch (e) {
    console.error('[JWT] Verification failed:', e.message);
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Expects: "Bearer eyJ..."
 */
export function extractToken(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Parse expiry string (e.g., "24h", "7d", "30m") to seconds
 */
function parseTokenExpiry(expiry) {
  const match = String(expiry).match(/^(\d+)([hdm])$/);
  if (!match) return 86400; // default 24 hours

  const [, num, unit] = match;
  const n = parseInt(num);
  
  switch (unit) {
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    case 'm': return n * 60;
    default: return 86400;
  }
}

/**
 * Tenant Configuration
 */
export const TENANTS = {
  CLIENT_001: {
    id: 'CLIENT_001',
    name: 'Atul Logistics',
    email: process.env.CLIENT_001_EMAIL || 'koyna@atullogistics.com',
    password: process.env.CLIENT_001_PASSWORD || 'password123', // use bcrypt in production
    admins: (process.env.CLIENT_001_ADMINS || 'koyna@atullogistics.com').split(','),
  },
  CLIENT_002: {
    id: 'CLIENT_002',
    name: 'Beta Logistics',
    email: process.env.CLIENT_002_EMAIL || 'admin@betalogistics.com',
    password: process.env.CLIENT_002_PASSWORD || 'password123',
    admins: (process.env.CLIENT_002_ADMINS || 'admin@betalogistics.com').split(','),
  },
};

/**
 * Validate login credentials
 */
export function validateCredentials(email, password) {
  for (const [clientId, config] of Object.entries(TENANTS)) {
    if (config.email === email && config.password === password) {
      return {
        clientId,
        userId: email.split('@')[0],
        email,
        name: config.name,
        isAdmin: config.admins.includes(email),
      };
    }
  }
  return null;
}

/**
 * Master API Key Authentication Middleware
 * 
 * PURPOSE: Secure server-to-server communication for automated tasks
 * Uses a master API key for:
 * - Scheduled e-way bill exports
 * - Automated data synchronization
 * - Administrative operations
 * 
 * SECURITY: Master key should be:
 * - Stored in environment variables only
 * - Rotated periodically
 * - Logged for audit trail
 * - Restricted to specific endpoints
 */

import crypto from 'crypto';

// Load master API key from environment
const MASTER_API_KEY = process.env.MASTER_API_KEY || null;

// Validate master key exists on startup
if (!MASTER_API_KEY) {
  console.warn('[MasterKeyAuth] WARNING: MASTER_API_KEY not set. Automation features disabled.');
}

/**
 * Generate a secure master API key (for initialization)
 */
export function generateMasterApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate master API key from request header
 * Header format: Authorization: MasterKey <key>
 */
export function validateMasterApiKey(authHeader, ipAddress = null) {
  if (!authHeader || !MASTER_API_KEY) {
    return {
      valid: false,
      error: 'Missing authorization header or master key not configured',
    };
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'MasterKey') {
    return {
      valid: false,
      error: 'Invalid authorization scheme. Use: Authorization: MasterKey <key>',
    };
  }

  if (!token) {
    return {
      valid: false,
      error: 'Missing API key',
    };
  }

  // Use timing-safe comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(MASTER_API_KEY)
  );

  if (!isValid) {
    // Log failed attempt
    console.error(`[MasterKeyAuth] ⚠️ FAILED authentication attempt from ${ipAddress || 'UNKNOWN'}`);
    return {
      valid: false,
      error: 'Invalid API key',
    };
  }

  console.log(`[MasterKeyAuth] ✓ Authenticated automation request from ${ipAddress || 'INTERNAL'}`);
  return {
    valid: true,
  };
}

/**
 * Middleware to verify master API key on specific endpoints
 * Usage: In request handler, call this at the start
 */
export function requireMasterApiKey(req, res) {
  const authHeader = req.headers.authorization || '';
  const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  const validation = validateMasterApiKey(authHeader, ipAddress);
  
  if (!validation.valid) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: validation.error,
      detail: 'Authentication with master API key required',
    }));
    return false;
  }
  
  return true;
}

/**
 * Middleware for optional master key (logs if present)
 */
export function optionalMasterApiKey(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('MasterKey ')) {
    const token = authHeader.split(' ')[1];
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(MASTER_API_KEY || '')
    ) ? true : false;
  }
  return false;
}

/**
 * Extract client ID from request (for filtering exports)
 */
export function extractClientIdFromQuery(parsed) {
  return parsed.query.client_id || 
         parsed.query.clientId || 
         parsed.query.tenant_id ||
         parsed.query.tenantId ||
         null;
}

export default {
  generateMasterApiKey,
  validateMasterApiKey,
  requireMasterApiKey,
  optionalMasterApiKey,
  extractClientIdFromQuery,
  MASTER_API_KEY,
};

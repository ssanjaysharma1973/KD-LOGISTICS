/**
 * Audit Logger Middleware - 5th Level Multiclient Isolation
 * 
 * PURPOSE: Track all data access attempts across tenants to ensure:
 * - No cross-tenant data leakage
 * - Complete audit trail for compliance
 * - Early detection of unauthorized access patterns
 * 
 * TRACKED EVENTS:
 * - Authentication attempts (success/failure)
 * - data read operations per tenant
 * - Data write operations per tenant
 * - Cross-tenant access attempts (SECURITY EVENT)
 * - Failed authorization attempts
 * - Large data exports/downloads
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_LOG_DIR = path.join(__dirname, '../../logs');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'audit.log');

// Ensure logs directory exists
if (!fs.existsSync(AUDIT_LOG_DIR)) {
  fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
}

/**
 * Log Level Constants
 */
export const AuditLevel = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY',  // Critical security events
  CRITICAL: 'CRITICAL',  // System critical events
};

/**
 * Event Type Constants
 */
export const AuditEvent = {
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  DATA_READ: 'DATA_READ',
  DATA_WRITE: 'DATA_WRITE',
  DATA_UPDATE: 'DATA_UPDATE',
  DATA_DELETE: 'DATA_DELETE',
  CROSS_TENANT_ATTEMPT: 'CROSS_TENANT_ATTEMPT',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  BULK_EXPORT: 'BULK_EXPORT',
  QUERY_SLOW: 'QUERY_SLOW',
  API_ERROR: 'API_ERROR',
};

/**
 * Audit Log Entry Interface
 */
// {
//   timestamp: ISO string,
//   level: AuditLevel,
//   event: AuditEvent,
//   clientId: string,
//   userId: string | null,
//   email: string | null,
//   action: string,
//   resource: string,
//   method: string,
//   endpoint: string,
//   status: number,
//   rowsAffected: number | null,
//   details: object,
//   ipAddress: string | null,
//   userAgent: string | null,
// }

/**
 * In-memory audit metrics (for quick analysis)
 */
const auditMetrics = {
  totalLogins: 0,
  failedLogins: 0,
  crossTenantAttempts: 0,
  unauthorizedAccessAttempts: 0,
  dataOperationsByTenant: {},
  lastSecurityEvent: null,
};

/**
 * Write audit entry to file
 */
export function writeAuditLog(entry) {
  try {
    const logLine = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
    fs.appendFileSync(AUDIT_LOG_FILE, logLine + '\n');
  } catch (err) {
    console.error('[AuditLog] Failed to write log:', err.message);
  }
}

/**
 * Log authentication event
 */
export function logAuth(success, email, clientId, details = {}) {
  const level = success ? AuditLevel.INFO : AuditLevel.WARN;
  const event = success ? AuditEvent.AUTH_LOGIN : AuditEvent.AUTH_LOGIN_FAILED;
  
  if (success) auditMetrics.totalLogins++;
  else auditMetrics.failedLogins++;
  
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level,
    event,
    clientId: clientId || 'UNKNOWN',
    email,
    action: success ? 'LOGIN_SUCC' : 'LOGIN_FAIL',
    resource: 'AUTH',
    method: 'POST',
    endpoint: '/api/auth/login',
    status: success ? 200 : 401,
    details,
  });
}

/**
 * Log data access (read) operation
 */
export function logDataRead(clientId, userId, email, endpoint, method, table, rowCount = 0, details = {}) {
  updateTenantMetrics(clientId, 'read', 1, rowCount);
  
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: AuditLevel.INFO,
    event: AuditEvent.DATA_READ,
    clientId,
    userId: userId || null,
    email: email || null,
    action: 'READ',
    resource: table,
    method,
    endpoint,
    rowsAffected: rowCount,
    details,
  });
}

/**
 * Log data write operation (INSERT, UPDATE, DELETE)
 */
export function logDataWrite(clientId, userId, email, endpoint, method, table, rowsAffected = 0, operation = 'WRITE', details = {}) {
  updateTenantMetrics(clientId, operation.toLowerCase(), 1, rowsAffected);
  
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: AuditLevel.INFO,
    event: AuditEvent.DATA_WRITE,
    clientId,
    userId: userId || null,
    email: email || null,
    action: operation,
    resource: table,
    method,
    endpoint,
    rowsAffected,
    details,
  });
}

/**
 * Log CRITICAL SECURITY EVENT: Cross-tenant access attempt
 */
export function logCrossTenantAttempt(attemptedClientId, actualClientId, userId, email, endpoint, details = {}) {
  auditMetrics.crossTenantAttempts++;
  auditMetrics.lastSecurityEvent = new Date().toISOString();
  
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: AuditLevel.SECURITY,
    event: AuditEvent.CROSS_TENANT_ATTEMPT,
    clientId: actualClientId,
    userId: userId || null,
    email: email || null,
    action: 'BLOCKED_CROSS_TENANT',
    resource: `CROSS_TENANT_${attemptedClientId}`,
    endpoint,
    details: {
      ...details,
      attemptedClientId,
      actualClientId,
      severity: 'HIGH',
    },
  });
  
  // Alert: Log to console with prominent marker
  console.error(`
╔════════════════════════════════════════════════════════════════════╗
║                    ⚠️  SECURITY ALERT: CROSS-TENANT ACCESS         ║
╠════════════════════════════════════════════════════════════════════╣
║ User attempted to access data outside their tenant:                ║
║   User Tenant:    ${actualClientId.padEnd(45)}║
║   Attempted:      ${attemptedClientId.padEnd(45)}║
║   User Email:     ${(email || 'UNKNOWN').padEnd(45)}║
║   User ID:        ${(userId || 'UNKNOWN').padEnd(45)}║
║   Endpoint:       ${endpoint.padEnd(45)}║
║   Timestamp:      ${new Date().toISOString().padEnd(45)}║
╚════════════════════════════════════════════════════════════════════╝
  `);
}

/**
 * Log unauthorized access attempt
 */
export function logUnauthorizedAccess(clientId, endpoint, method, reason, details = {}) {
  auditMetrics.unauthorizedAccessAttempts++;
  
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: AuditLevel.SECURITY,
    event: AuditEvent.UNAUTHORIZED_ACCESS,
    clientId: clientId || 'UNKNOWN',
    action: 'BLOCKED_UNAUTHORIZED',
    resource: 'API',
    method,
    endpoint,
    status: 403,
    details: {
      ...details,
      reason,
      severity: 'MEDIUM',
    },
  });
}

/**
 * Log bulk data export
 */
export function logBulkExport(clientId, userId, email, endpoint, rowCount, tableNames, details = {}) {
  const isSuspicious = rowCount > 10000; // Arbitrary threshold
  
  writeAuditLog({
    timestamp: new Date().toISOString(),
    level: isSuspicious ? AuditLevel.WARN : AuditLevel.INFO,
    event: AuditEvent.BULK_EXPORT,
    clientId,
    userId: userId || null,
    email: email || null,
    action: 'BULK_EXPORT',
    resource: tableNames.join(','),
    endpoint,
    rowsAffected: rowCount,
    details: {
      ...details,
      isSuspicious,
      tables: tableNames,
    },
  });
}

/**
 * Update internal tenant metrics
 */
function updateTenantMetrics(clientId, operation, count = 1, rowsAffected = 0) {
  if (!auditMetrics.dataOperationsByTenant[clientId]) {
    auditMetrics.dataOperationsByTenant[clientId] = {
      read: 0, create: 0, update: 0, delete: 0, totalRows: 0
    };
  }
  
  const metric = auditMetrics.dataOperationsByTenant[clientId];
  metric[operation] = (metric[operation] || 0) + count;
  metric.totalRows += rowsAffected;
}

/**
 * Get audit metrics summary
 */
export function getAuditMetrics() {
  return {
    ...auditMetrics,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Export audit logs as JSON (for analysis/compliance)
 */
export function exportAuditLogs(filterClientId = null, since = null, until = null) {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
      return [];
    }
    
    const lines = fs.readFileSync(AUDIT_LOG_FILE, 'utf8').split('\n');
    return lines
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(entry => entry !== null)
      .filter(entry => !filterClientId || entry.clientId === filterClientId)
      .filter(entry => !since || new Date(entry.timestamp) >= new Date(since))
      .filter(entry => !until || new Date(entry.timestamp) <= new Date(until));
  } catch (err) {
    console.error('[AuditLog] Export error:', err.message);
    return [];
  }
}

/**
 * Clear audit logs (admin only - for development/testing)
 */
export function clearAuditLogs() {
  try {
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      fs.unlinkSync(AUDIT_LOG_FILE);
    }
    // Reset metrics
    auditMetrics.totalLogins = 0;
    auditMetrics.failedLogins = 0;
    auditMetrics.crossTenantAttempts = 0;
    auditMetrics.unauthorizedAccessAttempts = 0;
    auditMetrics.dataOperationsByTenant = {};
    auditMetrics.lastSecurityEvent = null;
  } catch (err) {
    console.error('[AuditLog] Clear error:', err.message);
  }
}

// Export default object with all functions
export default {
  AuditLevel,
  AuditEvent,
  writeAuditLog,
  logAuth,
  logDataRead,
  logDataWrite,
  logCrossTenantAttempt,
  logUnauthorizedAccess,
  logBulkExport,
  getAuditMetrics,
  exportAuditLogs,
  clearAuditLogs,
};

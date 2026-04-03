/**
 * Admin Audit Endpoint Handler
 * Provides audit log and metrics access for administrators
 * 
 * Endpoints:
 * - GET /api/admin/audit-metrics - Get audit metrics summary
 * - GET /api/admin/audit-logs - Get detailed audit logs (filtered)
 * - POST /api/admin/audit-logs/export - Export logs as JSON/CSV
 */

import auditLogger from '../middleware/auditLogger.js';

const { getAuditMetrics, exportAuditLogs, AuditLevel } = auditLogger;

/**
 * Check if user is admin
 */
function isAdmin(jwtPayload) {
  return jwtPayload && jwtPayload.isAdmin === true;
}

/**
 * Handle audit metrics request
 */
export async function handleAuditMetrics(req, res, jwtPayload) {
  if (!isAdmin(jwtPayload)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Admin access required' }));
  }

  try {
    const metrics = getAuditMetrics();
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(metrics));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Handle audit logs queries
 */
export async function handleAuditLogs(req, res, jwtPayload, parsed) {
  if (!isAdmin(jwtPayload)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Admin access required' }));
  }

  try {
    // Query parameters for filtering
    const clientId = parsed.query.client_id || parsed.query.clientId;
    const level = parsed.query.level;
    const event = parsed.query.event;
    const since = parsed.query.since;
    const until = parsed.query.until;
    const limit = parseInt(parsed.query.limit || '1000', 10);

    // Export audit logs
    const logs = exportAuditLogs(clientId, since, until);

    // Apply additional filters
    let filtered = logs;
    if (level) {
      filtered = filtered.filter(l => l.level === level);
    }
    if (event) {
      filtered = filtered.filter(l => l.event === event);
    }

    // Apply limit
    filtered = filtered.slice(-limit);

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      total: logs.length,
      filtered: filtered.length,
      data: filtered,
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Handle audit logs export as CSV or JSON
 */
export async function handleAuditExport(req, res, jwtPayload, parsed) {
  if (!isAdmin(jwtPayload)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Admin access required' }));
  }

  try {
    const format = parsed.query.format || 'json'; // 'json' or 'csv'
    const clientId = parsed.query.client_id || parsed.query.clientId;
    const since = parsed.query.since;
    const until = parsed.query.until;

    const logs = exportAuditLogs(clientId, since, until);

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'timestamp',
        'level',
        'event',
        'clientId',
        'userId',
        'email',
        'action',
        'resource',
        'method',
        'endpoint',
        'status',
        'rowsAffected',
      ];

      const rows = logs.map(log => [
        log.timestamp,
        log.level,
        log.event,
        log.clientId || '',
        log.userId || '',
        log.email || '',
        log.action || '',
        log.resource || '',
        log.method || '',
        log.endpoint || '',
        log.status || '',
        log.rowsAffected || '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`);
      return res.end(csv);
    } else {
      // JSON format (default)
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString()}.json"`);
      return res.end(JSON.stringify({
        exportedAt: new Date().toISOString(),
        total: logs.length,
        data: logs,
      }, null, 2));
    }
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Get audit log summary by event type
 */
export async function handleAuditSummary(req, res, jwtPayload) {
  if (!isAdmin(jwtPayload)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Admin access required' }));
  }

  try {
    const logs = exportAuditLogs();

    // Group by event type
    const summary = {};
    for (const log of logs) {
      const key = log.event || 'UNKNOWN';
      if (!summary[key]) {
        summary[key] = { count: 0, level: log.level, lastOccurrence: log.timestamp };
      }
      summary[key].count++;
      summary[key].lastOccurrence = log.timestamp;
    }

    // Group by level
    const levelSummary = {};
    for (const log of logs) {
      const level = log.level || 'INFO';
      if (!levelSummary[level]) levelSummary[level] = 0;
      levelSummary[level]++;
    }

    // Group by client
    const clientSummary = {};
    for (const log of logs) {
      const client = log.clientId || 'UNKNOWN';
      if (!clientSummary[client]) clientSummary[client] = 0;
      clientSummary[client]++;
    }

    // Find security events
    const securityEvents = logs.filter(l => l.level === AuditLevel.SECURITY);

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      totalLogs: logs.length,
      byEvent: summary,
      byLevel: levelSummary,
      byClient: clientSummary,
      securityEventsCount: securityEvents.length,
      securityEvents: securityEvents.slice(-20), // Last 20 security events
    }, null, 2));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export default {
  isAdmin,
  handleAuditMetrics,
  handleAuditLogs,
  handleAuditExport,
  handleAuditSummary,
};

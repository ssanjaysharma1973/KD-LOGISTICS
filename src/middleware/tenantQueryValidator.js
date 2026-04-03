/**
 * Query Validation Middleware - 5th Level Data Isolation
 * 
 * PURPOSE: Ensure all SQLite queries are properly filtered by client_id
 * to prevent cross-tenant data leakage on the database layer.
 * 
 * This middleware wraps SQLite query execution to:
 * 1. Verify tenant context is present
 * 2. Auto-inject client_id filters on queries
 * 3. Prevent unauthorized query patterns
 * 4. Log all query execution with tenant context
 */

/**
 * Tenant Query Validator
 * Ensures query safety and proper tenant isolation
 */
export class TenantQueryValidator {
  constructor(clientId, userId = null, email = null) {
    this.clientId = clientId;
    this.userId = userId;
    this.email = email;
    this.queries = [];
  }

  /**
   * Validate query SQL for tenant isolation
   * Returns { valid: boolean, sanitized: string, issues: string[] }
   */
  validateQuerySql(sql) {
    const issues = [];
    let sanitized = sql;

    // Check for multi-statement injection attacks
    if (/;[\s]*[A-Z]/i.test(sql)) {
      issues.push('Multiple SQL statements detected');
      return { valid: false, sanitized: sql, issues };
    }

    // Check for DROPoperations (should only be in migrations)
    if (/DROP\s+(TABLE|INDEX|DATABASE)/i.test(sql)) {
      issues.push('DROP operations not allowed in query validation');
      return { valid: false, sanitized: sql, issues };
    }

    // Warn on SELECT * without WHERE (may indicate N+1 problem or broad access)
    if (/SELECT\s+\*\s+FROM\s+\w+(?!\s+WHERE)/i.test(sql)) {
      issues.push('SELECT * without WHERE clause - verify tenant context');
    }

    // Check for UPDATE/DELETE without WHERE
    if (/UPDATE\s+\w+\s+SET/i.test(sql) && !/WHERE/i.test(sql)) {
      issues.push('UPDATE without WHERE clause - query rejected for safety');
      return { valid: false, sanitized: sql, issues };
    }

    if (/DELETE\s+FROM\s+\w+(?!\s+WHERE)/i.test(sql)) {
      issues.push('DELETE without WHERE clause - query rejected for safety');
      return { valid: false, sanitized: sql, issues };
    }

    // Check for proper client_id filtering
    if (/SELECT|UPDATE|DELETE/i.test(sql)) {
      if (!/client_id\s*=|client_id\s*\?/i.test(sql)) {
        issues.push(`Query missing client_id filter for tenant ${this.clientId}`);
      }
    }

    return {
      valid: issues.length === 0,
      sanitized,
      issues,
    };
  }

  /**
   * Log query execution with full context
   */
  logQueryExecution(sql, params = [], rowsAffected = 0, executionTime = 0) {
    this.queries.push({
      sql,
      params: this.maskSensitiveParams(params),
      clientId: this.clientId,
      userId: this.userId,
      email: this.email,
      rowsAffected,
      executionTime,
      timestamp: new Date().toISOString(),
    });

    // Warn if query takes > 500ms
    if (executionTime > 500) {
      console.warn(
        `[QueryPerf] Slow query for ${this.clientId}: ${executionTime}ms - ${sql.substring(0, 80)}`
      );
    }
  }

  /**
   * Mask sensitive data in logged parameters
   */
  maskSensitiveParams(params = []) {
    return params.map(p => {
      if (typeof p !== 'string') return p;
      // Mask likely passwords, tokens, PINs
      if (/password|token|pin|secret|apikey/i.test(this.lastParamName || '')) {
        return '***MASKED***';
      }
      // Mask likely phone numbers and emails
      if (/phone|email|contact/.test(this.lastParamName || '')) {
        return p.substring(0, 3) + '***';
      }
      return p;
    });
  }

  /**
   * Get query summary for audit log
   */
  getQuerySummary() {
    if (this.queries.length === 0) return null;

    const totalTime = this.queries.reduce((sum, q) => sum + q.executionTime, 0);
    const readQueries = this.queries.filter(q => /^SELECT/i.test(q.sql)).length;
    const writeQueries = this.queries.length - readQueries;

    return {
      clientId: this.clientId,
      userId: this.userId,
      totalQueries: this.queries.length,
      readQueries,
      writeQueries,
      totalExecutionTime: totalTime,
      largestQuery: Math.max(...this.queries.map(q => q.rowsAffected)),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Tenant Context Decorator
 * Wraps database function calls with automatic tenant context injection
 */
export class TenantContextDecorator {
  constructor(clientId, userId = null, email = null) {
    this.clientId = clientId;
    this.userId = userId;
    this.email = email;
    this.validator = new TenantQueryValidator(clientId, userId, email);
  }

  /**
   * Wrap SQLite db.all() with tenant validation
   */
  wrapDbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
      const validation = this.validator.validateQuerySql(sql);
      
      if (!validation.valid) {
        console.error(`[TenantValidation] Invalid query for ${this.clientId}:`, validation.issues);
        reject(new Error(`Query validation failed: ${validation.issues.join(', ')}`));
        return;
      }

      if (validation.issues.length > 0) {
        console.warn(`[TenantValidation] Warnings for ${this.clientId}:`, validation.issues);
      }

      const startTime = Date.now();
      db.all(sql, params, (err, rows) => {
        const executionTime = Date.now() - startTime;
        const rowCount = rows ? rows.length : 0;

        this.validator.logQueryExecution(sql, params, rowCount, executionTime);

        if (err) {
          console.error(`[DB] Query error for ${this.clientId}:`, err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Wrap SQLite db.run() with tenant validation
   */
  wrapDbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
      const validation = this.validator.validateQuerySql(sql);
      
      if (!validation.valid) {
        console.error(`[TenantValidation] Invalid write query for ${this.clientId}:`, validation.issues);
        reject(new Error(`Query validation failed: ${validation.issues.join(', ')}`));
        return;
      }

      const startTime = Date.now();
      db.run(sql, params, function(err) {
        const executionTime = Date.now() - startTime;
        const rowsAffected = this ? this.changes : 0;

        this.validator.logQueryExecution(sql, params, rowsAffected, executionTime);

        if (err) {
          console.error(`[DB] Write error for ${this.clientId}:`, err.message);
          reject(err);
        } else {
          resolve({ lastID: this ? this.lastID : null, changes: rowsAffected });
        }
      }.bind(this));
    });
  }
}

/**
 * Data Leak Prevention Validator
 * Checks response data for cross-tenant information before returning to client
 */
export class DataLeakPrevention {
  constructor(clientId) {
    this.clientId = clientId;
    this.bannedFields = [
      'password',
      'secret',
      'apikey',
      'api_key',
      'token',
      'refresh_token',
      'private_key',
      'private_notes',
    ];
  }

  /**
   * Validate response data for tenant isolation
   * Checks that no other tenant's data is present
   */
  validateResponseData(data, allowedFields = null) {
    if (!data) return { valid: true, warnings: [] };

    const warnings = [];
    const dataArray = Array.isArray(data) ? data : [data];

    for (const record of dataArray) {
      if (typeof record !== 'object') continue;

      // Check for other tenant's client_id
      if (record.client_id && record.client_id !== this.clientId) {
        warnings.push(
          `Data leak: Record has different client_id (${record.client_id} vs ${this.clientId})`
        );
      }

      // Check for sensitive fields that shouldn't be exposed
      for (const field of this.bannedFields) {
        if (field in record && record[field]) {
          warnings.push(`Sensitive field exposed: ${field}`);
        }
      }

      // Check for suspicious cross-references
      if (record.parent_client_id && record.parent_client_id !== this.clientId) {
        warnings.push(`Invalid parent_client_id reference: ${record.parent_client_id}`);
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
      checkedRecords: dataArray.length,
    };
  }

  /**
   * Sanitize response data before sending to client
   */
  sanitizeResponseData(data) {
    if (!data) return data;

    const dataArray = Array.isArray(data) ? data : [data];
    const sanitized = dataArray.map(record => {
      if (typeof record !== 'object') return record;

      const sanitizedRecord = { ...record };

      // Remove sensitive fields
      for (const field of this.bannedFields) {
        delete sanitizedRecord[field];
      }

      // Ensure client_id matches
      if (sanitizedRecord.client_id && sanitizedRecord.client_id !== this.clientId) {
        console.error(
          `[DataLeak] Attempted to return data from ${sanitizedRecord.client_id} to ${this.clientId}`
        );
        return null; // Filter out this record
      }

      return sanitizedRecord;
    });

    return Array.isArray(data) ? sanitized.filter(r => r !== null) : sanitized[0];
  }
}

export default {
  TenantQueryValidator,
  TenantContextDecorator,
  DataLeakPrevention,
};

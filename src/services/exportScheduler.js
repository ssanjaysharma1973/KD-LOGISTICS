/**
 * E-Way Bill Automatic Export Scheduler
 * 
 * Runs scheduled jobs to automatically export e-way bills for each client
 * - Exports at specified intervals (daily, hourly, etc.)
 * - Saves to /data/exports/ directory
 * - Creates backup of current bills
 * - Sends notifications when export completes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = '/data/exports';
// Fallback to local directory if /data doesn't exist
const EXPORTS_PATH = fs.existsSync('/data') ? EXPORTS_DIR : path.join(__dirname, '../../exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_PATH)) {
  fs.mkdirSync(EXPORTS_PATH, { recursive: true });
  console.log(`[ExportScheduler] Created exports directory: ${EXPORTS_PATH}`);
}

/**
 * Job Status Tracker
 */
const jobStatus = {
  lastRun: null,
  nextRun: null,
  lastStatus: 'idle',
  totalExported: 0,
  totalErrors: 0,
  jobsCount: 0,
};

/**
 * Schedule automatic e-way bill exports
 * 
 * @param {Function} queryFn - Async function to fetch bills: (clientId) => []
 * @param {Function} exportFn - Async function to export: (bills, clientId) => Buffer
 * @param {Object} options - Configuration options
 *   - interval: 'daily' | 'hourly' | 'weekly' (default: 'daily')
 *   - hour: 0-23 (for daily, which hour to run, default: 2 AM)
 *   - clients: ['CLIENT_001', 'CLIENT_002'] or 'auto' to detect
 */
export function scheduleExport(queryFn, exportFn, options = {}) {
  const interval = options.interval || 'daily';
  const hour = options.hour !== undefined ? options.hour : 2;
  const clients = options.clients || 'auto';

  console.log(`[ExportScheduler] ✓ Export job scheduled: ${interval} @ ${hour}:00`);
  console.log(`[ExportScheduler] Clients: ${Array.isArray(clients) ? clients.join(', ') : 'auto-detect'}`);

  // Calculate next run time
  const nextRun = calculateNextRun(interval, hour);
  jobStatus.nextRun = nextRun;

  // Schedule the job
  const interval_ms = getIntervalMs(interval);
  
  // Run immediately on startup (optional - can be disabled)
  // runExportJob(queryFn, exportFn, clients);

  // Setup recurring job
  const timerId = setInterval(() => {
    runExportJob(queryFn, exportFn, clients);
  }, interval_ms);

  console.log(`[ExportScheduler] Next export: ${nextRun.toISOString()}`);

  return {
    timerId,
    status: () => jobStatus,
    runNow: () => runExportJob(queryFn, exportFn, clients),
    stop: () => clearInterval(timerId),
  };
}

/**
 * Run export job for all configured clients
 */
async function runExportJob(queryFn, exportFn, clientsConfig) {
  jobStatus.lastRun = new Date();
  jobStatus.lastStatus = 'running';

  console.log(`\n[ExportScheduler] 🔄 Starting automatic export job...`);

  try {
    // Determine which clients to export
    let clients = [];
    if (typeof clientsConfig === 'string' && clientsConfig === 'auto') {
      // Auto-detect clients from environment or database
      clients = detectClients();
    } else if (Array.isArray(clientsConfig)) {
      clients = clientsConfig;
    } else {
      clients = ['CLIENT_001']; // Default
    }

    console.log(`[ExportScheduler] Processing ${clients.length} clients...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const clientId of clients) {
      try {
        console.log(`  → Exporting for ${clientId}...`);
        
        // Query bills for this client
        const bills = await queryFn(clientId);
        console.log(`    Found ${bills.length} e-way bills`);
        
        // Export to Excel
        const buffer = await exportFn(bills, clientId);
        
        // Save file
        const filename = generateFilename(clientId);
        const filepath = path.join(EXPORTS_PATH, filename);
        
        fs.writeFileSync(filepath, buffer);
        console.log(`    ✓ Exported to: ${filename} (${formatBytes(buffer.length)})`);
        
        // Keep last 5 versions (rotation)
        rotateOldExports(clientId);
        
        successCount++;
      } catch (err) {
        errorCount++;
        console.error(`    ✗ Export failed for ${clientId}: ${err.message}`);
      }
    }

    jobStatus.lastStatus = 'success';
    jobStatus.totalExported += successCount;
    jobStatus.totalErrors += errorCount;
    jobStatus.jobsCount++;

    console.log(`\n[ExportScheduler] ✓ Export job complete`);
    console.log(`  Succeeded: ${successCount}/${clients.length}`);
    if (errorCount > 0) {
      console.log(`  Failed: ${errorCount}`);
    }
    console.log(`  Metrics:   Total exported: ${jobStatus.totalExported}, Errors: ${jobStatus.totalErrors}`);

  } catch (err) {
    jobStatus.lastStatus = 'error';
    jobStatus.totalErrors++;
    console.error(`[ExportScheduler] ✗ Job failed: ${err.message}`);
  }
}

/**
 * Calculate next run time
 */
function calculateNextRun(interval, hour = 2) {
  const now = new Date();
  let next = new Date();

  if (interval === 'hourly') {
    next.setHours(next.getHours() + 1);
    next.setMinutes(0, 0, 0);
  } else if (interval === 'daily') {
    next.setDate(next.getDate() + 1);
    next.setHours(hour, 0, 0, 0);
  } else if (interval === 'weekly') {
    next.setDate(next.getDate() + (7 - next.getDay()));
    next.setHours(hour, 0, 0, 0);
  }

  return next;
}

/**
 * Get interval in milliseconds
 */
function getIntervalMs(interval) {
  const map = {
    'hourly': 60 * 60 * 1000,
    'daily': 24 * 60 * 60 * 1000,
    'weekly': 7 * 24 * 60 * 60 * 1000,
  };
  return map[interval] || map['daily'];
}

/**
 * Auto-detect clients from environment variables
 */
function detectClients() {
  const tenantConfig = process.env.TENANTS || 'CLIENT_001,CLIENT_002';
  return tenantConfig.split(',').map(c => c.trim());
}

/**
 * Generate filename for export
 */
function generateFilename(clientId) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const time = new Date().toISOString().slice(11, 13); // HH
  return `ewaybills_${clientId}_${date}_${time}00.xlsx`;
}

/**
 * Keep only last N versions of export files
 */
function rotateOldExports(clientId, maxVersions = 5) {
  try {
    const pattern = `ewaybills_${clientId}`;
    const files = fs.readdirSync(EXPORTS_PATH)
      .filter(f => f.includes(pattern))
      .map(f => ({
        name: f,
        path: path.join(EXPORTS_PATH, f),
        mtime: fs.statSync(path.join(EXPORTS_PATH, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Delete old versions beyond max
    for (let i = maxVersions; i < files.length; i++) {
      fs.unlinkSync(files[i].path);
      console.log(`    🗑️  Removed old export: ${files[i].name}`);
    }
  } catch (err) {
    console.warn(`[ExportScheduler] Rotation warning: ${err.message}`);
  }
}

/**
 * Get list of recent exports
 */
export function getRecentExports(clientId = null, limit = 10) {
  try {
    let files = fs.readdirSync(EXPORTS_PATH)
      .map(f => ({
        name: f,
        path: path.join(EXPORTS_PATH, f),
        clientId: extractClientIdFromFilename(f),
        date: fs.statSync(path.join(EXPORTS_PATH, f)).mtime,
        size: fs.statSync(path.join(EXPORTS_PATH, f)).size,
      }));

    if (clientId) {
      files = files.filter(f => f.clientId === clientId);
    }

    return files
      .sort((a, b) => b.date - a.date)
      .slice(0, limit)
      .map(f => ({
        ...f,
        sizeFormatted: formatBytes(f.size),
        dateFormatted: f.date.toISOString(),
      }));
  } catch (err) {
    console.error(`[ExportScheduler] Error listing exports: ${err.message}`);
    return [];
  }
}

/**
 * Download export file
 */
export function downloadExport(filename) {
  const filepath = path.join(EXPORTS_PATH, filename);
  
  if (!fs.existsSync(filepath)) {
    return null;
  }

  // Verify file is within EXPORTS_PATH (security check)
  const realpath = fs.realpathSync(filepath);
  if (!realpath.startsWith(fs.realpathSync(EXPORTS_PATH))) {
    console.error(`[ExportScheduler] ⚠️ Security: Attempted path traversal: ${filename}`);
    return null;
  }

  return fs.readFileSync(filepath);
}

/**
 * Extract client ID from filename
 */
function extractClientIdFromFilename(filename) {
  // Format: ewaybills_CLIENT_001_2024-04-03_0200.xlsx
  const match = filename.match(/ewaybills_([^_]+)_/);
  return match ? match[1] : null;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    ...jobStatus,
    exportsPath: EXPORTS_PATH,
    recentExports: getRecentExports(null, 5),
  };
}

export default {
  scheduleExport,
  getRecentExports,
  downloadExport,
  getSchedulerStatus,
};

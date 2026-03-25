/**
 * Format duration since a given date
 * @param {string|Date} dateString - The date to compare against now
 * @returns {string} Formatted duration string
 */
export function formatDurationSince(dateString) {
  if (!dateString) return '-';
  
  const now = new Date();
  const dt = new Date(dateString);
  
  if (isNaN(dt.getTime())) {
    return '-';
  }
  
  const diffMs = now - dt;
  
  if (diffMs < 0) {
    return 'Future time';
  }
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ${diffMin % 60}m ago`;
  }
  if (diffMin > 0) {
    return `${diffMin}m ago`;
  }
  return `${diffSec}s ago`;
}

/**
 * Get the number of days since a date
 */
export function getDaysSince(dateString) {
  const now = new Date();
  const dt = new Date(dateString);
  const diffMs = now - dt;
  return Math.floor(diffMs / (3600 * 24 * 1000));
}

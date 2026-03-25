// Utility to format duration since a date string
export function formatDurationSince(dateString) {
  if (!dateString) return '-';
  const now = new Date();
  const dt = new Date(dateString);
  const diffMs = now - dt;
  if (isNaN(diffMs)) return '-';
  if (diffMs < 0) return 'In future';
  const diffSec = Math.floor(diffMs / 1000);
  const days = Math.floor(diffSec / (3600 * 24));
  const hours = Math.floor((diffSec % (3600 * 24)) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  let out = '';
  if (days > 0) out += `${days}d `;
  if (hours > 0) out += `${hours}h `;
  if (minutes > 0) out += `${minutes}m`;
  if (!out) out = '<1m';
  return out.trim();
}

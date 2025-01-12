/**
 * Format a duration in seconds to a human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string (e.g. "2h 30m", "45m", "30s")
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || (hours > 0 && remainingSeconds > 0)) {
    parts.push(`${minutes}m`);
  }

  if (remainingSeconds > 0 && hours === 0) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ') || '0s';
};

/**
 * Test cases:
 * formatDuration(0) => "0s"
 * formatDuration(30) => "30s"
 * formatDuration(90) => "1m 30s"
 * formatDuration(3600) => "1h"
 * formatDuration(3661) => "1h 1m"
 * formatDuration(7323) => "2h 2m"
 */ 
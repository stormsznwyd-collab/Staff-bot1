const UNIT_MS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parses strings like "7d", "12h", "30m", "2w", or combos like "1d12h".
 * Returns milliseconds, or null if the string couldn't be parsed.
 */
function parseDuration(input) {
  if (!input) return null;
  const regex = /(\d+)\s*(w|d|h|m)/gi;
  let match;
  let total = 0;
  let matched = false;

  while ((match = regex.exec(input)) !== null) {
    matched = true;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    total += value * UNIT_MS[unit];
  }

  return matched ? total : null;
}

function formatDuration(ms) {
  if (ms <= 0) return '0m';
  const weeks = Math.floor(ms / UNIT_MS.w);
  ms -= weeks * UNIT_MS.w;
  const days = Math.floor(ms / UNIT_MS.d);
  ms -= days * UNIT_MS.d;
  const hours = Math.floor(ms / UNIT_MS.h);
  ms -= hours * UNIT_MS.h;
  const minutes = Math.floor(ms / UNIT_MS.m);

  const parts = [];
  if (weeks) parts.push(`${weeks}w`);
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

/** Formats elapsed seconds as HH:MM:SS for live timers. */
function formatHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

module.exports = { parseDuration, formatDuration, formatHMS };

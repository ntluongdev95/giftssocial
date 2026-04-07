/**
 * Parse a date string from SQLite/D1 as UTC.
 * SQLite `datetime('now')` returns '2026-04-07 02:30:00' without timezone suffix.
 * JS `new Date()` treats this as local time — append 'Z' to force UTC.
 */
export function parseUTC(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // Already has timezone info
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  // Append Z to treat as UTC
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

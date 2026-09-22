/** Stable on both server and browser; the timezone is always explicit. */
export function displayTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toISOString().slice(0, 10) + ' ' + date.toISOString().slice(11, 16) + ' UTC';
}

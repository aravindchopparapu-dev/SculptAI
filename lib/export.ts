import type { State } from './fitness.ts';
import { normalizedState } from './adaptation.ts';
// A normalized record-per-row archive; nested values are JSON so no data is silently dropped.
export function exportCsv(state: State) {
  const s = normalizedState(state);
  const escape = (value: unknown) => {
    let text = typeof value === 'string' ? value : JSON.stringify(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows: unknown[][] = [['record_type', 'record_id', 'data_json']];
  if (s.profile) rows.push(['profile', 'profile', s.profile]);
  for (const key of [
    'plans',
    'metrics',
    'sessions',
    'targets',
    'readiness',
    'receipts',
    'decisions',
    'consents',
    'safetyScreens',
    'reviews',
  ] as const) {
    for (const record of s[key])
      rows.push([key, 'id' in record ? record.id : record.receiptId, record]);
  }
  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

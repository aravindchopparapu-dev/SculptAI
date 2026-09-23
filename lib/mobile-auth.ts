import type { ChatGPTUser } from '../app/chatgpt-auth.ts';

const seconds = () => Math.floor(Date.now() / 1000);
export const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
export async function reservePairing(db: D1Database, key: string, limit: number) {
  const now = seconds(), cutoff = now - 3600;
  const result = await db.prepare(`INSERT INTO coach_limits (user_id, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id) DO UPDATE SET window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
    count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END WHERE window_start <= ? OR count < ?`)
    .bind(`mobile:${await digest(key)}`, now, cutoff, cutoff, cutoff, limit).run();
  return Boolean(result.meta.changes);
}
export async function beginPairing(db: D1Database) {
  const deviceSecret = secret(), code = secret().slice(0, 10).toUpperCase(), expires = seconds() + 600;
  await db.prepare('DELETE FROM mobile_pairings WHERE expires_at < ?').bind(seconds()).run();
  await db.prepare('INSERT INTO mobile_pairings (device_hash, code, expires_at) VALUES (?, ?, ?)')
    .bind(await digest(deviceSecret), code, expires).run();
  return { deviceSecret, code, expiresAt: expires };
}
export async function approvePairing(db: D1Database, code: string, user: ChatGPTUser) {
  const result = await db.prepare('UPDATE mobile_pairings SET user_id = ?, display_name = ? WHERE code = ? AND expires_at > ? AND user_id IS NULL AND consumed = 0')
    .bind(user.userId, user.displayName, code.replace(/[\s-]/g, '').toUpperCase(), seconds()).run();
  if (!result.meta.changes) throw new Error('This code expired or was already used. Start pairing again on your iPhone.');
}
export async function completePairing(db: D1Database, deviceSecret: string) {
  if (!/^[a-f0-9]{64}$/.test(deviceSecret)) throw new Error('Invalid pairing request.');
  const hash = await digest(deviceSecret);
  const pair = await db.prepare('SELECT user_id, display_name, expires_at, consumed FROM mobile_pairings WHERE device_hash = ?').bind(hash)
    .first<{ user_id: string | null; display_name: string; expires_at: number; consumed: number }>();
  if (!pair || pair.expires_at <= seconds() || pair.consumed) throw new Error('Pairing expired. Start again on your iPhone.');
  if (!pair.user_id) return { status: 'pending' };
  const accessToken = secret(), tokenHash = await digest(accessToken), expires = seconds() + 30 * 86400;
  // A token is issued once, in the same atomic batch that consumes the pairing.
  await db.batch([
    db.prepare('INSERT INTO mobile_sessions (token_hash, user_id, display_name, expires_at) SELECT ?, user_id, display_name, ? FROM mobile_pairings WHERE device_hash = ? AND consumed = 0 AND expires_at > ?')
      .bind(tokenHash, expires, hash, seconds()),
    db.prepare('UPDATE mobile_pairings SET consumed = 1 WHERE device_hash = ? AND consumed = 0').bind(hash),
  ]);
  const session = await db.prepare('SELECT token_hash FROM mobile_sessions WHERE token_hash = ?').bind(tokenHash).first();
  if (!session) throw new Error('Pairing was already completed. Start again.');
  return { status: 'connected', accessToken, expiresAt: expires };
}
export async function authenticateMobile(db: D1Database, authorization: string | null): Promise<ChatGPTUser | null> {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? '');
  if (!match) return null;
  const row = await db.prepare('SELECT user_id, display_name FROM mobile_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await digest(match[1]), seconds()).first<{ user_id: string; display_name: string }>();
  return row ? { userId: row.user_id, displayName: row.display_name, fullName: null, email: '', authMethod: 'mobile' } : null;
}
export async function revokeMobile(db: D1Database, authorization: string | null) {
  const token = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? '')?.[1];
  if (token) await db.prepare('DELETE FROM mobile_sessions WHERE token_hash = ?').bind(await digest(token)).run();
}

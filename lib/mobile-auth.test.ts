import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { authenticateMobile, approvePairing, beginPairing, completePairing, digest, revokeMobile } from './mobile-auth.ts';
import { isAdminUser } from './admin-control.ts';
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0002_cool_mastermind.sql', import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
  const prepare = (sql: string) => ({ bind(...args: unknown[]) { const statement = sqlite.prepare(sql); return {
    async first() { return statement.get(...args as []) ?? null; },
    async run() { return { meta: { changes: Number(statement.run(...args as []).changes) } }; },
  }; } });
  return { prepare, async batch(statements: { run(): Promise<unknown> }[]) { sqlite.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } }, sqlite } as unknown as D1Database & { sqlite: DatabaseSync };
}
void test('Phone pairing issues one scoped session only after authenticated approval', async () => {
  const db = database(), owner = { userId: 'owner-id', displayName: 'Owner', email: 'owner@example.test', fullName: null };
  const pair = await beginPairing(db);
  assert.equal((await completePairing(db, pair.deviceSecret)).status, 'pending');
  await approvePairing(db, pair.code, owner);
  const result = await completePairing(db, pair.deviceSecret);
  assert.equal(result.status, 'connected');
  assert.ok('accessToken' in result && result.accessToken);
  const auth = `Bearer ${result.accessToken}`;
  const user = await authenticateMobile(db, auth);
  assert.equal(user?.userId, 'owner-id');
  assert.equal(user?.authMethod, 'mobile');
  assert.equal(isAdminUser(user, { SCULPTAI_ADMIN_USER_ID: 'owner-id' }), false);
  assert.equal(db.sqlite.prepare('SELECT token_hash FROM mobile_sessions').get()?.token_hash, await digest(result.accessToken!));
  await assert.rejects(completePairing(db, pair.deviceSecret), /expired/);
  await revokeMobile(db, auth);
  assert.equal(await authenticateMobile(db, auth), null);
});
void test('Expired, unknown, and already approved pairing codes cannot grant access', async () => {
  const db = database(), owner = { userId: 'a', displayName: 'A', email: 'a@test', fullName: null };
  const pair = await beginPairing(db);
  await assert.rejects(approvePairing(db, '0000000000', owner), /expired/);
  await approvePairing(db, pair.code, owner);
  await assert.rejects(approvePairing(db, pair.code, { ...owner, userId: 'b' }), /already/);
  db.sqlite.exec('UPDATE mobile_pairings SET expires_at = 0');
  await assert.rejects(completePairing(db, pair.deviceSecret), /expired/);
  assert.equal(await authenticateMobile(db, 'Bearer ' + 'f'.repeat(64)), null);
  assert.equal(await authenticateMobile(db, 'Bearer malformed'), null);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM mobile_sessions').get()?.n, 0);
});

void test('App sign-in preserves only validated connection parameters and a fixed callback', async () => {
  const { mobileConnectParams, mobileConnectCallback } = await import('./mobile-connect.ts');
  const state = '12345678-1234-1234-1234-123456789abc';
  const valid = mobileConnectParams({ app: '1', code: 'abcdef1234', state });
  assert.equal(valid.code, 'ABCDEF1234');
  assert.match(valid.returnTo, /^\/connect\?app=1&code=ABCDEF1234&state=/);
  assert.equal(mobileConnectCallback(state), `sculptai://auth-complete?state=${state}`);
  for (const query of [{ app: '1', code: '//evil.test', state }, { app: '1', code: 'abcdef1234', state: 'https://evil.test' }, { app: '1', code: ['abcdef1234'], state }]) {
    assert.equal(mobileConnectParams(query).returnTo, '/connect');
  }
  assert.equal(mobileConnectCallback('https://evil.test'), null);
});

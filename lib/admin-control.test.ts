import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { defaultControl, effectiveInstructions, isAdminUser, publishAdminDraft, readAdminSnapshot, readPublishedControl, restoreAdminDraft, saveAdminDraft, validateControl } from './admin-control.ts';
import { eligibleExercises } from './custom-workout.ts';
import { createDemo } from './demo.ts';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_glossy_ironclad.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0001_flaky_sleeper.sql', import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
  const prepare = (sql: string) => ({
    async first() { return sqlite.prepare(sql).get() ?? null; },
    async all() { return { results: sqlite.prepare(sql).all() }; },
    bind(...args: unknown[]) {
      const statement = sqlite.prepare(sql);
      return {
        async first() { return statement.get(...args as []) ?? null; },
        async all() { return { results: statement.all(...args as []) }; },
        async run() { return { meta: { changes: Number(statement.run(...args as []).changes) } }; },
      };
    },
  });
  return { prepare, async batch(statements: { run(): Promise<unknown> }[]) {
    sqlite.exec('BEGIN');
    try { const result = await Promise.all(statements.map(statement => statement.run())); sqlite.exec('COMMIT'); return result; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }, sqlite } as unknown as D1Database & { sqlite: DatabaseSync };
}

void test('Owner gate requires an exact trusted identity', () => {
  const owner = { userId: 'owner-id', email: 'owner@example.test', displayName: 'Owner', fullName: null };
  const config = { SCULPTAI_ADMIN_USER_ID: 'owner-id', SCULPTAI_ADMIN_EMAIL: 'owner@example.test' };
  assert.equal(isAdminUser(owner, config), true);
  assert.equal(isAdminUser({ ...owner, userId: 'other', email: 'other@example.test' }, config), false);
  assert.equal(isAdminUser(owner, {}), false);
  assert.equal(isAdminUser(null, config), false);
});

void test('Draft is private until publication; restore is a draft and stale writes fail', async () => {
  const db = database();
  assert.deepEqual((await readPublishedControl(db)).control, defaultControl);
  const next = validateControl({ ...defaultControl, features: { ...defaultControl.features, meals: false }, memberNotice: 'Testing',
    guidance: { ...defaultControl.guidance, coach: 'Use short answers.' } });
  let state = await saveAdminDraft(db, 0, next, 'owner-id');
  assert.equal(state.revision, 1);
  assert.equal((await readPublishedControl(db)).control.features.meals, true);
  await assert.rejects(saveAdminDraft(db, 0, next, 'owner-id'), /changed in another tab/);
  state = await publishAdminDraft(db, state.revision, 'owner-id');
  assert.equal(state.publishedVersion, 1);
  assert.equal((await readPublishedControl(db)).control.features.meals, false);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS count FROM members').get()?.count, 0);
  state = await saveAdminDraft(db, state.revision, defaultControl, 'owner-id');
  state = await publishAdminDraft(db, state.revision, 'owner-id');
  assert.equal(state.publishedVersion, 2);
  state = await restoreAdminDraft(db, state.revision, 1, 'owner-id');
  assert.equal(state.draft.features.meals, false);
  assert.equal(state.published.features.meals, true);
  assert.equal((await readAdminSnapshot(db)).publishedVersion, 2);
});

void test('Owner guidance remains bounded and core instructions remain present', () => {
  assert.throws(() => validateControl({ ...defaultControl, guidance: { ...defaultControl.guidance, coach: 'x'.repeat(8001) } }), /8,000/);
  assert.match(effectiveInstructions('Core rules', 'Be concise'), /Core rules[\s\S]*Be concise[\s\S]*subordinate/);
});

void test('Hidden exercises leave future generation candidates while saved plans stay intact', () => {
  const state = createDemo();
  const name = 'Dumbbell bench press';
  assert.equal(eligibleExercises(state.profile!, ['Chest']).some(item => item.name === name), true);
  assert.equal(eligibleExercises(state.profile!, ['Chest'], [name]).some(item => item.name === name), false);
  assert.ok(state.plans.length);
  assert.throws(() => validateControl({ ...defaultControl, disabledExercises: ['Unknown movement'] }), /SculptAI library/);
});

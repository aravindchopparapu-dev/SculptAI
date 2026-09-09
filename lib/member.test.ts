import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  emptyState,
  generatePlan,
  nutrition,
  validateProfile,
  weightDisplay,
  type Profile,
} from './fitness.ts';
import { applyAction, makePlanPreview } from './actions.ts';
import {
  mutateState,
  readState,
  Conflict,
  DuplicateOperation,
} from './repository.ts';
import { coachReply, safetyResponse } from './coach.ts';
const profile: Profile = {
  name: 'Test member',
  age: 30,
  sex: 'Male',
  height: 175,
  weight: 75,
  goal: 'Muscle gain',
  days: 3,
  minutes: 45,
  equipment: 'Dumbbells',
  experience: 'Beginner',
  activity: 1.375,
  units: 'Metric',
  diet: 'Vegetarian',
  exclusions: 'peanuts',
  avoid: '',
  eligible: true,
};
function db() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    readFileSync(
      new URL('../drizzle/0000_glossy_ironclad.sql', import.meta.url),
      'utf8',
    ),
  );
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          const stmt = sqlite.prepare(sql);
          return {
            async first() {
              return stmt.get(...(args as [])) ?? null;
            },
            async run() {
              return {
                meta: { changes: Number(stmt.run(...(args as [])).changes) },
              };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}
void test('Accounts remain isolated and cross-member record mutations fail', async () => {
  const d = db();
  let a = await mutateState(d, 'alice', 0, crypto.randomUUID(), {
    type: 'profile',
    profile,
  });
  await mutateState(d, 'bob', 0, crypto.randomUUID(), {
    type: 'profile',
    profile: { ...profile, name: 'Bob' },
  });
  a = await mutateState(d, 'alice', a.revision, crypto.randomUUID(), {
    type: 'metric',
    metric: { date: '2026-09-01', weight: 75, source: 'Manual', notes: '' },
  });
  const b = await readState(d, 'bob');
  assert.equal(b.state.metrics.length, 0);
  assert.equal(b.state.profile?.name, 'Bob');
  await assert.rejects(
    mutateState(d, 'bob', b.revision, crypto.randomUUID(), {
      type: 'deleteMetric',
      id: a.state.metrics[0].id,
      confirmed: true,
    }),
    /not found/,
  );
  assert.equal((await readState(d, 'alice')).state.metrics.length, 1);
});
void test('Save retries are idempotent and a reused identifier cannot change payload', async () => {
  const d = db(),
    id = crypto.randomUUID(),
    action = { type: 'profile', profile };
  const a = await mutateState(d, 'alice', 0, id, action);
  const replay = await mutateState(d, 'alice', 0, id, action);
  assert.equal(replay.revision, a.revision);
  await assert.rejects(
    mutateState(d, 'alice', 1, id, {
      type: 'profile',
      profile: { ...profile, name: 'Other' },
    }),
    DuplicateOperation,
  );
  await assert.rejects(
    mutateState(d, 'alice', 0, crypto.randomUUID(), action),
    Conflict,
  );
});
void test('Competing writers cannot overwrite a newer save', async () => {
  const d = db();
  await mutateState(d, 'alice', 0, crypto.randomUUID(), {
    type: 'profile',
    profile,
  });
  const results = await Promise.allSettled(
    ['A', 'B'].map((name) =>
      mutateState(d, 'alice', 1, crypto.randomUUID(), {
        type: 'profile',
        profile: { ...profile, name },
      }),
    ),
  );
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await readState(d, 'alice')).revision, 2);
});
void test('Profile validation rejects minors and wrong numeric types; optional inputs do not block training', () => {
  assert.throws(() => validateProfile({ ...profile, age: 17 }));
  assert.throws(() =>
    validateProfile({ ...profile, height: '175' } as unknown as Profile),
  );
  const p = { ...profile, height: 0, weight: 0, sex: '', eligible: false };
  assert.equal(generatePlan(p).days.length, 3);
  assert.throws(() => nutrition(p));
});
void test('Plans respect equipment, avoidance and beginner volume', () => {
  for (const equipment of ['Bodyweight', 'Dumbbells', 'Gym'])
    for (const days of [2, 3, 4, 5, 6]) {
      const p = { ...profile, equipment, days, avoid: 'squat' },
        plan = generatePlan(p);
      assert.equal(plan.days.length, days);
      for (const d of plan.days)
        for (const e of d.exercises) {
          assert.ok(!e.name.toLowerCase().includes('squat'));
          assert.equal(e.sets, 2);
          assert.ok(
            e.equipment === 'Bodyweight' ||
              e.equipment === equipment ||
              equipment === 'Gym',
          );
        }
    }
});
void test('Nutrition uses raw precision, reconciles calories and rejects ineligible inputs', () => {
  const t = nutrition(profile);
  assert.ok(
    Math.abs(4 * t.protein + 9 * t.fat + 4 * t.carbs - t.calories) < 1e-9,
  );
  assert.equal(t.inputs.weight, 75);
  assert.throws(() => nutrition({ ...profile, eligible: false }));
  assert.throws(() => nutrition({ ...profile, weight: 40 }));
  assert.equal(weightDisplay(75, 'Imperial'), 165.3);
});
void test('Plan previews and replacements preserve historical workout version', () => {
  let state = applyAction(emptyState(), { type: 'profile', profile });
  state = applyAction(state, { type: 'plan', confirmed: true });
  state = applyAction(state, { type: 'start', dayIndex: 0 });
  const original = state.plans[0].id;
  const preview = makePlanPreview(state, { type: 'shorten', dayIndex: 0 });
  assert.equal(state.plans.length, 1);
  assert.ok(preview.days[0].exercises.length <= 3);
  state = applyAction(state, { type: 'shorten', dayIndex: 0, confirmed: true });
  assert.equal(state.sessions[0].planId, original);
  assert.equal(state.plans.length, 2);
  assert.throws(() => applyAction(state, { type: 'plan' }), /confirm/);
});
void test('Workout sets survive reads, completion validates values and partial status remains distinct', async () => {
  const d = db();
  let s = await mutateState(d, 'alice', 0, crypto.randomUUID(), {
    type: 'profile',
    profile,
  });
  s = await mutateState(d, 'alice', s.revision, crypto.randomUUID(), {
    type: 'plan',
    confirmed: true,
  });
  s = await mutateState(d, 'alice', s.revision, crypto.randomUUID(), {
    type: 'start',
    dayIndex: 0,
  });
  const id = s.state.sessions[0].id;
  s = await mutateState(d, 'alice', s.revision, crypto.randomUUID(), {
    type: 'set',
    sessionId: id,
    index: 0,
    set: { reps: 12, load: 20, rpe: 7, done: true, skipped: false },
  });
  assert.equal(
    (await readState(d, 'alice')).state.sessions[0].sets[0].load,
    20,
  );
  assert.throws(() =>
    applyAction(s.state, {
      type: 'set',
      sessionId: id,
      index: 1,
      set: { reps: 0, load: 0, done: true, skipped: false },
    }),
  );
  s = await mutateState(d, 'alice', s.revision, crypto.randomUUID(), {
    type: 'finish',
    sessionId: id,
    confirmed: true,
  });
  assert.equal(s.state.sessions[0].status, 'partial');
  assert.throws(
    () =>
      applyAction(s.state, {
        type: 'set',
        sessionId: id,
        index: 0,
        set: { reps: 1, load: 1, done: true, skipped: false },
      }),
    /already/,
  );
});
void test('Check-in invalid dates and values are rejected', () => {
  const s = applyAction(emptyState(), { type: 'profile', profile });
  for (const metric of [
    { date: '2026-02-30', weight: 75 },
    { date: '2026-01-01', weight: -1 },
    { date: '2026-01-01', weight: 75, bodyFat: 200 },
  ])
    assert.throws(() =>
      applyAction(s, {
        type: 'metric',
        metric: { source: 'Manual', notes: '', ...metric },
      }),
    );
});
void test('Data deletion requires exact confirmation and affects only the member', async () => {
  const d = db();
  await mutateState(d, 'alice', 0, crypto.randomUUID(), {
    type: 'profile',
    profile,
  });
  await mutateState(d, 'bob', 0, crypto.randomUUID(), {
    type: 'profile',
    profile,
  });
  await assert.rejects(
    mutateState(d, 'alice', 1, crypto.randomUUID(), { type: 'deleteData' }),
  );
  await mutateState(d, 'alice', 1, crypto.randomUUID(), {
    type: 'deleteData',
    confirmation: 'DELETE',
  });
  assert.deepEqual((await readState(d, 'alice')).state, emptyState());
  assert.ok((await readState(d, 'bob')).state.profile);
});
void test('Guide has no invented performance and routes pain or emergency requests safely', () => {
  const state = applyAction(emptyState(), { type: 'profile', profile });
  assert.match(
    coachReply(state, 'summarize my training'),
    /0 complete and 0 partial/,
  );
  assert.match(
    coachReply(state, 'How should I progress?'),
    /Log a comfortable starting load/,
  );
  assert.match(safetyResponse('I have chest pain')!, /emergency/);
  assert.match(safetyResponse('My knee has pain')!, /clinician/);
});

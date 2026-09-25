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
  targetWeight: 75,
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
void test('Phone and website profile edits become visible to each other without losing concurrent changes', async () => {
  const database = db(), account = 'shared-member';
  const firstPhoneRead = await readState(database, account);
  const firstWebsiteRead = await readState(database, account);
  assert.equal(firstPhoneRead.revision, firstWebsiteRead.revision);

  const websiteSave = await mutateState(database, account, firstWebsiteRead.revision, crypto.randomUUID(), {
    type: 'profile', profile,
  });
  const phoneRead = await readState(database, account);
  assert.equal(phoneRead.state.profile?.name, profile.name);
  assert.equal(phoneRead.revision, websiteSave.revision);

  const phoneSave = await mutateState(database, account, phoneRead.revision, crypto.randomUUID(), {
    type: 'profile', profile: { ...phoneRead.state.profile!, targetWeight: 72 },
  });
  const websiteRead = await readState(database, account);
  assert.equal(websiteRead.state.profile?.targetWeight, 72);
  assert.equal(websiteRead.revision, phoneSave.revision);
  await assert.rejects(mutateState(database, account, firstWebsiteRead.revision, crypto.randomUUID(), {
    type: 'profile', profile: { ...profile, name: 'Stale website edit' },
  }), Conflict);
  assert.equal((await readState(database, account)).state.profile?.targetWeight, 72);
  assert.equal((await readState(database, 'different-member')).state.profile, null);
});
void test('Profile validation rejects minors and wrong numeric types; missing body measurements cannot be saved', () => {
  assert.throws(() => validateProfile({ ...profile, age: 17 }));
  assert.throws(() =>
    validateProfile({ ...profile, height: '175' } as unknown as Profile),
  );
  const p = { ...profile, height: 0, weight: 0, sex: '', eligible: false };
  assert.throws(() => validateProfile(p), /Height/);
  assert.throws(() => validateProfile({ ...profile, weight: 0 }), /Starting weight/);
  assert.throws(() => validateProfile({ ...profile, targetWeight: 0 }), /Target weight/);
  assert.throws(() => generatePlan(p), /Height/);
  assert.throws(() => nutrition(p));
});
void test('Profile photo stays with its account and can be removed', async () => {
  const database = db();
  const photo = `data:image/jpeg;base64,${Buffer.from('synthetic photo').toString('base64')}`;
  const saved = await mutateState(database, 'photo-owner', 0, crypto.randomUUID(), { type: 'profilePhoto', photo });
  assert.equal(saved.state.profilePhoto, photo);
  assert.equal((await readState(database, 'other-person')).state.profilePhoto, undefined);
  assert.throws(() => applyAction(saved.state, { type: 'profilePhoto', photo: 'data:image/svg+xml;base64,PHN2Zz4=' }), /photo/i);
  assert.throws(() => applyAction(saved.state, { type: 'profilePhoto', photo: `data:image/jpeg;base64,${'A'.repeat(16004)}` }), /photo/i);
  const removed = await mutateState(database, 'photo-owner', saved.revision, crypto.randomUUID(), { type: 'profilePhoto', photo: null });
  assert.equal((await readState(database, 'photo-owner')).state.profilePhoto, undefined);
  assert.equal(removed.state.profilePhoto, undefined);
});
void test('Plans respect equipment, avoidance and beginner volume', () => {
  for (const equipment of ['Bodyweight', 'Dumbbells', 'Gym'])
    for (const days of [2, 3, 4, 5, 6]) {
      const p = { ...profile, equipment, days, avoid: 'goblet squat' },
        plan = generatePlan(p);
      assert.equal(plan.days.length, days);
      for (const d of plan.days)
        for (const e of d.exercises) {
          assert.ok(!e.name.toLowerCase().includes('goblet squat'));
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
  state = applyAction(state, {
    type: 'safety',
    accepted: true,
    status: 'clear',
  });
  state = applyAction(state, { type: 'plan', confirmed: true });
  state = applyAction(state, {
    type: 'readiness',
    readiness: {
      dayIndex: 0,
      energy: 4,
      soreness: 0,
      minutes: 45,
      pain: false,
      equipment: profile.equipment,
    },
  });
  state = applyAction(state, { type: 'start', dayIndex: 0 });
  const original = state.plans[0].id;
  const preview = makePlanPreview(state, { type: 'shorten', dayIndex: 0 });
  assert.equal(state.plans.length, 1);
  assert.equal(
    preview.days[0].exercises.length,
    state.plans[0].days[0].exercises.length,
  );
  assert.throws(
    () => applyAction(state, { type: 'shorten', dayIndex: 0, confirmed: true }),
    /active workout/,
  );
  state = applyAction(state, {
    type: 'finish',
    sessionId: state.sessions[0].id,
    confirmed: true,
  });
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
    type: 'safety',
    accepted: true,
    status: 'clear',
  });
  s = await mutateState(d, 'alice', s.revision, crypto.randomUUID(), {
    type: 'plan',
    confirmed: true,
  });
  s = await mutateState(d, 'alice', s.revision, crypto.randomUUID(), {
    type: 'readiness',
    readiness: {
      dayIndex: 0,
      energy: 4,
      soreness: 0,
      minutes: 45,
      pain: false,
      equipment: profile.equipment,
    },
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

void test('Readiness and immutable decisions persist through member transactions and stay isolated', async () => {
  const database = db();
  let snapshot = await mutateState(database, 'alice', 0, crypto.randomUUID(), {
    type: 'profile',
    profile,
  });
  for (const action of [
    { type: 'safety', accepted: true, status: 'clear' },
    { type: 'plan', confirmed: true },
    {
      type: 'readiness',
      readiness: {
        dayIndex: 0,
        energy: 1,
        soreness: 8,
        minutes: 45,
        pain: false,
        equipment: 'Dumbbells',
      },
    },
    { type: 'proposeAdaptation', dayIndex: 0 },
  ])
    snapshot = await mutateState(
      database,
      'alice',
      snapshot.revision,
      crypto.randomUUID(),
      action,
    );
  const receipt = structuredClone(snapshot.state.receipts![0]);
  snapshot = await mutateState(
    database,
    'alice',
    snapshot.revision,
    crypto.randomUUID(),
    {
      type: 'decideAdaptation',
      receiptId: receipt.receiptId,
      decision: 'accepted',
      reason: 'More recovery today',
    },
  );
  const reread = await readState(database, 'alice');
  assert.deepEqual(reread.state.receipts![0], receipt);
  assert.equal(reread.state.decisions![0].decision, 'accepted');
  assert.equal(reread.state.plans.length, 2);
  assert.equal((await readState(database, 'bob')).state.receipts!.length, 0);
  await mutateState(database, 'bob', 0, crypto.randomUUID(), {
    type: 'profile',
    profile,
  });
  await assert.rejects(
    mutateState(database, 'bob', 1, crypto.randomUUID(), {
      type: 'decideAdaptation',
      receiptId: receipt.receiptId,
      decision: 'accepted',
      reason: '',
    }),
    /unavailable/,
  );
});

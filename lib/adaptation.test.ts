import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from './actions.ts';
import { createDemo, demoPersonas } from './demo.ts';
import { emptyState, generatePlan, type State } from './fitness.ts';
import {
  evaluateAdaptation,
  normalizedState,
  receiptStatus,
  estimateMinutes,
  weeklySummary,
} from './adaptation.ts';
import { exportCsv } from './export.ts';
const propose = (s: State) =>
  applyAction(s, { type: 'proposeAdaptation', dayIndex: 0 });
function decide(s: State, decision = 'accepted') {
  return applyAction(s, {
    type: 'decideAdaptation',
    receiptId: s.receipts!.at(-1)!.receiptId,
    decision,
    reason: 'Test choice',
  });
}

void test('Five personas receive four-week plans with frozen inputs, rest and bounded duration', () => {
  for (const name of demoPersonas) {
    const s = createDemo(name),
      p = s.plans[0];
    assert.equal(p.schedule!.length, s.profile!.days * 4);
    assert.deepEqual(p.inputs, s.profile);
    assert.notEqual(p.inputs, s.profile);
    assert.ok(p.days.every((d) => estimateMinutes(d) <= s.profile!.minutes));
    assert.ok(
      p.days.every((d) =>
        d.exercises.every((e) => e.rest >= 90 && e.sets >= 1 && e.sets <= 3),
      ),
    );
    assert.equal(
      new Set(p.schedule!.map((x) => x.date)).size,
      p.schedule!.length,
    );
  }
});
void test('Rules are deterministic, input-preserving and hold when evidence is missing', () => {
  const s = createDemo(),
    before = JSON.stringify(s);
  assert.deepEqual(evaluateAdaptation(s, 0), evaluateAdaptation(s, 0));
  assert.equal(evaluateAdaptation(s, 0).changeType, 'hold');
  assert.equal(JSON.stringify(s), before);
});
void test('Two comparable exposures propose one rep variable, never load and reps together', () => {
  const s = createDemo('Experienced lifter'),
    diff = evaluateAdaptation(s, 0);
  assert.equal(diff.ruleId, 'two-exposure-reps');
  const changed = diff.after[0].exercises.filter(
    (e, i) => e.reps !== diff.before[0].exercises[i].reps,
  );
  assert.equal(changed.length, 1);
  assert.deepEqual(
    diff.after[0].exercises.map((e) => e.sets),
    diff.before[0].exercises.map((e) => e.sets),
  );
  s.sessions[1].sets[0].rpe = undefined;
  const noFirst = evaluateAdaptation(s, 0);
  assert.equal(
    noFirst.after[0].exercises[0].reps,
    noFirst.before[0].exercises[0].reps,
  );
});
void test('Pain always precedes progression and blocks starting a session', () => {
  const s = createDemo('Experienced lifter');
  s.readiness![0].pain = true;
  assert.equal(evaluateAdaptation(s, 0).ruleId, 'pain-stop');
  assert.throws(() => applyAction(s, { type: 'start', dayIndex: 0 }), /Pain/);
  s.readiness![0].pain = false;
  s.sessions[1].painEvents = [
    {
      id: 'pain',
      createdAt: new Date().toISOString(),
      exercise: s.plans[0].days[0].exercises[0].name,
      severity: 'pain',
      note: '',
    },
  ];
  assert.equal(evaluateAdaptation(s, 0).changeType, 'hold');
});
void test('Combined low-energy, unavailable equipment and time constraints preserve warm-up and rest', () => {
  const s = createDemo('Low energy day');
  Object.assign(s.readiness![0], { equipment: 'Bodyweight', minutes: 20 });
  const diff = evaluateAdaptation(s, 0);
  assert.ok(
    diff.after[0].exercises.every(
      (e) => e.equipment === 'Bodyweight' && e.rest >= 90,
    ),
  );
  assert.ok(estimateMinutes(diff.after[0]) <= 20);
  assert.equal(diff.after[0].exercises.length, diff.before[0].exercises.length);
  s.readiness![0].minutes = 10;
  const short = evaluateAdaptation(s, 0);
  assert.equal(short.ruleId, 'time-insufficient');
  assert.deepEqual(short.before, short.after);
});
void test('Accept, reject and undo preserve immutable receipts and historical plan snapshots', () => {
  let s = propose(createDemo('Low energy day'));
  const receipt = structuredClone(s.receipts![0]),
    original = structuredClone(s.plans[0]);
  assert.equal(s.plans.length, 1);
  s = decide(s);
  assert.equal(s.plans.length, 2);
  assert.deepEqual(s.receipts![0], receipt);
  s = applyAction(s, { type: 'undoAdaptation', receiptId: receipt.receiptId });
  assert.equal(s.plans.length, 3);
  assert.deepEqual(s.plans.at(-1)!.days, original.days);
  assert.deepEqual(s.receipts![0], receipt);
  assert.equal(receiptStatus(s, receipt.receiptId), 'undone');
  let rejected = propose(createDemo('Low energy day'));
  rejected = decide(rejected, 'rejected');
  assert.equal(rejected.plans.length, 1);
  assert.equal(rejected.decisions![0].decision, 'rejected');
  assert.throws(() => decide(rejected), /already/);
});
void test('Stale proposals cannot overwrite newer readiness, profile or workout data', () => {
  const s = propose(createDemo('Low energy day'));
  const changed = applyAction(s, {
    type: 'readiness',
    readiness: { ...s.readiness![0], energy: 4 },
  });
  assert.throws(() => decide(changed), /changed/);
  const profile = applyAction(s, {
    type: 'profile',
    profile: { ...s.profile!, avoid: 'squat' },
  });
  assert.throws(() => decide(profile), /changed/);
});
void test('Undo waits for an active workout and preserves completed logs', () => {
  let s = decide(propose(createDemo('Low energy day')));
  s = applyAction(s, { type: 'start', dayIndex: 0 });
  assert.throws(
    () =>
      applyAction(s, {
        type: 'undoAdaptation',
        receiptId: s.receipts![0].receiptId,
      }),
    /active workout/,
  );
});
void test('Undo after completion retains the workout prescription and its original plan', () => {
  let s = decide(propose(createDemo('Low energy day')));
  s = applyAction(s, { type: 'start', dayIndex: 0 });
  const originalPlanId = s.sessions[0].planId,
    prescription = structuredClone(s.sessions[0].prescribed);
  s = applyAction(s, {
    type: 'finish',
    sessionId: s.sessions[0].id,
    confirmed: true,
  });
  s = applyAction(s, {
    type: 'undoAdaptation',
    receiptId: s.receipts![0].receiptId,
  });
  assert.equal(s.sessions[0].planId, originalPlanId);
  assert.deepEqual(s.sessions[0].prescribed, prescription);
  assert.notEqual(s.plans.at(-1)!.id, originalPlanId);
});
void test('Pain reporting stops affected sets, preserves completed history and survives export', () => {
  let s = applyAction(createDemo(), { type: 'start', dayIndex: 0 });
  const id = s.sessions[0].id,
    exercise = s.sessions[0].sets[0].exercise;
  s = applyAction(s, {
    type: 'set',
    sessionId: id,
    index: 0,
    set: { reps: 8, load: 0, rpe: 7, done: true, skipped: false },
  });
  s = applyAction(s, {
    type: 'pain',
    sessionId: id,
    exercise,
    severity: 'pain',
    note: 'Example discomfort',
  });
  assert.equal(s.sessions[0].sets[0].done, true);
  assert.ok(
    s.sessions[0].sets
      .filter((x) => x.exercise === exercise && !x.done)
      .every((x) => x.skipped),
  );
  assert.throws(
    () =>
      applyAction(s, {
        type: 'set',
        sessionId: id,
        index: 1,
        set: { reps: 8, load: 0, done: true, skipped: false },
      }),
    /stopped/,
  );
  assert.match(exportCsv(s), /Example discomfort/);
});
void test('Urgent symptoms pause every movement and cannot be cleared through a normal check-in', () => {
  let s = applyAction(createDemo(), { type: 'start', dayIndex: 0 });
  s = applyAction(s, {
    type: 'pain',
    sessionId: s.sessions[0].id,
    exercise: s.sessions[0].sets[0].exercise,
    severity: 'urgent',
    note: 'Fictional urgent flag',
  });
  assert.ok(s.sessions[0].sets.every((x) => x.skipped));
  assert.throws(
    () => applyAction(s, { type: 'safety', accepted: true, status: 'clear' }),
    /cannot be cleared/,
  );
  assert.throws(
    () => applyAction(s, { type: 'plan', confirmed: true }),
    /urgent/,
  );
});
void test('Consent and screening gate legacy profiles without deleting their data', () => {
  const s = createDemo();
  delete s.consents;
  delete s.safetyScreens;
  assert.throws(
    () => applyAction(s, { type: 'plan', confirmed: true }),
    /notice/,
  );
  const normalized = normalizedState(s);
  assert.deepEqual(normalized.plans, s.plans);
  assert.deepEqual(normalized.consents, []);
  assert.throws(
    () => applyAction(s, { type: 'safety', accepted: false, status: 'clear' }),
    /Accept/,
  );
});
void test('Weekly reviews and complete JSON-compatible CSV retain missing-data distinctions', () => {
  let s = createDemo('Experienced lifter');
  const summary = weeklySummary(s);
  assert.equal(summary.complete, 2);
  assert.equal(summary.weightChange, null);
  s = applyAction(s, {
    type: 'weeklyReview',
    barrier: 'Time',
    nutritionDays: 3,
    reflection: 'A shorter session helps',
  });
  assert.equal(s.reviews![0].summary.complete, 2);
  assert.match(exportCsv(s), /A shorter session helps/);
  assert.deepEqual(
    applyAction(s, { type: 'deleteData', confirmation: 'DELETE' }),
    emptyState(),
  );
});

void test('Exclusions cannot silently remove an entire required movement pattern', () => {
  const s = createDemo();
  assert.throws(
    () => generatePlan({ ...s.profile!, avoid: 'squat' }),
    /missing movement pattern/,
  );
});
void test('Manual shorter sessions reduce volume without removing patterns and reject no-op repeats', () => {
  let s = createDemo();
  const original = s.plans[0].days[0].exercises;
  s = applyAction(s, { type: 'shorten', dayIndex: 0, confirmed: true });
  assert.deepEqual(
    s.plans.at(-1)!.days[0].exercises.map((e) => e.pattern),
    original.map((e) => e.pattern),
  );
  assert.ok(s.plans.at(-1)!.days[0].exercises.every((e) => e.sets === 1));
  assert.equal(s.decisions!.at(-1)!.decision, 'accepted');
  assert.throws(
    () => applyAction(s, { type: 'shorten', dayIndex: 0, confirmed: true }),
    /minimum volume/,
  );
});

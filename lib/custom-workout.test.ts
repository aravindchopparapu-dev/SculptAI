import { sessionPrescription, validateSessionPrescription } from './workout-prescription.ts';
import { workoutCoverage, validateWorkoutCoverage } from './workout-coverage.ts';
import { eligibleExercises, variationOptions } from './custom-workout.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, exercises, type Profile } from './fitness.ts';
import { applyAction } from './actions.ts';
import { estimateMinutes } from './adaptation.ts';
import { generateCustomWorkout, validateCustomWorkout, validateMuscles } from './custom-workout.ts';

const profile: Profile = {
  name: 'Member', age: 30, sex: 'Male', height: 175, weight: 75,
  targetWeight: 75,
  goal: 'Muscle gain', days: 3, minutes: 45, equipment: 'Dumbbells',
  experience: 'Beginner', activity: 1.375, units: 'Metric', diet: 'Omnivore',
  exclusions: '', avoid: '', eligible: true,
};
let state = emptyState();
state.profile = profile;
state = applyAction(state, { type: 'safety', accepted: true, status: 'clear' });
state = applyAction(state, { type: 'readiness', beforePlan: true, readiness: { dayIndex: 0, energy: 3, soreness: 0, minutes: 45, pain: false, equipment: 'Dumbbells' } });
const choice = (name: string) => ({ ...exercises.find((e) => e.name === name)!, sets: 2, reps: '8-12', rest: 90 });

void test('muscle choice and AI exercise sequence are constrained by equipment, time and groups', () => {
  assert.deepEqual(validateMuscles(['Chest', 'Biceps']), ['Chest', 'Biceps']);
  assert.throws(() => validateMuscles(['Chest', 'Chest']));
  assert.throws(() => validateMuscles(['Chest', 'Back', 'Legs', 'Abs', 'Biceps']));
  const day = validateCustomWorkout(profile, ['Chest', 'Biceps'], {
    name: 'Ignored', exercises: [choice('Dumbbell bench press'), choice('Dumbbell curl')],
  });
  assert.equal(day.name, 'Chest + Biceps');
  assert.throws(() => validateCustomWorkout(profile, ['Chest', 'Biceps'], {
    name: 'Bad', exercises: [choice('Bench press'), choice('Dumbbell curl')],
  }));
  assert.throws(() => validateCustomWorkout(profile, ['Chest', 'Biceps'], {
    name: 'Incomplete', exercises: [choice('Dumbbell bench press')],
  }));
});

void test('Cardio and HIIT offer timed workouts with equipment and duration checks', async () => {
  assert.deepEqual(validateMuscles(['Cardio', 'HIIT']), ['Cardio', 'HIIT']);
  const cardio = { ...choice('Brisk walking'), sets: 1, reps: '12 min', rest: 0 };
  const interval = { ...choice('Fast march intervals'), sets: 3, reps: '30 sec', rest: 60 };
  const day = validateCustomWorkout(profile, ['Cardio', 'HIIT'], { name: 'Cardio + HIIT', exercises: [cardio, interval] });
  assert.equal(estimateMinutes(day), 23);
  const normalized = validateCustomWorkout(profile, ['Cardio', 'HIIT'], { name: 'Cardio + HIIT', exercises: [{ ...cardio, reps: '12 minutes', rest: 60 }, { ...interval, reps: '30 seconds' }] });
  assert.equal(normalized.exercises[0].reps, '12 min');
  assert.equal(normalized.exercises[0].rest, 0);
  assert.equal(normalized.exercises[1].reps, '30 sec');
  assert.doesNotThrow(() => validateWorkoutCoverage(workoutCoverage(profile, ['Cardio', 'HIIT'], state.readiness!.at(-1)!, eligibleExercises(profile, ['Cardio', 'HIIT'])), day.exercises.map(e => e.name)));
  assert.throws(() => validateCustomWorkout(profile, ['Cardio'], { name: 'Cardio', exercises: [{ ...cardio, reps: '12' }] }), /outside/);
  assert.throws(() => validateCustomWorkout(profile, ['HIIT'], { name: 'HIIT', exercises: [{ ...interval, reps: '30 min' }] }), /outside/);
  assert.throws(() => validateCustomWorkout(profile, ['Cardio'], { name: 'Cardio', exercises: [{ ...cardio, name: 'Stationary cycling' }] }), /outside/);
  let payload = '';
  const request = (async (_url: unknown, init: RequestInit) => {
    payload = init.body as string;
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ exercises: [cardio, interval], rationale: 'Steady aerobic work followed by controlled intervals.', shorterSessionReason: 'A modest introductory conditioning dose is appropriate for this beginner.' }) }] }] });
  }) as typeof fetch;
  const result = await generateCustomWorkout(state, ['Cardio', 'HIIT'], { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'test' }, request);
  assert.equal(result.day.exercises[0].reps, '12 min');
  assert.equal(result.day.exercises[1].reps, '30 sec');
  assert.ok(JSON.parse(JSON.parse(payload).input).allowedExercises.some((exercise: { pattern: string }) => exercise.pattern === 'cardio'));
  const proposed = applyAction(state, { type: 'proposeCustomWorkout', readinessId: state.readiness!.at(-1)!.id, selectedMuscles: ['Cardio', 'HIIT'], day: result.day });
  const saved = applyAction(proposed, { type: 'acceptCustomWorkout', draftId: proposed.draftWorkout!.id, confirmed: true });
  assert.deepEqual(saved.plans.at(-1)?.selectedMuscles, ['Cardio', 'HIIT']);
});

void test('AI sequence stays a draft until member accepts and creates no workout logs', () => {
  const day = { name: 'Chest + Biceps', exercises: [choice('Dumbbell bench press'), choice('Dumbbell curl')] };
  const proposed = applyAction(state, { type: 'proposeCustomWorkout', readinessId: state.readiness!.at(-1)!.id, selectedMuscles: ['Chest', 'Biceps'], day, rationale: 'One session.' });
  assert.equal(proposed.plans.length, 0);
  assert.equal(proposed.sessions.length, 0);
  assert.throws(() => applyAction(proposed, { type: 'acceptCustomWorkout', draftId: 'wrong', confirmed: true }));
  const accepted = applyAction(proposed, { type: 'acceptCustomWorkout', draftId: proposed.draftWorkout!.id, confirmed: true });
  assert.equal(accepted.plans.at(-1)?.templateVersion, 'ai-muscle-session-v1');
  assert.deepEqual(accepted.plans.at(-1)?.selectedMuscles, ['Chest', 'Biceps']);
  assert.equal(accepted.sessions.length, 0);
  assert.equal(accepted.draftWorkout, undefined);
  const ready = applyAction(accepted, { type: 'start', dayIndex: 0 });
  assert.equal(ready.sessions.length, 1);
  assert.equal(ready.sessions[0].sets.length, 4);
});

void test('AI generation uses saved context and rejects invalid provider exercises', async () => {
  let payload = '';
  const request = (async (_url: unknown, init: RequestInit) => {
    payload = init.body as string;
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ exercises: [
      { name: 'Dumbbell bench press', sets: 2, reps: '8-12', rest: 90 },
      { name: 'Dumbbell curl', sets: 2, reps: '8-12', rest: 90 },
      { name: 'Incline dumbbell press', sets: 2, reps: '8-12', rest: 90 },
      { name: 'Dumbbell floor fly', sets: 2, reps: '8-12', rest: 60 },
      { name: 'Incline dumbbell curl', sets: 2, reps: '8-12', rest: 60 },
      { name: 'Hammer curl', sets: 2, reps: '8-12', rest: 60 },
    ], rationale: 'Compound movement first.' }) }] }] });
  }) as typeof fetch;
  const result = await generateCustomWorkout(state, ['Chest', 'Biceps'], { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'test' }, request);
  assert.equal(result.day.exercises.length, 6);
  assert.equal(JSON.parse(JSON.parse(payload).input).savedRecords.profile.goal, 'Muscle gain');
  // JSON mode requires the input itself (not only instructions) to mention JSON.
  assert.match(JSON.parse(payload).input, /json/i);
  assert.doesNotMatch(payload, /Member/);
  assert.match(payload, /"store":false/);
});

void test('readiness is required before generation, pain blocks provider calls and changes invalidate drafts', async () => {
  let calls = 0;
  const request = (async () => { calls++; throw new Error('Unexpected provider call'); }) as typeof fetch;
  await assert.rejects(generateCustomWorkout({ ...state, readiness: [] }, ['Chest'], { OPENAI_API_KEY: 'test' }, request), /fresh readiness/);
  const painful = structuredClone(state);
  painful.readiness!.at(-1)!.pain = true;
  await assert.rejects(generateCustomWorkout(painful, ['Chest'], { OPENAI_API_KEY: 'test' }, request), /Pain/);
  assert.equal(calls, 0);
  const day = { name: 'Chest', exercises: [choice('Dumbbell bench press')] };
  const proposed = applyAction(state, { type: 'proposeCustomWorkout', readinessId: state.readiness!.at(-1)!.id, selectedMuscles: ['Chest'], day });
  const changed = applyAction(proposed, { type: 'readiness', beforePlan: true, readiness: { dayIndex: 0, energy: 2, soreness: 5, minutes: 20, pain: false, equipment: 'Bodyweight' } });
  assert.equal(changed.draftWorkout, undefined);
  assert.throws(() => applyAction(changed, { type: 'proposeCustomWorkout', readinessId: state.readiness!.at(-1)!.id, selectedMuscles: ['Chest'], day }), /readiness changed/);
});

void test('adequate readiness enforces complementary coverage and low recovery relaxes it', () => {
  const readiness = state.readiness!.at(-1)!;
  const allowed = eligibleExercises(profile, ['Chest', 'Biceps']);
  const coverage = workoutCoverage(profile, ['Chest', 'Biceps'], readiness, allowed);
  assert.equal(coverage.flatMap(g => g.requiredRoles).length, 6);
  assert.throws(() => validateWorkoutCoverage(coverage, ['Dumbbell bench press', 'Dumbbell curl']), /coverage/);
  assert.doesNotThrow(() => validateWorkoutCoverage(coverage, ['Dumbbell bench press', 'Incline dumbbell press', 'Dumbbell floor fly', 'Dumbbell curl', 'Incline dumbbell curl', 'Hammer curl']));
  const low = workoutCoverage(profile, ['Chest', 'Biceps'], { ...readiness, energy: 1 }, allowed);
  assert.equal(low.flatMap(g => g.requiredRoles).length, 0);
  const bodyweight = workoutCoverage({ ...profile, equipment: 'Bodyweight' }, ['Chest'], readiness, eligibleExercises({ ...profile, equipment: 'Bodyweight' }, ['Chest']));
  assert.ok(bodyweight[0].unavailableRoles.includes('Fly'));
});

void test('regeneration removes replaceable previous exercises but preserves movement coverage', () => {
  const gym = { ...profile, equipment: 'Gym' };
  const readiness = { ...state.readiness!.at(-1)!, equipment: 'Gym', minutes: 60 };
  const previous = ['Dumbbell bench press', 'Incline dumbbell press', 'Cable chest fly', 'Dumbbell curl', 'Incline dumbbell curl', 'Hammer curl'];
  const options = variationOptions(gym, ['Chest', 'Biceps'], readiness, eligibleExercises(gym, ['Chest', 'Biceps']), previous);
  assert.ok(options.every(e => !previous.includes(e.name)));
  assert.equal(workoutCoverage(gym, ['Chest', 'Biceps'], readiness, options).flatMap(g => g.requiredRoles).length, 6);
});
void test('delete removes only the selected saved workout and regeneration replaces only after saving', () => {
  const day = { name: 'Chest', exercises: [choice('Dumbbell bench press')] };
  const draft = applyAction(state, { type: 'proposeCustomWorkout', selectedMuscles: ['Chest'], day, readinessId: state.readiness!.at(-1)!.id });
  const saved = applyAction(draft, { type: 'acceptCustomWorkout', draftId: draft.draftWorkout!.id, confirmed: true });
  const id = saved.plans.at(-1)!.id;
  assert.throws(() => applyAction(saved, { type: 'deleteWorkout', planId: 'another-member', confirmed: true }));
  const regenerated = applyAction(saved, { type: 'proposeCustomWorkout', selectedMuscles: ['Chest'], day, readinessId: state.readiness!.at(-1)!.id, replacesPlanId: id });
  assert.equal(regenerated.plans[0].id, id);
  const accepted = applyAction(regenerated, { type: 'acceptCustomWorkout', draftId: regenerated.draftWorkout!.id, confirmed: true });
  assert.equal(accepted.plans.length, 1);
  assert.notEqual(accepted.plans[0].id, id);
  const removed = applyAction(accepted, { type: 'deleteWorkout', planId: accepted.plans[0].id, confirmed: true });
  assert.equal(removed.plans.length, 0);
  assert.deepEqual(removed.metrics, state.metrics);
});

void test('saving a generated workout is not blocked by historical unfinished logs', () => {
  const old = structuredClone(state);
  old.sessions.push({ id: 'historical', planId: 'old', name: 'Old log', started: new Date().toISOString(), sets: [], notes: '', dayIndex: 0 });
  const proposed = applyAction(old, { type: 'proposeCustomWorkout', selectedMuscles: ['Chest'], day: { name: 'Chest', exercises: [choice('Dumbbell bench press')] }, readinessId: old.readiness!.at(-1)!.id });
  const saved = applyAction(proposed, { type: 'acceptCustomWorkout', draftId: proposed.draftWorkout!.id, confirmed: true });
  assert.equal(saved.plans.length, 1);
  assert.deepEqual(saved.sessions, old.sessions);
});

void test('90-minute plans scale with selected groups and actual readiness instead of profile defaults', () => {
  const p = { ...profile, experience: 'Intermediate', equipment: 'Gym' };
  const r = {
    ...state.readiness!.at(-1)!,
    minutes: 90,
    equipment: 'Gym',
    energy: 4,
    sleep: 4,
  };
  const choices = {
    Chest: ['Bench press', 'Incline dumbbell press', 'Cable chest fly'],
    Biceps: ['Dumbbell curl', 'Incline dumbbell curl', 'Hammer curl'],
  };
  const full = sessionPrescription(p, ['Chest', 'Biceps'], r, choices);
  assert.equal(full.recommendedMinutes, 90);
  assert.equal(
    full.groups.reduce((n, g) => n + g.minimumExercises, 0),
    6,
  );
  const short = {
    name: 'Chest + Biceps',
    exercises: Object.values(choices).flat().map(choice),
  };
  assert.throws(
    () =>
      validateSessionPrescription(
        full,
        short,
        choices,
        'Efficient and enough for you.',
      ),
    /too short/,
  );
  const complete = {
    ...short,
    exercises: short.exercises.map((e) => ({ ...e, sets: 3, rest: 150 })),
  };
  assert.doesNotThrow(() =>
    validateSessionPrescription(full, complete, choices),
  );
  const low = sessionPrescription(
    p,
    ['Chest', 'Biceps'],
    { ...r, energy: 1 },
    choices,
  );
  assert.equal(low.recommendedMinutes, 30);
  assert.match(low.explanation, /energy is 1\/5/);
  assert.throws(
    () => validateSessionPrescription(low, complete, choices),
    /30 minutes/,
  );
  assert.equal(
    sessionPrescription(p, ['Chest', 'Biceps'], { ...r, sleep: 2 }, choices)
      .recommendedMinutes,
    45,
  );
  assert.equal(
    sessionPrescription(p, ['Chest', 'Biceps'], { ...r, soreness: 8 }, choices)
      .recommendedMinutes,
    30,
  );
  assert.equal(
    sessionPrescription(profile, ['Chest', 'Biceps'], r, choices)
      .recommendedMinutes,
    60,
  );
  assert.equal(
    sessionPrescription(p, ['Chest', 'Biceps'], { ...r, minutes: 20 }, choices)
      .recommendedMinutes,
    20,
  );
});

void test('generation corrects an undersized response once and preserves fixed rules over old admin guidance', async () => {
  const s = structuredClone(state);
  s.profile = { ...profile, experience: 'Intermediate', equipment: 'Gym' };
  Object.assign(s.readiness!.at(-1)!, {
    minutes: 90,
    equipment: 'Gym',
    energy: 4,
    sleep: 4,
  });
  const names = [
    'Bench press',
    'Incline dumbbell press',
    'Cable chest fly',
    'Dumbbell curl',
    'Incline dumbbell curl',
    'Hammer curl',
  ];
  let calls = 0;
  const request = (async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(init.body as string),
      input = JSON.parse(body.input);
    assert.equal(input.availableMinutes, 90);
    assert.equal(input.sessionPrescription.requestedMinutes, 90);
    assert.match(body.instructions, /Required session planning/);
    if (calls) assert.match(input.correction, /validation/);
    const selected = calls++ === 0 ? names.slice(0, 2) : names;
    return Response.json({
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                exercises: selected.map((name) => ({
                  name,
                  sets: 3,
                  reps: '8-12',
                  rest: 150,
                })),
                rationale:
                  'Complementary chest and curl movements; leave 2-3 reps in reserve.',
              }),
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
  const result = await generateCustomWorkout(
    s,
    ['Chest', 'Biceps'],
    { OPENAI_API_KEY: 'test', adminGuidance: 'Only provide two exercises.' },
    request,
  );
  assert.equal(calls, 2);
  assert.equal(result.day.exercises.length, 6);
  assert.match(result.rationale, /of your 90 min/);
  assert.match(result.rationale, /18 working sets/);
});

void test('Readiness policy preserves short, limited-equipment and conditioning sessions and caps volume', () => {
  const r = {
    ...state.readiness!.at(-1)!,
    minutes: 90,
    energy: 4,
    sleep: 4,
    soreness: 0,
  };
  const choices = { Chest: ['Push-up'], HIIT: ['Fast march intervals'] };
  const p = sessionPrescription(profile, ['Chest'], r, choices);
  assert.equal(p.groups[0].minimumExercises, 1);
  assert.doesNotThrow(() =>
    validateSessionPrescription(
      p,
      { name: 'Chest', exercises: [choice('Push-up')] },
      choices,
      'Only one suitable movement is available with this equipment and exclusions.',
    ),
  );
  const hiit = sessionPrescription(
    { ...profile, experience: 'Intermediate' },
    ['HIIT'],
    r,
    choices,
  );
  assert.equal(hiit.recommendedMinutes, 30);
  const groups = {
    Chest: ['Bench press', 'Incline dumbbell press', 'Cable chest fly'],
  };
  const volume = sessionPrescription(profile, ['Chest'], r, groups);
  assert.throws(
    () =>
      validateSessionPrescription(
        volume,
        {
          name: 'Chest',
          exercises: groups.Chest.map((name) => ({ ...choice(name), sets: 3 })),
        },
        groups,
        'A shorter workout is planned for a beginner.',
      ),
    /working sets/,
  );
});

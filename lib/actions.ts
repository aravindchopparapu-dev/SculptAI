import {
  emptyState,
  exercises,
  generatePlan,
  nutrition,
  num,
  validateMetric,
  validateProfile,
  type State,
  type Profile,
  type Metric,
  type Plan,
} from './fitness.ts';

export type Action = { type: string; [key: string]: unknown };
export class InputError extends Error {}
export function availableExercises(profile: Profile, pattern?: string) {
  const avoid = profile.avoid
    .toLowerCase()
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return exercises.filter(
    (e) =>
      (!pattern || e.pattern === pattern) &&
      (e.equipment === 'Bodyweight' ||
        e.equipment === profile.equipment ||
        profile.equipment === 'Gym') &&
      !avoid.some((a) => e.name.toLowerCase().includes(a)),
  );
}
export function makePlanPreview(state: State, action: Action): Plan {
  if (!state.profile) throw new InputError('Complete your profile first.');
  const old = state.plans.at(-1);
  if (action.type === 'plan')
    return generatePlan(state.profile, (old?.version || 0) + 1);
  if (!old) throw new InputError('Create a training plan first.');
  const next = structuredClone(old);
  next.id = crypto.randomUUID();
  next.created = new Date().toISOString();
  next.version = old.version + 1;
  const dayIndex = num(
    action.dayIndex,
    'Training day',
    0,
    next.days.length - 1,
  );
  if (!Number.isInteger(dayIndex))
    throw new InputError('Choose a training day.');
  if (action.type === 'shorten') {
    next.days[dayIndex].exercises = next.days[dayIndex].exercises
      .slice(0, 3)
      .map((e) => ({ ...e, sets: Math.min(2, e.sets) }));
  } else if (action.type === 'substitute') {
    const index = num(
      action.exerciseIndex,
      'Exercise',
      0,
      next.days[dayIndex].exercises.length - 1,
    );
    if (!Number.isInteger(index)) throw new InputError('Choose an exercise.');
    const previous = next.days[dayIndex].exercises[index];
    const replacement = availableExercises(
      state.profile,
      previous.pattern,
    ).find((e) => e.name === action.exercise);
    if (
      !replacement ||
      next.days[dayIndex].exercises.some((e) => e.name === replacement.name)
    )
      throw new InputError('Choose a different compatible exercise.');
    next.days[dayIndex].exercises[index] = { ...previous, ...replacement };
  } else throw new InputError('Unknown plan change.');
  return next;
}
export function applyAction(input: State, action: Action): State {
  const state = structuredClone(input);
  if (action.type === 'deleteData') {
    if (action.confirmation !== 'DELETE')
      throw new InputError('Confirm deletion by typing DELETE.');
    return emptyState();
  }
  if (action.type === 'profile') {
    state.profile = validateProfile(action.profile as Profile);
    return state;
  }
  if (!state.profile) throw new InputError('Complete your profile first.');
  if (['plan', 'shorten', 'substitute'].includes(action.type)) {
    if (action.confirmed !== true)
      throw new InputError('Review and confirm the plan change first.');
    state.plans.push(makePlanPreview(state, action));
  } else if (action.type === 'metric') {
    const m = action.metric as Metric;
    if (!m || typeof m !== 'object') throw new InputError('Enter a check-in.');
    validateMetric(m);
    const clean = Object.fromEntries(
      [
        'date',
        'weight',
        'waist',
        'bodyFat',
        'fatMass',
        'leanMass',
        'muscleMass',
        'bmr',
        'visceral',
        'ecw',
        'source',
        'notes',
      ]
        .filter((k) => m[k as keyof Metric] !== undefined)
        .map((k) => [k, m[k as keyof Metric]]),
    ) as Metric;
    if (m.id) {
      const index = state.metrics.findIndex((x) => x.id === m.id);
      if (index < 0) throw new InputError('Check-in not found.');
      state.metrics[index] = { ...clean, id: m.id };
    } else state.metrics.push({ ...clean, id: crypto.randomUUID() });
    state.metrics.sort((a, b) => a.date.localeCompare(b.date));
  } else if (action.type === 'deleteMetric') {
    if (action.confirmed !== true)
      throw new InputError('Confirm removing this check-in.');
    if (!state.metrics.some((x) => x.id === action.id))
      throw new InputError('Check-in not found.');
    state.metrics = state.metrics.filter((x) => x.id !== action.id);
  } else if (action.type === 'start') {
    if (state.sessions.some((s) => !s.completed))
      throw new InputError('Resume or finish your active workout first.');
    const plan = state.plans.at(-1);
    if (!plan) throw new InputError('Create a training plan first.');
    const day = num(action.dayIndex, 'Training day', 0, plan.days.length - 1);
    if (!Number.isInteger(day)) throw new InputError('Choose a training day.');
    state.sessions.push({
      id: crypto.randomUUID(),
      planId: plan.id,
      dayIndex: day,
      name: plan.days[day].name,
      started: new Date().toISOString(),
      notes: '',
      sets: plan.days[day].exercises.flatMap((e) =>
        Array.from({ length: e.sets }, (_, index) => ({
          exercise: e.name,
          index,
          reps: 0,
          load: 0,
          done: false,
          skipped: false,
        })),
      ),
    });
  } else if (
    action.type === 'set' ||
    action.type === 'sessionNotes' ||
    action.type === 'finish'
  ) {
    const session = state.sessions.find((s) => s.id === action.sessionId);
    if (!session) throw new InputError('Workout not found.');
    if (session.completed)
      throw new InputError('This workout has already been finished.');
    if (action.type === 'set') {
      const index = num(action.index, 'Set', 0, session.sets.length - 1);
      if (!Number.isInteger(index)) throw new InputError('Choose a set.');
      const patch = action.set as {
        reps: number;
        load: number;
        rpe?: number;
        done: boolean;
        skipped?: boolean;
      };
      if (
        !patch ||
        typeof patch.done !== 'boolean' ||
        typeof patch.skipped !== 'boolean' ||
        (patch.done && patch.skipped)
      )
        throw new InputError('Choose a valid set status.');
      num(patch.reps, 'Repetitions', patch.done ? 1 : 0, 100);
      if (!Number.isInteger(patch.reps))
        throw new InputError('Repetitions must be a whole number.');
      num(patch.load, 'Load in kg', 0, 600);
      if (patch.rpe !== undefined) num(patch.rpe, 'Effort (RPE)', 1, 10);
      session.sets[index] = {
        ...session.sets[index],
        reps: patch.reps,
        load: patch.load,
        rpe: patch.rpe,
        done: patch.done,
        skipped: patch.skipped,
      };
    } else if (action.type === 'sessionNotes') {
      if (typeof action.notes !== 'string' || action.notes.length > 1000)
        throw new InputError('Keep workout notes under 1,000 characters.');
      session.notes = action.notes;
    } else {
      if (action.confirmed !== true)
        throw new InputError('Confirm finishing this workout.');
      session.completed = new Date().toISOString();
      session.status = session.sets.every((s) => s.done)
        ? 'complete'
        : 'partial';
    }
  } else if (action.type === 'nutrition') {
    if (action.confirmed !== true)
      throw new InputError('Review and confirm your target first.');
    const latestWeight = state.metrics.at(-1)?.weight;
    state.targets.push(
      nutrition({
        ...state.profile,
        weight: latestWeight ?? state.profile.weight,
      }),
    );
  } else throw new InputError('Unknown action.');
  // Prevent unbounded documents from exhausting the Worker. Export stays available.
  if (JSON.stringify(state).length > 1_500_000)
    throw new InputError(
      'Your history has reached this beta’s storage limit. Export your data and contact support.',
    );
  return state;
}

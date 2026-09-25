import { validateMealFoods, validateMealDraft, mealPlanContext } from './meal-plan.ts';
import { applyAdaptiveAction, recordManualChange } from './adaptive-actions.ts';
import {
  assertCleared,
  normalizedState,
  validateDays,
  estimateMinutes,
  compatible,
} from './adaptation.ts';
import {
  emptyState,
  exercises,
  generatePlan,
  num,
  validateMetric,
  validateProfile,
  type State,
  type Profile,
  type Metric,
  type Plan,
} from './fitness.ts';
import { validateCustomWorkout, validateMuscles, workoutReadiness } from './custom-workout.ts';
import { applyCoachFuelReview, applyCoachTimeline, syncFuelTarget } from './fuel-adaptation.ts';

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
    if (next.days[dayIndex].exercises.every((e) => e.sets === 1))
      throw new InputError(
        'This session is already at the minimum volume. Keep its warm-up and rest.',
      );
    next.days[dayIndex].exercises = next.days[dayIndex].exercises.map((e) => ({
      ...e,
      sets: Math.max(1, e.sets - 1),
    }));
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
  const state = normalizedState(structuredClone(input));
  if (action.type === 'deleteData') {
    if (action.confirmation !== 'DELETE')
      throw new InputError('Confirm deletion by typing DELETE.');
    return emptyState();
  }
  if (action.type === 'profilePhoto') {
    if (action.photo === null) {
      delete state.profilePhoto;
    } else if (typeof action.photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(action.photo) && action.photo.length <= 16000) {
      state.profilePhoto = action.photo;
    } else {
      throw new InputError('Choose a JPG, PNG or WebP photo under 10 MB.');
    }
    return state;
  }
  if (action.type === 'profile') {
    state.profile = validateProfile(action.profile as Profile);
    state.draftWorkout = undefined;
    syncFuelTarget(state);
    return state;
  }
  if (!state.profile) throw new InputError('Complete your profile first.');
  if (action.type === 'mealFoods') {
    state.mealFoods = validateMealFoods(action.foods);
  } else if (action.type === 'generatedMealPlan') {
    const context = mealPlanContext(state);
    if (action.contextKey !== context.contextKey) throw new InputError('Your foods or Fuel targets changed. Generate a fresh meal plan.');
    const plan = validateMealDraft(state, action.draft);
    state.mealPlan = { ...plan, id: crypto.randomUUID(), created: new Date().toISOString(), contextKey: context.contextKey };
  } else if (action.type === 'proposeCustomWorkout') {
    const readiness = workoutReadiness(state);
    if (action.readinessId !== readiness.id) throw new InputError('Your readiness changed. Generate a new workout.');
    const todayProfile = { ...state.profile, minutes: readiness.minutes, equipment: readiness.equipment };
    const selectedMuscles = validateMuscles(action.selectedMuscles);
    const day = validateCustomWorkout(todayProfile, selectedMuscles, action.day as Plan['days'][number]);
    state.draftWorkout = {
      id: crypto.randomUUID(), created: new Date().toISOString(),
      selectedMuscles, day, readinessId: readiness.id,
      replacesPlanId: typeof action.replacesPlanId === 'string' ? action.replacesPlanId : undefined,
      rationale: typeof action.rationale === 'string' ? action.rationale.slice(0, 1600) : '',
      profile: structuredClone(state.profile),
    };
  } else if (action.type === 'deleteWorkout') {
    if (action.confirmed !== true || !state.plans.some(p => p.id === action.planId)) throw new InputError('Choose a saved workout to delete.');
    state.plans = state.plans.filter(p => p.id !== action.planId);
    if (state.draftWorkout?.replacesPlanId === action.planId) state.draftWorkout = undefined;
  } else if (action.type === 'acceptCustomWorkout') {
    const draft = state.draftWorkout;
    if (!draft || action.draftId !== draft.id || action.confirmed !== true)
      throw new InputError('Review the latest AI workout before saving it.');
    if (JSON.stringify(draft.profile) !== JSON.stringify(state.profile))
      throw new InputError('Your profile changed. Generate a new workout.');
    const readiness = workoutReadiness(state);
    if (draft.readinessId !== readiness.id) throw new InputError('Your readiness changed. Generate a new workout.');
    const selectedMuscles = validateMuscles(draft.selectedMuscles);
    const day = validateCustomWorkout({ ...state.profile, minutes: readiness.minutes, equipment: readiness.equipment }, selectedMuscles, draft.day);
    if (draft.replacesPlanId && !state.plans.some(p => p.id === draft.replacesPlanId)) throw new InputError('The original workout was removed. Generate a new workout.');
    const nextVersion = (state.plans.at(-1)?.version ?? 0) + 1;
    state.plans = state.plans.filter(p => p.id !== draft.replacesPlanId);
    state.plans.push({
      id: crypto.randomUUID(), version: nextVersion,
      created: new Date().toISOString(), inputs: structuredClone(state.profile),
      templateVersion: 'ai-muscle-session-v1', selectedMuscles, readinessId: readiness.id,
      days: [day],
    });
    state.draftWorkout = undefined;
  } else if (applyAdaptiveAction(state, action)) {
    // Every extended action uses this same size-limited transaction.
  } else if (['plan', 'shorten', 'substitute'].includes(action.type)) {
    assertCleared(state);
    if (state.sessions.some((s) => !s.completed))
      throw new InputError(
        'Finish your active workout before changing the plan.',
      );
    if (
      action.expectedPlanId !== undefined &&
      action.expectedPlanId !== state.plans.at(-1)?.id
    )
      throw new InputError('The plan changed. Review the new preview first.');
    if (action.confirmed !== true)
      throw new InputError('Review and confirm the plan change first.');
    const next = makePlanPreview(state, action);
    validateDays(next.days, state.profile);
    recordManualChange(state, state.plans.at(-1), next, action);
    state.plans.push(next);
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
    syncFuelTarget(state);
  } else if (action.type === 'deleteMetric') {
    if (action.confirmed !== true)
      throw new InputError('Confirm removing this check-in.');
    if (!state.metrics.some((x) => x.id === action.id))
      throw new InputError('Check-in not found.');
    state.metrics = state.metrics.filter((x) => x.id !== action.id);
    syncFuelTarget(state);
  } else if (action.type === 'start') {
    assertCleared(state);
    if (state.sessions.some((s) => !s.completed))
      throw new InputError('Resume or finish your active workout first.');
    const plan = state.plans.at(-1);
    if (!plan) throw new InputError('Create a training plan first.');
    const day = num(action.dayIndex, 'Training day', 0, plan.days.length - 1);
    if (!Number.isInteger(day)) throw new InputError('Choose a training day.');
    if (plan.templateVersion === 'ai-muscle-session-v1') {
      const current = workoutReadiness(state);
      if (plan.readinessId && plan.readinessId !== current.id) throw new InputError('Your readiness changed. Generate a workout using your current check-in.');
      validateCustomWorkout({ ...state.profile, minutes: current.minutes, equipment: current.equipment }, validateMuscles(plan.selectedMuscles), plan.days[0]);
    }
    else validateDays(plan.days, state.profile);
    const readiness = state.readiness.at(-1);
    if (
      !readiness ||
      readiness.dayIndex !== day ||
      Date.now() - Date.parse(readiness.createdAt) > 12 * 3600000 ||
      state.sessions.some((s) => s.readinessId === readiness.id)
    )
      throw new InputError(
        'Save a fresh readiness check for this workout first.',
      );
    if (readiness.pain)
      throw new InputError(
        'Pain was reported. Training is paused for this check-in; seek guidance if symptoms persist.',
      );
    if (
      plan.days[day].exercises.some(
        (e) =>
          !compatible(state.profile!, e.pattern, readiness.equipment).some(
            (x) => x.name === e.name,
          ),
      ) ||
      estimateMinutes(plan.days[day]) > readiness.minutes
    )
      throw new InputError(
        'Review an adjustment to fit your available time and equipment before starting.',
      );
    state.sessions.push({
      readinessId: readiness.id,
      prescribed: structuredClone(plan.days[day]),
      painEvents: [],
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
      if (
        session.painEvents?.some(
          (e) =>
            e.severity === 'urgent' ||
            e.exercise === session.sets[index].exercise,
        )
      )
        throw new InputError(
          'This movement is stopped after a pain report. Finish the session or continue unaffected movements.',
        );
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
    if (!state.profile.targetWeight) throw new InputError('Add target weight in Profile first.');
    syncFuelTarget(state);
  } else if (action.type === 'coachFuelReview') {
    applyCoachFuelReview(state, action.delta as number, action.explanation as string);
  } else if (action.type === 'coachTimeline') {
    applyCoachTimeline(state, action.targetId as string, action.minWeeks as number,
      action.maxWeeks as number, action.explanation as string);
  } else if (action.type === 'fuelSync') {
    syncFuelTarget(state);
  } else throw new InputError('Unknown action.');
  // Prevent unbounded documents from exhausting the Worker. Export stays available.
  if (JSON.stringify(state).length > 1_500_000)
    throw new InputError(
      'Your history has reached this beta’s storage limit. Export your data and contact support.',
    );
  return state;
}

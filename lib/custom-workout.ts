import { workoutCoverage, validateWorkoutCoverage } from './workout-coverage.ts';
import { additionalExercises } from './exercise-library.ts';
import { assertCleared, estimateMinutes, normalizedState } from './adaptation.ts';
import { exercises, type Plan, type Profile, type State } from './fitness.ts';
import { WORKOUT_INSTRUCTIONS } from './workout-instructions.ts';
import { effectiveInstructions } from './admin-control.ts';
import { coachContext } from './live-coach.ts';

export const muscleGroups = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Legs', 'Glutes', 'Calves', 'Abs', 'Cardio', 'HIIT',
] as const;
export type MuscleGroup = (typeof muscleGroups)[number];

export const groupExercises: Record<MuscleGroup, string[]> = {
  Chest: ['Push-up', 'Dumbbell bench press', 'Bench press', 'Incline dumbbell press', 'Cable chest fly', 'Dumbbell floor fly'],
  Back: ['Prone W raise', 'Dumbbell row', 'Seated cable row', 'Lat pulldown'],
  Shoulders: ['Pike push-up', 'Dumbbell shoulder press', 'Machine shoulder press', 'Dumbbell lateral raise', 'Dumbbell reverse fly'],
  Biceps: ['Self-resisted curl', 'Dumbbell curl', 'Cable curl', 'Hammer curl', 'Incline dumbbell curl', 'Preacher curl', 'Concentration curl'],
  Triceps: ['Close-grip push-up', 'Overhead triceps extension', 'Cable triceps pushdown'],
  Forearms: ['Self-resisted wrist curl', 'Dumbbell wrist curl', 'Hammer curl'],
  Legs: ['Bodyweight squat', 'Goblet squat', 'Barbell squat', 'Split squat', 'Reverse lunge', 'Dumbbell Romanian deadlift', 'Hamstring walkout'],
  Glutes: ['Glute bridge', 'Dumbbell Romanian deadlift', 'Split squat'],
  Calves: ['Calf raise', 'Dumbbell calf raise'],
  Abs: ['Dead bug', 'Reverse crunch'],
  Cardio: [],
  HIIT: [],
};

for (const exercise of additionalExercises) groupExercises[exercise.group as MuscleGroup].push(exercise.name);

export function validateMuscles(value: unknown): MuscleGroup[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4 ||
      value.some((x) => !muscleGroups.includes(x as MuscleGroup)) ||
      new Set(value).size !== value.length)
    throw new Error('Choose one to four different training options.');
  return value as MuscleGroup[];
}

export function eligibleExercises(profile: Profile, selected: MuscleGroup[], disabledExercises: string[] = []) {
  const avoid = profile.avoid.toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  return exercises.filter((e) =>
    selected.some((group) => groupExercises[group].includes(e.name)) &&
    (e.equipment === 'Bodyweight' || e.equipment === profile.equipment || profile.equipment === 'Gym') &&
    !avoid.some((word) => e.name.toLowerCase().includes(word)) &&
    !disabledExercises.includes(e.name));
}

export function validateCustomWorkout(profile: Profile, selected: MuscleGroup[], day: Plan['days'][number], disabledExercises: string[] = []) {
  if (!day || !Array.isArray(day.exercises) || day.exercises.length < selected.length || day.exercises.length > 12)
    throw new Error('AI Coach returned an invalid workout. Please regenerate it.');
  const eligible = eligibleExercises(profile, selected, disabledExercises);
  const names = new Set<string>();
  const clean: Plan['days'][number] = { name: selected.join(' + '), exercises: [] };
  for (const raw of day.exercises) {
    const e = eligible.find((candidate) => candidate.name === raw.name);
    const cardio = e?.pattern === 'cardio' && typeof raw.reps === 'string' ? /^(\d{1,2})\s*(?:min|mins|minute|minutes)$/i.exec(raw.reps.trim()) : null;
    const hiit = e?.pattern === 'hiit' && typeof raw.reps === 'string' ? /^(\d{1,2})\s*(?:s|sec|secs|second|seconds)$/i.exec(raw.reps.trim()) : null;
    const timed = e?.pattern === 'cardio' ? !!cardio && Number(cardio[1]) >= 5 && Number(cardio[1]) <= 30 && raw.sets === 1
      : e?.pattern === 'hiit' ? !!hiit && [15, 20, 30, 40, 45, 60].includes(Number(hiit[1])) : false;
    const strength = e?.pattern !== 'cardio' && e?.pattern !== 'hiit' && /^(?:[5-9]|1\d|20)(?:[–-](?:[5-9]|1\d|20))?$/.test(raw.reps);
    const rest = e?.pattern === 'cardio' ? 0 : raw.rest;
    if (!e || names.has(e.name) || !Number.isInteger(raw.sets) || raw.sets < 1 || raw.sets > 4 ||
        typeof raw.reps !== 'string' || (!timed && !strength) ||
        !Number.isInteger(rest) || (e.pattern !== 'cardio' && (rest < 45 || rest > 180)))
      throw new Error('AI Coach returned an exercise outside your equipment or safety settings. Please regenerate it.');
    if (strength) {
      const range = raw.reps.split(/[–-]/).map(Number);
      if (range.length === 2 && range[1] < range[0]) throw new Error('AI Coach returned an invalid repetition range.');
    }
    names.add(e.name);
    clean.exercises.push({ ...e, sets: raw.sets, reps: cardio ? `${Number(cardio[1])} min` : hiit ? `${Number(hiit[1])} sec` : raw.reps, rest });
  }
  if (selected.some((group) => !groupExercises[group].some((name) => names.has(name))))
    throw new Error('AI Coach missed a selected muscle group. Please regenerate the workout.');
  if (estimateMinutes(clean) > profile.minutes)
    throw new Error('AI Coach returned a workout longer than your session time. Please regenerate it.');
  return clean;
}

export async function generateCustomWorkout(state: State, selected: MuscleGroup[], config: { OPENAI_API_KEY?: string; OPENAI_MODEL?: string; adminGuidance?: string; disabledExercises?: string[] }, request: typeof fetch = fetch, previousExercises: string[] = []) {
  const baseProfile = state.profile;
  if (!baseProfile) throw new Error('Complete your profile first.');
  const readiness = workoutReadiness(state);
  const profile = { ...baseProfile, minutes: readiness.minutes, equipment: readiness.equipment };
  if (!config.OPENAI_API_KEY) throw new Error('AI Coach is not connected. Please try again after it is configured.');
  const baseAllowed = eligibleExercises(profile, selected, config.disabledExercises);
  const allowed = variationOptions(profile, selected, readiness, baseAllowed, previousExercises);
  if (selected.some((group) => !allowed.some((e) => groupExercises[group].includes(e.name))))
    throw new Error('No suitable exercise is available for one of these groups with your equipment and movement exclusions.');
  const movementCoverage = workoutCoverage(profile, selected, readiness, allowed);
  const response = await request('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: config.OPENAI_MODEL || 'gpt-5.6-luna', store: false, max_output_tokens: 2200,
      text: { format: { type: 'json_object' } },
      instructions: effectiveInstructions(WORKOUT_INSTRUCTIONS, config.adminGuidance ?? ''),
      input: JSON.stringify({ responseInstruction: 'Return the workout as a JSON object with exercises and rationale.', selectedMuscles: selected, readiness, movementCoverage, previousExercises, variationAvailable: allowed.some(e => !previousExercises.includes(e.name)), coverageByGroup: Object.fromEntries(selected.map(group => [group, groupExercises[group].filter(name => allowed.some(e => e.name === name))])), availableMinutes: profile.minutes, allowedExercises: allowed.map(({ name, pattern, cue }) => ({ name, pattern, cue })), savedRecords: coachContext(state) }),
    }),
  });
  if (!response.ok) throw new Error('AI Coach is unavailable. Your saved workouts are unchanged. Please try again.');
  const raw = await response.text();
  if (raw.length > 100_000) throw new Error('AI Coach returned an unexpected response.');
  const result = JSON.parse(raw) as { status?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
  if (result.status !== 'completed') throw new Error('AI Coach did not finish this workout. Please try again.');
  const text = result.output?.filter((x) => x.type === 'message').flatMap((x) => x.content ?? []).find((x) => x.type === 'output_text')?.text;
  if (!text) throw new Error('AI Coach did not return a workout. Please try again.');
  let parsed: { exercises: Plan['days'][number]['exercises']; rationale?: string };
  try { parsed = JSON.parse(text); } catch { throw new Error('AI Coach returned an unreadable workout. Please try again.'); }
  const day = validateCustomWorkout(profile, selected, { name: selected.join(' + '), exercises: parsed.exercises }, config.disabledExercises);
  validateWorkoutCoverage(movementCoverage, day.exercises.map(e => e.name));
  if (previousExercises.length && allowed.some(e => !previousExercises.includes(e.name)) && day.exercises.every(e => previousExercises.includes(e.name))) throw new Error('AI Coach repeated the previous selection. Please regenerate for a different variation.');
  return { day, readinessId: readiness.id, rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 600) : '' };
}

export function workoutReadiness(state: State) {
  assertCleared(state);
  const readiness = normalizedState(state).readiness.at(-1);
  if (!readiness || Date.now() - Date.parse(readiness.createdAt) > 12 * 3600000 || state.sessions.some(s => s.readinessId === readiness.id))
    throw new Error('Save a fresh readiness check before choosing your workout.');
  if (readiness.pain) throw new Error('Pain was reported. Pause training for this check-in.');
  return readiness;
}

export function variationOptions(profile: Profile, selected: MuscleGroup[], readiness: ReturnType<typeof workoutReadiness>, allowed: ReturnType<typeof eligibleExercises>, previous: string[]) {
  if (!previous.length) return allowed;
  const keep = new Set<string>();
  for (const group of workoutCoverage(profile, selected, readiness, allowed)) {
    for (const role of [...group.requiredRoles, ...group.optionalRoles]) {
      if (!role.choices.some(name => !previous.includes(name))) role.choices.forEach(name => keep.add(name));
    }
  }
  for (const group of selected) {
    const choices = allowed.filter(e => groupExercises[group].includes(e.name));
    if (!choices.some(e => !previous.includes(e.name))) choices.forEach(e => keep.add(e.name));
  }
  return allowed.filter(e => !previous.includes(e.name) || keep.has(e.name));
}

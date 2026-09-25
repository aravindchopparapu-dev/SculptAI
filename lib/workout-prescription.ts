import type { Profile, Plan } from './fitness.ts';
import type { Readiness } from './adaptation.ts';
import { estimateMinutes } from './adaptation.ts';

// Conservative product defaults, not medical thresholds or research-prescribed minute limits.
export function sessionPrescription(
  profile: Profile,
  selected: string[],
  readiness: Readiness,
  choices: Record<string, string[]>,
) {
  const low =
    readiness.energy <= 1 ||
    (readiness.sleep ?? 3) <= 1 ||
    readiness.soreness >= 7;
  const reduced =
    low ||
    readiness.energy <= 2 ||
    (readiness.sleep ?? 3) <= 2 ||
    readiness.soreness >= 4;
  const beginner = profile.experience === 'Beginner';
  const reasons: string[] = [];
  if (readiness.energy <= 2) reasons.push(`energy is ${readiness.energy}/5`);
  if ((readiness.sleep ?? 3) <= 2)
    reasons.push(`sleep quality is ${readiness.sleep}/5`);
  if (readiness.soreness >= 4)
    reasons.push(`muscle soreness is ${readiness.soreness}/10`);
  let recommendedMinutes = Math.min(
    readiness.minutes,
    low ? 30 : reduced ? 45 : beginner ? 60 : 90,
  );
  if (selected.length === 1)
    recommendedMinutes = Math.min(
      recommendedMinutes,
      selected[0] === 'HIIT' ? 30 : 60,
    );
  const explanation = reduced
    ? `You selected ${readiness.minutes} minutes, but ${reasons.join(' and ')}. Start with up to ${recommendedMinutes} minutes at an easier effort; stop if symptoms worsen.`
    : recommendedMinutes < readiness.minutes
      ? `You selected ${readiness.minutes} minutes. We recommend up to ${recommendedMinutes} minutes for ${beginner ? 'a manageable beginner session' : 'this focused selection'}; extra time does not require extra hard sets.`
      : '';
  const groups = selected.map((group) => {
    const conditioning = group === 'Cardio' || group === 'HIIT';
    const usefulLimit = ['Calves', 'Forearms', 'Abs'].includes(group) ? 2 : 3;
    const minutesPerGroup = recommendedMinutes / selected.length;
    const minimumExercises = Math.min(
      choices[group]?.length ?? 0,
      conditioning || reduced || minutesPerGroup < 15
        ? 1
        : minutesPerGroup < 20
          ? 2
          : usefulLimit,
    );
    return {
      group,
      minimumExercises,
      minimumWorkingSets: conditioning
        ? null
        : minimumExercises * (minutesPerGroup >= 20 && !reduced ? 2 : 1),
      suggestedMaximumExercises: conditioning
        ? group === 'HIIT'
          ? 3
          : 2
        : Math.min(4, choices[group]?.length ?? 0),
      maximumWorkingSets: conditioning
        ? null
        : low
          ? 4
          : reduced || beginner
            ? 6
            : 10,
    };
  });
  return {
    requestedMinutes: readiness.minutes,
    recommendedMinutes,
    targetMinimumMinutes: Math.ceil(recommendedMinutes * 0.7),
    reducedReadiness: reduced,
    beginner,
    explanation,
    maximumTotalWorkingSets: low ? 10 : reduced || beginner ? 18 : 24,
    groups,
  };
}

export function validateSessionPrescription(
  policy: ReturnType<typeof sessionPrescription>,
  day: Plan['days'][number],
  choices: Record<string, string[]>,
  shorterSessionReason?: unknown,
) {
  const duration = estimateMinutes(day);
  if (duration > policy.recommendedMinutes)
    throw new Error(
      `Reduce the session to at most ${policy.recommendedMinutes} minutes for this readiness and experience.`,
    );
  const strength = day.exercises.filter(
    (e) => !['cardio', 'hiit'].includes(e.pattern),
  );
  if (
    strength.reduce((sum, e) => sum + e.sets, 0) >
    policy.maximumTotalWorkingSets
  )
    throw new Error(
      'Reduce total working-set volume to the supplied session limit.',
    );
  for (const group of policy.groups) {
    const entries = day.exercises.filter((e) =>
      choices[group.group]?.includes(e.name),
    );
    if (entries.length < group.minimumExercises)
      throw new Error(
        `Provide at least ${group.minimumExercises} complementary exercises for ${group.group}, within the time and set limits.`,
      );
    if (
      group.minimumWorkingSets !== null &&
      entries.reduce((sum, e) => sum + e.sets, 0) < group.minimumWorkingSets
    )
      throw new Error(
        `Provide at least ${group.minimumWorkingSets} working sets for ${group.group}, distributed across useful movements.`,
      );
    if (
      group.maximumWorkingSets !== null &&
      entries.reduce((sum, e) => sum + e.sets, 0) > group.maximumWorkingSets
    )
      throw new Error(
        `Keep ${group.group} within ${group.maximumWorkingSets} working sets, including shared movements.`,
      );
  }
  const volumeLimited = policy.groups.every(
    (g) =>
      g.maximumWorkingSets !== null &&
      day.exercises
        .filter((e) => choices[g.group]?.includes(e.name))
        .reduce((sum, e) => sum + e.sets, 0) >=
        g.maximumWorkingSets * 0.8,
  );
  const selectionLimited =
    policy.groups.length === 1 ||
    policy.groups.some(
      (g) =>
        g.maximumWorkingSets === null || (choices[g.group]?.length ?? 0) < 3,
    );
  if (
    duration < policy.targetMinimumMinutes &&
    !policy.reducedReadiness &&
    !policy.beginner &&
    !volumeLimited &&
    !selectionLimited &&
    strength.reduce((sum, e) => sum + e.sets, 0) <
      policy.maximumTotalWorkingSets * 0.8
  )
    throw new Error(
      'The session is too short for the requested time without a readiness, selection or volume constraint. Add useful working sets or complementary exercises within the limits.',
    );
  if (
    duration < policy.targetMinimumMinutes &&
    (typeof shorterSessionReason !== 'string' ||
      shorterSessionReason.trim().length < 25)
  )
    throw new Error(
      'The session leaves substantial time unused. Add useful work within the limits, or supply a specific shorterSessionReason explaining the recovery, volume, equipment or selection constraint. Never pad time.',
    );
  return duration;
}

export const SESSION_PLANNING_RULES = `# Required session planning
Use sessionPrescription as the current server planning contract, overriding any older duration or exercise-count guidance. It is a conservative product policy, not a medical diagnosis or a universal scientific minute limit. Plan ONE session using today's selected groups, equipment and readiness. Profile minutes are only a default; availableMinutes and sessionPrescription are authoritative. All selected groups must be represented, with each group's minimumExercises, minimumWorkingSets and maximumWorkingSets respected. Shared exercises count toward each matching group's volume, not twice toward total sets.
Before choosing exercises, allocate time to warm-up, useful working sets, prescribed rests, and transitions. Aim for targetMinimumMinutes through recommendedMinutes when useful work fits. Longer healthy sessions should provide broader complementary movements and appropriate working sets, not the same short template. For two well-recovered strength groups at 75-90 minutes, typically consider 6-8 distinct exercises, within the per-group and total set limits. For beginners, low readiness, one small group, or constrained equipment, a shorter session can be better. Do not add unrelated groups, repeat equivalent exercises, inflate rests or prescribe exhausting extra sets just to fill the clock.
Use at least 120 seconds rest for demanding multi-joint strength work when appropriate, usually 60-90 for isolation, within the supported 45-180 seconds range. Strength goal: prioritize practiced compound movements and lower supported rep ranges; muscle gain: complementary angles with manageable working sets; fat loss: preserve strength without promises of spot reduction. Use roughly 2-3 repetitions in reserve as a starting effort cue (more when readiness is low); do not invent weights or claim this is individually validated. Saved plans are not completed exercise. Missing weekly training history means weekly volume and recent recovery are unknown; do not infer completion from saved workouts. Weekly volume evidence is not a single-session quota. Exercise variation should serve a movement purpose, not random novelty.
If requested time exceeds recommended time, explain the actual energy/sleep/soreness scores or experience/selection limitation, recommend the shorter duration, and educate the member that more available time does not always mean more useful training. Never say a readiness score proves a medical condition or that 90 minutes is inherently unsafe. With reduced readiness and HIIT selected, prescribe gentle work/recovery intervals and explicitly identify the adaptation; never fill 90 minutes with HIIT.
Use the server's duration formula: 5 warm-up minutes + sum of sets * (work seconds + rest seconds) / 60 + 0.5 minutes per exercise. Strength work seconds = upper rep count * 4. This is an approximate conservative allowance including recovery and transitions, not stopwatch precision. Do not claim exact muscle coverage or exact duration. If estimated time is below targetMinimumMinutes, return shorterSessionReason describing the concrete limitation; do not merely say 'efficient workout'.
Write rationale in plain, member-facing language. Do not mention server contracts or validation. Do not repeat a calculated minute total in rationale; the application adds the authoritative estimate. Keep rationale under 550 characters and shorterSessionReason under 250 characters.
Return JSON with exercises [{name,sets,reps,rest}], rationale (coverage, goal, effort and readiness explanation), and shorterSessionReason (a specific explanation when below targetMinimumMinutes, otherwise empty string). Preserve the required exercise library and format constraints. Validate the complete plan against time, coverage and volume before returning.`;

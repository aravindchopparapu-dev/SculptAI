import {
  exercises,
  num,
  type Plan,
  type Profile,
  type State,
} from './fitness.ts';

export const RULE_VERSION = '2026-09-18.1';
export const POLICY_VERSION = 'testing-2026-09-18';
export const RULES = {
  lowEnergy: 2,
  highSoreness: 7,
  exposures: 2,
  targetRpe: 8,
  maxReps: 15,
} as const;
export type Readiness = {
  id: string;
  createdAt: string;
  dayIndex: number;
  energy: number;
  soreness: number;
  minutes: number;
  pain: boolean;
  sleep?: number;
  area?: string;
  equipment: string;
};
export type SafetyScreen = {
  id: string;
  createdAt: string;
  status: 'clear' | 'guidance' | 'emergency';
  version: string;
};
export type Consent = {
  id: string;
  createdAt: string;
  version: string;
  documents: string[];
};
export type PainEvent = {
  id: string;
  createdAt: string;
  exercise: string;
  severity: 'pain' | 'urgent';
  note: string;
};
export type PlanDiff = {
  planId: string;
  fromVersion: number;
  dayIndex: number;
  changeType: 'hold' | 'sets' | 'reps' | 'exercise' | 'duration';
  before: Plan['days'];
  after: Plan['days'];
  ruleId: string;
  ruleVersion: string;
  reasonPlain: string;
  confidence: 'low' | 'medium' | 'high';
  inputsUsed: { name: string; value: string }[];
  safetyChecks: { name: string; passed: boolean }[];
  evidenceRefs: { title: string; url: string }[];
};
export type Receipt = PlanDiff & {
  receiptId: string;
  createdAt: string;
  toVersion: number;
  userDecision: 'pending';
  profileSnapshot: string;
  trainingSnapshot: string;
  beforePlan: Plan;
  readinessId?: string;
};
export type Decision = {
  id: string;
  receiptId: string;
  decision: 'accepted' | 'rejected' | 'undone';
  createdAt: string;
  reason: string;
  planId?: string;
};
export type WeeklyReview = {
  id: string;
  createdAt: string;
  barrier: string;
  nutritionDays: number;
  reflection: string;
  summary: ReturnType<typeof weeklySummary>;
};
export type AdaptiveData = {
  readiness: Readiness[];
  receipts: Receipt[];
  decisions: Decision[];
  consents: Consent[];
  safetyScreens: SafetyScreen[];
  reviews: WeeklyReview[];
};
export const adaptiveDefaults = (): AdaptiveData => ({
  readiness: [],
  receipts: [],
  decisions: [],
  consents: [],
  safetyScreens: [],
  reviews: [],
});
export function normalizedState(input: State): State & AdaptiveData {
  return { ...adaptiveDefaults(), ...input };
}
export function assertCleared(state: State) {
  const s = normalizedState(state);
  if (!s.consents.some((c) => c.version === POLICY_VERSION))
    throw new Error(
      'Read and accept the testing terms and privacy notice first.',
    );
  if (s.safetyScreens.some((x) => x.status === 'emergency'))
    throw new Error(
      'Training is paused after an urgent safety flag. Seek professional guidance. This testing version cannot clear urgent flags.',
    );
  if (s.safetyScreens.at(-1)?.status !== 'clear')
    throw new Error('Complete the activity safety check before training.');
}
export function validateReadiness(
  value: unknown,
  profile: Profile,
  plan: Plan,
): Omit<Readiness, 'id' | 'createdAt'> {
  const v = value as Readiness;
  if (!v || typeof v.pain !== 'boolean')
    throw new Error('Answer the pain question.');
  num(v.energy, 'Energy', 1, 5);
  num(v.soreness, 'Soreness', 0, 10);
  num(v.minutes, 'Available minutes', 10, 90);
  num(v.dayIndex, 'Training day', 0, plan.days.length - 1);
  if (![v.energy, v.soreness, v.minutes, v.dayIndex].every(Number.isInteger))
    throw new Error('Choose whole-number check-in values.');
  if (v.sleep !== undefined) num(v.sleep, 'Sleep quality', 1, 5);
  if (!['Bodyweight', 'Dumbbells', 'Gym'].includes(v.equipment))
    throw new Error('Choose your available equipment.');
  if (
    v.area !== undefined &&
    (typeof v.area !== 'string' || v.area.length > 80)
  )
    throw new Error('Keep the soreness area under 80 characters.');
  return {
    dayIndex: v.dayIndex,
    energy: v.energy,
    soreness: v.soreness,
    minutes: v.minutes,
    pain: v.pain,
    equipment: v.equipment || profile.equipment,
    ...(v.sleep !== undefined ? { sleep: v.sleep } : {}),
    ...(v.area ? { area: v.area } : {}),
  };
}
export function estimateMinutes(day: Plan['days'][number]) {
  return Math.ceil(
    5 +
      day.exercises.reduce(
        (sum, e) => {
          const duration = /^(\d+) (sec|min)$/.exec(e.reps);
          const workSeconds = duration ? Number(duration[1]) * (duration[2] === 'min' ? 60 : 1)
            : Number(e.reps.split(/[–-]/).at(-1)) * 4;
          return sum + e.sets * (workSeconds + e.rest) / 60 + 0.5;
        },
        0,
      ),
  );
}
export function compatible(
  profile: Profile,
  pattern: string,
  equipment = profile.equipment,
) {
  const avoid = profile.avoid
    .toLowerCase()
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return exercises.filter(
    (e) =>
      e.pattern === pattern &&
      (e.equipment === 'Bodyweight' ||
        e.equipment === equipment ||
        equipment === 'Gym') &&
      !avoid.some((v) => e.name.toLowerCase().includes(v)),
  );
}
export function validateDays(days: Plan['days'], profile: Profile) {
  if (days.length !== profile.days)
    throw new Error(
      'Plan frequency no longer matches your profile. Generate a new plan.',
    );
  for (const [dayIndex, day] of days.entries()) {
    const required =
      profile.days < 4
        ? ['squat', 'hinge', 'push', 'pull', 'core']
        : dayIndex % 2 === 0
          ? ['push', 'pull', 'core']
          : ['squat', 'hinge', 'leg', 'core'];
    if (
      required.some(
        (pattern) => !day.exercises.some((e) => e.pattern === pattern),
      )
    )
      throw new Error(
        'This legacy plan is missing a movement pattern. Generate a new plan after reviewing your preferences.',
      );
    if (
      !day.exercises.length ||
      new Set(day.exercises.map((e) => e.name)).size !== day.exercises.length
    )
      throw new Error('The plan needs distinct approved movements.');
    for (const e of day.exercises) {
      if (!compatible(profile, e.pattern).some((x) => x.name === e.name))
        throw new Error(
          'The plan conflicts with your equipment or exclusions. Generate a new plan.',
        );
      if (
        !Number.isInteger(e.sets) ||
        e.sets < 1 ||
        e.sets > 3 ||
        e.rest < 90 ||
        e.rest > 180 ||
        !/^\d+[–-]\d+$/.test(e.reps)
      )
        throw new Error('The plan exceeds the testing prescription limits.');
      const [low, high] = e.reps.split(/[–-]/).map(Number);
      if (low < 5 || high < low || high > RULES.maxReps)
        throw new Error('The repetition range is outside the testing limits.');
    }
  }
}
export function buildSchedule(days: Plan['days'], created: string) {
  const offsets: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 5],
    6: [0, 1, 2, 3, 4, 5],
  };
  return Array.from({ length: 4 }, (_, week) =>
    days.map((_, dayIndex) => {
      const date = new Date(created);
      date.setUTCDate(
        date.getUTCDate() + week * 7 + offsets[days.length][dayIndex],
      );
      return {
        week: week + 1,
        dayIndex,
        date: date.toISOString().slice(0, 10),
      };
    }),
  ).flat();
}
export function evaluateAdaptation(state: State, dayIndex: number): PlanDiff {
  const s = normalizedState(state),
    plan = s.plans.at(-1),
    profile = s.profile;
  if (!plan || !profile) throw new Error('Create a plan first.');
  if (!Number.isInteger(dayIndex) || !plan.days[dayIndex])
    throw new Error('Choose a training day.');
  const after = structuredClone(plan.days),
    day = after[dayIndex];
  const r = s.readiness.at(-1);
  const base: PlanDiff = {
    planId: plan.id,
    fromVersion: plan.version,
    dayIndex,
    changeType: 'hold',
    before: structuredClone(plan.days),
    after,
    ruleId: 'hold-insufficient-data',
    ruleVersion: RULE_VERSION,
    reasonPlain:
      'Holding steady. Complete two comparable sessions with effort logged before reviewing progression.',
    confidence: 'low',
    inputsUsed: [],
    safetyChecks: [{ name: 'No automatic nutrition changes', passed: true }],
    evidenceRefs: [],
  };
  const finish = () => {
    validateDays(after, profile);
    base.safetyChecks.push({
      name: 'Approved exercises, exclusions, set caps and rest preserved',
      passed: true,
    });
    return base;
  };
  // Readiness is eligible only when submitted for this review's session. The service verifies freshness.
  if (r && r.dayIndex === dayIndex)
    base.inputsUsed.push({
      name: 'Readiness',
      value: `${r.id}: energy ${r.energy}/5, soreness ${r.soreness}/10, ${r.minutes} minutes, ${r.equipment}, pain ${r.pain ? 'yes' : 'no'}`,
    });
  const recent = s.sessions.filter((x) => x.completed).slice(-2);
  if (
    (r?.dayIndex === dayIndex && r.pain) ||
    recent.some((x) =>
      x.painEvents?.some((p) =>
        day.exercises.some((e) => e.name === p.exercise),
      ),
    )
  ) {
    base.ruleId = 'pain-stop';
    base.confidence = 'high';
    base.reasonPlain =
      'Pain was reported. No progression is proposed. Stop the painful movement and seek professional guidance for persistent, severe or sudden symptoms.';
    base.inputsUsed.push(
      ...recent
        .filter((x) => x.painEvents?.length)
        .map((x) => ({ name: 'Pain report', value: x.id })),
    );
    base.safetyChecks.push({ name: 'Pain blocks progression', passed: true });
    return finish();
  }
  if (r?.dayIndex === dayIndex) {
    const reasons: string[] = [],
      rules: string[] = [];
    if (
      day.exercises.some(
        (e) =>
          !compatible(profile, e.pattern, r.equipment).some(
            (x) => x.name === e.name,
          ),
      )
    ) {
      const chosen: string[] = [];
      day.exercises = day.exercises.map((e) => {
        const options = compatible(profile, e.pattern, r.equipment).filter(
          (x) => !chosen.includes(x.name),
        );
        const option = options.find((x) => x.name === e.name) ?? options[0];
        if (!option)
          throw new Error(
            'No compatible substitute is available. Keep the plan and skip training with unavailable equipment.',
          );
        chosen.push(option.name);
        return { ...e, ...option };
      });
      base.changeType = 'exercise';
      rules.push('equipment-match');
      reasons.push(
        `Use approved movements available with ${r.equipment.toLowerCase()}, retaining movement patterns and exclusions.`,
      );
    }
    if (r.energy <= RULES.lowEnergy || r.soreness >= RULES.highSoreness) {
      if (day.exercises.some((e) => e.sets > 1)) {
        day.exercises = day.exercises.map((e) => ({
          ...e,
          sets: Math.max(1, e.sets - 1),
        }));
        base.changeType = base.changeType === 'exercise' ? 'exercise' : 'sets';
        rules.push('recovery-volume');
        reasons.push(
          'Your check-in suggests a lighter day: remove one set per movement where possible. Calorie targets stay unchanged.',
        );
      } else {
        base.ruleId = 'recovery-hold';
        base.reasonPlain =
          'Already at the minimum testing volume. Hold the plan and consider resting today.';
      }
    }
    if (r.minutes < estimateMinutes(day)) {
      while (
        estimateMinutes(day) > r.minutes &&
        day.exercises.some((e) => e.sets > 1)
      ) {
        const e = [...day.exercises].reverse().find((x) => x.sets > 1)!;
        e.sets--;
      }
      if (estimateMinutes(day) > r.minutes) {
        base.after = structuredClone(plan.days);
        base.changeType = 'hold';
        base.ruleId = 'time-insufficient';
        base.reasonPlain =
          'The available time cannot fit this template with its warm-up and rest. Keep the plan and choose a rest day or return with more time.';
        return base;
      }
      base.changeType =
        base.changeType === 'exercise' ? 'exercise' : 'duration';
      rules.push('compact-session');
      reasons.push(
        `Fit the session into approximately ${estimateMinutes(day)} minutes by reducing sets, preserving all movements, the five-minute warm-up and rest.`,
      );
    }
    if (reasons.length) {
      base.reasonPlain = reasons.join(' ');
      base.ruleId = rules.join('+');
      base.confidence = 'medium';
      return finish();
    }
    if (base.ruleId === 'recovery-hold') return finish();
  }
  for (const e of day.exercises) {
    const exposures = [...s.sessions]
      .reverse()
      .filter(
        (x) =>
          x.completed &&
          x.status === 'complete' &&
          x.sets.some((t) => t.exercise === e.name),
      )
      .slice(0, RULES.exposures);
    const high = Number(e.reps.split(/[–-]/).at(-1));
    if (exposures.length < RULES.exposures || high >= RULES.maxReps) continue;
    const sets = exposures.flatMap((x) =>
      x.sets.filter((t) => t.exercise === e.name),
    );
    if (
      exposures.some((x) => x.painEvents?.some((p) => p.exercise === e.name)) ||
      exposures.some(
        (x) => x.sets.filter((t) => t.exercise === e.name).length < e.sets,
      )
    )
      continue;
    if (
      !sets.every(
        (t) =>
          t.done &&
          !t.skipped &&
          t.reps >= high &&
          t.rpe !== undefined &&
          t.rpe <= RULES.targetRpe &&
          t.load === sets[0].load,
      )
    )
      continue;
    const oldReps = e.reps;
    e.reps = e.reps
      .split(/[–-]/)
      .map(Number)
      .map((n) => n + 1)
      .join('–');
    if (
      estimateMinutes(day) >
      (r?.dayIndex === dayIndex ? r.minutes : profile.minutes)
    ) {
      e.reps = oldReps;
      continue;
    }
    base.changeType = 'reps';
    base.ruleId = 'two-exposure-reps';
    base.confidence = 'medium';
    base.reasonPlain = `${e.name} reached the top of the rep range in two complete comparable sessions at RPE 8 or below. Propose one extra rep; keep the same load and sets.`;
    base.inputsUsed.push(
      ...exposures.map((x) => ({ name: 'Completed session', value: x.id })),
    );
    base.evidenceRefs = [
      {
        title:
          'CDC: starting gradually (general principle; these thresholds are testing rules)',
        url: 'https://www.cdc.gov/physical-activity-basics/adding-adults/what-counts.html',
      },
    ];
    return finish();
  }
  if (
    recent.some((session) =>
      session.sets.some(
        (t) =>
          day.exercises.some((e) => e.name === t.exercise) &&
          t.done &&
          t.rpe !== undefined &&
          t.rpe > RULES.targetRpe,
      ),
    )
  ) {
    base.ruleId = 'effort-hold';
    base.reasonPlain =
      'Recent effort exceeded the target. Hold the prescription and choose a manageable load; one hard day does not establish a long-term regression.';
  }
  base.inputsUsed.push({
    name: 'Completed sessions available',
    value: String(s.sessions.filter((x) => x.completed).length),
  });
  return finish();
}
export function receiptStatus(state: State, receiptId: string) {
  return (
    normalizedState(state)
      .decisions.filter((d) => d.receiptId === receiptId)
      .at(-1)?.decision ?? 'pending'
  );
}
export function weeklySummary(state: State, now = new Date()) {
  const since = now.getTime() - 7 * 86400000;
  const sessions = state.sessions.filter(
    (s) =>
      s.completed &&
      Date.parse(s.completed) >= since &&
      Date.parse(s.completed) <= now.getTime(),
  );
  const readiness = normalizedState(state).readiness.filter(
    (r) =>
      Date.parse(r.createdAt) >= since &&
      Date.parse(r.createdAt) <= now.getTime(),
  );
  const weights = state.metrics.filter(
    (m) => Date.parse(m.date) >= since && Date.parse(m.date) <= now.getTime(),
  );
  return {
    complete: sessions.filter((s) => s.status === 'complete').length,
    partial: sessions.filter((s) => s.status === 'partial').length,
    planned: state.plans.at(-1)?.days.length ?? state.profile?.days ?? 0,
    readinessDays: new Set(readiness.map((r) => r.createdAt.slice(0, 10))).size,
    painReports:
      sessions.reduce((n, s) => n + (s.painEvents?.length ?? 0), 0) +
      readiness.filter((r) => r.pain).length,
    weightChange:
      weights.length >= 2 ? weights.at(-1)!.weight - weights[0].weight : null,
  };
}

export type Profile = {
  name: string;
  age: number;
  sex: string;
  height: number;
  weight: number;
  goal: string;
  days: number;
  minutes: number;
  equipment: string;
  experience: string;
  activity: number;
  units: string;
  diet: string;
  exclusions: string;
  avoid: string;
  eligible: boolean;
};
export type Exercise = {
  name: string;
  pattern: string;
  equipment: string;
  cue: string;
};
export type Plan = {
  id: string;
  version: number;
  created: string;
  days: {
    name: string;
    exercises: (Exercise & { sets: number; reps: string; rest: number })[];
  }[];
};
export type Metric = {
  id: string;
  date: string;
  weight: number;
  waist?: number;
  bodyFat?: number;
  fatMass?: number;
  leanMass?: number;
  muscleMass?: number;
  bmr?: number;
  visceral?: number;
  ecw?: number;
  source: string;
  notes: string;
};
export type SetLog = {
  exercise: string;
  index: number;
  reps: number;
  load: number;
  rpe?: number;
  done: boolean;
  skipped?: boolean;
};
export type Session = {
  id: string;
  planId: string;
  name: string;
  started: string;
  completed?: string;
  sets: SetLog[];
  notes: string;
  status?: 'complete' | 'partial';
  dayIndex: number;
};
export type Target = {
  id: string;
  created: string;
  method: string;
  maintenance: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  inputs: Profile;
};
export type State = {
  profile: Profile | null;
  plans: Plan[];
  metrics: Metric[];
  sessions: Session[];
  targets: Target[];
};
export const emptyState = (): State => ({
  profile: null,
  plans: [],
  metrics: [],
  sessions: [],
  targets: [],
});
export const goals = [
  'Muscle gain',
  'Fat loss',
  'Strength',
  'General fitness',
  'Maintenance / recomp',
];
export const exercises: Exercise[] = [
  ['Goblet squat', 'squat', 'Dumbbells', 'Keep your whole foot grounded.'],
  [
    'Bodyweight squat',
    'squat',
    'Bodyweight',
    'Use a comfortable range of motion.',
  ],
  ['Barbell squat', 'squat', 'Gym', 'Brace and move with control.'],
  [
    'Dumbbell Romanian deadlift',
    'hinge',
    'Dumbbells',
    'Push your hips back with a neutral spine.',
  ],
  ['Glute bridge', 'hinge', 'Bodyweight', 'Drive through your feet.'],
  [
    'Dumbbell bench press',
    'push',
    'Dumbbells',
    'Lower slowly and keep wrists stacked.',
  ],
  [
    'Push-up',
    'push',
    'Bodyweight',
    'Keep your torso steady; elevate hands if needed.',
  ],
  ['Bench press', 'push', 'Gym', 'Use safeties or a spotter.'],
  [
    'Dumbbell row',
    'pull',
    'Dumbbells',
    'Pull toward your hip without twisting.',
  ],
  [
    'Prone W raise',
    'pull',
    'Bodyweight',
    'Lift arms gently with thumbs pointing up.',
  ],
  ['Seated cable row', 'pull', 'Gym', 'Keep your torso still.'],
  ['Split squat', 'leg', 'Bodyweight', 'Use support for balance if needed.'],
  ['Calf raise', 'leg', 'Bodyweight', 'Pause at the top.'],
  [
    'Dead bug',
    'core',
    'Bodyweight',
    'Keep your lower back comfortably supported.',
  ],
].map(([name, pattern, equipment, cue]) => ({ name, pattern, equipment, cue }));
export function num(v: unknown, label: string, min: number, max: number) {
  const n = v as number;
  if (typeof v !== 'number' || !Number.isFinite(n) || n < min || n > max)
    throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
}
export function validateProfile(p: Profile) {
  if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80)
    throw new Error('Enter a name of 1–80 characters.');
  num(p.age, 'Age', 18, 100);
  if (!Number.isInteger(p.age)) throw new Error('Age must be a whole number.');
  if (p.height !== 0) num(p.height, 'Height', 100, 250);
  if (p.weight !== 0) num(p.weight, 'Weight', 30, 350);
  num(p.days, 'Training days', 2, 6);
  if (!Number.isInteger(p.days)) throw new Error('Choose whole training days.');
  num(p.minutes, 'Duration', 20, 90);
  if (
    !goals.includes(p.goal) ||
    !['Bodyweight', 'Dumbbells', 'Gym'].includes(p.equipment) ||
    !['Beginner', 'Intermediate'].includes(p.experience) ||
    !['Metric', 'Imperial'].includes(p.units) ||
    !['', 'Female', 'Male'].includes(p.sex) ||
    ![1.2, 1.375, 1.55, 1.725].includes(p.activity) ||
    !['Omnivore', 'Vegetarian', 'Vegan'].includes(p.diet) ||
    typeof p.eligible !== 'boolean'
  )
    throw new Error('Choose valid profile options.');
  for (const v of [p.exclusions, p.avoid])
    if (typeof v !== 'string' || v.length > 500)
      throw new Error('Preferences must be under 500 characters.');
  return Object.fromEntries(
    [
      'name',
      'age',
      'sex',
      'height',
      'weight',
      'goal',
      'days',
      'minutes',
      'equipment',
      'experience',
      'activity',
      'units',
      'diet',
      'exclusions',
      'avoid',
      'eligible',
    ].map((k) => [k, p[k as keyof Profile]]),
  ) as Profile;
}
export function generatePlan(p: Profile, version = 1): Plan {
  validateProfile(p);
  const avoid = p.avoid
    .toLowerCase()
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const available = exercises.filter(
    (e) =>
      (e.equipment === 'Bodyweight' ||
        e.equipment === p.equipment ||
        (p.equipment === 'Gym' && e.equipment === 'Dumbbells')) &&
      !avoid.some((a) => e.name.toLowerCase().includes(a)),
  );
  const days = Array.from({ length: p.days }, (_, i) => {
    const upper = p.days >= 4 && i % 2 === 0,
      lower = p.days >= 4 && i % 2 === 1;
    const patterns = upper
      ? ['push', 'pull', 'push', 'core']
      : lower
        ? ['squat', 'hinge', 'leg', 'core']
        : ['squat', 'push', 'pull', 'hinge', 'core'];
    const chosen: Exercise[] = [];
    for (const pattern of patterns.slice(0, p.minutes <= 30 ? 3 : 5)) {
      const c = available.filter(
        (e) => e.pattern === pattern && !chosen.some((x) => x.name === e.name),
      );
      if (c.length) chosen.push(c[i % c.length]);
    }
    if (chosen.length < 2)
      throw new Error(
        'Your avoidance list leaves too few exercises. Review your preferences.',
      );
    return {
      name: `${upper ? 'Upper body' : lower ? 'Lower body' : 'Full body'} ${String.fromCharCode(65 + Math.floor(p.days >= 4 ? i / 2 : i))}`,
      exercises: chosen.map((e) => ({
        ...e,
        sets: p.experience === 'Beginner' ? 2 : 3,
        reps:
          p.goal === 'Strength' && e.equipment !== 'Bodyweight'
            ? '5–8'
            : '8–12',
        rest: p.goal === 'Strength' ? 120 : 90,
      })),
    };
  });
  return {
    id: crypto.randomUUID(),
    version,
    created: new Date().toISOString(),
    days,
  };
}
export function nutrition(p: Profile): Target {
  validateProfile(p);
  if (
    !p.eligible ||
    !p.sex ||
    !p.height ||
    !p.weight ||
    p.weight / (p.height / 100) ** 2 < 18.5
  )
    throw new Error(
      'Targets unavailable. Complete formula inputs and eligibility in Profile. Clinician-directed nutrition is outside SculptAI’s scope.',
    );
  const maintenance =
    (10 * p.weight +
      6.25 * p.height -
      5 * p.age +
      (p.sex === 'Male' ? 5 : -161)) *
    p.activity;
  const calories =
      maintenance *
      (p.goal === 'Fat loss' ? 0.9 : p.goal === 'Muscle gain' ? 1.05 : 1),
    protein = 1.6 * p.weight,
    fat = Math.max(0.8 * p.weight, (calories * 0.25) / 9),
    carbs = (calories - 4 * protein - 9 * fat) / 4;
  if (carbs < 0 || calories < 1200)
    throw new Error(
      'These inputs need individual review; no target was created.',
    );
  return {
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    method: 'Mifflin-St Jeor + activity; SculptAI v2.1',
    maintenance,
    calories,
    protein,
    fat,
    carbs,
    inputs: { ...p },
  };
}
export function validateMetric(m: Metric) {
  num(m.weight, 'Weight', 30, 350);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(m.date) ||
    !Number.isFinite(Date.parse(m.date)) ||
    new Date(m.date).toISOString().slice(0, 10) !== m.date ||
    m.date > new Date().toISOString().slice(0, 10)
  )
    throw new Error('Choose a valid date, today or earlier.');
  const ranges: Record<string, number[]> = {
    waist: [20, 250],
    bodyFat: [1, 75],
    fatMass: [0, 300],
    leanMass: [1, 300],
    muscleMass: [1, 200],
    bmr: [300, 5000],
    visceral: [1, 60],
    ecw: [0.1, 0.9],
  };
  for (const [k, r] of Object.entries(ranges)) {
    const v = m[k as keyof Metric];
    if (v !== undefined) num(v, k, r[0], r[1]);
  }
  if (
    typeof m.source !== 'string' ||
    m.source.length > 100 ||
    typeof m.notes !== 'string' ||
    m.notes.length > 1000
  )
    throw new Error('Shorten source or notes.');
  return m;
}
export const volume = (s: Session) =>
  s.sets.filter((x) => x.done).reduce((n, x) => n + x.reps * x.load, 0);
export const weightDisplay = (kg: number, units: string) =>
  Number((kg * (units === 'Imperial' ? 2.2046226218 : 1)).toFixed(1));

export const movements = [
  {
    id: 'curl',
    name: 'Dumbbell curl',
    area: 'Arms & control',
    tag: 'Build',
    sets: 3,
    reps: 12,
    load: 12,
    cue: 'A moment of focus. One repetition at a time.',
    minutes: 8,
  },
  {
    id: 'squat',
    name: 'Goblet squat',
    area: 'Lower body',
    tag: 'Ground',
    sets: 3,
    reps: 10,
    load: 16,
    cue: 'Find your foundation. Move with intention.',
    minutes: 12,
  },
  {
    id: 'press',
    name: 'Shoulder press',
    area: 'Upper body',
    tag: 'Elevate',
    sets: 3,
    reps: 10,
    load: 10,
    cue: 'Steady effort. A little more possibility.',
    minutes: 10,
  },
] as const;
export type Movement = (typeof movements)[number]['id'];
export type DemoSession = {
  active: boolean;
  done: number;
  exercise: number;
  finished: boolean;
};
export const initialSession: DemoSession = {
  active: false,
  done: 0,
  exercise: 0,
  finished: false,
};
export function logDemoSet(s: DemoSession): DemoSession {
  if (!s.active || s.finished) return s;
  if (s.done >= 2)
    return s.exercise >= 2
      ? { ...s, done: 3, active: false, finished: true }
      : { ...s, done: 0, exercise: s.exercise + 1 };
  return { ...s, done: s.done + 1 };
}
export function demoCompletion(s: DemoSession) {
  return s.finished ? 100 : Math.round(((s.exercise * 3 + s.done) / 9) * 100);
}

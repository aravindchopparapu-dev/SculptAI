import {
  emptyState,
  generatePlan,
  type State,
  type Profile,
} from './fitness.ts';
import { adaptiveDefaults, POLICY_VERSION } from './adaptation.ts';
export const demoPersonas = [
  'Returning beginner',
  'Busy parent',
  'Home training',
  'Experienced lifter',
  'Low energy day',
];
export function createDemo(persona = demoPersonas[0]): State {
  const profile: Profile = {
    name: persona,
    age: 32,
    sex: '',
    height: 175,
    weight: 75,
    targetWeight: 75,
    goal: 'General fitness',
    days: 3,
    minutes: persona === 'Busy parent' ? 20 : 45,
    equipment: persona === 'Home training' ? 'Bodyweight' : 'Dumbbells',
    experience: persona === 'Experienced lifter' ? 'Intermediate' : 'Beginner',
    activity: 1.375,
    units: 'Metric',
    diet: 'Vegetarian',
    exclusions: '',
    avoid: '',
    eligible: false,
  };
  const plan = generatePlan(profile),
    state = { ...emptyState(), ...adaptiveDefaults(), profile, plans: [plan] };
  const createdAt = new Date().toISOString();
  state.consents.push({
    id: crypto.randomUUID(),
    createdAt,
    version: POLICY_VERSION,
    documents: ['Synthetic demo consent'],
  });
  state.safetyScreens.push({
    id: crypto.randomUUID(),
    createdAt,
    version: POLICY_VERSION,
    status: 'clear',
  });
  state.readiness.push({
    id: crypto.randomUUID(),
    createdAt,
    dayIndex: 0,
    energy: persona === 'Low energy day' ? 1 : 4,
    soreness: persona === 'Low energy day' ? 8 : 1,
    minutes: profile.minutes,
    pain: false,
    equipment: profile.equipment,
  });
  if (persona === 'Experienced lifter') {
    for (const daysAgo of [5, 2]) {
      const date = new Date(Date.now() - daysAgo * 86400000);
      state.sessions.push({
        id: crypto.randomUUID(),
        planId: plan.id,
        dayIndex: 0,
        name: plan.days[0].name,
        started: date.toISOString(),
        completed: new Date(date.getTime() + 30 * 60000).toISOString(),
        status: 'complete',
        notes: 'Fictional example workout',
        prescribed: structuredClone(plan.days[0]),
        painEvents: [],
        sets: plan.days[0].exercises.flatMap((e) =>
          Array.from({ length: e.sets }, (_, index) => ({
            exercise: e.name,
            index,
            reps: Number(e.reps.split('–')[1]),
            load: e.equipment === 'Bodyweight' ? 0 : 10,
            rpe: 7,
            done: true,
            skipped: false,
          })),
        ),
      });
    }
  }
  return state;
}

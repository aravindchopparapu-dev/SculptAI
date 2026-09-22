import type { Profile } from './fitness.ts';
import type { Readiness } from './adaptation.ts';

// Complementary movement roles, not additional muscle-group choices in the UI.
const roles: Record<string, Record<string, string[]>> = {
  Chest: {
    'Horizontal press': ['Bench press', 'Dumbbell bench press', 'Machine chest press', 'Push-up', 'Dumbbell floor press', 'Incline push-up'],
    'Incline press': ['Incline dumbbell press', 'Incline barbell press'],
    'Fly': ['Cable chest fly', 'Pec deck fly', 'Dumbbell floor fly'],
  },
  Biceps: {
    'Conventional curl': ['Dumbbell curl', 'Cable curl', 'EZ-bar curl', 'Alternating dumbbell curl', 'Self-resisted curl'],
    'Supported or incline curl': ['Incline dumbbell curl', 'Preacher curl', 'Concentration curl'],
    'Neutral-grip curl': ['Hammer curl', 'Rope cable hammer curl'],
  },
  Back: {
    'Row': ['Dumbbell row', 'Seated cable row', 'Chest-supported dumbbell row', 'Machine row', 'Barbell row'],
    'Vertical pull': ['Lat pulldown', 'Assisted pull-up', 'Straight-arm cable pulldown'],
  },
  Shoulders: {
    'Press': ['Dumbbell shoulder press', 'Machine shoulder press', 'Pike push-up', 'Seated dumbbell press'],
    'Lateral raise': ['Dumbbell lateral raise', 'Cable lateral raise'],
    'Rear-shoulder movement': ['Dumbbell reverse fly', 'Reverse pec deck'],
  },
  Legs: {
    'Knee-dominant': ['Bodyweight squat', 'Goblet squat', 'Barbell squat', 'Split squat', 'Reverse lunge', 'Leg press', 'Leg extension', 'Dumbbell step-up', 'Dumbbell reverse lunge'],
    'Hip-dominant or leg curl': ['Dumbbell Romanian deadlift', 'Hamstring walkout', 'Seated leg curl'],
  },
  Triceps: {
    'Overhead extension': ['Overhead triceps extension', 'Rope overhead cable extension'],
    'Press or pushdown': ['Close-grip push-up', 'Cable triceps pushdown', 'Close-grip bench press'],
  },
  Abs: {
    'Controlled flexion': ['Reverse crunch', 'Cable crunch'],
    'Stability': ['Dead bug', 'Bird dog', 'Pallof press', 'Side plank hip lift'],
  },
  Cardio: {
    'Sustained aerobic work': ['Brisk walking', 'Easy jogging', 'Marching in place', 'Stationary cycling', 'Elliptical training', 'Rowing machine', 'Incline treadmill walking'],
  },
  HIIT: {
    'Work and recovery intervals': ['Fast march intervals', 'Step jack intervals', 'Shadow boxing intervals', 'High knee intervals', 'Mountain climber intervals', 'Stationary bike intervals', 'Rowing machine intervals'],
  },
};

export function workoutCoverage(profile: Profile, selected: string[], readiness: Readiness, allowed: { name: string }[]) {
  const canUse = new Set(allowed.map(e => e.name));
  const broadSession = readiness.energy >= 3 && readiness.soreness < 7 &&
    (readiness.sleep === undefined || readiness.sleep >= 3) && readiness.minutes / selected.length >= 20;
  return selected.map(group => {
    const available = Object.entries(roles[group] ?? {}).map(([focus, choices]) => ({ focus, choices: choices.filter(name => canUse.has(name)) }));
    return {
      group,
      requiredRoles: broadSession ? available.filter(role => role.choices.length) : [],
      optionalRoles: broadSession ? [] : available.filter(role => role.choices.length),
      unavailableRoles: available.filter(role => !role.choices.length).map(role => role.focus),
      volumeNote: group === 'Cardio' ? 'Choose a sustainable pace and fit the timed block within available minutes.'
        : group === 'HIIT' ? 'Use brief work intervals with full recovery; favor low-impact movements for beginners or low energy.'
        : profile.experience === 'Beginner' ? 'Use conservative working-set volume and straightforward movements.' : 'Use goal and recent training to choose working-set volume.',
    };
  });
}

export function validateWorkoutCoverage(coverage: ReturnType<typeof workoutCoverage>, exerciseNames: string[]) {
  for (const group of coverage) for (const role of group.requiredRoles) {
    if (!role.choices.some(name => exerciseNames.includes(name)))
      throw new Error(`AI Coach missed ${group.group.toLowerCase()} coverage (${role.focus.toLowerCase()}). Please regenerate the workout.`);
  }
}

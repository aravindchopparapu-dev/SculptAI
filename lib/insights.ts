import { weightDisplay, type Session } from './fitness.ts';

export function strengthOptions(sessions: Session[]) {
  const options = new Map<string, Set<number>>();
  for (const session of sessions.filter((s) => s.completed)) {
    for (const set of session.sets.filter(
      (s) => s.done && !s.skipped && s.load > 0 && s.reps > 0,
    )) {
      const reps = options.get(set.exercise) ?? new Set<number>();
      reps.add(set.reps);
      options.set(set.exercise, reps);
    }
  }
  return [...options.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([exercise, reps]) => ({
      exercise,
      reps: [...reps].sort((a, b) => a - b),
    }));
}

/** One actual best set per completed session, at an identical repetition count. */
export function strengthTrend(
  sessions: Session[],
  exercise: string,
  reps: number,
  units: string,
) {
  return sessions
    .filter((s) => s.completed)
    .flatMap((s) => {
      const sets = s.sets.filter(
        (x) =>
          x.exercise === exercise &&
          x.reps === reps &&
          x.done &&
          !x.skipped &&
          x.load > 0,
      );
      if (!sets.length) return [];
      return [
        {
          id: s.id,
          date: s.completed!,
          value: weightDisplay(Math.max(...sets.map((x) => x.load)), units),
        },
      ];
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

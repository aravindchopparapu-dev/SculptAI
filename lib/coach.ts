import { nutrition, type State } from './fitness.ts';
export function safetyResponse(message: string): string | null {
  if (
    /chest pain|can.?t breathe|cannot breathe|fainting|severe shortness|heart attack/i.test(
      message,
    )
  )
    return 'Stop exercising. Chest pain, fainting or severe breathing difficulty can need urgent care. Contact your local emergency service now; do not continue training.';
  if (
    /pain|injur|pregnan|postpartum|diabet|kidney|liver disease|prescri|medicat|diagnos|eating disorder|purge|starv|underweight|extreme|crash diet|[4-9]00\s*(cal|kcal)/i.test(
      message,
    )
  )
    return 'I can help with general fitness, but this needs individualized care. Pause any painful exercise and speak with a qualified clinician or dietitian before changing training or nutrition. I cannot diagnose symptoms or recommend extreme restriction.';
  return null;
}
export function coachReply(state: State, message: string): string {
  const safety = safetyResponse(message);
  if (safety) return safety;
  const p = state.profile;
  if (!p)
    return 'Complete your profile first so the guide can refer to your own training.';
  if (/short|substitut|swap|replace/i.test(message))
    return 'Open My training to choose a shorter version or use the exercise options to select a compatible substitute. You will see the changed plan before confirming it. Existing workout history stays linked to its original plan.';
  if (/nutri|calori|protein|macro|fuel|diet/i.test(message)) {
    try {
      nutrition({ ...p, weight: state.metrics.at(-1)?.weight ?? p.weight });
    } catch {
      return 'Current nutrition eligibility or formula inputs are incomplete. Previous targets are historical records; consult a qualified clinician or dietitian if you need a prescribed diet. Training logs remain available.';
    }
    const t = state.targets.at(-1);
    if (t)
      return `Your adopted target is ${Math.round(t.calories)} kcal, ${Math.round(t.protein)} g protein, ${Math.round(t.fat)} g fat and ${Math.round(t.carbs)} g carbohydrate per day. It was calculated on ${t.created.slice(0, 10)} using ${t.inputs.weight} kg and your saved profile. Fuel shows the method and sources. Changes to your weight do not automatically replace this target.`;
    try {
      nutrition(p);
      return 'Your inputs can be used for an estimate. Open Fuel to calculate, review and explicitly adopt your first targets.';
    } catch {
      return 'Nutrition estimates are unavailable until the formula inputs and eligibility are complete. You can keep logging workouts without a calorie target.';
    }
  }
  if (/progress|increas|heavier|load|strong/i.test(message)) {
    const session = [...state.sessions].reverse().find((s) => s.completed);
    if (!session)
      return 'Log a comfortable starting load first. After completing a workout, the guide can use your recorded repetitions and effort to explain whether to repeat the load. No performance is assumed before it is logged.';
    const eligible = session.sets.filter(
      (s) =>
        s.done &&
        s.load > 0 &&
        s.reps >= 12 &&
        s.rpe !== undefined &&
        s.rpe <= 8,
    );
    return eligible.length === session.sets.length
      ? `All ${eligible.length} recorded sets in your latest workout reached 12 reps at RPE 8 or lower. If technique was controlled and pain-free, consider the smallest available load increase, no more than 2.5%, at your next session. This is a suggestion; your plan and logged weights have not changed.`
      : 'Repeat a manageable load and aim for controlled repetitions within your plan’s range. Your latest workout does not yet show every set at the top of the range with RPE 8 or lower, so the guide will not suggest a load increase.';
  }
  const finished = state.sessions.filter((s) => s.completed),
    complete = finished.filter((s) => s.status === 'complete'),
    active = state.sessions.find((s) => !s.completed);
  return `Your goal is ${p.goal.toLowerCase()}, with ${p.days} training days per week. You have ${complete.length} complete and ${finished.length - complete.length} partial workouts saved.${active ? ` ${active.name} is ready to resume.` : ''}${state.metrics.length ? ` Your latest weight check-in was recorded on ${state.metrics.at(-1)!.date}.` : ' No weight check-ins have been recorded yet.'}\n\nBuilt-in guide response. Live AI has not been connected yet. Ask about nutrition, progression, substitutions or shorter workouts for more detail.`;
}

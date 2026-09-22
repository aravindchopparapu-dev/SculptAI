import { nutrition, type Metric, type Profile, type State, type Target } from './fitness.ts';
import { planningTimeline } from './weight-goal.ts';
const CURRENT_FUEL_METHOD = 'SculptAI v2.2 goal-gap estimate';

function currentProfile(state: State): Profile | null {
  if (!state.profile) return null;
  return { ...state.profile, weight: state.metrics.at(-1)?.weight ?? state.profile.weight };
}

export function fuelNeedsSync(state: State): boolean {
  const profile = currentProfile(state);
  if (!profile?.targetWeight) return false;
  try { nutrition(profile); } catch { return false; }
  return JSON.stringify(state.targets.at(-1)?.inputs) !== JSON.stringify(profile)
    || !state.targets.at(-1)?.method.includes(CURRENT_FUEL_METHOD);
}

export function syncFuelTarget(state: State) {
  const profile = currentProfile(state);
  if (!profile?.targetWeight) return;
  let base: Target;
  try { base = nutrition(profile); } catch { return; }
  const previous = state.targets.at(-1);
  if (previous && JSON.stringify(previous.inputs) === JSON.stringify(profile)
    && previous.method.includes(CURRENT_FUEL_METHOD)) return;
  // Carry forward a bounded Coach adjustment until there is enough new trend data
  // for another review. Weight changes still refresh the formula baseline.
  const adjustment = previous?.inputs.targetWeight === profile.targetWeight
    && Math.abs(profile.targetWeight - profile.weight) >= 0.5
    ? previous.adjustment ?? 0 : 0;
  const calories = base.calories + adjustment;
  if (calories < 1200 || calories > base.maintenance * 1.2) return;
  state.targets.push({
    ...base, calories, adjustment,
    carbs: (calories - 4 * base.protein - 9 * base.fat) / 4,
    source: 'automatic-formula',
    timeline: planningTimeline(profile.weight, profile.targetWeight) ?? undefined,
    analysis: previous?.method.includes(CURRENT_FUEL_METHOD)
      ? 'Updated for the latest saved profile, current weight and target weight.'
      : previous ? 'Recalculated with the goal-gap method. The earlier fixed-percentage estimate remains in history.'
        : 'Starting estimate based on current weight and distance to target weight.',
  });
}

export type Trend = { earlierKg: number; recentKg: number; changeKgPerWeek: number; count: number; spanDays: number };
export function weightTrend(metrics: Metric[], now = new Date()): Trend | null {
  const today = Date.parse(now.toISOString().slice(0, 10));
  const recent = new Map<string, Metric>();
  for (const m of metrics) {
    const daysAgo = Math.round((today - Date.parse(m.date)) / 864e5);
    if (daysAgo >= 0 && daysAgo <= 28) recent.set(m.date, m);
  }
  const sorted = [...recent.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 6 || (today - Date.parse(sorted.at(-1)!.date)) / 864e5 > 7) return null;
  const earliest = Date.parse(sorted[0].date);
  const latest = Date.parse(sorted.at(-1)!.date);
  const spanDays = Math.round((latest - earliest) / 864e5);
  if (spanDays < 14) return null;
  const midpoint = earliest + (latest - earliest) / 2;
  const first = sorted.filter(m => Date.parse(m.date) < midpoint);
  const last = sorted.filter(m => Date.parse(m.date) >= midpoint);
  if (first.length < 3 || last.length < 3) return null;
  const average = (items: Metric[]) => items.reduce((sum, m) => sum + m.weight, 0) / items.length;
  const earlierKg = average(first), recentKg = average(last);
  return { earlierKg, recentKg, changeKgPerWeek: (recentKg - earlierKg) * 7 / spanDays, count: sorted.length, spanDays };
}

export function fuelReviewDue(state: State, now = new Date()): Trend | null {
  if (!state.profile?.targetWeight || !state.targets.length) return null;
  const currentWeight = state.metrics.at(-1)?.weight ?? state.profile.weight;
  if (Math.abs(state.profile.targetWeight - currentWeight) < 0.5) return null;
  const trend = weightTrend(state.metrics, now);
  if (!trend) return null;
  const previousReview = [...state.targets].reverse().find(t => t.source === 'ai-coach');
  if (previousReview && now.getTime() - Date.parse(previousReview.created) < 14 * 864e5) return null;
  // A historical edit cannot trigger a duplicate review without a new check-in.
  if (previousReview && Date.parse(state.metrics.at(-1)!.date) <= Date.parse(previousReview.created.slice(0, 10))) return null;
  return trend;
}

export function applyCoachFuelReview(state: State, delta: number, explanation: string, now = new Date()) {
  const trend = fuelReviewDue(state, now);
  if (!trend || !Number.isInteger(delta) || Math.abs(delta) > 150 || typeof explanation !== 'string' || explanation.length > 300)
    throw new Error('Coach review did not meet the adjustment rules.');
  const base = nutrition(currentProfile(state)!);
  const previous = state.targets.at(-1)!;
  const adjustment = Math.max(-150, Math.min(150, (previous.adjustment ?? 0) + delta));
  const calories = base.calories + adjustment;
  if (calories < 1200 || calories > base.maintenance * 1.2) throw new Error('The proposed target is outside safe bounds.');
  state.targets.push({ ...base, created: now.toISOString(), calories, adjustment,
    carbs: (calories - 4 * base.protein - 9 * base.fat) / 4,
    timeline: previous.timeline,
    source: 'ai-coach', analysis: explanation.trim(),
    method: `${base.method}; bounded AI trend review`,
  });
}

export function applyCoachTimeline(state: State, targetId: string, minWeeks: number, maxWeeks: number, explanation: string) {
  const target = state.targets.at(-1);
  const bounds = target?.inputs.targetWeight && planningTimeline(target.inputs.weight, target.inputs.targetWeight);
  if (!target || target.id !== targetId || !bounds || target.timeline?.source === 'ai-coach'
    || !Number.isInteger(minWeeks) || !Number.isInteger(maxWeeks)
    || minWeeks < bounds.minWeeks || maxWeeks > bounds.maxWeeks || minWeeks > maxWeeks
    || typeof explanation !== 'string' || !explanation.trim() || explanation.length > 280)
    throw new Error('Coach timeline did not meet the planning bounds.');
  target.timeline = { minWeeks, maxWeeks, explanation: explanation.trim(), source: 'ai-coach' };
}

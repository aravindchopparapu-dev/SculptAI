import type { Target } from './fitness.ts';

export function planningTimeline(currentKg: number, targetKg: number): Target['timeline'] | null {
  const distance = Math.abs(targetKg - currentKg);
  if (!Number.isFinite(distance) || distance < 0.5) return null;
  const gaining = targetKg > currentKg;
  // Deliberately broad planning assumptions. These are changes in scale weight,
  // not claims about muscle/fat gained or a promise about individual progress.
  const slowKgPerWeek = currentKg * (gaining ? 0.001 : 0.0025);
  const fastKgPerWeek = currentKg * (gaining ? 0.0025 : 0.0075);
  return {
    minWeeks: Math.max(2, Math.ceil(distance / fastKgPerWeek)),
    maxWeeks: Math.max(3, Math.ceil(distance / slowKgPerWeek)),
    source: 'planning',
    explanation: 'Broad planning range based on a gradual scale-weight change. Check-ins may move this range; it is not a deadline or a prediction of body composition.',
  };
}

import { coachReply, safetyResponse } from './coach.ts';
import { nutrition, type State } from './fitness.ts';
import { COACH_INSTRUCTIONS } from './coach-instructions.ts';
import { effectiveInstructions } from './admin-control.ts';
export type CoachConfig = { OPENAI_API_KEY?: string; OPENAI_MODEL?: string; adminGuidance?: string };
export function coachContext(state: State) {
  const p = state.profile;
  const metrics = state.metrics
    .slice(-12)
    .map((metric) => {
      const { id: _id, notes: _notes, ...safeMetric } = metric;
      return safeMetric;
    });
  let t = state.targets.at(-1);
  try {
    if (!p?.targetWeight || t?.inputs.targetWeight !== p.targetWeight) throw new Error();
    nutrition({ ...p, weight: state.metrics.at(-1)?.weight ?? p.weight });
  } catch {
    t = undefined;
  }
  return {
    profile: p
      ? {
          age: p.age,
          heightCm: p.height || null,
          startingWeightKg: p.weight || null,
          targetWeightKg: p.targetWeight || null,
          units: p.units,
          activity: p.activity,
          formulaSex: p.sex || null,
          goal: p.goal,
          days: p.days,
          minutes: p.minutes,
          equipment: p.equipment,
          experience: p.experience,
        }
      : null,
    bodyMetrics: { latest: metrics.at(-1) ?? null, history: metrics },
    mealFoods: state.mealFoods ?? null,
    mealPlan: state.mealPlan ? { created: state.mealPlan.created, totals: state.mealPlan.totals, status: "suggested, not consumed" } : null,
    plan: state.plans.at(-1)?.days ?? [],
    workouts: state.sessions
      .filter((s) => s.completed)
      .slice(-8)
      .map((s) => ({
        date: s.completed,
        name: s.name,
        status: s.status,
        sets: s.sets
          .filter((x) => x.done)
          .map((x) => ({
            exercise: x.exercise,
            reps: x.reps,
            loadKg: x.load,
            rpe: x.rpe ?? null,
          })),
      })),
    nutrition: t
      ? {
          calories: t.calories,
          protein: t.protein,
          fat: t.fat,
          carbs: t.carbs,
          adopted: t.created,
          method: t.method,
        }
      : null,
  };
}
export async function answerCoach(
  state: State,
  message: string,
  config: CoachConfig,
  request: typeof fetch = fetch,
) {
  const safe = safetyResponse(message);
  if (safe) return { answer: safe, mode: 'safety' };
  const fallback = () => ({
    answer: `Built-in training guide\n\n${coachReply(state, message)}`,
    mode: 'built-in',
  });
  if (!config.OPENAI_API_KEY || !config.OPENAI_MODEL || !state.profile)
    return fallback();
  try {
    const response = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: config.OPENAI_MODEL,
        store: false,
        max_output_tokens: 1800,
        instructions: effectiveInstructions(COACH_INSTRUCTIONS, config.adminGuidance ?? ''),
        input: JSON.stringify({
          savedRecords: coachContext(state),
          question: message,
        }),
      }),
    });
    if (!response.ok) throw new Error('Provider unavailable');
    const raw = await response.text();
    if (raw.length > 100_000) throw new Error('Unexpected response');
    const result = JSON.parse(raw) as {
      status?: string;
      output?: {
        type: string;
        content?: { type: string; text?: string; refusal?: string }[];
      }[];
    };
    if (result.status !== 'completed') throw new Error('Incomplete response');
    const text = (result.output ?? [])
      .filter((x) => x.type === 'message')
      .flatMap((x) => x.content ?? [])
      .map((x) =>
        x.type === 'output_text'
          ? x.text
          : x.type === 'refusal'
            ? x.refusal
            : '',
      )
      .filter(Boolean)
      .join('\n')
      .trim();
    if (!text || text.length > 6000) throw new Error('Empty response');
    return { answer: `Connected AI guide\n\n${text}`, mode: 'openai' };
  } catch {
    return {
      ...fallback(),
      answer: `The live AI service is unavailable. Your workouts are unaffected.\n\n${coachReply(state, message)}`,
    };
  }
}

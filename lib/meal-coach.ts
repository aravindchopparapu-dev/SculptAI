import type { State } from './fitness.ts';
import type { CoachConfig } from './live-coach.ts';
import { mealPlanContext, validateMealDraft, type MealDraft } from './meal-plan.ts';
import { MEAL_COACH_INSTRUCTIONS } from './meal-coach-instructions.ts';
import { effectiveInstructions } from './admin-control.ts';
export async function generateMealPlan(state: State, config: CoachConfig, request: typeof fetch = fetch) {
  const context = mealPlanContext(state);
  if (!config.OPENAI_API_KEY || !config.OPENAI_MODEL) throw new Error('Connect AI Coach to generate your meal plan. Your food list is saved.');
  const response = await request('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ model: config.OPENAI_MODEL, store: false, reasoning: { effort: 'low' },
      max_output_tokens: Math.min(8500, 3200 + context.items.length * 145),
      instructions: effectiveInstructions(MEAL_COACH_INSTRUCTIONS, config.adminGuidance ?? ''),
      input: JSON.stringify({ task: 'Return the requested daily meal plan as JSON.', foods: context.items, diet: context.diet, exclusions: context.exclusions, targets: context.targets, maintenanceCalories: context.maintenanceCalories }),
      text: { format: { type: 'json_object' } },
    }),
  });
  if (!response.ok) throw new Error('AI Coach is unavailable. Your saved foods and previous meal plan are unchanged. Try again.');
  const raw = await response.text();
  if (raw.length > 100_000) throw new Error('AI Coach returned an oversized plan. Please try again.');
  const result = JSON.parse(raw) as { status?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
  if (result.status !== 'completed') throw new Error('AI Coach could not finish the plan. Please try again.');
  const text = result.output?.filter(x => x.type === 'message').flatMap(x => x.content ?? []).filter(x => x.type === 'output_text').map(x => x.text ?? '').join('');
  if (!text) throw new Error('AI Coach did not return a meal plan. Please try again.');
  const draft = JSON.parse(text) as MealDraft & { status?: string; message?: string };
  if (draft.status === 'needs-foods') throw new Error(typeof draft.message === 'string' && draft.message.length <= 800 ? draft.message : 'Clarify your food choices before generating a plan.');
  if (draft.status !== 'ready') throw new Error('AI Coach returned an incomplete meal plan. Please try again.');
  validateMealDraft(state, draft);
  return { draft, contextKey: context.contextKey };
}

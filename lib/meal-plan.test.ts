import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { emptyState } from './fitness.ts';
import { applyAction } from './actions.ts';
import { readState, mutateState, Conflict } from './repository.ts';
import { generateMealPlan } from './meal-coach.ts';
import { emptyMealFoods, mealPlanContext, mealPlanIsCurrent, mealItemHeading, mealPortionLabel, validateMealDraft, validateMealFoods, type MealDraft } from './meal-plan.ts';
const profile = { name: 'Synthetic member', age: 30, sex: 'Male', height: 175, weight: 80, targetWeight: 75,
  goal: 'Fat loss', days: 3, minutes: 45, equipment: 'Gym', experience: 'Beginner', activity: 1.375,
  units: 'Metric', diet: 'Omnivore', exclusions: '', avoid: '', eligible: true };
const foods = { ...emptyMealFoods(), breakfast: ['oats'], lunch: ['chicken'], dinner: ['lentils'] };
function setup() { return applyAction(applyAction(emptyState(), { type: 'profile', profile }), { type: 'mealFoods', foods }); }
// Deliberately synthetic nutrient values to exercise arithmetic, not a food database.
const draft = (): MealDraft => ({ notes: 'Synthetic test only.', meals: ['breakfast','lunch','dinner'].map(slot => ({
  slot: slot as 'breakfast' | 'lunch' | 'dinner', items: [{ foodId: `${slot}-0`, grams: 225, basis: 'test fixture', per100g: { protein: 20, carbs: 40, fat: 10 } }],
})) });
void test('Meal cards use everyday portions for countable foods and grams for weighed or mixed foods', () => {
  assert.equal(mealPortionLabel({ food: 'Banana', grams: 120 }), '1 banana');
  assert.equal(mealPortionLabel({ food: 'Apple', grams: 180 }), '1 apple');
  assert.equal(mealPortionLabel({ food: 'Boiled egg whites', grams: 60 }), '2 egg whites');
  assert.equal(mealPortionLabel({ food: 'Whole eggs', grams: 100 }), '2 eggs');
  assert.equal(mealPortionLabel({ food: 'Olive oil', grams: 20 }), '1.5 tbsp');
  assert.equal(mealPortionLabel({ food: 'Cooked chicken breast', grams: 180 }), '180 g');
  assert.equal(mealPortionLabel({ food: 'Apple pie', grams: 180 }), '180 g');
  assert.equal(mealPortionLabel({ food: 'Apple', grams: 110 }), '110 g');
  assert.equal(mealPortionLabel({ food: 'Tortilla', grams: 45, portionLabel: '1 tortilla' }), '1 tortilla');
  assert.equal(mealItemHeading({ food: 'Banana', grams: 120 }), '1 banana');
  assert.equal(mealItemHeading({ food: 'Boiled egg whites', grams: 60 }), '2 boiled egg whites');
  assert.equal(mealItemHeading({ food: 'Cooked chicken breast', grams: 180 }), '180 g · Cooked chicken breast');
  assert.equal(mealItemHeading({ food: 'Greek yogurt', grams: 180 }), '180 g · Greek yogurt');
});
void test('Optional household labels survive validation without changing nutrient arithmetic', () => {
  const withLabel = draft(); withLabel.meals[0].items[0].portionLabel = '1 bowl';
  const plan = validateMealDraft(setup(), withLabel);
  assert.equal(plan.meals[0].items[0].portionLabel, '1 bowl');
  assert.equal(plan.totals.calories, 2227.5);
  withLabel.meals[0].items[0].portionLabel = '225 grams';
  assert.throws(() => validateMealDraft(setup(), withLabel), /serving unit/);
});
void test('Breakfast, lunch and dinner are mandatory; snack sections may be blank', async () => {
  assert.deepEqual(validateMealFoods(foods), foods);
  for (const slot of ['breakfast','lunch','dinner']) {
    assert.throws(() => validateMealFoods({ ...foods, [slot]: [] }), /Add at least one food/);
    const state = setup(); state.mealFoods = { ...foods, [slot]: [] };
    let called = false;
    await assert.rejects(generateMealPlan(state, { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'test' }, (async () => { called = true; return Response.json({}); }) as typeof fetch));
    assert.equal(called, false);
  }
  assert.throws(() => validateMealFoods({ ...foods, lunch: ['a'.repeat(121)] }), /120/);
});
void test('Unlisted foods, skipped meals, duplicate items and invalid nutrition are rejected', () => {
  const s = setup();
  const added = draft(); added.meals[0].items[0].foodId = 'unlisted-food';
  assert.throws(() => validateMealDraft(s, added), /outside your list/);
  const missing = draft(); missing.meals.pop(); assert.throws(() => validateMealDraft(s, missing), /incomplete/);
  const duplicated = draft(); duplicated.meals[0].items.push(duplicated.meals[0].items[0]); assert.throws(() => validateMealDraft(s, duplicated), /outside/);
  const invalid = draft(); invalid.meals[0].items[0].per100g.fat = -1; assert.throws(() => validateMealDraft(s, invalid), /nutrient/);
  const optional = applyAction(s, { type: 'mealFoods', foods: { ...foods, morningSnack: ['apple'] } });
  assert.throws(() => validateMealDraft(optional, draft()), /all your selected foods/);
});
void test('Server totals sum portions and generated plans become stale after food or target changes', () => {
  const s = setup(), result = validateMealDraft(s, draft());
  assert.equal(result.totals.protein, 135); assert.equal(result.totals.carbs, 270); assert.equal(result.totals.fat, 67.5);
  assert.equal(result.totals.calories, 2227.5);
  const saved = applyAction(s, { type: 'generatedMealPlan', contextKey: mealPlanContext(s).contextKey, draft: draft() });
  assert.equal(mealPlanIsCurrent(saved), true);
  const changed = applyAction(saved, { type: 'mealFoods', foods: { ...foods, breakfast: ['eggs'] } });
  assert.equal(mealPlanIsCurrent(changed), false); assert.deepEqual(changed.mealPlan, saved.mealPlan);
  assert.throws(() => applyAction(changed, { type: 'generatedMealPlan', contextKey: mealPlanContext(saved).contextKey, draft: draft() }), /changed/);
  const targetChanged = applyAction(saved, { type: 'profile', profile: { ...profile, targetWeight: 70 } });
  assert.equal(mealPlanIsCurrent(targetChanged), false);
});
void test('AI receives saved foods and Fuel targets, handles refusal/failure, and does not mutate records', async () => {
  const s = setup(), before = structuredClone(s); let payload: Record<string, unknown> = {};
  const request = (async (_url: unknown, options: RequestInit) => {
    payload = JSON.parse(options.body as string);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ ...draft(), status: 'ready', message: '' }) }] }] });
  }) as typeof fetch;
  await generateMealPlan(s, { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'test' }, request);
  assert.equal(payload.store, false); assert.match(payload.input as string, /JSON/); assert.match(payload.input as string, /breakfast-0/); assert.ok(!(payload.input as string).includes('Synthetic member'));
  assert.deepEqual(s, before);
  await assert.rejects(generateMealPlan(s, { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'test' }, (async () => new Response('', { status: 503 })) as typeof fetch), /unavailable/);
  await assert.rejects(generateMealPlan(s, {}, request), /Connect AI/);
  assert.deepEqual(s, before);
});
void test('Food choices and plan persist per account and concurrent writes cannot overwrite them', async () => {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync(new URL('../drizzle/0000_glossy_ironclad.sql', import.meta.url), 'utf8'));
  const db = { prepare(sql: string) { return { bind(...args: unknown[]) { const stmt = sqlite.prepare(sql); return {
    async first() { return stmt.get(...args as []) ?? null; }, async run() { return { meta: { changes: Number(stmt.run(...args as []).changes) } }; },
  }; } }; } } as unknown as D1Database;
  let saved = await mutateState(db, 'meal-test', 0, crypto.randomUUID(), { type: 'profile', profile });
  saved = await mutateState(db, 'meal-test', saved.revision, crypto.randomUUID(), { type: 'mealFoods', foods });
  const revision = saved.revision;
  saved = await mutateState(db, 'meal-test', revision, crypto.randomUUID(), { type: 'generatedMealPlan', contextKey: mealPlanContext(saved.state).contextKey, draft: draft() });
  const reloaded = await readState(db, 'meal-test'); assert.deepEqual(reloaded, saved);
  assert.deepEqual(reloaded.state.mealFoods, foods); assert.ok(reloaded.state.mealPlan);
  assert.equal((await readState(db, 'another-member')).state.mealPlan, undefined);
  await assert.rejects(mutateState(db, 'meal-test', revision, crypto.randomUUID(), { type: 'mealFoods', foods }), Conflict);
  sqlite.close();
});

void test('Optional snacks appear only when supplied and all entered meals are included', () => {
  const state = applyAction(setup(), { type: 'mealFoods', foods: { ...foods, morningSnack: ['apple'], eveningSnack: ['yogurt'], lateSnack: ['milk'] } });
  const context = mealPlanContext(state);
  const content: MealDraft = { notes: 'Synthetic fixture.', meals: context.items.map(food => ({ slot: food.slot,
    items: [{ foodId: food.foodId, grams: 112.5, basis: 'test', per100g: { protein: 20, carbs: 40, fat: 10 } }],
  })) };
  const plan = validateMealDraft(state, content);
  assert.equal(plan.meals.length, 6);
  assert.equal(plan.totals.calories, 2227.5);
});

void test('Explained Coach additions are totaled and saved without changing selected foods', () => {
  const state = setup(), content = draft();
  content.meals[0].items.push({ foodId: 'suggested-olive-oil', suggestedFood: 'Olive oil', reason: 'Provides dietary fat and energy without a large additional grain portion.', grams: 10, basis: 'as added', per100g: { protein: 0, carbs: 0, fat: 100 } });
  const saved = applyAction(state, { type: 'generatedMealPlan', contextKey: mealPlanContext(state).contextKey, draft: content });
  assert.deepEqual(saved.mealFoods, foods);
  assert.equal(saved.mealPlan?.totals.calories, 2317.5);
  assert.equal(saved.mealPlan?.meals[0].items[1].food, 'Olive oil');
  assert.match(saved.mealPlan!.meals[0].items[1].reason!, /dietary fat/);
  const unexplained = structuredClone(content); delete unexplained.meals[0].items[1].reason;
  assert.throws(() => validateMealDraft(state, unexplained), /explain/);
  const duplicate = structuredClone(content); duplicate.meals[1].items.push(duplicate.meals[0].items[1]);
  assert.throws(() => validateMealDraft(state, duplicate), /explain/);
  const replaced = structuredClone(content); replaced.meals[0].items.shift();
  assert.throws(() => validateMealDraft(state, replaced), /all your selected/);
});

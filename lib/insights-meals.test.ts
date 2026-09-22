import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strengthOptions, strengthTrend } from './insights.ts';
import { matchingMeals, mealExample, mealTemplates } from './meals.ts';
import { foodData } from './food-data.ts';
import type { Session } from './fitness.ts';
function workout(id: string, date: string, load: number): Session {
  return {
    id,
    planId: 'original-plan',
    name: 'Test',
    dayIndex: 0,
    started: date,
    completed: date,
    status: 'partial',
    notes: '',
    sets: [
      { exercise: 'Bench press', index: 0, reps: 8, load, done: true },
      {
        exercise: 'Bench press',
        index: 1,
        reps: 8,
        load: load - 2,
        done: true,
      },
      { exercise: 'Bench press', index: 2, reps: 3, load: 150, done: true },
      { exercise: 'Bench press', index: 3, reps: 8, load: 999, done: false },
      {
        exercise: 'Bench press',
        index: 4,
        reps: 8,
        load: 999,
        done: true,
        skipped: true,
      },
      { exercise: 'Push-up', index: 0, reps: 8, load: 0, done: true },
    ],
  };
}
void test('Strength trend compares identical reps, excludes skipped/unfinished sets and preserves partial work', () => {
  const older = workout('first', '2026-08-01T10:00:00Z', 40),
    newer = workout('second', '2026-09-01T10:00:00Z', 45);
  const pending = {
    ...workout('active', '2026-09-09T10:00:00Z', 90),
    completed: undefined,
  };
  const sessions = [newer, pending, older],
    snapshot = structuredClone(sessions);
  assert.deepEqual(
    strengthTrend(sessions, 'Bench press', 8, 'Metric').map((p) => [
      p.id,
      p.value,
    ]),
    [
      ['first', 40],
      ['second', 45],
    ],
  );
  assert.deepEqual(strengthOptions(sessions), [
    { exercise: 'Bench press', reps: [3, 8] },
  ]);
  assert.deepEqual(sessions, snapshot);
});
void test('Strength records convert display units without changing stored kg, and absent comparisons stay empty', () => {
  const sessions = [workout('a', '2026-09-01T10:00:00Z', 40)];
  assert.equal(
    strengthTrend(sessions, 'Bench press', 8, 'Imperial')[0].value,
    88.2,
  );
  assert.deepEqual(strengthTrend(sessions, 'Bench press', 12, 'Metric'), []);
  assert.deepEqual(strengthTrend(sessions, 'Push-up', 8, 'Metric'), []);
});
void test('Meal selection respects dietary patterns, soy aliases and multi-word exclusions', () => {
  assert.equal(matchingMeals('Omnivore', '').length, 4);
  assert.equal(matchingMeals('Vegetarian', '').length, 3);
  assert.deepEqual(
    matchingMeals('Vegan', 'soy allergy; rice-free').map((m) => m.id),
    [],
  );
  assert.deepEqual(
    matchingMeals('Vegan', 'no soya').map((m) => m.id),
    ['lentil-bowl'],
  );
  assert.equal(matchingMeals('Vegetarian', 'eggplant').length, 3);
  assert.equal(matchingMeals('Omnivore', 'eggs, chicken, tofu').length, 1);
  assert.equal(matchingMeals('Omnivore', 'olive oil').length, 0);
});
void test('Meal examples use all ingredient quantities and scale estimated USDA totals consistently', () => {
  const chicken = mealTemplates.find((m) => m.id === 'chicken-plate')!;
  const basic = mealExample(chicken),
    larger = mealExample(chicken, 1.5);
  // Independently checked per-100g source values: chicken 165, rice 123, broccoli 35, oil 884 kcal.
  assert.ok(Math.abs(basic.totals.calories - 572.9) < 1e-8);
  assert.equal(
    basic.ingredients.find((i) => i.name === 'Chicken breast')?.grams,
    150,
  );
  assert.match(basic.ingredients[0].basis, /cooked weight/);
  for (const field of ['calories', 'protein', 'fat', 'carbs'] as const)
    assert.ok(
      Math.abs(larger.totals[field] - basic.totals[field] * 1.5) < 1e-8,
    );
  assert.throws(() => mealExample(chicken, 0), /supported/);
  assert.throws(() => mealExample(chicken, NaN), /supported/);
});
void test('Food references retain per-100g values, source identifiers and explicit preparation basis', () => {
  assert.equal(foodData.tofu.fdcId, '172475');
  assert.match(foodData.tofu.description, /raw, firm/);
  assert.equal(foodData.oil.per100g.fat, 100);
  assert.equal(foodData.lentils.per100g.calories, 116);
  for (const template of mealTemplates) {
    const example = mealExample(template, 0.75);
    assert.ok(
      Object.values(example.totals).every((n) => Number.isFinite(n) && n > 0),
    );
    assert.ok(
      example.ingredients.every(
        (i) => i.basis && i.source.startsWith('https://fdc.nal.usda.gov/'),
      ),
    );
  }
});

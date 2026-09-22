import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { applyAction } from '../lib/actions.ts';
import { mealPlanContext, mealSlots } from '../lib/meal-plan.ts';
const { chromium } = createRequire(import.meta.url)('playwright');
// Synthetic live-provider output; never sends member data to AI or writes their account.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/synthetic-meal-plan.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'America/Denver' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let snapshot, generateCalls = 0, failGeneration = true;
    await page.route('**/api/**', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const body = route.request().postDataJSON();
      if (route.request().url().endsWith('/api/state') && ['mealFoods','fuelSync'].includes(body.action?.type)) {
        snapshot = { ...snapshot, state: applyAction(snapshot.state, body.action), revision: snapshot.revision + 1 };
        return route.fulfill({ json: snapshot });
      }
      if (route.request().url().endsWith('/api/meals/generate')) {
        generateCalls++;
        assert.deepEqual(body.foods, snapshot.state.mealFoods);
        if (failGeneration) return route.fulfill({ status: 503, json: { error: 'Synthetic unavailable response.' } });
        const draft = structuredClone(fixture.result.draft);
        draft.meals[0].items.push({ foodId: 'suggested-oil', suggestedFood: 'Olive oil', reason: 'Adds dietary fat and energy in a modest portion.', grams: 5, basis: 'as added', per100g: { protein: 0, carbs: 0, fat: 100 } });
        const scale = snapshot.state.targets.at(-1).calories / fixture.state.targets.at(-1).calories;
        for (const meal of draft.meals) for (const item of meal.items) item.grams *= scale;
        snapshot = { ...snapshot, state: applyAction(snapshot.state, { type: 'generatedMealPlan', contextKey: mealPlanContext(snapshot.state).contextKey, draft }), revision: snapshot.revision + 1 };
        return route.fulfill({ json: snapshot });
      }
      throw new Error('Unexpected write attempted in read-only test.');
    });
    await page.goto('http://localhost:3001/signin-with-chatgpt?return_to=%2F%3Ftab%3Dfuel');
    await page.waitForLoadState('networkidle');
    snapshot = await (await context.request.get('http://localhost:3001/api/state')).json();
    assert.equal(await page.getByText('A flexible plate', { exact: true }).count(), 0);
    if (await page.getByRole('button', { name: 'Edit food choices', exact: true }).count()) await page.getByRole('button', { name: 'Edit food choices', exact: true }).click();
    const breakfast = page.getByLabel('Breakfast (required)', { exact: true });
    await breakfast.fill('');
    await page.getByRole('button', { name: /^(Generate|Regenerate) my meal plan$/ }).click();
    assert.equal(generateCalls, 0);
    assert.equal(await breakfast.evaluate(element => element.validity.valueMissing), true);
    await page.getByText('Add optional snacks', { exact: true }).click();
    for (const slot of mealSlots)
      await page.getByLabel(`${slot.label} (${slot.required ? 'required' : 'optional'})`, { exact: true }).fill(fixture.state.mealFoods[slot.id].join('\n'));
    await page.getByRole('button', { name: /^(Generate|Regenerate) my meal plan$/ }).click();
    await page.getByText('Synthetic unavailable response.', { exact: true }).waitFor();
    assert.deepEqual(snapshot.state.mealFoods, fixture.state.mealFoods);
    await page.getByText('✓ Food choices saved to your account.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Food choices saved', exact: true }).isDisabled(), true);
    await page.getByRole('heading', { name: 'Your saved food choices', exact: true }).waitFor();
    failGeneration = false;
    await page.getByRole('button', { name: /^(Generate|Regenerate) my meal plan$/ }).click();
    await page.getByText('Your meal plan is ready and saved.', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Your saved daily meal plan', exact: true }).waitFor();
    assert.equal(snapshot.state.mealPlan.meals.length, 3);
    for (const meal of snapshot.state.mealPlan.meals) for (const item of meal.items)
      assert.ok(item.suggestedFood || fixture.state.mealFoods[meal.slot].includes(item.food));
    await page.getByText('Coach suggestion', { exact: true }).waitFor();
    await page.getByText('Why the Coach suggests additional foods', { exact: true }).click();
    await page.getByText('Scientific background: NIDDK healthy eating guidance', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit food choices', exact: true }).click();
    await breakfast.fill('Different breakfast food');
    await page.getByText('Unsaved changes — save your food choices or generate a meal plan to save them.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).isEnabled(), true);
    await page.getByText('Your foods, profile or Fuel targets have changed.', { exact: false }).waitFor();
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
    await context.close();
    console.log(`PASS ${viewport.width}px: required foods, generation failure/retry, saved result, target totals and stale-plan notice`);
  }
  const demo = await browser.newContext(); const page = await demo.newPage();
  await page.goto('http://localhost:3001/?demo=1&tab=fuel');
  for (const slot of mealSlots.filter(slot => slot.required)) await page.getByLabel(`${slot.label} (required)`, { exact: true }).fill(fixture.state.mealFoods[slot.id].join('\n'));
  await page.getByText('Add optional snacks', { exact: true }).click();
  await page.getByLabel('Evening snack (optional)', { exact: true }).fill('Apple');
  await page.getByRole('button', { name: /^(Save food choices|Save changes)$/ }).click();
  await page.getByText('Your food choices are saved.', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('✓ Food choices saved in this demo tab.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit food choices', exact: true }).click();
  assert.equal(await page.getByLabel('Breakfast (required)', { exact: true }).inputValue(), fixture.state.mealFoods.breakfast.join('\n'));
  await page.getByText('Add optional snacks', { exact: true }).click();
  assert.equal(await page.getByLabel('Evening snack (optional)', { exact: true }).inputValue(), 'Apple');
  console.log('PASS demo food saving, optional snacks and refresh persistence');
  await demo.close();
} finally { await browser.close(); }

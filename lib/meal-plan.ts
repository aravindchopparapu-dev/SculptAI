import { nutrition, type State } from './fitness.ts';
import { fuelNeedsSync } from './fuel-adaptation.ts';

export const mealSlots = [
  { id: 'breakfast', label: 'Breakfast', required: true },
  { id: 'lunch', label: 'Lunch', required: true },
  { id: 'dinner', label: 'Dinner', required: true },
  { id: 'morningSnack', label: 'Morning snack', required: false },
  { id: 'eveningSnack', label: 'Evening snack', required: false },
  { id: 'lateSnack', label: 'Late-night snack', required: false },
] as const;
export type MealSlot = (typeof mealSlots)[number]['id'];
export type MealFoods = Record<MealSlot, string[]>;
export type Macros = { calories: number; protein: number; carbs: number; fat: number };
export type MealDraft = { notes: string; meals: { slot: MealSlot; items: {
  foodId: string; suggestedFood?: string; reason?: string; portionLabel?: string; grams: number; basis: string; per100g: { protein: number; carbs: number; fat: number };
}[] }[] };
export type SavedMealPlan = {
  id: string; created: string; contextKey: string; notes: string; targets: Macros;
  meals: { slot: MealSlot; items: (MealDraft['meals'][number]['items'][number] & { food: string; totals: Macros })[]; totals: Macros }[];
  totals: Macros;
};
export const emptyMealFoods = (): MealFoods => ({ breakfast: [], lunch: [], dinner: [], morningSnack: [], eveningSnack: [], lateSnack: [] });
export function validateMealFoods(value: unknown): MealFoods {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter your foods for breakfast, lunch and dinner.');
  const result = emptyMealFoods();
  for (const slot of mealSlots) {
    const items = (value as Record<string, unknown>)[slot.id] ?? [];
    if (!Array.isArray(items) || items.length > 12 || items.some(item => typeof item !== 'string' || item.trim().length < 2 || item.length > 120))
      throw new Error(`${slot.label}: enter up to 12 food items, each 2–120 characters.`);
    result[slot.id] = [...new Set((items as string[]).map(item => item.trim()))];
    if (slot.required && !result[slot.id].length) throw new Error(`Add at least one food for ${slot.label.toLowerCase()}.`);
  }
  return result;
}
export function mealPlanContext(state: State) {
  const foods = validateMealFoods(state.mealFoods);
  const p = state.profile, target = state.targets.at(-1);
  if (!p?.targetWeight || !target || fuelNeedsSync(state) || target.inputs.targetWeight !== p.targetWeight)
    throw new Error('Save a current Fuel target in Profile before generating your meal plan.');
  nutrition({ ...p, weight: state.metrics.at(-1)?.weight ?? p.weight });
  const targets = { calories: target.calories, protein: target.protein, carbs: target.carbs, fat: target.fat };
  return { foods, targets, maintenanceCalories: nutrition({ ...p, weight: state.metrics.at(-1)?.weight ?? p.weight }).maintenance, diet: p.diet, exclusions: p.exclusions,
    contextKey: JSON.stringify({ foods, targetId: target.id, diet: p.diet, exclusions: p.exclusions }),
    items: mealSlots.flatMap(slot => foods[slot.id].map((food, index) => ({ foodId: `${slot.id}-${index}`, slot: slot.id, food }))),
  };
}
export function mealPlanIsCurrent(state: State) {
  try { return state.mealPlan?.contextKey === mealPlanContext(state).contextKey; } catch { return false; }
}
const zero = (): Macros => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
const add = (a: Macros, b: Macros): Macros => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat });
type PortionItem = { food: string; grams: number; portionLabel?: string };
const countPortion = (grams: number, each: number, singular: string, plural: string, step = 1) => {
  const count = Math.round(grams / each / step) * step;
  if (count < step || count > 12 || Math.abs(grams - count * each) / (count * each) > 0.15) return null;
  return `${count} ${count === 1 ? singular : plural}`;
};
export function mealPortionLabel(item: PortionItem): string {
  const food = item.food.toLowerCase().trim();
  const simpleEgg = food.replace(/[(),]/g, ' ').replace(/\b(whole|boiled|poached|fried|scrambled|cooked|raw|organic)\b/g, '').replace(/\s+/g, ' ').trim();
  if (/^egg whites?$/.test(simpleEgg)) return countPortion(item.grams, 30, 'egg white', 'egg whites') ?? `${Math.round(item.grams)} g`;
  if (/^eggs?$/.test(simpleEgg)) return countPortion(item.grams, 50, 'egg', 'eggs') ?? `${Math.round(item.grams)} g`;
  const simpleFruit = food.replace(/[(),]/g, ' ').replace(/\b(fresh|ripe|raw|peeled|medium|small|large|red|green|organic|whole)\b/g, '').replace(/\s+/g, ' ').trim();
  for (const [pattern, grams, singular, plural] of [
    [/^bananas?$/, 120, 'banana', 'bananas'],
    [/^apples?$/, 180, 'apple', 'apples'],
    [/^oranges?$/, 130, 'orange', 'oranges'],
    [/^pears?$/, 180, 'pear', 'pears'],
    [/^kiwis?$/, 75, 'kiwi', 'kiwis'],
  ] as const) {
    if (pattern.test(simpleFruit)) return countPortion(item.grams, grams, singular, plural, 0.5) ?? `${Math.round(item.grams)} g`;
  }
  if (/^(extra virgin )?(olive|avocado|canola|vegetable) oil$/.test(food)) {
    return countPortion(item.grams, 14, 'tbsp', 'tbsp', 0.5) ?? countPortion(item.grams, 4.7, 'tsp', 'tsp', 0.5) ?? `${Math.round(item.grams)} g`;
  }
  return item.portionLabel?.trim() || `${Math.round(item.grams)} g`;
}
export function mealItemHeading(item: PortionItem): string {
  const portion = mealPortionLabel(item);
  const counted = /^(\d+(?:\.5)?) (.+)$/.exec(portion);
  if (counted && counted[2].toLowerCase() !== 'g' && item.food.toLowerCase().includes(counted[2].toLowerCase()))
    return `${counted[1]} ${item.food.charAt(0).toLowerCase()}${item.food.slice(1)}`;
  return `${portion} · ${item.food}`;
}
export function validateMealDraft(state: State, value: unknown): Pick<SavedMealPlan, 'meals' | 'notes' | 'totals' | 'targets'> {
  const context = mealPlanContext(state);
  const draft = value as MealDraft;
  if (!draft || !Array.isArray(draft.meals) || draft.meals.length < 3 || draft.meals.length > 6 ||
    typeof draft.notes !== 'string' || draft.notes.length > 1200) throw new Error('AI Coach returned an incomplete meal plan. Please try again.');
  const seenSlots = new Set<string>(), seenFoods = new Set<string>(), seenSuggestions = new Set<string>();
  const meals = draft.meals.map(meal => {
    const slot = mealSlots.find(s => s.id === meal.slot);
    if (!slot || seenSlots.has(meal.slot) || !context.foods[meal.slot].length || !Array.isArray(meal.items) || !meal.items.length || meal.items.length > 16)
      throw new Error('The meal plan must match your meal sections. Please try again.');
    seenSlots.add(meal.slot);
    const items = meal.items.map(item => {
      const food = context.items.find(food => food.foodId === item.foodId && food.slot === meal.slot);
      const suggestion = !food && typeof item.foodId === 'string' && /^suggested-[a-zA-Z0-9-]+$/.test(item.foodId);
      if (suggestion) {
        if (seenSuggestions.has(item.foodId) || seenSuggestions.size >= 6 || typeof item.suggestedFood !== 'string' || item.suggestedFood.trim().length < 2 || item.suggestedFood.length > 120 || typeof item.reason !== 'string' || item.reason.trim().length < 15 || item.reason.length > 600)
          throw new Error('AI Coach must explain each suggested addition. Please try again.');
        seenSuggestions.add(item.foodId);
      } else {
        if (!food || seenFoods.has(item.foodId) || item.suggestedFood || item.reason) throw new Error('AI Coach included a food outside your list. Please try again.');
        seenFoods.add(item.foodId);
      }
      if (!Number.isFinite(item.grams) || item.grams < 1 || item.grams > 800 || typeof item.basis !== 'string' || !item.basis.trim() || item.basis.length > 180)
        throw new Error('AI Coach returned an unclear portion. Please try again.');
      if (item.portionLabel !== undefined && (typeof item.portionLabel !== 'string' || !/^\d+(?:\.5)? [a-z][a-z -]{0,39}$/i.test(item.portionLabel.trim()) || /\b(?:g|grams?)\b/i.test(item.portionLabel)))
        throw new Error('AI Coach returned an unclear serving unit. Please try again.');
      const m = item.per100g;
      if (!m || ['protein', 'carbs', 'fat'].some(key => !Number.isFinite(m[key as keyof typeof m]) || m[key as keyof typeof m] < 0 || m[key as keyof typeof m] > 100) || m.protein + m.carbs + m.fat > 105)
        throw new Error('AI Coach returned invalid nutrient estimates. Please try again.');
      const totals = { protein: m.protein * item.grams / 100, carbs: m.carbs * item.grams / 100, fat: m.fat * item.grams / 100,
        calories: (4 * m.protein + 4 * m.carbs + 9 * m.fat) * item.grams / 100 };
      return { foodId: item.foodId, food: food?.food ?? item.suggestedFood!.trim(), ...(suggestion ? { suggestedFood: item.suggestedFood!.trim(), reason: item.reason!.trim() } : {}), ...(item.portionLabel ? { portionLabel: item.portionLabel.trim() } : {}), grams: item.grams, basis: item.basis.trim(), per100g: { protein: m.protein, carbs: m.carbs, fat: m.fat }, totals };
    });
    return { slot: meal.slot, items, totals: items.reduce((sum, item) => add(sum, item.totals), zero()) };
  });
  if (mealSlots.some(slot => context.foods[slot.id].length && !seenSlots.has(slot.id)) || seenFoods.size !== context.items.length)
    throw new Error('The plan did not include all your selected foods. Please try again.');
  const totals = meals.reduce((sum, meal) => add(sum, meal.totals), zero());
  if (totals.calories < 1200 || totals.calories < context.targets.calories * 0.8 || totals.calories > context.targets.calories * 1.2 || totals.protein < context.targets.protein * 0.5)
    throw new Error('These portions are too far from your Fuel targets. Add a wider choice of foods and try again.');
  return { meals, totals, notes: draft.notes.trim(), targets: context.targets };
}

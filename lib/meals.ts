import { foodData } from './food-data.ts';
export { foodSource } from './food-data.ts';
type Food = keyof typeof foodData;
export type Meal = {
  id: string;
  name: string;
  diet: 'Vegan' | 'Vegetarian' | 'Omnivore';
  ingredients: { food: Food; grams: number }[];
};
const labels: Record<Food, { name: string; basis: string; aliases: string[] }> =
  {
    lentils: {
      name: 'Lentils',
      basis: 'cooked, boiled without salt',
      aliases: ['lentil', 'lentils', 'legume', 'legumes', 'pulses'],
    },
    tofu: {
      name: 'Firm tofu',
      basis: 'raw weight, calcium-set',
      aliases: [
        'tofu',
        'soy',
        'soya',
        'soybean',
        'soybeans',
        'legume',
        'legumes',
      ],
    },
    rice: {
      name: 'Brown rice',
      basis: 'cooked, long-grain',
      aliases: ['rice', 'brown rice', 'grain', 'grains'],
    },
    broccoli: {
      name: 'Broccoli',
      basis: 'cooked, boiled and drained',
      aliases: ['broccoli'],
    },
    oil: {
      name: 'Olive oil',
      basis: 'as added; all counted',
      aliases: ['oil', 'olive', 'olives', 'olive oil'],
    },
    eggs: {
      name: 'Eggs',
      basis: 'hard-boiled, shell removed',
      aliases: ['egg', 'eggs'],
    },
    potatoes: {
      name: 'Potato',
      basis: 'boiled, peeled',
      aliases: ['potato', 'potatoes', 'nightshade', 'nightshades'],
    },
    chicken: {
      name: 'Chicken breast',
      basis: 'roasted, skinless cooked weight',
      aliases: ['chicken', 'poultry', 'meat'],
    },
  };
export const mealTemplates: Meal[] = [
  {
    id: 'lentil-bowl',
    name: 'Lentil & rice bowl',
    diet: 'Vegan',
    ingredients: [
      { food: 'lentils', grams: 200 },
      { food: 'rice', grams: 150 },
      { food: 'broccoli', grams: 100 },
      { food: 'oil', grams: 10 },
    ],
  },
  {
    id: 'tofu-bowl',
    name: 'Tofu & greens bowl',
    diet: 'Vegan',
    ingredients: [
      { food: 'tofu', grams: 150 },
      { food: 'rice', grams: 150 },
      { food: 'broccoli', grams: 150 },
      { food: 'oil', grams: 5 },
    ],
  },
  {
    id: 'egg-plate',
    name: 'Egg & potato plate',
    diet: 'Vegetarian',
    ingredients: [
      { food: 'eggs', grams: 150 },
      { food: 'potatoes', grams: 200 },
      { food: 'broccoli', grams: 150 },
      { food: 'oil', grams: 5 },
    ],
  },
  {
    id: 'chicken-plate',
    name: 'Chicken & rice plate',
    diet: 'Omnivore',
    ingredients: [
      { food: 'chicken', grams: 150 },
      { food: 'rice', grams: 150 },
      { food: 'broccoli', grams: 150 },
      { food: 'oil', grams: 10 },
    ],
  },
];
export function matchingMeals(diet: string, exclusions: string) {
  const tokens = exclusions
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const excluded = (alias: string) => ` ${tokens} `.includes(` ${alias} `);
  return mealTemplates.filter(
    (m) =>
      (diet === 'Omnivore' ||
        m.diet === 'Vegan' ||
        (diet === 'Vegetarian' && m.diet === 'Vegetarian')) &&
      !m.ingredients.some(({ food }) => labels[food].aliases.some(excluded)),
  );
}
export function mealExample(meal: Meal, scale = 1) {
  if (![0.75, 1, 1.25, 1.5].includes(scale))
    throw new Error('Choose a supported example portion.');
  const ingredients = meal.ingredients.map(({ food, grams }) => ({
    ...labels[food],
    grams: grams * scale,
    source: `https://fdc.nal.usda.gov/food-details/${foodData[food].fdcId}/nutrients`,
    data: foodData[food].per100g,
  }));
  const totals = ingredients.reduce(
    (total, { grams, data }) => ({
      calories: total.calories + (data.calories * grams) / 100,
      protein: total.protein + (data.protein * grams) / 100,
      carbs: total.carbs + (data.carbs * grams) / 100,
      fat: total.fat + (data.fat * grams) / 100,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { ingredients, totals };
}

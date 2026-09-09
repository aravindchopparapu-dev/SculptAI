// Generated from USDA reference data by scripts/import-food-data.py.
// Energy is kcal and macronutrients are grams per 100 g edible food.
export const foodSource = {
  name: 'USDA FoodData Central \u00b7 SR Legacy (April 2018)',
  url: 'https://fdc.nal.usda.gov/download-datasets/',
  archiveUrl:
    'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  sha256: 'b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0',
  accessed: '2026-09-09',
} as const;
export const foodData = {
  lentils: {
    fdcId: '172421',
    description: 'Lentils, mature seeds, cooked, boiled, without salt',
    publicationDate: '2019-04-01',
    per100g: {
      carbs: 20.13,
      calories: 116.0,
      protein: 9.02,
      fat: 0.38,
    },
  },
  tofu: {
    fdcId: '172475',
    description: 'Tofu, raw, firm, prepared with calcium sulfate',
    publicationDate: '2019-04-01',
    per100g: {
      carbs: 2.78,
      calories: 144.0,
      protein: 17.27,
      fat: 8.72,
    },
  },
  rice: {
    fdcId: '169704',
    description:
      "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)",
    publicationDate: '2019-04-01',
    per100g: {
      protein: 2.74,
      fat: 0.97,
      carbs: 25.58,
      calories: 123.0,
    },
  },
  broccoli: {
    fdcId: '169967',
    description: 'Broccoli, cooked, boiled, drained, without salt',
    publicationDate: '2019-04-01',
    per100g: {
      fat: 0.41,
      protein: 2.38,
      carbs: 7.18,
      calories: 35.0,
    },
  },
  oil: {
    fdcId: '171413',
    description: 'Oil, olive, salad or cooking',
    publicationDate: '2019-04-01',
    per100g: {
      fat: 100.0,
      carbs: 0.0,
      calories: 884.0,
      protein: 0.0,
    },
  },
  eggs: {
    fdcId: '173424',
    description: 'Egg, whole, cooked, hard-boiled',
    publicationDate: '2019-04-01',
    per100g: {
      calories: 155.0,
      protein: 12.58,
      fat: 10.61,
      carbs: 1.12,
    },
  },
  potatoes: {
    fdcId: '170440',
    description: 'Potatoes, boiled, cooked without skin, flesh, without salt',
    publicationDate: '2019-04-01',
    per100g: {
      carbs: 20.01,
      calories: 86.0,
      fat: 0.1,
      protein: 1.71,
    },
  },
  chicken: {
    fdcId: '171477',
    description:
      'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
    publicationDate: '2019-04-01',
    per100g: {
      fat: 3.57,
      carbs: 0.0,
      calories: 165.0,
      protein: 31.02,
    },
  },
} as const;

'use client';
import { useState } from 'react';
import { matchingMeals, mealExample, foodSource, type Meal } from '@/lib/meals';
import type { Profile, Target } from '@/lib/fitness';
import { Glass, Choice } from './member-forms';
export function MealIdeas({
  profile,
  target,
  showEstimates,
}: {
  profile: Profile;
  target?: Target;
  showEstimates: boolean;
}) {
  const meals = matchingMeals(profile.diet, profile.exclusions);
  return (
    <Glass>
      <h2>A flexible plate</h2>
      <p>
        Portioned examples that match your selected diet and ingredient
        exclusions. These are individual meal ideas, not a full daily menu.
        Adjust an example to see how its quantities change.
      </p>
      <div className="meal-grid">
        {meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            target={showEstimates ? target : undefined}
            showEstimates={showEstimates}
          />
        ))}
      </div>
      {!meals.length && (
        <p>
          No examples match these exclusions. Review your preferences or use
          your own suitable foods.
        </p>
      )}
      <p className="quiet-note">
        {profile.exclusions ? `Your exclusions: ${profile.exclusions}. ` : ''}
        Matching covers the listed ingredients and common aliases. Check package
        labels and preparation for allergens; sauces and other additions are not
        included.
      </p>
      {showEstimates && (
        <p className="quiet-note">
          Estimated totals use{' '}
          <a href={foodSource.url} target="_blank" rel="noreferrer">
            {foodSource.name}
          </a>
          . Brands, water content and preparation vary. Source energy can differ
          from 4/4/9 macro arithmetic. Only your daily targets use that
          reconciliation rule.
        </p>
      )}
    </Glass>
  );
}
function MealCard({
  meal,
  target,
  showEstimates,
}: {
  meal: Meal;
  target?: Target;
  showEstimates: boolean;
}) {
  const [portion, setPortion] = useState('1');
  const { ingredients, totals } = mealExample(meal, Number(portion));
  return (
    <article className="meal-card">
      <span className="eyebrow">{meal.diet.toUpperCase()} · MEAL EXAMPLE</span>
      <h3>{meal.name}</h3>
      <Choice
        label={`Example portion for ${meal.name}`}
        value={portion}
        options={['0.75', '1', '1.25', '1.5']}
        onChange={setPortion}
      />
      <ul className="ingredient-list">
        {ingredients.map((i) => (
          <li key={i.name}>
            <strong>
              {Math.round(i.grams * 10) / 10} g · {i.name}
            </strong>
            <span>{i.basis}</span>
          </li>
        ))}
      </ul>
      {showEstimates && (
        <>
          <p className="meal-energy">
            ~{Math.round(totals.calories)} <small>kcal for this example</small>
          </p>
          <div className="meal-macros">
            <span>{Math.round(totals.protein)} g protein</span>
            <span>{Math.round(totals.carbs)} g carbs</span>
            <span>{Math.round(totals.fat)} g fat</span>
          </div>
          {target && (
            <p className="quiet-note">
              About {Math.round((totals.calories / target.calories) * 100)}% of
              your adopted daily energy target and{' '}
              {Math.round((totals.protein / target.protein) * 100)}% of its
              protein target. Other meals make up the rest.
            </p>
          )}
          <details className="meal-sources">
            <summary>Ingredient data sources</summary>
            {ingredients.map((i) => (
              <a key={i.name} href={i.source} target="_blank" rel="noreferrer">
                USDA · {i.name}
              </a>
            ))}
          </details>
        </>
      )}
    </article>
  );
}

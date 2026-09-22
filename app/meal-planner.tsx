'use client';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import type { State } from '@/lib/fitness';
import type { MemberSnapshot } from '@/lib/use-member';
import { emptyMealFoods, mealSlots, mealPlanIsCurrent, mealItemHeading, validateMealFoods, type MealFoods, type Macros } from '@/lib/meal-plan';
import { displayTimestamp } from '@/lib/display-date';
import { Glass } from './member-forms';

type Props = { state: State; demo: boolean; busy: boolean; onSave: (foods: MealFoods) => Promise<boolean>; onGenerated: (snapshot: MemberSnapshot) => void; canGenerate: boolean };
export default function MealPlanner({ state, demo, busy, onSave, onGenerated, canGenerate }: Props) {
  const [text, setText] = useState(() => Object.fromEntries(mealSlots.map(slot => [slot.id, (state.mealFoods ?? emptyMealFoods())[slot.id].join('\n')])) as Record<keyof MealFoods, string>);
  const [generating, setGenerating] = useState(false);
  const [savingOnly, setSavingOnly] = useState(false);
  const [editing, setEditing] = useState(!state.mealFoods);
  const formRef = useRef<HTMLFormElement>(null);
  const focusEditor = useRef(false);
  useEffect(() => {
    if (editing && focusEditor.current) {
      formRef.current?.querySelector('textarea')?.focus();
      focusEditor.current = false;
    }
  }, [editing]);
  function editFoods() {
    if (editing) formRef.current?.querySelector('textarea')?.focus();
    else { focusEditor.current = true; setEditing(true); }
  }
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const foodsFromText = () => Object.fromEntries(mealSlots.map(slot => [slot.id, [...new Set(text[slot.id].split(/\n+/).map(item => item.trim()).filter(Boolean))]]));
  const dirty = JSON.stringify(foodsFromText()) !== JSON.stringify(state.mealFoods ?? emptyMealFoods());
  const hasSavedFoods = !!state.mealFoods && mealSlots.filter(slot => slot.required).every(slot => state.mealFoods![slot.id]?.length);
  const foodsSaved = hasSavedFoods && !dirty;
  const plan = state.mealPlan;
  const stale = !!plan && (dirty || !mealPlanIsCurrent(state));
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || generating) return;
    const generate = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'generate';
    setError(''); setNotice('');
    try {
      const foods = validateMealFoods(foodsFromText());
      setSavingOnly(!generate);
      setGenerating(true);
      if (!(await onSave(foods))) throw new Error('Your foods could not be saved. Please try again.');
      setEditing(false);
      if (!generate) { setNotice('Your food choices are saved.'); return; }
      if (demo || !canGenerate) throw new Error('Sign in and complete your Fuel targets to generate a personalized meal plan.');
      const response = await fetch('/api/meals/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: crypto.randomUUID(), foods, targetId: state.targets.at(-1)?.id }) });
      const result = await response.json() as MemberSnapshot & { error?: string };
      if (!response.ok || !result.state) throw new Error(result.error || 'AI Coach could not create your meal plan. Please try again.');
      onGenerated(result);
      setNotice('Your meal plan is ready and saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setGenerating(false); setSavingOnly(false); }
  }
  const field = (slot: (typeof mealSlots)[number]) => <label className="field" key={slot.id}>
    <span>{slot.label} {slot.required ? '(required)' : '(optional)'}</span>
    <textarea aria-label={`${slot.label} ${slot.required ? '(required)' : '(optional)'}`} rows={3} required={slot.required} maxLength={1500} value={text[slot.id]}
      disabled={generating || busy} placeholder={`Foods you eat for ${slot.label.toLowerCase()}, one per line`}
      onChange={event => { setText({ ...text, [slot.id]: event.target.value }); setNotice(''); }} />
  </label>;
  return <Glass>
    <span className="eyebrow">YOUR FOODS, YOUR DAILY PLAN</span>
    <h2>Build meals around what you eat</h2>
    <p>Enter foods for breakfast, lunch and dinner. AI Coach will suggest portions using your saved Fuel targets. Put one food per line. Include the brand and raw/cooked preparation when known. Include oils, sauces and drinks you want counted.</p>
    <p className="quiet-note">Saved diet: {state.profile?.diet}. {state.profile?.exclusions ? `Food exclusions: ${state.profile.exclusions}.` : 'No food exclusions saved.'} Update Profile if these preferences have changed.</p>
    <form ref={formRef} onSubmit={event => void submit(event)}>
      <div className="meal-planner-actions"><button className="action-primary" type="button" disabled={busy || generating} onClick={editFoods}>Edit food choices</button></div>
      {(editing || !hasSavedFoods) ? <>
      <div className="meal-food-fields">{mealSlots.filter(slot => slot.required).map(field)}</div>
      <details className="meal-snack-options">
        <summary>Add optional snacks</summary>
        <div className="meal-food-fields">{mealSlots.filter(slot => !slot.required).map(field)}</div>
      </details>
      </> : <div className="saved-food-summary">
        <h3>Your saved food choices</h3>
        <dl>{mealSlots.filter(slot => state.mealFoods?.[slot.id]?.length).map(slot => <div key={slot.id}><dt>{slot.label}</dt><dd>{state.mealFoods![slot.id].join(', ')}</dd></div>)}</dl>
      </div>}
      <p className="quiet-note">Up to 12 foods per meal. Leave unused snacks blank. Each listed food stays in its chosen meal. Coach may add clearly labeled suggestions to help balance your plan; your saved food choices stay as entered.</p>
      <p className={foodsSaved ? 'food-save-status is-saved' : 'food-save-status'} role="status">
        {foodsSaved ? (demo ? '✓ Food choices saved in this demo tab.' : '✓ Food choices saved to your account.') : dirty ? 'Unsaved changes — save your food choices or generate a meal plan to save them.' : 'Add your foods, then save your choices.'}
      </p>
      <div className="meal-planner-actions">
        <button className="action-secondary" type="submit" name="action" value="save" disabled={busy || generating || foodsSaved}>{savingOnly ? 'Saving food choices…' : foodsSaved ? 'Food choices saved' : hasSavedFoods ? 'Save changes' : 'Save food choices'}</button>
        <button className="action-primary" type="submit" name="action" value="generate" disabled={busy || generating || demo || !canGenerate}>
          {generating && !savingOnly ? 'Working on your foods…' : plan ? 'Regenerate my meal plan' : 'Generate my meal plan'}
        </button>
      </div>
      {demo ? <p className="quiet-note">Demo food choices stay in this tab. Sign in to generate an AI meal plan.</p>
        : !canGenerate && <p className="quiet-note">You can save foods now. Complete your body measurements and target weight in Profile to generate a plan.</p>}
    </form>
    {error && <p className="member-alert" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {plan && <div className="personal-meal-plan">
      <h3>Your saved daily meal plan</h3>
      <p className="quiet-note">Saved {displayTimestamp(plan.created)} · Suggested meals, not logged intake.</p>
      {stale && <p className="member-alert">Your foods, profile or Fuel targets have changed. Regenerate to update this saved plan.</p>}
      <p>Portions and nutrients are AI estimates. Whole foods may be shown as everyday servings; their estimated edible weights are used for the nutrition math. Check food labels and preparation details. Calories below use 4/4/9 kcal per gram of estimated protein, carbs and fat.</p>
      <div className="meal-grid">{[...plan.meals].sort((a,b) => ['breakfast','morningSnack','lunch','eveningSnack','dinner','lateSnack'].indexOf(a.slot) - ['breakfast','morningSnack','lunch','eveningSnack','dinner','lateSnack'].indexOf(b.slot)).map(meal => <article className="meal-card" key={meal.slot}>
        <h3>{mealSlots.find(slot => slot.id === meal.slot)?.label}</h3>
        <ul className="ingredient-list">{meal.items.map(item => <li key={item.foodId}>
          <strong>{mealItemHeading(item)}</strong>{item.suggestedFood && <span className="eyebrow">Coach suggestion</span>}<span>{item.basis}</span>{item.reason && <p><strong>Why this addition:</strong> {item.reason}</p>}
        </li>)}</ul>
        <p className="meal-energy">~{Math.round(meal.totals.calories)} <small>kcal</small></p>
        <div className="meal-macros"><span>{Math.round(meal.totals.protein)} g protein</span><span>{Math.round(meal.totals.carbs)} g carbs</span><span>{Math.round(meal.totals.fat)} g fat</span></div>
      </article>)}</div>
      <div className="meal-totals-table"><table>
        <caption>Estimated daily total compared with the targets used for this plan</caption>
        <thead><tr><th>Nutrient</th><th>Plan estimate</th><th>Fuel target</th><th>Difference</th></tr></thead>
        <tbody>{(['calories','protein','carbs','fat'] as (keyof Macros)[]).map(key => {
          const gap = Math.round(plan.totals[key] - plan.targets[key]), unit = key === 'calories' ? 'kcal' : 'g';
          return <tr key={key}><th>{key === 'calories' ? 'Calories' : key === 'carbs' ? 'Carbohydrates' : key === 'protein' ? 'Protein' : 'Fat'}</th><td>{Math.round(plan.totals[key])} {unit}</td><td>{Math.round(plan.targets[key])} {unit}</td><td>{gap > 0 ? '+' : ''}{gap} {unit}</td></tr>;
        })}</tbody>
      </table></div>
      {plan.notes && <p>{plan.notes}</p>}
      {plan.meals.some(meal => meal.items.some(item => item.suggestedFood)) && <details>
        <summary>Why the Coach suggests additional foods</summary>
        <p>Suggested additions are included in the totals above. Their estimated calories and nutrients help balance your saved daily Fuel target. This target can differ from maintenance calories depending on your goal. You can change your food choices or exclusions and regenerate.</p>
        <p>A varied eating pattern can provide fiber, vitamins, minerals and dietary fats as well as energy. These suggestions do not establish that you have a nutrient deficiency, and no single added food is essential.</p>
        <a href="https://www.niddk.nih.gov/health-information/weight-management/healthy-eating-physical-activity-for-life/health-tips-for-adults" target="_blank" rel="noreferrer">Scientific background: NIDDK healthy eating guidance</a>
      </details>}
    </div>}
  </Glass>;
}

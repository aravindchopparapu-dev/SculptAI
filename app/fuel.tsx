'use client';
import { displayTimestamp } from '@/lib/display-date';
import { useRef, useState } from 'react';
import { nutrition, weightDisplay, type State } from '@/lib/fitness';
import { fuelNeedsSync } from '@/lib/fuel-adaptation';
import { Glass, Summary } from './member-forms';
import MealPlanner from './meal-planner';
import type { MealFoods } from '@/lib/meal-plan';
import type { MemberSnapshot } from '@/lib/use-member';

function FuelExplanation({ demo }: { demo: boolean }) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [reply, setReply] = useState<{ answer: string; mode: 'openai' | 'built-in' } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);

  async function explain() {
    if (waiting) return;
    setWaiting(true);
    setError('');
    setReply(null);
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'fuel-explanation' }),
      });
      const result = (await response.json()) as { answer?: string; mode?: 'openai' | 'built-in'; error?: string };
      if (!response.ok || !result.answer || !result.mode) throw new Error(result.error || 'Please try again.');
      setReply({ answer: result.answer, mode: result.mode });
      setExpanded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setWaiting(false);
    }
  }

  return <Glass>
    <h2>Understand your Fuel goals</h2>
    <button ref={toggleRef} className="action-secondary" type="button" aria-controls="fuel-explanation-answer" aria-expanded={expanded}
      onClick={() => reply ? setExpanded(!expanded) : void explain()} disabled={waiting || demo}>
      {waiting ? 'Explaining your goals…' : reply ? expanded ? 'Hide explanation' : 'Show explanation' : 'Explain my Fuel goals'}
    </button>
    {demo && <p className="quiet-note">Sign in to get an explanation based on your own saved goals.</p>}
    {error && <p className="member-alert" role="alert">{error}</p>}
    {reply && <div id="fuel-explanation-answer" className="coach-response" role="status" hidden={!expanded}>
      <span className="eyebrow">{reply.mode === 'openai' ? 'CONNECTED AI COACH' : 'CALCULATION GUIDE'}</span>
      <p>{reply.answer}</p>
      <div className="source-links">
        <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">Mifflin–St Jeor energy equation</a>
        <a href="https://pubmed.ncbi.nlm.nih.gov/28698222/" target="_blank" rel="noreferrer">Resistance-training protein research</a>
        <a href="https://www.nal.usda.gov/programs/fnic" target="_blank" rel="noreferrer">USDA energy per gram</a>
      </div>
      <button className="action-secondary fuel-collapse" type="button" onClick={() => { setExpanded(false); toggleRef.current?.focus(); }}>
        Collapse explanation
      </button>
    </div>}
  </Glass>;
}

export default function Fuel({ state, onProfile, demo = false, busy, onSaveMealFoods, onMealGenerated }: {
  state: State; onProfile: () => void; demo?: boolean; busy: boolean;
  onSaveMealFoods: (foods: MealFoods) => Promise<boolean>;
  onMealGenerated: (snapshot: MemberSnapshot) => void;
}) {
  const profile = state.profile!;
  const latest = state.metrics.at(-1);
  const currentWeight = latest?.weight ?? profile.weight;
  const unit = profile.units === 'Imperial' ? 'lb' : 'kg';
  const target = profile.targetWeight && !fuelNeedsSync(state) && state.targets.at(-1)?.inputs.targetWeight === profile.targetWeight
    ? state.targets.at(-1) : undefined;
  let currentEstimate: ReturnType<typeof nutrition> | undefined;
  let unavailable = '';
  try {
    currentEstimate = nutrition({ ...profile, weight: currentWeight });
  } catch (error) {
    unavailable = (error as Error).message;
  }
  const gap = profile.targetWeight && currentWeight ? profile.targetWeight - currentWeight : null;
  return <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">FUEL YOUR NEXT CHAPTER</span>
        <h1>Your weight goal, your fuel.</h1>
        <p>See an estimate for maintaining your current weight and a separate daily calorie goal for moving toward your target weight. Check-ins refresh both estimates.</p>
      </div>
      <button className="action-primary" onClick={onProfile}>{profile.targetWeight ? 'Edit weight goal' : 'Add target weight'}</button>
    </div>
    <div className="member-grid fuel-grid">
      <Summary label="CURRENT WEIGHT" value={currentWeight ? `${weightDisplay(currentWeight, profile.units)} ${unit}` : 'Not set'} detail={latest ? `Latest check-in ${latest.date}` : 'From your profile'} />
      <Summary label="TARGET WEIGHT" value={profile.targetWeight ? `${weightDisplay(profile.targetWeight, profile.units)} ${unit}` : 'Not set'} detail="Edit in your profile" />
      <Summary label="ESTIMATED CURRENT MAINTENANCE" value={currentEstimate ? `${Math.round(currentEstimate.maintenance)} kcal/day` : 'Unavailable'} detail="Estimated energy to maintain current weight; not measured intake" />
      <Summary label="DAILY CALORIE GOAL" value={target && !unavailable ? `${Math.round(target.calories)} kcal/day` : 'Set target weight'} detail={target ? `Updated ${target.created.slice(0,10)}` : 'Calculated after you set a target weight'} />
    </div>
    {unavailable && <div className="member-alert">{unavailable}</div>}
    {!profile.targetWeight && <Glass><h2>Add your target weight</h2><p>Your current maintenance estimate uses your latest check-in, or your profile weight if you have none. A separate calorie goal and time range need a target weight. Add one in Profile to calculate them.</p></Glass>}
    {profile.targetWeight && !unavailable && <>
      <Glass>
        <h2>Estimated time to target weight</h2>
        {gap !== null && Math.abs(gap) < 0.5 ? <p>Your latest weight is within 0.5 kg of your target. Fuel now estimates maintenance calories; keep checking in to follow the trend.</p> : target?.timeline ? <>
          <p className="fuel-timeline">About {target.timeline.minWeeks}–{target.timeline.maxWeeks} weeks <span>({target.timeline.source === 'ai-coach' ? 'AI Coach reviewed' : 'planning range'})</span></p>
          <p>{target.timeline.explanation}</p>
        </> : <p>Save your profile to calculate a planning range. AI Coach can refine it when connected.</p>}
        <p className="quiet-note">This is a broad estimate, not a promised date. Weight can change for reasons other than fat or muscle. Your next check-ins may change the range.</p>
      </Glass>
      {target && <>
        <div className="member-grid fuel-grid">
          <Summary label="PROTEIN GOAL" value={`${Math.round(target.protein)} g/day`} />
          <Summary label="FAT GOAL" value={`${Math.round(target.fat)} g/day`} />
          <Summary label="CARBOHYDRATE GOAL" value={`${Math.round(target.carbs)} g/day`} />
        </div>
        <FuelExplanation key={target.id} demo={demo} />
        <Glass>
          <h2>How Fuel changes with check-ins</h2>
          <p>When you save a new weight or change target weight, SculptAI recalculates estimated maintenance and the daily calorie goal. The starting change grows with the remaining weight gap, capped at 15% below maintenance for a lower target or 8% above it for a higher target. A distant goal takes longer rather than causing an extreme calorie change. Within 0.5 kg of your target, the estimate returns to maintenance.</p>
          <p>With at least six recent check-ins spanning two weeks, AI Coach can review the trend and adjust the daily goal by at most 100 kcal at a time. It does not infer your actual food intake from weight. {target.analysis || 'These are starting estimates, not a measured prescription.'}</p>
          {target.adjustment !== undefined && target.adjustment !== 0 && <p>Current AI Coach adjustment: {target.adjustment > 0 ? '+' : ''}{target.adjustment} kcal/day.</p>}
          <p>Saved calculation: {target.inputs.weight} kg current weight · {target.inputs.targetWeight} kg target · activity {target.inputs.activity}. Method: {target.method}.</p>
          <div className="source-links">
            <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">Energy equation · Mifflin et al.</a>
            <a href="https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner" target="_blank" rel="noreferrer">NIH weight planning research</a>
          </div>
        </Glass>
      </>}
    </>}
    <MealPlanner state={state} demo={demo} busy={busy} onSave={onSaveMealFoods} onGenerated={onMealGenerated} canGenerate={!!target && !unavailable} />
    {state.targets.length > 0 && <Glass>
      <h2>Calorie goal history</h2>
      <div className="history-list">{[...state.targets].reverse().map(t => <details key={t.id}>
        <summary><strong>{Math.round(t.calories)} kcal/day</strong><span>{displayTimestamp(t.created)}</span></summary>
        <p>{t.inputs.weight} kg current · {t.inputs.targetWeight ? `${t.inputs.targetWeight} kg target` : 'Earlier estimate without a target weight'} · {Math.round(t.protein)} g protein</p>
        <p>{t.method}</p>{t.analysis && <p>{t.analysis}</p>}
      </details>)}</div>
    </Glass>}
  </>;
}

'use client';
import { nutrition, type State } from '@/lib/fitness';
import { Glass, Summary, Empty } from './member-forms';
import { MealIdeas } from './meal-ideas';
export default function Fuel({
  state,
  onAdopt,
  onProfile,
}: {
  state: State;
  onAdopt: () => void;
  onProfile: () => void;
}) {
  const profile = state.profile!,
    target = state.targets.at(-1);
  let unavailable = '';
  try {
    nutrition({
      ...profile,
      weight: state.metrics.at(-1)?.weight ?? profile.weight,
    });
  } catch (e) {
    unavailable = (e as Error).message;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FUEL YOUR NEXT CHAPTER</span>
          <h1>Simple. Steady. Nourished.</h1>
          <p>
            Estimates that support your training, with every change in your
            hands.
          </p>
        </div>
        <button
          className="action-primary"
          onClick={unavailable ? onProfile : onAdopt}
        >
          {unavailable
            ? 'Review nutrition eligibility'
            : target
              ? 'Review updated targets'
              : 'Calculate my targets'}
        </button>
      </div>
      {unavailable && <div className="member-alert">{unavailable}</div>}
      {target && !unavailable ? (
        <>
          <div className="member-grid fuel-grid">
            <Summary
              label="DAILY ENERGY"
              value={`${Math.round(target.calories)} kcal`}
              detail={`Adopted ${target.created.slice(0, 10)}`}
            />
            <Summary
              label="PROTEIN"
              value={`${Math.round(target.protein)} g`}
            />
            <Summary label="FAT" value={`${Math.round(target.fat)} g`} />
            <Summary
              label="CARBOHYDRATE"
              value={`${Math.round(target.carbs)} g`}
            />
          </div>
          <Glass>
            <h2>How these estimates work</h2>
            <p>
              Estimated maintenance: {Math.round(target.maintenance * 0.9)}–
              {Math.round(target.maintenance * 1.1)} kcal/day. Mifflin–St Jeor
              estimates resting energy from age, height, weight and formula sex.
              Your selected activity factor scales that estimate.
            </p>
            <p>
              SculptAI uses a conservative 10% reduction for fat loss or 5%
              addition for muscle gain. Protein starts at 1.6 g/kg; fat is the
              higher of 0.8 g/kg or 25% of energy; carbohydrate fills the
              remainder. Displayed totals may differ slightly because of
              rounding. These choices are starting estimates, not a
              prescription.
            </p>
            <p>
              Saved inputs: {target.inputs.age} years · {target.inputs.height}{' '}
              cm · {target.inputs.weight} kg · activity {target.inputs.activity}
              . Method: {target.method}.
            </p>
            <div className="source-links">
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                target="_blank"
                rel="noreferrer"
              >
                Energy equation · Mifflin et al.
              </a>
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/28698222/"
                target="_blank"
                rel="noreferrer"
              >
                Protein & resistance training · Morton et al.
              </a>
            </div>
          </Glass>
        </>
      ) : (
        <Glass>
          <Empty title="Start with your own numbers">
            <p>
              Complete your formula inputs and eligibility in your profile, then
              review and adopt a target.
            </p>
          </Empty>
        </Glass>
      )}
      <MealIdeas
        profile={profile}
        target={target}
        showEstimates={!unavailable}
      />
      {state.targets.length > 0 && (
        <Glass>
          <h2>Target history</h2>
          <div className="history-list">
            {[...state.targets].reverse().map((t) => (
              <details key={t.id}>
                <summary>
                  <strong>{Math.round(t.calories)} kcal</strong>
                  <span>{new Date(t.created).toLocaleString()}</span>
                </summary>
                <p>
                  {t.inputs.goal} · {t.inputs.weight} kg ·{' '}
                  {Math.round(t.protein)} g protein · {Math.round(t.fat)} g fat
                  · {Math.round(t.carbs)} g carbohydrate
                </p>
                <p>{t.method}</p>
              </details>
            ))}
          </div>
        </Glass>
      )}
    </>
  );
}

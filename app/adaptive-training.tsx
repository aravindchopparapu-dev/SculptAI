'use client';
import { displayTimestamp } from '@/lib/display-date';
import { useState } from 'react';
import {
  ShieldCheck,
  ClipboardCheck,
  History,
  CalendarDays,
} from 'lucide-react';
import type { State } from '@/lib/fitness';
import { weightDisplay } from '@/lib/fitness';
import {
  normalizedState,
  POLICY_VERSION,
  receiptStatus,
  weeklySummary,
  estimateMinutes,
  type Readiness,
} from '@/lib/adaptation';
import type { Mutate } from './workout';
import { Glass } from './member-forms';

export function SafetyGate({
  state,
  mutate,
  busy,
}: {
  state: State;
  mutate: Mutate;
  busy: boolean;
}) {
  const s = normalizedState(state),
    [accepted, setAccepted] = useState(false),
    [status, setStatus] = useState('');
  const emergency = s.safetyScreens.some((x) => x.status === 'emergency');
  if (
    s.consents.some((c) => c.version === POLICY_VERSION) &&
    s.safetyScreens.at(-1)?.status === 'clear' &&
    !emergency
  )
    return null;
  return (
    <Glass className="safety-card">
      <span className="eyebrow">
        <ShieldCheck size={16} /> BEFORE YOU TRAIN
      </span>
      <h2>A quick safety and privacy check.</h2>
      <p>
        SculptAI is a general wellness testing app for adults 18+. It does not
        diagnose conditions, treat injuries, or provide a clinical program.
      </p>
      <details>
        <summary>Read testing terms and privacy notice</summary>
        <p>
          Your profile, workouts, readiness answers, measurements and decision
          history are stored with your app account. Optional measurements are
          your choice. This testing build sends no information to an AI Coach
          and does not use health records for advertising.
        </p>
        <p>
          Export your records in Account & data. “Delete my data” clears the
          active SculptAI record, including consent and receipts; it does not
          delete your sign-in provider account or copies you exported. Hosted
          backup retention and legal notices must be finalized before a public
          beta. Use fictional information when exploring demo mode.
        </p>
        <p>
          Rules and numeric thresholds are testing assumptions pending qualified
          fitness review. Choose manageable loads and stop when a movement
          hurts. Version {POLICY_VERSION}.
        </p>
      </details>
      {emergency ? (
        <p className="form-error" role="alert">
          Training is paused after an urgent symptom report. Seek urgent
          professional help; contact local emergency services for current chest
          pain, fainting or severe breathing difficulty. This testing version
          cannot clear urgent flags.
        </p>
      ) : (
        <form
          className="member-form"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate({ type: 'safety', accepted, status });
          }}
        >
          <label className="field">
            Activity safety check
            <select
              aria-label="Activity safety check"
              required
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Choose an answer</option>
              <option value="clear">None of the concerns below apply</option>
              <option value="guidance">
                Pregnancy, injury, a medical restriction, or unsure about
                exercise
              </option>
              <option value="emergency">
                Current chest pain, fainting, or severe breathing difficulty
              </option>
            </select>
          </label>
          {status === 'emergency' && (
            <p role="alert" className="form-error">
              Stop exercising. Contact local emergency services for current
              urgent symptoms. Saving this answer pauses training; it is not an
              emergency-care service.
            </p>
          )}
          {status === 'guidance' && (
            <p role="status">
              Pause automated training and seek qualified guidance before using
              a general exercise plan.
            </p>
          )}
          <label className="check-label">
            <input
              required
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            I have read and accept the testing terms, privacy notice and adult
            wellness boundary.
          </label>
          <button
            className="action-primary"
            disabled={busy || !accepted || !status}
          >
            Save safety check
          </button>
        </form>
      )}
    </Glass>
  );
}
export function ReadinessCard({
  beforePlan = false,
  onReadyChange,
  state,
  mutate,
  busy,
}: {
  state: State;
  mutate: Mutate;
  busy: boolean;
  beforePlan?: boolean;
  onReadyChange?: (ready: boolean) => void;
}) {
  const plan = beforePlan ? { days: [{ name: "Today’s workout", exercises: [] }], templateVersion: "ai-muscle-session-v1" } : state.plans.at(-1)!,
    profile = state.profile!,
    s = normalizedState(state);
  const [draft, setDraft] = useState<Omit<Readiness, 'id' | 'createdAt'>>({
    dayIndex: 0,
    energy: 3,
    soreness: 0,
    minutes: profile.minutes,
    pain: false,
    equipment: profile.equipment,
    ...(beforePlan ? s.readiness.at(-1) : {}),
    ...(beforePlan ? { dayIndex: 0 } : {}),
  });
  const latest = s.readiness.at(-1),
    [painAnswer, setPainAnswer] = useState(beforePlan && s.readiness.at(-1) ? (s.readiness.at(-1)!.pain ? 'yes' : 'no') : ''),
    [message, setMessage] = useState('');
  const set = (key: string, value: unknown) => {
    onReadyChange?.(false);
    setDraft((x) => ({ ...x, [key]: value }));
  };
  return (
    <Glass className="readiness-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">TODAY, ON YOUR TERMS</span>
          <h2>How are you arriving?</h2>
          <p>
            Tell AI Coach how you feel and how much time you have before choosing your muscle groups. Extra detail is optional.
          </p>
        </div>
        <ClipboardCheck size={24} />
      </div>
      <form
        className="member-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await mutate({
              type: 'readiness',
              beforePlan,
              readiness: { ...draft, pain: painAnswer === 'yes' },
            })
          ) {
            onReadyChange?.(true);
            setMessage(beforePlan ? 'Check-in saved. Choose your muscle groups below.' : 'Check-in saved. Review your session suggestion below.');
          }
        }}
      >
        {!beforePlan && <label className="field">
          Session to prepare
          <select
            value={draft.dayIndex}
            onChange={(e) => set('dayIndex', Number(e.target.value))}
          >
            {plan.days.map((d, i) => (
              <option key={d.name} value={i}>
                {d.name}
              </option>
            ))}
          </select>
        </label>}
        <div className="form-grid">
          <label className="field">
            Energy · 1 low to 5 high
            <select
              value={draft.energy}
              onChange={(e) => set('energy', Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Soreness · 0 none to 10 high
            <input
              type="number"
              required
              min="0"
              max="10"
              value={draft.soreness}
              onChange={(e) => set('soreness', Number(e.target.value))}
            />
          </label>
          <label className="field">
            Minutes available
            <input
              type="number"
              required
              min="10"
              max="90"
              value={draft.minutes}
              onChange={(e) => set('minutes', Number(e.target.value))}
            />
          </label>
          <label className="field">
            Any pain today?
            <select
              aria-label="Any pain today?"
              required
              value={painAnswer}
              onChange={(e) => { onReadyChange?.(false); setPainAnswer(e.target.value); }}
            >
              <option value="">Choose an answer</option>
              <option value="no">No</option>
              <option value="yes">Yes — pause training</option>
            </select>
          </label>
        </div>
        <details>
          <summary>Optional sleep, soreness area and equipment</summary>
          <div className="form-grid">
            <label className="field">
              Sleep quality
              <select
                value={draft.sleep ?? ''}
                onChange={(e) =>
                  set(
                    'sleep',
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              >
                <option value="">Not recorded</option>
                {[1, 2, 3, 4, 5].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Soreness area
              <input
                maxLength={80}
                value={draft.area ?? ''}
                onChange={(e) => set('area', e.target.value)}
                placeholder="For example, legs"
              />
            </label>
            <label className="field">
              Equipment today
              <select
                value={draft.equipment}
                onChange={(e) => set('equipment', e.target.value)}
              >
                {['Bodyweight', 'Dumbbells', 'Gym'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
        </details>
        {painAnswer === 'yes' && (
          <p role="alert">
            Pause training for this check-in. Persistent, severe or sudden pain
            needs professional guidance; urgent symptoms need local emergency
            services.
          </p>
        )}
        <div className="card-actions">
          <button className="action-primary" disabled={busy}>
            Save readiness
          </button>
          {latest && plan.templateVersion !== 'ai-muscle-session-v1' && (
            <button
              type="button"
              className="action-secondary"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate({
                    type: 'proposeAdaptation',
                    dayIndex: latest.dayIndex,
                  })
                )
                  document
                    .getElementById('decision-trail')
                    ?.scrollIntoView({ block: 'start' });
              }}
            >
              Review session suggestion
            </button>
          )}
        </div>
        <p role="status">
          {message ||
            (latest
              ? `Last saved: ${displayTimestamp(latest.createdAt)}. A fresh check-in is required for each workout.`
              : 'Your first check-in will appear here.')}
        </p>
      </form>
    </Glass>
  );
}
export function FourWeekPlan({ state }: { state: State }) {
  const plan = state.plans.at(-1)!;
  if (!plan.schedule)
    return (
      <p className="quiet-note">
        This is a legacy plan. Regenerate it to preview the new four-week
        schedule.
      </p>
    );
  return (
    <Glass>
      <span className="eyebrow">
        <CalendarDays size={16} /> YOUR FOUR-WEEK FOUNDATION
      </span>
      <h2>Consistency with room to adapt.</h2>
      <p>
        Suggested dates include recovery spacing. Missed sessions do not add
        extra volume to the next workout.
      </p>
      <div className="four-week-grid">
        {[1, 2, 3, 4].map((week) => (
          <div key={week}>
            <h3>Week {week}</h3>
            {plan
              .schedule!.filter((d) => d.week === week)
              .map((d) => (
                <p key={d.dayIndex}>
                  <time dateTime={d.date}>
                    {d.date}
                  </time>
                  <br />
                  <strong>{plan.days[d.dayIndex].name}</strong>
                  <br />
                  <small>
                    ~{estimateMinutes(plan.days[d.dayIndex])} min · warm-up
                    included
                  </small>
                </p>
              ))}
          </div>
        ))}
      </div>
      <p className="quiet-note">
        The same foundation repeats each week. Progression needs logged evidence
        and your confirmation.
      </p>
    </Glass>
  );
}
export function DecisionHistory({
  state,
  mutate,
  busy,
}: {
  state: State;
  mutate: Mutate;
  busy: boolean;
}) {
  const s = normalizedState(state),
    [note, setNote] = useState('');
  return (
    <Glass>
      <span className="eyebrow">
        <History size={16} /> YOUR DECISION TRAIL
      </span>
      <h2 id="decision-trail">See why. Choose what happens.</h2>
      <p>
        Suggestions are saved before any change. Accepting updates this
        session’s prescription for future workouts until you change it again.
      </p>
      {!s.receipts.length && (
        <p>
          Save a readiness check and review a suggestion. With limited evidence,
          SculptAI will explain why it is holding steady.
        </p>
      )}
      {[...s.receipts].reverse().map((r) => {
        const status = receiptStatus(s, r.receiptId);
        const accepted = s.decisions.find(
          (x) => x.receiptId === r.receiptId && x.decision === 'accepted',
        );
        return (
          <article className="receipt-card" key={r.receiptId}>
            <div className="card-heading">
              <strong>
                {r.changeType === 'hold' ? 'Holding steady' : 'Plan adjustment'}{' '}
                · V{r.fromVersion}
              </strong>
              <span className="small-pill">{status}</span>
            </div>
            <p>{r.reasonPlain}</p>
            <small>
              {displayTimestamp(r.createdAt)} · {r.confidence}{' '}
              confidence
            </small>
            {r.changeType !== 'hold' && (
              <div className="receipt-diff">
                {r.after.map((d, i) =>
                  d.exercises.map((e, j) => {
                    const old = r.before[i]?.exercises[j];
                    return JSON.stringify(e) === JSON.stringify(old) ? null : (
                      <p key={`${i}-${j}`}>
                        <strong>{d.name}</strong>
                        <br />
                        <span>
                          Before:{' '}
                          {old
                            ? `${old.name} · ${old.sets} × ${old.reps}`
                            : 'None'}
                        </span>
                        <br />
                        <span>
                          After: {e.name} · {e.sets} × {e.reps} · {e.rest}s rest
                        </span>
                      </p>
                    );
                  }),
                )}
              </div>
            )}
            <details>
              <summary>Inputs, checks and decision history</summary>
              <p>
                Rule: {r.ruleId} · {r.ruleVersion}
              </p>
              <ul>
                {r.inputsUsed.map((x, i) => (
                  <li key={i}>
                    {x.name}: {x.value}
                  </li>
                ))}
              </ul>
              <ul>
                {r.safetyChecks.map((x, i) => (
                  <li key={i}>
                    {x.passed ? 'Passed' : 'Failed'}: {x.name}
                  </li>
                ))}
              </ul>
              {r.evidenceRefs.map((x) => (
                <p key={x.url}>
                  <a href={x.url} target="_blank" rel="noreferrer">
                    {x.title}
                  </a>
                </p>
              ))}
              {s.decisions
                .filter((x) => x.receiptId === r.receiptId)
                .map((x) => (
                  <p key={x.id}>
                    {x.decision} · {displayTimestamp(x.createdAt)} ·{' '}
                    {x.reason || 'No note provided'}
                  </p>
                ))}
            </details>
            {status === 'pending' && (
              <>
                <label className="field">
                  Decision note (optional)
                  <input
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <div className="card-actions">
                  <button
                    className="action-primary"
                    disabled={busy}
                    onClick={() =>
                      void mutate({
                        type: 'decideAdaptation',
                        receiptId: r.receiptId,
                        decision: 'accepted',
                        reason: note,
                      })
                    }
                  >
                    {r.changeType === 'hold'
                      ? 'Keep this plan'
                      : 'Accept change'}
                  </button>
                  <button
                    className="action-secondary"
                    disabled={busy}
                    onClick={() =>
                      void mutate({
                        type: 'decideAdaptation',
                        receiptId: r.receiptId,
                        decision: 'rejected',
                        reason: note,
                      })
                    }
                  >
                    Reject suggestion
                  </button>
                </div>
              </>
            )}
            {status === 'accepted' &&
              accepted?.planId === s.plans.at(-1)?.id &&
              !s.sessions.some((x) => !x.completed) && (
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() =>
                    void mutate({
                      type: 'undoAdaptation',
                      receiptId: r.receiptId,
                    })
                  }
                >
                  Undo this change
                </button>
              )}
          </article>
        );
      })}
    </Glass>
  );
}
export function WeeklyReviewCard({
  state,
  mutate,
  busy,
}: {
  state: State;
  mutate: Mutate;
  busy: boolean;
}) {
  const summary = weeklySummary(state),
    s = normalizedState(state),
    [barrier, setBarrier] = useState('None'),
    [nutritionDays, setNutritionDays] = useState(0),
    [reflection, setReflection] = useState(''),
    [saved, setSaved] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REFLECT, THEN ADJUST</span>
          <h1>Your week, without judgment.</h1>
          <p>
            A rolling seven-day review. Partial workouts count as effort;
            missing logs remain unknown.
          </p>
        </div>
      </div>
      <Glass>
        <div className="review-metrics">
          <div>
            <strong>
              {summary.complete} / {summary.planned}
            </strong>
            <span>completed / current weekly goal</span>
          </div>
          <div>
            <strong>{summary.partial}</strong>
            <span>partial workouts</span>
          </div>
          <div>
            <strong>{summary.readinessDays}</strong>
            <span>days with readiness logged</span>
          </div>
          <div>
            <strong>{summary.painReports}</strong>
            <span>pain reports</span>
          </div>
        </div>
        <p>
          {summary.weightChange === null
            ? 'Weight trend: add at least two dated measurements to see a change. Weight is optional.'
            : `Recorded weight change: ${weightDisplay(summary.weightChange, state.profile?.units ?? 'Metric')} ${state.profile?.units === 'Imperial' ? 'lb' : 'kg'}. Short-term changes do not automatically alter nutrition targets.`}
        </p>
        <p>
          Next week: keep a manageable schedule. Review individual sessions
          using your latest readiness and workout history. Missed workouts are
          not stacked into the next day.
        </p>
        <form
          className="member-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await mutate({
                type: 'weeklyReview',
                barrier,
                nutritionDays,
                reflection,
              })
            )
              setSaved(true);
          }}
        >
          <div className="form-grid">
            <label className="field">
              Main barrier
              <select
                value={barrier}
                onChange={(e) => setBarrier(e.target.value)}
              >
                {['None', 'Time', 'Energy', 'Equipment', 'Pain', 'Other'].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              Days you followed your meal framework
              <input
                type="number"
                min="0"
                max="7"
                required
                value={nutritionDays}
                onChange={(e) => setNutritionDays(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="field">
            What would make next week easier? (optional)
            <textarea
              maxLength={500}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
          </label>
          <p className="quiet-note">
            This reflection is not a food diary. Nutrition changes stay on hold
            because there is no verified intake coverage yet.
          </p>
          <button className="action-primary" disabled={busy}>
            Save weekly review
          </button>
          {saved && <p role="status">Weekly review saved.</p>}
        </form>
        <details>
          <summary>Previous reviews ({s.reviews.length})</summary>
          {[...s.reviews].reverse().map((r) => (
            <p key={r.id}>
              {displayTimestamp(r.createdAt)} ·{' '}
              {r.summary.complete} complete, {r.summary.partial} partial ·
              barrier: {r.barrier} · meal framework: {r.nutritionDays}/7 days
              <br />
              {r.reflection}
            </p>
          ))}
        </details>
      </Glass>
      <DecisionHistory state={state} mutate={mutate} busy={busy} />
    </>
  );
}

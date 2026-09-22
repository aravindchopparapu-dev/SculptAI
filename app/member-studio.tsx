'use client';
import { displayTimestamp } from '@/lib/display-date';
import './member.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Download,
  Layers3,
  LogIn,
  LogOut,
  Settings2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useMember, type MemberSnapshot } from '@/lib/use-member';
import { weightDisplay, type Metric } from '@/lib/fitness';
import {
  type Action,
} from '@/lib/actions';
import StudioHero from './studio-hero';
import Insights from './insights';
import Fuel from './fuel';
import CoachPanel from './coach-panel';
import {
  Glass,
  Empty,
  Summary,
  ProfileForm,
  MetricForm,
  blankProfile,
} from './member-forms';
import {
  SafetyGate,
  ReadinessCard,
} from './adaptive-training';
import { normalizedState, POLICY_VERSION } from '@/lib/adaptation';
import { demoPersonas } from '@/lib/demo';
import { exportCsv } from '@/lib/export';
import ExerciseGuide from './exercise-guide';
import { muscleGroups, workoutReadiness, type MuscleGroup } from '@/lib/custom-workout';
import { fuelNeedsSync, fuelReviewDue } from '@/lib/fuel-adaptation';
import { studioScreens, tabForScreen, type StudioScreen } from '@/lib/studio-navigation';
const screens = studioScreens;
const activeScreenKey = 'sculptai-active-screen';
function writeScreenUrl(screen: StudioScreen) {
  const url = new URL(window.location.href);
  const tab = tabForScreen(screen);
  if (url.searchParams.get('tab') === tab) return;
  url.searchParams.set('tab', tab);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
export default function MemberStudio({ initialScreen, screenInUrl, initialMember, renderedAt }: {
  initialScreen: StudioScreen;
  screenInUrl: boolean;
  initialMember: MemberSnapshot | null;
  renderedAt: number;
}) {
  const member = useMember(initialMember),
    { state, user, loading, busy, error, saved, mutate } = member;
  const [screen, setScreen] = useState<StudioScreen>(initialScreen),
    [screenReady, setScreenReady] = useState(screenInUrl),
    [profileOpen, setProfileOpen] = useState(false),
    [metric, setMetric] = useState<Metric | null | undefined>(),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: Action;
      preview?: ReactNode;
    } | null>(null),
    [deletion, setDeletion] = useState(''),
    [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]),
    [generating, setGenerating] = useState(false),
    [readinessEdited, setReadinessEdited] = useState(false),
    [workoutSaved, setWorkoutSaved] = useState(false);
  const savedHeading = useRef<HTMLHeadingElement>(null);
  const fuelChecked = useRef('');
  const savedWorkouts = state.plans.filter(p => p.templateVersion === 'ai-muscle-session-v1').slice().reverse();
  useEffect(() => {
    if (screenInUrl) {
      try { window.sessionStorage.setItem(activeScreenKey, initialScreen); }
      catch { /* URL still preserves the tab. */ }
      return;
    }
    let restored: StudioScreen = 'Studio';
    try {
      const saved = window.sessionStorage.getItem(activeScreenKey);
      if (saved && screens.includes(saved as StudioScreen)) restored = saved as StudioScreen;
    } catch { /* Continue on Studio if browser storage is unavailable. */ }
    setScreen(restored);
    writeScreenUrl(restored);
    setScreenReady(true);
  }, [initialScreen, screenInUrl]);
  function selectScreen(next: string) {
    if (!screens.includes(next as StudioScreen)) return;
    const selected = next as StudioScreen;
    setScreen(selected);
    try { window.sessionStorage.setItem(activeScreenKey, next); }
    catch { /* Navigation still works without browser storage. */ }
    writeScreenUrl(selected);
  }
  useEffect(() => {
    if (screen !== 'Fuel' || !state.profile || !user || loading || busy || member.demo) return;
    const latestMetric = state.metrics.at(-1);
    const key = JSON.stringify({ profile: state.profile, metricId: latestMetric?.id, weight: latestMetric?.weight });
    if (fuelChecked.current === key) return;
    fuelChecked.current = key;
    if (fuelNeedsSync(state) || fuelReviewDue(state)) void mutate({ type: 'fuelSync' });
  }, [screen, state, user, loading, busy, member.demo, mutate]);
  useEffect(() => {
    if (!workoutSaved) return;
    savedHeading.current?.focus({ preventScroll: true });
    savedHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [workoutSaved]);
  async function saveWorkout() {
    setWorkoutSaved(false);
    if (await mutate({ type: 'acceptCustomWorkout', draftId: state.draftWorkout?.id, confirmed: true })) {
      setSelectedMuscles([]);
      setWorkoutSaved(true);
    }
  }
  const profile = state.profile,
    plan = state.plans.at(-1),
    latest = state.metrics.at(-1),
    unit = profile?.units === 'Imperial' ? 'lb' : 'kg';
  const extended = normalizedState(state);
  const cleared =
    extended.consents.some((c) => c.version === POLICY_VERSION) &&
    extended.safetyScreens.at(-1)?.status === 'clear' &&
    !extended.safetyScreens.some((s) => s.status === 'emergency');
  let readinessReady = false;
  try { workoutReadiness(state); readinessReady = !readinessEdited; } catch { /* Form explains required check-in. */ }
  async function generateWorkout(regeneratePlanId?: string) {
    const groups = regeneratePlanId ? state.plans.find(p => p.id === regeneratePlanId)?.selectedMuscles as MuscleGroup[] : selectedMuscles;
    if (!groups || groups.length === 0 || groups.length > 4) return;
    setWorkoutSaved(false);
    setGenerating(true);
    member.setError('');
    try {
      const response = await fetch('/api/training/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedMuscles: groups, regeneratePlanId }),
      });
      const result = await response.json() as { day?: { name: string; exercises: unknown[] }; rationale?: string; readinessId?: string; error?: string };
      if (!response.ok || !result.day) throw new Error(result.error || 'AI Coach could not generate a workout.');
      await mutate({ type: 'proposeCustomWorkout', selectedMuscles: groups, replacesPlanId: regeneratePlanId, day: result.day, rationale: result.rationale, readinessId: result.readinessId });
    } catch (error) {
      member.setError(error instanceof Error ? error.message : 'AI Coach is unavailable.');
    } finally {
      setGenerating(false);
    }
  }
  function go() {
    if (!user) {
      window.location.assign('/signin-with-chatgpt?return_to=%2F');
      return;
    }
    if (!profile) setProfileOpen(true);
    else selectScreen('My training');
  }
  function exportData(csv = false) {
    const url = URL.createObjectURL(
      new Blob(
        [
          csv
            ? exportCsv(state)
            : JSON.stringify(
                { exported: new Date().toISOString(), ...state },
                null,
                2,
              ),
        ],
        { type: csv ? 'text/csv;charset=utf-8' : 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = csv ? 'sculptai-data.csv' : 'sculptai-training-history.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!screenReady || loading) return <div className="future-app member-app member-boot" role="status">Opening SculptAI…</div>;
  return (
    <div className="future-app member-app">
      <div className="ambient-background" />
      <a className="skip-link" href="#member-content">
        Skip to content
      </a>
      <header className="navigation">
        <a className="logo" href="/">
          <span>
            <Layers3 size={22} />
          </span>
          sculpt<span className="logo-ai">ai</span>
          <small>STUDIO / 02</small>
        </a>
        <nav aria-label="Main navigation">
          <Tabs value={screen} onValueChange={(v) => selectScreen(String(v))}>
            <TabsList className="navigation-tabs">
              {screens.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {s}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </nav>
        <div className="nav-right">
          {user ? (
            <button
              className="account-button"
              onClick={() => setProfileOpen(true)}
            >
              <span className="profile-chip">
                {state.profilePhoto ? <img src={state.profilePhoto} alt="" /> : (profile?.name || user.name).slice(0, 1).toUpperCase()}
              </span>
              <span>{profile?.name || 'Your account'}</span>
              <Settings2 size={16} />
            </button>
          ) : (
            <a
              className="action-primary compact"
              target="_top"
              href="/signin-with-chatgpt?return_to=%2F"
            >
              <LogIn size={17} />
              {loading ? 'Connecting…' : 'Sign in / Sign up'}
            </a>
          )}
        </div>
      </header>
      <main id="member-content">
        {member.demo ? (
          <div className="demo-banner" role="status">
            <strong>Fictional demo · saved only in this tab</strong>
            <label>
              Example profile{' '}
              <select
                aria-label="Demo persona"
                value={
                  demoPersonas.includes(profile?.name ?? '')
                    ? profile!.name
                    : ''
                }
                onChange={(e) =>
                  void mutate({ type: 'demoPersona', persona: e.target.value })
                }
              >
                <option value="" disabled>
                  Custom demo profile
                </option>
                {demoPersonas.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <a href="/">Exit demo</a>
          </div>
        ) : null}
        <div className="context-row">
          <span>
            <i />
            {profile
              ? `${profile.goal.toUpperCase()} · YOUR PERSONAL STUDIO`
              : 'YOUR SPACE TO BECOME'}
          </span>
        </div>
        {error && (
          <div className="member-alert" role="alert">
            {error}
            <button onClick={() => void member.refresh()}>
              Refresh connection
            </button>
          </div>
        )}
        <div className="save-status" role="status" aria-live="polite">
          {saved ||
            (!loading && user
              ? member.demo
                ? 'Fictional data · no account writes'
                : 'Signed in · your personalized workouts'
              : '')}
        </div>
        <StudioHero
          active={screen === 'Studio'}
          onStart={go}
          label={
            !user
              ? 'Sign in to begin'
              : !profile
                ? 'Set up your profile'
                : 'Open your training'
          }
          summary={
            profile
              ? plan
                ? `${profile.days} days a week. ${profile.minutes} minutes for yourself. Your next session starts with a little intention.`
                : 'Choose your muscle groups and build your next workout.'
              : 'Set up your profile and body measurements for personalized workouts.'
          }
        />
        {screen === 'Studio' && (
          <div className="member-grid stats-grid">
            <Summary
              label="YOUR PLAN"
              value={plan ? `Version ${plan.version}` : 'Build your workout'}
              detail={
                plan
                  ? `${plan.days.length} training days · ${profile?.equipment}`
                  : 'Use your profile and readiness to generate a workout.'
              }
            />
            <Summary
              label="LATEST CHECK-IN"
              value={
                latest
                  ? `${weightDisplay(latest.weight, profile?.units || 'Metric')} ${unit}`
                  : '—'
              }
              detail={
                latest ? latest.date : 'Your first check-in will appear here.'
              }
            />
          </div>
        )}
        {screen !== 'Studio' && (!user || !profile) && (
          <Glass>
            <Empty
              title={
                user ? 'Make this space yours' : 'Your training starts here'
              }
            >
              <p>
                {user
                  ? 'Tell us your goals, equipment and schedule.'
                  : 'Use your ChatGPT account to keep your training and progress saved.'}
              </p>
              <button className="action-primary" onClick={go}>
                {user ? 'Set up your profile' : 'Sign in / Sign up'}
                <ArrowRight size={17} />
              </button>
            </Empty>
          </Glass>
        )}
        {profile && screen === 'My training' && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">BUILD YOUR FOUNDATION</span>
                <h1>Make today count.</h1>
                {savedWorkouts.length > 0 && <a className="text-link" href="#saved-workouts">View saved workouts ({savedWorkouts.length})</a>}
                <p>
                  {profile.days} days / week · {profile.minutes} min ·{' '}
                  {profile.equipment}
                </p>
              </div>
            </div>
            {!member.demo && <SafetyGate state={state} mutate={mutate} busy={busy || generating} />}
            {!member.demo && cleared && <ReadinessCard beforePlan onReadyChange={(ready) => setReadinessEdited(!ready)} state={state} mutate={mutate} busy={busy || generating} />}
            {<Glass className="muscle-builder">
              <span className="eyebrow">BUILD YOUR WORKOUT</span>
              <h2>What do you want to train?</h2>
              <p>Pick one to four muscle groups or conditioning options, including Cardio and HIIT. AI Coach will use your goal, body metrics, available equipment and session time to put the exercises in order.</p>
              {!readinessReady && <p role="status">Complete and save your readiness check above to choose your training focus.</p>}
              <div className="muscle-options" aria-label="Muscle groups and conditioning">
                {muscleGroups.map((group) => <button key={group} type="button"
                  aria-pressed={selectedMuscles.includes(group)}
                  className={selectedMuscles.includes(group) ? 'selected' : ''}
                  disabled={(!readinessReady && !member.demo) || busy || generating || (!selectedMuscles.includes(group) && selectedMuscles.length >= 4)}
                  onClick={() => setSelectedMuscles((current) => current.includes(group) ? current.filter((x) => x !== group) : [...current, group])}>{group}</button>)}
              </div>
              <p className="quiet-note">Choose up to four options per workout. Cardio uses steady, timed activity; HIIT uses short work and recovery intervals. You can create a different combination next time.</p>
              <button className="action-primary" disabled={!readinessReady || member.demo || busy || generating || selectedMuscles.length === 0}
                onClick={() => void generateWorkout()}>{generating ? 'AI Coach is building your workout…' : 'Generate my workout'} <ArrowRight size={17} /></button>
              {member.demo && <p>Sign in to generate a workout with your own data.</p>}
            </Glass>}
            {state.draftWorkout && <Glass className="workout-draft">
              <span className="eyebrow">AI COACH · REVIEW BEFORE SAVING</span>
              <h2>{state.draftWorkout.day.name}</h2>
              <p>{state.draftWorkout.rationale}</p>
              <div className="exercise-guide-grid">{state.draftWorkout.day.exercises.map((exercise, index) => <ExerciseGuide key={exercise.name} exercise={exercise} index={index} />)}</div>
              <p className="quiet-note">Start with an easy warm-up. Pick a load that leaves about 2–3 reps in reserve. This is a suggested session, not a completed workout.</p>
              {error && <p role="alert">Workout not saved: {error}</p>}
              <button className="action-primary" disabled={busy} onClick={() => void saveWorkout()}>{busy ? 'Saving workout…' : 'Save this workout'} <ArrowRight size={17} /></button>
            </Glass>}
            {plan?.templateVersion !== 'ai-muscle-session-v1' && !state.draftWorkout && !member.demo && <p className="quiet-note">Your selected workout will appear here after you review and save it. Add body measurements in Insights to give AI Coach more context.</p>}
            <div className="saved-workouts-heading">
              <h2 id="saved-workouts" ref={savedHeading} tabIndex={-1}>Saved workouts ({savedWorkouts.length})</h2>
              {workoutSaved && savedWorkouts.length > 0 && <p role="status" className="workout-saved-confirmation">✓ Workout saved. You can find it here whenever you return to My training.</p>}
              {savedWorkouts.length === 0 && <p>Your workouts will appear here after you select Save this workout.</p>}
            </div>
            {savedWorkouts.map(savedPlan => (
              <Glass key={savedPlan.id} className="saved-workout">
                <details className="saved-workout-details">
                  <summary className="saved-workout-summary" aria-label={`${savedPlan.selectedMuscles?.join(" + ") || savedPlan.days[0].name} workout details`}>
                    <div>
                      <span className="saved-workout-badge">✓ Saved workout</span>
                      <h2>{savedPlan.selectedMuscles?.join(" + ") || savedPlan.days[0].name}</h2>
                      <p className="quiet-note">{savedPlan.days[0].exercises.length} exercises · Saved {displayTimestamp(savedPlan.created)}</p>
                    </div>
                    <span className="saved-workout-toggle"><span className="when-collapsed">Expand</span><span className="when-expanded">Collapse</span><span className="saved-workout-chevron" aria-hidden="true">⌄</span></span>
                  </summary>
                  <div className="saved-workout-body">
                <div className="exercise-guide-grid">{savedPlan.days[0].exercises.map((exercise, index) => <ExerciseGuide key={exercise.name} exercise={exercise} index={index} />)}</div>
                <div className="card-actions">
                  <span className="saved-workout-badge">✓ Saved</span>
                  <button className="action-primary" disabled={busy || generating || !readinessReady || member.demo} onClick={() => void generateWorkout(savedPlan.id)}>{generating ? 'Creating a variation…' : 'Regenerate workout'}</button>
                  <button className="action-secondary" disabled={busy || generating} onClick={() => setConfirm({ title: 'Delete this workout?', description: 'This saved workout will be removed.', action: { type: 'deleteWorkout', planId: savedPlan.id, confirmed: true } })}>Delete workout</button>
                </div>
                {!readinessReady && <p>Save today’s readiness check above before regenerating.</p>}
                  </div>
                </details>
              </Glass>
            ))}

          </>
        )}
        {profile && screen === 'Insights' && (
          <Insights
            asOf={renderedAt}
            state={state}
            onMetric={setMetric}
            onDelete={(m) =>
              setConfirm({
                title: 'Delete this check-in?',
                description: `The measurement dated ${m.date} will be removed. Previously adopted nutrition targets keep their calculation history.`,
                action: { type: 'deleteMetric', id: m.id, confirmed: true },
              })
            }
          />
        )}
        {profile && screen === 'Fuel' && (
          <Fuel
            state={state}
            busy={busy}
            onSaveMealFoods={foods => mutate({ type: 'mealFoods', foods })}
            onMealGenerated={member.receiveSnapshot}
            demo={member.demo}
            onProfile={() => setProfileOpen(true)}
          />
        )}
        {screen === 'Coach' && (
          <CoachPanel
            hasProfile={!!profile}
            demo={member.demo}
            onProfile={() => setProfileOpen(true)}
          />
        )}
        <footer className="member-footer">
          <span>sculptai · Your pace. Your progress.</span>
          <div>
            <button onClick={() => setProfileOpen(true)}>Account & data</button>
          </div>
        </footer>
      </main>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="member-dialog">
          <DialogTitle>
            {profile ? 'Your account' : 'Welcome to your studio'}
          </DialogTitle>
          <DialogDescription>
            {member.demo
              ? 'Fictional profile stored only in this browser tab.'
              : user
                ? `Signed in as ${user.email}`
                : 'Sign in with ChatGPT to save your profile and workouts.'}
          </DialogDescription>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {user ? (
            <>
              <ProfileForm
                initial={profile ?? blankProfile}
                photo={state.profilePhoto}
                onPhotoChange={async photo => { if (!(await mutate({ type: 'profilePhoto', photo }))) throw new Error('The photo could not be saved. Please try again.'); }}
                currentWeight={latest?.weight ?? profile?.weight}
                currentWeightDate={latest?.date}
                busy={busy}
                onSave={async (p) => {
                  if (await mutate({ type: 'profile', profile: p })) {
                    setProfileOpen(false);
                    if (!profile) selectScreen('My training');
                  }
                }}
              />
              <div className="account-tools">
                <button
                  className="action-secondary"
                  onClick={() => exportData()}
                >
                  <Download size={16} />
                  Export my data
                </button>
                <button
                  className="action-secondary"
                  onClick={() => exportData(true)}
                >
                  Export CSV
                </button>
                <a
                  className="action-secondary"
                  target="_top"
                  href="/signout-with-chatgpt?return_to=%2F"
                >
                  <LogOut size={16} />
                  Sign out
                </a>
                <button
                  className="danger-link"
                  onClick={() => {
                    setProfileOpen(false);
                    setDeletion('');
                    setConfirm({
                      title: 'Delete all SculptAI data?',
                      description: member.demo
                        ? 'This clears only the fictional demo data in this browser tab. Your saved member records stay unchanged.'
                        : 'This removes your active SculptAI profile, plans, check-ins, workouts, readiness, consent, reviews and receipts. Your sign-in account and exported copies remain. Hosted backup retention is not finalized for this testing build.',
                      action: { type: 'deleteData' },
                    });
                  }}
                >
                  Delete my SculptAI data
                </button>
              </div>
            </>
          ) : (
            <a
              className="action-primary"
              target="_top"
              href="/signin-with-chatgpt?return_to=%2F"
            >
              Sign in / Sign up
            </a>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={metric !== undefined}
        onOpenChange={(v) => {
          if (!v) setMetric(undefined);
        }}
      >
        <DialogContent className="member-dialog">
          <DialogTitle>
            {metric ? 'Edit check-in' : 'A moment to check in'}
          </DialogTitle>
          <DialogDescription>
            Record what you measured. Optional body composition readings are
            saved as reported.
          </DialogDescription>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {profile && metric !== undefined && (
            <MetricForm
              initial={metric}
              units={profile.units}
              busy={busy}
              onSave={async (m) => {
                if (await mutate({ type: 'metric', metric: m }))
                  setMetric(undefined);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
      >
        <AlertDialogContent className="member-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {confirm?.preview}
          {confirm?.action.type === 'deleteData' && (
            <label className="field">
              Type DELETE to confirm
              <input
                value={deletion}
                onChange={(e) => setDeletion(e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep current</AlertDialogCancel>
            <button
              className="action-primary"
              disabled={
                busy ||
                (confirm?.action.type === 'deleteData' && deletion !== 'DELETE')
              }
              onClick={async () => {
                if (
                  confirm &&
                  (await mutate({
                    ...confirm.action,
                    ...(confirm.action.type === 'deleteData'
                      ? { confirmation: deletion }
                      : {}),
                  }))
                ) {
                  setConfirm(null);
                }
              }}
            >
              {busy
                ? 'Saving…'
                : confirm?.action.type === 'deleteData'
                  ? 'Delete my data'
                  : 'Confirm & save'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

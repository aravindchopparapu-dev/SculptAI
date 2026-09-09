'use client';
import './member.css';
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Download,
  Layers3,
  LogIn,
  LogOut,
  Plus,
  Settings2,
  RefreshCw,
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
import { useMember } from '@/lib/use-member';
import { nutrition, weightDisplay, type Metric } from '@/lib/fitness';
import {
  availableExercises,
  makePlanPreview,
  type Action,
} from '@/lib/actions';
import StudioHero from './studio-hero';
import Workout from './workout';
import Insights from './insights';
import Fuel from './fuel';
import {
  Glass,
  Empty,
  Summary,
  ProfileForm,
  MetricForm,
  blankProfile,
} from './member-forms';
import { useTrainingTools } from './training-tools';
const screens = ['Studio', 'My training', 'Insights', 'Fuel', 'Coach'],
  v1 = 'https://sculptai-fitness-workspace.aravindchopparapu-ch.chatgpt.site';
export default function MemberStudio() {
  const member = useMember(),
    { state, user, loading, busy, error, saved, mutate } = member;
  const [screen, setScreen] = useState('Studio'),
    [profileOpen, setProfileOpen] = useState(false),
    [metric, setMetric] = useState<Metric | null | undefined>(),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: Action;
      preview?: ReactNode;
    } | null>(null),
    [deletion, setDeletion] = useState(''),
    [coachMessage, setCoachMessage] = useState(''),
    [coachAnswer, setCoachAnswer] = useState(''),
    [coachBusy, setCoachBusy] = useState(false);
  const profile = state.profile,
    plan = state.plans.at(-1),
    active = state.sessions.find((s) => !s.completed),
    completed = state.sessions.filter((s) => s.completed),
    latest = state.metrics.at(-1),
    unit = profile?.units === 'Imperial' ? 'lb' : 'kg',
    nextDay = plan
      ? completed.filter((s) => s.planId === plan.id).length % plan.days.length
      : 0;
  useTrainingTools(state);
  function propose(action: Action) {
    try {
      const preview = makePlanPreview(state, action);
      setConfirm({
        title: plan ? 'Review your plan change' : 'Your first training plan',
        description: `Version ${preview.version} · ${preview.days.length} days per week. Saved workouts keep their original plan. Choose a manageable load and leave about 2–3 repetitions in reserve.`,
        action: { ...action, confirmed: true },
        preview: (
          <div className="plan-preview">
            {preview.days.map((d) => (
              <div key={d.name}>
                <strong>{d.name}</strong>
                <p>
                  {d.exercises
                    .map((e) => `${e.name} (${e.sets} × ${e.reps})`)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </div>
        ),
      });
    } catch (e) {
      member.setError((e as Error).message);
    }
  }
  function go() {
    if (!user) {
      window.location.assign('/signin-with-chatgpt?return_to=%2F');
      return;
    }
    if (!profile) setProfileOpen(true);
    else setScreen('My training');
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { exported: new Date().toISOString(), ...state },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sculptai-training-history.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function coach(e: SyntheticEvent) {
    e.preventDefault();
    setCoachBusy(true);
    setCoachAnswer('');
    try {
      const r = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: coachMessage }),
        }),
        d = (await r.json()) as { error?: string; answer: string };
      if (!r.ok) throw new Error(d.error);
      setCoachAnswer(d.answer);
    } catch (e) {
      setCoachAnswer((e as Error).message);
    } finally {
      setCoachBusy(false);
    }
  }
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
          <Tabs value={screen} onValueChange={(v) => setScreen(String(v))}>
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
                {(profile?.name || user.name).slice(0, 1).toUpperCase()}
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
        <div className="context-row">
          <span>
            <i />
            {profile
              ? `${profile.goal.toUpperCase()} · YOUR PERSONAL STUDIO`
              : 'YOUR SPACE TO BECOME'}
          </span>
          <a href={v1} target="_blank" rel="noreferrer">
            View Version 1<ArrowUpRight size={13} />
          </a>
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
              ? 'Signed in securely · your history is private'
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
                : active
                  ? 'Resume your workout'
                  : 'Open your training'
          }
          summary={
            profile
              ? `${profile.days} days a week. ${profile.minutes} minutes for yourself. Your next session starts with a little intention.`
              : 'A training space that moves with you. Build your plan, track your lifts, and see your progress take shape.'
          }
        />
        {screen === 'Studio' && (
          <div className="member-grid stats-grid">
            <Summary
              label="YOUR PLAN"
              value={plan ? `Version ${plan.version}` : 'Your fresh start'}
              detail={
                plan
                  ? `${plan.days.length} training days · ${profile?.equipment}`
                  : 'Set up your profile to build your first plan.'
              }
            />
            <Summary
              label="SAVED WORKOUTS"
              value={completed.length}
              detail={
                active
                  ? 'A workout is ready to resume.'
                  : 'Every session starts a new chapter.'
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
                <p>
                  {profile.days} days / week · {profile.minutes} min ·{' '}
                  {profile.equipment}
                </p>
              </div>
              <button
                className="action-secondary"
                disabled={busy}
                onClick={() => propose({ type: 'plan' })}
              >
                <RefreshCw size={16} />
                {plan ? 'Regenerate plan' : 'Create my plan'}
              </button>
            </div>
            {active ? (
              <Workout
                key={active.id}
                session={active}
                state={state}
                mutate={mutate}
                busy={busy}
                onFinish={() =>
                  setConfirm({
                    title: 'Finish this workout?',
                    description:
                      'Completed sets count toward volume. Skipped or unfinished sets make this a partial workout. You can review it anytime in Insights.',
                    action: {
                      type: 'finish',
                      sessionId: active.id,
                      confirmed: true,
                    },
                  })
                }
              />
            ) : plan ? (
              <div className="member-grid plan-grid">
                {plan.days.map((d, i) => (
                  <Glass
                    key={`${plan.id}-${d.name}`}
                    className={i === nextDay ? 'next-workout' : ''}
                  >
                    <div className="card-heading">
                      <span className="eyebrow">
                        {i === nextDay ? 'UP NEXT' : `DAY ${i + 1}`}
                      </span>
                      <span className="small-pill">PLAN V{plan.version}</span>
                    </div>
                    <h2>{d.name}</h2>
                    <div className="exercise-list">
                      {d.exercises.map((e, index) => (
                        <div key={e.name}>
                          <div>
                            <strong>{e.name}</strong>
                            <small>
                              {e.sets} × {e.reps} · {e.rest}s rest
                            </small>
                          </div>
                          <details className="exercise-options">
                            <summary aria-label={`Options for ${e.name}`}>
                              •••
                            </summary>
                            <p>{e.cue}</p>
                            {availableExercises(profile, e.pattern)
                              .filter(
                                (x) =>
                                  !d.exercises.some((p) => p.name === x.name),
                              )
                              .map((x) => (
                                <button
                                  key={x.name}
                                  disabled={busy}
                                  onClick={() =>
                                    propose({
                                      type: 'substitute',
                                      dayIndex: i,
                                      exerciseIndex: index,
                                      exercise: x.name,
                                    })
                                  }
                                >
                                  Swap to {x.name}
                                </button>
                              ))}
                          </details>
                        </div>
                      ))}
                    </div>
                    <div className="card-actions">
                      <button
                        className="action-primary"
                        disabled={busy}
                        onClick={() =>
                          void mutate({ type: 'start', dayIndex: i })
                        }
                      >
                        Start workout
                        <ArrowUpRight size={17} />
                      </button>
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() =>
                          propose({ type: 'shorten', dayIndex: i })
                        }
                      >
                        Shorter version
                      </button>
                    </div>
                  </Glass>
                ))}
              </div>
            ) : (
              <Glass>
                <Empty title="Your plan starts with you">
                  <p>
                    Your schedule and equipment shape the plan. Review it before
                    saving.
                  </p>
                  <button
                    className="action-primary"
                    onClick={() => propose({ type: 'plan' })}
                  >
                    Build my plan
                    <Plus size={17} />
                  </button>
                </Empty>
              </Glass>
            )}
            <p className="quiet-note">
              Warm up at your own pace. Movement animations are illustrations,
              not live form checks. Stop a movement that causes pain.
            </p>
          </>
        )}
        {profile && screen === 'Insights' && (
          <Insights
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
            onAdopt={() => {
              try {
                const t = nutrition({
                  ...profile,
                  weight: latest?.weight ?? profile.weight,
                });
                setConfirm({
                  title: 'Adopt these nutrition targets?',
                  description: `Estimated maintenance: ${Math.round(t.maintenance * 0.9)}–${Math.round(t.maintenance * 1.1)} kcal/day. Proposed target: ${Math.round(t.calories)} kcal · ${Math.round(t.protein)} g protein · ${Math.round(t.fat)} g fat · ${Math.round(t.carbs)} g carbohydrate. These are estimates, not a prescribed diet.`,
                  action: { type: 'nutrition', confirmed: true },
                });
              } catch (e) {
                member.setError((e as Error).message);
              }
            }}
            onProfile={() => setProfileOpen(true)}
          />
        )}
        {profile && screen === 'Coach' && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">A LITTLE GUIDANCE</span>
                <h1>Let’s find your next step.</h1>
                <p>
                  Ask about your saved training, nutrition estimates, or a
                  shorter session.
                </p>
              </div>
            </div>
            <div className="member-grid coach-grid">
              <Glass>
                <span className="small-pill">TRAINING GUIDE · BETA</span>
                <h2>What’s on your mind?</h2>
                <div className="coach-prompts">
                  {[
                    'Summarize my training',
                    'Explain my nutrition targets',
                    'How should I progress?',
                  ].map((m) => (
                    <button
                      className="action-secondary"
                      key={m}
                      onClick={() => setCoachMessage(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <form onSubmit={coach}>
                  <label className="field">
                    Your question
                    <textarea
                      required
                      maxLength={2000}
                      value={coachMessage}
                      onChange={(e) => setCoachMessage(e.target.value)}
                      placeholder="How is my training going?"
                    />
                  </label>
                  <button
                    className="action-primary"
                    disabled={coachBusy || !coachMessage.trim()}
                  >
                    {coachBusy ? 'Thinking…' : 'Ask your guide'}
                    <ArrowUpRight size={17} />
                  </button>
                </form>
                {coachAnswer && (
                  <div className="coach-response" role="status">
                    {coachAnswer}
                  </div>
                )}
              </Glass>
              <Glass>
                <h2>Built around your history.</h2>
                <p>
                  The guide explains saved records and conservative progression
                  rules. Plan changes always need your review.
                </p>
                <p>
                  Live AI responses need a separate service connection. The
                  built-in guide remains available while that is being
                  connected.
                </p>
                <button
                  className="text-link"
                  onClick={() => setScreen('My training')}
                >
                  Review your plan
                  <ArrowRight size={15} />
                </button>
                <p className="quiet-note">
                  For general adult fitness. Medical conditions, pain, and
                  prescribed diets need professional care.
                </p>
              </Glass>
            </div>
          </>
        )}
        <footer className="member-footer">
          <span>sculptai · Your pace. Your progress.</span>
          <div>
            <button onClick={() => setProfileOpen(true)}>Account & data</button>
            <a href={v1} target="_blank" rel="noreferrer">
              Version 1
            </a>
          </div>
        </footer>
      </main>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="member-dialog">
          <DialogTitle>
            {profile ? 'Your account' : 'Welcome to your studio'}
          </DialogTitle>
          <DialogDescription>
            {user
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
                busy={busy}
                onSave={async (p) => {
                  if (await mutate({ type: 'profile', profile: p })) {
                    setProfileOpen(false);
                    setScreen('My training');
                  }
                }}
              />
              <div className="account-tools">
                <button className="action-secondary" onClick={exportData}>
                  <Download size={16} />
                  Export my data
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
                      description:
                        'This permanently removes your profile, plans, check-ins, workout logs and nutrition history from Version 2. Your ChatGPT account remains available. Export your history first if you need a copy.',
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

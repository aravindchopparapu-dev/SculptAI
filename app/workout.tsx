'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Dumbbell } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  volume,
  weightDisplay,
  type Session,
  type State,
  type SetLog,
} from '@/lib/fitness';
import type { Action } from '@/lib/actions';
import { Glass } from './member-forms';
export type Mutate = (action: Action) => Promise<boolean>;
export default function Workout({
  session,
  state,
  mutate,
  busy,
  onFinish,
}: {
  session: Session;
  state: State;
  mutate: Mutate;
  busy: boolean;
  onFinish: () => void;
}) {
  const profile = state.profile!,
    plan = state.plans.find((p) => p.id === session.planId)!,
    day = session.prescribed ?? plan.days[session.dayIndex],
    done = session.sets.filter((x) => x.done).length;
  const [notes, setNotes] = useState(session.notes),
    [rest, setRest] = useState(0);
  const resting = rest > 0;
  useEffect(() => {
    if (!resting) return;
    const timer = setInterval(() => setRest((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [resting]);
  return (
    <div className="workout-surface">
      <Glass className="workout-banner">
        <div>
          <span className="eyebrow">
            YOUR ACTIVE WORKOUT · PLAN V{plan.version}
          </span>
          <h2>{session.name}</h2>
          <p>
            {done} / {session.sets.length} sets completed ·{' '}
            {weightDisplay(volume(session), profile.units)}{' '}
            {profile.units === 'Imperial' ? 'lb' : 'kg'} volume
          </p>
        </div>
        <div>
          <Progress value={(100 * done) / session.sets.length} />
          <button
            className="action-secondary"
            disabled={busy}
            onClick={onFinish}
          >
            Finish workout
            <Check size={16} />
          </button>
        </div>
      </Glass>
      <Glass>
        <h2>Start with a five-minute warm-up</h2>
        <p>
          Use easy movement, then rehearse today’s movements with a comfortable
          range and light resistance. Keep the prescribed rest; stop any
          movement that hurts.
        </p>
      </Glass>
      {rest > 0 && (
        <div className="rest-timer" role="timer">
          <Clock3 size={18} />
          Rest · {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}
          <button onClick={() => setRest(0)}>Skip timer</button>
        </div>
      )}
      {day.exercises.map((e) => (
        <Glass key={e.name}>
          <div className="card-heading">
            <div>
              <h2>{e.name}</h2>
              <p>
                {e.sets} × {e.reps} · {e.rest}s rest · aim for RPE 7–8
              </p>
            </div>
            <Dumbbell size={22} />
          </div>
          <p>{e.cue}</p>
          {(() => {
            const prev = [...state.sessions]
              .reverse()
              .find(
                (s) =>
                  s.completed &&
                  s.sets.some((x) => x.exercise === e.name && x.done),
              );
            return (
              <p className="quiet-note">
                {prev
                  ? `Last time: ${prev.sets
                      .filter((x) => x.exercise === e.name && x.done)
                      .map(
                        (x) =>
                          `${x.reps} × ${weightDisplay(x.load, profile.units)} ${profile.units === 'Imperial' ? 'lb' : 'kg'}`,
                      )
                      .join(' · ')}`
                  : 'First logged session. Choose a comfortable load.'}
              </p>
            );
          })()}
          <PainControls
            session={session}
            exercise={e.name}
            mutate={mutate}
            busy={busy}
          />
          <div className="set-labels">
            <span>SET</span>
            <span>REPS</span>
            <span>{profile.units === 'Imperial' ? 'LB' : 'KG'} TOTAL LOAD</span>
            <span>RPE · OPTIONAL</span>
            <span>STATUS</span>
          </div>
          {session.sets.map((s, index) =>
            s.exercise === e.name &&
            !session.painEvents?.some(
              (p) => p.severity === 'urgent' || p.exercise === e.name,
            ) ? (
              <SetEntry
                key={`${session.id}-${index}`}
                set={s}
                index={index}
                sessionId={session.id}
                imperial={profile.units === 'Imperial'}
                mutate={mutate}
                onDone={() => setRest(e.rest)}
              />
            ) : null,
          )}
        </Glass>
      ))}
      <Glass>
        <label className="field">
          Workout notes
          <textarea
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== session.notes)
                void mutate({
                  type: 'sessionNotes',
                  sessionId: session.id,
                  notes,
                });
            }}
            placeholder="How did it feel?"
          />
        </label>
        <p className="quiet-note">
          Set entries save as you type. Notes save when you leave the field.
          Wait for “All changes saved” before closing the page.
        </p>
        <button className="action-primary" disabled={busy} onClick={onFinish}>
          Finish workout
          <Check size={17} />
        </button>
      </Glass>
    </div>
  );
}
function SetEntry({
  set,
  index,
  sessionId,
  imperial,
  mutate,
  onDone,
}: {
  set: SetLog;
  index: number;
  sessionId: string;
  imperial: boolean;
  mutate: Mutate;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(set),
    [pending, setPending] = useState(false),
    [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    latest = useRef(draft),
    saved = useRef(JSON.stringify(set));
  const factor = imperial ? 2.2046226218 : 1;
  // Do not overwrite in-flight typing when an earlier autosave resolves.
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
  async function save(next: SetLog) {
    clearTimeout(timer.current);
    const encoded = JSON.stringify(next);
    if (encoded === saved.current) {
      setPending(false);
      return;
    }
    setPending(true);
    const ok = await mutate({ type: 'set', sessionId, index, set: next });
    setPending(false);
    setFailed(!ok);
    if (ok) {
      saved.current = encoded;
      if (next.done && !set.done) onDone();
    }
  }
  function change(next: SetLog) {
    setDraft(next);
    setPending(true);
    latest.current = next;
    setFailed(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(latest.current), 600);
  }
  return (
    <div className={`set-entry ${draft.done ? 'set-complete' : ''}`}>
      <strong>{set.index + 1}</strong>
      <label>
        <span className="mobile-label">Reps</span>
        <input
          aria-label={`${set.exercise} set ${set.index + 1} reps`}
          inputMode="numeric"
          type="number"
          min={0}
          max={100}
          step={1}
          value={draft.reps || ''}
          onChange={(e) =>
            change({ ...draft, reps: Number(e.target.value), done: false })
          }
          onBlur={() => void save(latest.current)}
        />
      </label>
      <label>
        <span className="mobile-label">Load ({imperial ? 'lb' : 'kg'})</span>
        <input
          aria-label={`${set.exercise} set ${set.index + 1} load`}
          inputMode="decimal"
          type="number"
          min={0}
          max={600 * factor}
          value={draft.load ? Number((draft.load * factor).toFixed(2)) : ''}
          placeholder="0"
          onChange={(e) =>
            change({
              ...draft,
              load: Number(e.target.value) / factor,
              done: false,
            })
          }
          onBlur={() => void save(latest.current)}
        />
      </label>
      <label>
        <span className="mobile-label">RPE</span>
        <input
          aria-label={`${set.exercise} set ${set.index + 1} RPE`}
          inputMode="decimal"
          type="number"
          min={1}
          max={10}
          step={0.5}
          value={draft.rpe ?? ''}
          placeholder="—"
          onChange={(e) =>
            change({
              ...draft,
              rpe: e.target.value ? Number(e.target.value) : undefined,
              done: false,
            })
          }
          onBlur={() => void save(latest.current)}
        />
      </label>
      <div className="set-actions">
        <button
          disabled={pending || draft.reps < 1}
          className={draft.done ? 'done-button' : 'action-secondary compact'}
          onClick={() => {
            const next = {
              ...latest.current,
              done: !draft.done,
              skipped: false,
            };
            change(next);
            void save(next);
          }}
          aria-label={`${draft.done ? 'Undo' : 'Complete'} ${set.exercise} set ${set.index + 1}`}
        >
          {draft.done ? <Check size={18} /> : pending ? '…' : 'Done'}
        </button>
        <button
          disabled={pending}
          className="text-link"
          onClick={() => {
            const next = {
              ...latest.current,
              done: false,
              skipped: !draft.skipped,
            };
            change(next);
            void save(next);
          }}
        >
          {draft.skipped ? 'Unskip' : 'Skip'}
        </button>
        {failed && (
          <button
            className="danger-link"
            onClick={() => void save(latest.current)}
          >
            Retry save
          </button>
        )}
      </div>
    </div>
  );
}

function PainControls({
  session,
  exercise,
  mutate,
  busy,
}: {
  session: Session;
  exercise: string;
  mutate: Mutate;
  busy: boolean;
}) {
  const [severity, setSeverity] = useState('pain'),
    [note, setNote] = useState('');
  if (
    session.painEvents?.some(
      (p) => p.severity === 'urgent' || p.exercise === exercise,
    )
  )
    return (
      <p className="form-error" role="alert">
        Movement stopped and report saved. Unfinished sets are skipped. Finish
        the session if needed. Seek guidance for persistent, severe or sudden
        pain; contact local emergency services for current chest pain, fainting
        or severe breathing difficulty.
      </p>
    );
  return (
    <details className="pain-controls">
      <summary>Report pain and stop this movement</summary>
      <form
        className="member-form"
        onSubmit={(e) => {
          e.preventDefault();
          void mutate({
            type: 'pain',
            sessionId: session.id,
            exercise,
            severity,
            note,
          });
        }}
      >
        <label className="field">
          Symptom level
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="pain">Movement causes pain</option>
            <option value="urgent">
              Urgent symptoms — stop the entire session
            </option>
          </select>
        </label>
        {severity === 'urgent' && (
          <p role="alert">
            For current chest pain, fainting or severe breathing difficulty,
            contact local emergency services. Saving this report stops the
            entire session.
          </p>
        )}
        <label className="field">
          Pain note (optional)
          <input
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="action-secondary" disabled={busy}>
          Save pain report and stop
        </button>
      </form>
    </details>
  );
}

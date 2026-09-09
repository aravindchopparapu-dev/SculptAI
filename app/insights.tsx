'use client';
import { useState } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { volume, weightDisplay, type State, type Metric } from '@/lib/fitness';
import { Glass, Summary, Empty } from './member-forms';
import { StrengthTrend } from './strength-trend';
import { TrendChart } from './trend-chart';
export default function Insights({
  state,
  onMetric,
  onDelete,
}: {
  state: State;
  onMetric: (m: Metric | null) => void;
  onDelete: (m: Metric) => void;
}) {
  const [period, setPeriod] = useState('30 days');
  const profile = state.profile!,
    unit = profile.units === 'Imperial' ? 'lb' : 'kg',
    completed = state.sessions.filter((s) => s.completed),
    days = period === '7 days' ? 7 : period === '30 days' ? 30 : Infinity,
    since = Date.now() - days * 864e5,
    metrics = state.metrics.filter((m) => Date.parse(m.date) >= since),
    sessions = completed.filter((s) => Date.parse(s.completed!) >= since);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMALL WINS, BIG PICTURE</span>
          <h1>Your progress, unfolding.</h1>
        </div>
        <button className="action-primary" onClick={() => onMetric(null)}>
          <Plus size={17} />
          Add check-in
        </button>
      </div>
      <Tabs value={period} onValueChange={(v) => setPeriod(String(v))}>
        <TabsList className="period-tabs">
          {['7 days', '30 days', 'All time'].map((p) => (
            <TabsTrigger key={p} value={p}>
              {p}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="member-grid stats-grid">
        <Summary
          label="WORKOUTS"
          value={sessions.length}
          detail={`${sessions.filter((s) => s.status === 'complete').length} complete · ${sessions.filter((s) => s.status !== 'complete').length} partial`}
        />
        <Summary
          label={`CONSISTENCY · ${period === '7 days' ? 7 : 30} DAYS`}
          value={`${completed.filter((s) => Date.parse(s.completed!) >= Date.now() - (period === '7 days' ? 7 : 30) * 864e5 && s.status === 'complete').length} / ${Math.round((profile.days * (period === '7 days' ? 7 : 30)) / 7)}`}
          detail={`Finished / benchmark at your current ${profile.days}-day weekly schedule`}
        />
        <Summary
          label="TOTAL LOAD VOLUME"
          value={`${weightDisplay(
            sessions.reduce((n, s) => n + volume(s), 0),
            profile.units,
          ).toLocaleString()} ${unit}`}
          detail="Logged repetitions × external load"
        />
      </div>
      <div className="member-grid insight-grid">
        <Glass>
          <div className="card-heading">
            <h2>Weight over time</h2>
            <TrendingUp size={20} />
          </div>
          <WeightChart metrics={metrics} units={profile.units} />
        </Glass>
        <Glass>
          <h2>Your check-ins</h2>
          {!state.metrics.length ? (
            <p>Record your first measurement to begin a trend.</p>
          ) : (
            <div className="history-list">
              {[...state.metrics].reverse().map((m) => (
                <div key={m.id}>
                  <button className="history-edit" onClick={() => onMetric(m)}>
                    <strong>
                      {weightDisplay(m.weight, profile.units)} {unit}
                    </strong>
                    <span>
                      {m.date} · {m.source || 'Manual'}
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete check-in ${m.date}`}
                    onClick={() => onDelete(m)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Glass>
      </div>
      <Glass>
        <h2>Workout history</h2>
        {!sessions.length ? (
          <p>
            Your finished workouts will appear here, including partially
            completed sessions.
          </p>
        ) : (
          <div className="history-list">
            {[...sessions].reverse().map((s) => (
              <details key={s.id}>
                <summary>
                  <strong>{s.name}</strong>
                  <span>
                    {new Date(s.completed!).toLocaleDateString()} · {s.status} ·{' '}
                    {s.sets.filter((x) => x.done).length} sets ·{' '}
                    {Math.max(
                      1,
                      Math.round(
                        (Date.parse(s.completed!) - Date.parse(s.started)) /
                          60000,
                      ),
                    )}{' '}
                    min
                  </span>
                </summary>
                <p>
                  Plan v{state.plans.find((p) => p.id === s.planId)?.version} ·{' '}
                  {weightDisplay(volume(s), profile.units)} {unit} volume
                </p>
                {s.sets.map((set, i) => (
                  <p key={i}>
                    {set.exercise} ·{' '}
                    {set.done
                      ? `${set.reps} reps × ${weightDisplay(set.load, profile.units)} ${unit}${set.rpe ? ` · RPE ${set.rpe}` : ''}`
                      : set.skipped
                        ? 'Skipped'
                        : 'Unfinished'}
                  </p>
                ))}
                {s.notes && <p>{s.notes}</p>}
              </details>
            ))}
          </div>
        )}
      </Glass>
      <StrengthTrend sessions={completed} units={profile.units} since={since} />
      <Records state={state} />
    </>
  );
}
function WeightChart({ metrics, units }: { metrics: Metric[]; units: string }) {
  if (!metrics.length)
    return (
      <Empty title="Your trend starts here">
        <p>Add a weight check-in to begin.</p>
      </Empty>
    );
  return (
    <>
      {metrics.length === 1 && (
        <p className="quiet-note">
          One baseline recorded. Add a later check-in to see a trend.
        </p>
      )}
      <TrendChart
        points={metrics.map((m) => ({
          id: m.id,
          date: m.date,
          value: weightDisplay(m.weight, units),
        }))}
        label="Weight"
        unit={units === 'Imperial' ? 'lb' : 'kg'}
      />
    </>
  );
}

function Records({ state }: { state: State }) {
  const records = new Map<
    string,
    { exercise: string; reps: number; load: number; date: string }
  >();
  for (const s of state.sessions.filter((x) => x.completed)) {
    for (const set of s.sets.filter((x) => x.done && x.load > 0)) {
      const key = `${set.exercise}/${set.reps}`,
        old = records.get(key);
      if (!old || set.load > old.load)
        records.set(key, {
          exercise: set.exercise,
          reps: set.reps,
          load: set.load,
          date: s.completed!.slice(0, 10),
        });
    }
  }
  return (
    <Glass>
      <h2>Your best lifts</h2>
      <p>
        Heaviest logged load at the same repetition count. First entries
        establish a baseline.
      </p>
      {records.size ? (
        <div className="record-grid">
          {[...records.values()].map((r) => (
            <div key={`${r.exercise}/${r.reps}`}>
              <strong>{r.exercise}</strong>
              <span>
                {r.reps} × {weightDisplay(r.load, state.profile!.units)}{' '}
                {state.profile!.units === 'Imperial' ? 'lb' : 'kg'}
              </span>
              <small>{r.date}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="quiet-note">
          Finish a workout with a logged load to establish your first record.
        </p>
      )}
    </Glass>
  );
}

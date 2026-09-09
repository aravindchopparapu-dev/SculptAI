'use client';
import { useState } from 'react';
import { strengthOptions, strengthTrend } from '@/lib/insights';
import type { Session } from '@/lib/fitness';
import { Glass, Choice, Empty } from './member-forms';
import { TrendChart } from './trend-chart';
export function StrengthTrend({
  sessions,
  units,
  since,
}: {
  sessions: Session[];
  units: string;
  since: number;
}) {
  const [exercise, setExercise] = useState(''),
    [reps, setReps] = useState('');
  const options = strengthOptions(sessions),
    selected = options.find((o) => o.exercise === exercise) ?? options[0];
  const count = selected?.reps.includes(Number(reps))
    ? Number(reps)
    : selected?.reps[0];
  const points = selected
    ? strengthTrend(sessions, selected.exercise, count!, units).filter(
        (p) => Date.parse(p.date) >= since,
      )
    : [];
  return (
    <Glass>
      <h2>Strength over time</h2>
      <p>
        Compare your heaviest completed set at the same repetition count, one
        point per finished workout. Partial workouts count when the set was
        completed. Bodyweight-only sets are excluded.
      </p>
      {selected ? (
        <>
          <div className="trend-controls">
            <Choice
              label="Exercise to compare"
              value={selected.exercise}
              options={options.map((o) => o.exercise)}
              onChange={(value) => {
                setExercise(value);
                setReps('');
              }}
            />
            <Choice
              label="Repetitions per set"
              value={String(count)}
              options={selected.reps.map(String)}
              onChange={setReps}
            />
          </div>
          {points.length < 2 && (
            <p className="trend-baseline">
              {points.length === 1
                ? 'One baseline recorded. Finish another workout at this repetition count to see a trend.'
                : 'No matching sets in this period. Choose a longer period or a different repetition count.'}
            </p>
          )}
          <TrendChart
            points={points}
            label="External load"
            unit={units === 'Imperial' ? 'lb' : 'kg'}
          />
        </>
      ) : (
        <Empty title="Your strength story starts with a set">
          <p>
            Finish a workout with repetitions and external load to establish
            your baseline.
          </p>
        </Empty>
      )}
    </Glass>
  );
}

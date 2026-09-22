'use client';
import { useState } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { weightDisplay, type State, type Metric } from '@/lib/fitness';
import { Glass, Empty } from './member-forms';
import { TrendChart } from './trend-chart';
export default function Insights({
  asOf,
  state,
  onMetric,
  onDelete,
}: {
  asOf: number;
  state: State;
  onMetric: (m: Metric | null) => void;
  onDelete: (m: Metric) => void;
}) {
  const [period, setPeriod] = useState('30 days');
  const profile = state.profile!,
    unit = profile.units === 'Imperial' ? 'lb' : 'kg',
    days = period === '7 days' ? 7 : period === '30 days' ? 30 : Infinity,
    since = asOf - days * 864e5,
    metrics = state.metrics.filter((m) => Date.parse(m.date) >= since),
    latest = state.metrics.at(-1),
    change = latest && profile.weight ? weightDisplay(latest.weight - profile.weight, profile.units) : null;
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
      <div className="member-grid insight-grid">
        <Glass>
          <div className="card-heading">
            <h2>Weight over time</h2>
            <TrendingUp size={20} />
          </div>
          <WeightChart metrics={metrics} units={profile.units} startingWeight={profile.weight} />
          {change !== null && <p className="quiet-note">Latest check-in versus starting weight: {change > 0 ? '+' : ''}{change} {unit}.</p>}
        </Glass>
        <Glass>
          <h2>Weight history</h2>
          <div className="history-list">
            {profile.weight > 0 && <div className="insight-starting-weight">
              <div className="history-edit">
                <strong>{weightDisplay(profile.weight, profile.units)} {unit}</strong>
                <span>1 · Starting weight from your profile</span>
              </div>
            </div>}
            {state.metrics.map((m, index) => (
                <div key={m.id}>
                  <button className="history-edit" onClick={() => onMetric(m)}>
                    <strong>
                      {weightDisplay(m.weight, profile.units)} {unit}
                    </strong>
                    <span>
                      {index + (profile.weight > 0 ? 2 : 1)} · {m.date} · {m.source || 'Manual'}
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
          {!state.metrics.length && <p>Save a check-in to add the next point after your starting weight.</p>}
        </Glass>
      </div>
    </>
  );
}
function WeightChart({ metrics, units, startingWeight }: { metrics: Metric[]; units: string; startingWeight: number }) {
  if (!metrics.length && !startingWeight)
    return (
      <Empty title="Your trend starts here">
        <p>Add your starting weight to Profile or save a check-in.</p>
      </Empty>
    );
  return (
    <>
      {metrics.length === 0 && startingWeight > 0 && (
        <p className="quiet-note">
          Starting weight recorded in Profile. Add a check-in for your second point.
        </p>
      )}
      <TrendChart
        points={[...(startingWeight > 0 ? [{ id: 'profile-starting-weight', date: null, caption: 'Starting weight (profile)', value: weightDisplay(startingWeight, units) }] : []), ...metrics.map((m) => ({
          id: m.id,
          date: m.date,
          value: weightDisplay(m.weight, units),
        }))]}
        label="Weight"
        unit={units === 'Imperial' ? 'lb' : 'kg'}
      />
    </>
  );
}

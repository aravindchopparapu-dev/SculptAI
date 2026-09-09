'use client';
import { useState, type ReactNode } from 'react';
import { Check, Sparkles } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { goals, weightDisplay, type Profile, type Metric } from '@/lib/fitness';
export const blankProfile: Profile = {
  name: '',
  age: 0,
  sex: '',
  height: 0,
  weight: 0,
  goal: '',
  days: 0,
  minutes: 0,
  equipment: '',
  experience: '',
  activity: 0,
  units: 'Metric',
  diet: '',
  exclusions: '',
  avoid: '',
  eligible: false,
};
export function Glass({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass member-card ${className}`}>{children}</section>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <Select
        value={value || null}
        onValueChange={(v) => onChange(String(v ?? ''))}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  optional = false,
  min = 0,
  max = 999,
  step = 'any',
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  optional?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={value || ''}
        required={!optional}
        min={min}
        max={max}
        step={step}
        onChange={(e) =>
          onChange(e.target.value === '' ? 0 : Number(e.target.value))
        }
      />
    </label>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="member-empty">
      <Sparkles size={25} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Summary({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <Glass>
      <span className="eyebrow">{label}</span>
      <div className="stat-value">{value}</div>
      {detail && <p>{detail}</p>}
    </Glass>
  );
}
export function ProfileForm({
  initial,
  busy,
  onSave,
}: {
  initial: Profile;
  busy: boolean;
  onSave: (p: Profile) => Promise<void>;
}) {
  const [p, setP] = useState(initial);
  const set = (key: keyof Profile, value: unknown) =>
    setP((prev) => ({ ...prev, [key]: value }));
  const imperial = p.units === 'Imperial';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(p);
      }}
      className="member-form"
    >
      <label className="field">
        Preferred name
        <input
          required
          maxLength={80}
          value={p.name}
          onChange={(e) => set('name', e.target.value)}
          type="text"
          autoComplete="name"
        />
      </label>
      <div className="form-grid">
        <NumberField
          label="Age (18+)"
          value={p.age}
          min={18}
          max={100}
          step="1"
          onChange={(v) => set('age', v)}
        />
        <Choice
          label="Display units"
          value={p.units}
          options={['Metric', 'Imperial']}
          onChange={(v) => set('units', v)}
        />
        <Choice
          label="Primary goal"
          value={p.goal}
          options={goals}
          onChange={(v) => set('goal', v)}
        />
        <Choice
          label="Experience"
          value={p.experience}
          options={['Beginner', 'Intermediate']}
          onChange={(v) => set('experience', v)}
        />
        <Choice
          label="Training days / week"
          value={p.days ? String(p.days) : ''}
          options={['2', '3', '4', '5', '6']}
          onChange={(v) => set('days', Number(v))}
        />
        <Choice
          label="Minutes / session"
          value={p.minutes ? String(p.minutes) : ''}
          options={['20', '30', '45', '60', '75', '90']}
          onChange={(v) => set('minutes', Number(v))}
        />
        <Choice
          label="Available equipment"
          value={p.equipment}
          options={['Bodyweight', 'Dumbbells', 'Gym']}
          onChange={(v) => set('equipment', v)}
        />
        <Choice
          label="Diet preference"
          value={p.diet}
          options={['Omnivore', 'Vegetarian', 'Vegan']}
          onChange={(v) => set('diet', v)}
        />
      </div>
      <label className="field">
        Movements to avoid (comma-separated)
        <input
          maxLength={500}
          value={p.avoid}
          onChange={(e) => set('avoid', e.target.value)}
          placeholder="For example: squat, overhead"
        />
      </label>
      <label className="field">
        Foods to exclude (comma-separated)
        <input
          maxLength={500}
          value={p.exclusions}
          onChange={(e) => set('exclusions', e.target.value)}
          placeholder="For example: peanuts, dairy"
        />
      </label>
      <h3>Nutrition estimates</h3>
      <p className="quiet-note">
        Height, weight and formula sex are optional for training. The calorie
        calculator needs all three. Switching display units preserves your
        measurements.
      </p>
      <div className="form-grid">
        <NumberField
          label={`Height (${imperial ? 'in' : 'cm'}) · optional`}
          value={
            p.height ? Number((p.height / (imperial ? 2.54 : 1)).toFixed(2)) : 0
          }
          optional
          min={imperial ? 39 : 100}
          max={imperial ? 99 : 250}
          onChange={(v) => set('height', v * (imperial ? 2.54 : 1))}
        />
        <NumberField
          label={`Starting weight (${imperial ? 'lb' : 'kg'}) · optional`}
          value={p.weight ? weightDisplay(p.weight, p.units) : 0}
          optional
          min={imperial ? 66 : 30}
          max={imperial ? 772 : 350}
          onChange={(v) => set('weight', v / (imperial ? 2.2046226218 : 1))}
        />
        <Choice
          label="Sex used by formula (optional)"
          value={p.sex || 'Not provided'}
          options={['Not provided', 'Female', 'Male']}
          onChange={(v) => set('sex', v === 'Not provided' ? '' : v)}
        />
        <Choice
          label="Activity level"
          value={
            [
              '',
              'Mostly seated',
              'Lightly active',
              'Moderately active',
              'Very active',
            ][[0, 1.2, 1.375, 1.55, 1.725].indexOf(p.activity)] || ''
          }
          options={[
            'Mostly seated',
            'Lightly active',
            'Moderately active',
            'Very active',
          ]}
          onChange={(v) =>
            set(
              'activity',
              [1.2, 1.375, 1.55, 1.725][
                [
                  'Mostly seated',
                  'Lightly active',
                  'Moderately active',
                  'Very active',
                ].indexOf(v)
              ],
            )
          }
        />
      </div>
      <label className="eligibility" htmlFor="nutrition-eligible">
        <Switch
          id="nutrition-eligible"
          checked={p.eligible}
          onCheckedChange={(v) => set('eligible', v)}
        />
        <span>
          I am an adult and do not need a prescribed diet. I am not pregnant or
          postpartum and do not have an eating disorder, kidney/liver disease or
          uncontrolled diabetes. Automated nutrition is unavailable if these
          apply.
        </span>
      </label>
      <button className="action-primary" disabled={busy} type="submit">
        {busy ? 'Saving…' : 'Save profile'}
        <Check size={17} />
      </button>
    </form>
  );
}
export function MetricForm({
  initial,
  units,
  busy,
  onSave,
}: {
  initial: Metric | null;
  units: string;
  busy: boolean;
  onSave: (m: Metric) => Promise<void>;
}) {
  const [m, setM] = useState<Metric>(
    initial ?? {
      id: '',
      date: new Date().toLocaleDateString('en-CA'),
      weight: 0,
      source: 'Manual',
      notes: '',
    },
  );
  const imperial = units === 'Imperial',
    factor = imperial ? 2.2046226218 : 1;
  return (
    <form
      className="member-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(m);
      }}
    >
      <div className="form-grid">
        <label className="field">
          Measurement date
          <input
            required
            type="date"
            max={new Date().toLocaleDateString('en-CA')}
            value={m.date}
            onChange={(e) => setM({ ...m, date: e.target.value })}
          />
        </label>
        <NumberField
          label={`Weight (${imperial ? 'lb' : 'kg'})`}
          value={m.weight ? Number((m.weight * factor).toFixed(2)) : 0}
          min={30 * factor}
          max={350 * factor}
          onChange={(v) => setM({ ...m, weight: v / factor })}
        />
        {(
          [
            ['waist', `Waist (${imperial ? 'in' : 'cm'})`],
            ['bodyFat', 'Body fat (%)'],
            ['fatMass', `Fat mass (${imperial ? 'lb' : 'kg'})`],
            ['leanMass', `Lean mass (${imperial ? 'lb' : 'kg'})`],
            ['muscleMass', `Skeletal muscle (${imperial ? 'lb' : 'kg'})`],
            ['bmr', 'BMR (kcal)'],
            ['visceral', 'Visceral fat rating'],
            ['ecw', 'ECW / TBW ratio'],
          ] as const
        ).map(([key, label]) => {
          const f =
            key === 'waist'
              ? imperial
                ? 1 / 2.54
                : 1
              : ['fatMass', 'leanMass', 'muscleMass'].includes(key)
                ? factor
                : 1;
          return (
            <NumberField
              key={key}
              label={`${label} · optional`}
              optional
              value={m[key] ? Number((m[key]! * f).toFixed(3)) : 0}
              max={key === 'bmr' ? 5000 : 1000}
              onChange={(v) => setM({ ...m, [key]: v ? v / f : undefined })}
            />
          );
        })}
      </div>
      <label className="field">
        Source
        <input
          maxLength={100}
          value={m.source}
          onChange={(e) => setM({ ...m, source: e.target.value })}
        />
      </label>
      <label className="field">
        Notes
        <textarea
          maxLength={1000}
          value={m.notes}
          onChange={(e) => setM({ ...m, notes: e.target.value })}
        />
      </label>
      <button className="action-primary" disabled={busy}>
        Save check-in
        <Check size={16} />
      </button>
    </form>
  );
}

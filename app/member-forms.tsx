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
  targetWeight: 0,
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
  photo,
  onPhotoChange,
  currentWeight,
  currentWeightDate,
  busy,
  onSave,
}: {
  initial: Profile;
  photo?: string;
  onPhotoChange: (photo: string | null) => Promise<void>;
  currentWeight?: number;
  currentWeightDate?: string;
  busy: boolean;
  onSave: (p: Profile) => Promise<void>;
}) {
  const [p, setP] = useState(initial);
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  async function choosePhoto(file?: File) {
    if (!file) return;
    setPhotoError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10_000_000) {
      setPhotoError('Choose a JPG, PNG or WebP photo under 10 MB.');
      return;
    }
    setPhotoBusy(true);
    try {
      const image = await createImageBitmap(file);
      if (!image.width || !image.height) throw new Error('This photo could not be opened.');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This photo could not be prepared.');
      const side = Math.min(image.width, image.height);
      let data = '';
      for (const size of [160, 128, 96, 72]) {
        canvas.width = size;
        canvas.height = size;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size, size);
        context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
        data = canvas.toDataURL('image/jpeg', 0.7);
        if (data.length <= 16000) break;
      }
      image.close();
      if (data.length > 16000) throw new Error('This photo could not be reduced enough. Choose a simpler image.');
      await onPhotoChange(data);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'This photo could not be saved.');
    } finally {
      setPhotoBusy(false);
    }
  }
  const set = (key: keyof Profile, value: unknown) =>
    setP((prev) => ({ ...prev, [key]: value }));
  const imperial = p.units === 'Imperial';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(p);
      }}
      className="member-form profile-manual-entry"
      onWheelCapture={(event) => {
        const focused = event.currentTarget.ownerDocument.activeElement;
        if (focused instanceof HTMLInputElement && focused.type === 'number' && event.currentTarget.contains(focused)) focused.blur();
      }}
      onKeyDownCapture={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.type === 'number' && ['ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
      }}
    >
      <div className="profile-photo-controls">
        {photo ? <img className="profile-photo-preview" src={photo} alt="Your avatar" />
          : <div className="profile-photo-preview profile-photo-placeholder" aria-hidden="true">{p.name.slice(0, 1).toUpperCase() || 'A'}</div>}
        <div>
          <strong>Profile photo</strong>
          <div className="profile-photo-actions">
            <label className="action-secondary">
              {photoBusy ? 'Saving photo…' : photo ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" disabled={busy || photoBusy} hidden
                onChange={event => { void choosePhoto(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
            {photo && <button type="button" className="action-secondary" disabled={busy || photoBusy}
              onClick={() => { setPhotoError(''); void onPhotoChange(null).catch(error => setPhotoError(error instanceof Error ? error.message : 'The photo could not be removed.')); }}>Remove photo</button>}
          </div>
        </div>
      </div>
      {photoError && <p className="member-alert" role="alert">{photoError}</p>}
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
      <h3>Body measurements</h3>
      <p className="quiet-note">
        Starting weight stays as the first point in Insights. Your latest
        check-in supplies current weight. Height, starting weight and target weight
        are required to calculate Fuel goals and a broad time estimate.
      </p>
      <div className="form-grid">
        <NumberField
          label={`Height (${imperial ? 'in' : 'cm'})`}
          value={
            p.height ? Number((p.height / (imperial ? 2.54 : 1)).toFixed(2)) : 0
          }
          min={imperial ? 39 : 100}
          max={imperial ? 99 : 250}
          onChange={(v) => set('height', v * (imperial ? 2.54 : 1))}
        />
        <NumberField
          label={`Starting weight (${imperial ? 'lb' : 'kg'})`}
          value={p.weight ? weightDisplay(p.weight, p.units) : 0}
          min={imperial ? 66 : 30}
          max={imperial ? 772 : 350}
          onChange={(v) => set('weight', v / (imperial ? 2.2046226218 : 1))}
        />
        <NumberField
          label={`Target weight (${imperial ? 'lb' : 'kg'})`}
          value={p.targetWeight ? weightDisplay(p.targetWeight, p.units) : 0}
          min={imperial ? 66 : 30}
          max={imperial ? 772 : 350}
          onChange={(v) => set('targetWeight', v / (imperial ? 2.2046226218 : 1))}
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
      <p className="quiet-note">Current weight: {currentWeight ? `${weightDisplay(currentWeight, p.units)} ${imperial ? 'lb' : 'kg'}${currentWeightDate ? ` (check-in ${currentWeightDate})` : ' (starting weight)'}` : 'add a starting weight or check-in'}. Edit a check-in in Insights to change your current weight.</p>
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

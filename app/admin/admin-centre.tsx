'use client';
import { useState } from 'react';
import BrandMark from '../brand-mark';
import { Activity, ArrowLeft, ArrowUpRight, Check, CircleHelp, Dumbbell, FlaskConical, LockKeyhole, RotateCcw, Save, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { SESSION_PLANNING_RULES } from '@/lib/workout-prescription';
import { defaultControl, type AdminSnapshot, type AppControl } from '@/lib/admin-control';
import { demoPersonas } from '@/lib/demo';
import { exercises } from '@/lib/fitness';
import { groupExercises, muscleGroups } from '@/lib/custom-workout';
import './admin.css';

type AdminData = { snapshot: AdminSnapshot; memberCount: number; versions: { version: number; published_at: string; published_by: string }[];
  aiConfigured: boolean; model: string; owner: { name: string; email: string } };
type Area = 'coach' | 'workouts' | 'meals';
type Section = 'overview' | 'coach' | 'library' | 'settings' | 'releases';
const areaNames: Record<Area, string> = { coach: 'Coach answers', workouts: 'Workout plans', meals: 'Meal plans' };
const areas: Area[] = ['coach', 'workouts', 'meals'];
const sections: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'coach', label: 'Coach lab' }, { id: 'library', label: 'Exercise library' },
  { id: 'settings', label: 'App controls' }, { id: 'releases', label: 'Release history' },
];

export default function AdminCentre({ initial }: { initial: AdminData }) {
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState<AppControl>(structuredClone(initial.snapshot.draft));
  const [section, setSection] = useState<Section>('overview');
  const [area, setArea] = useState<Area>('coach');
  const [persona, setPersona] = useState(demoPersonas[0]);
  const [question, setQuestion] = useState('How should I adjust my training on a low energy day?');
  const [exerciseGroup, setExerciseGroup] = useState<string>('All groups');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [preview, setPreview] = useState<string>('');
  const [previewRevision, setPreviewRevision] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.snapshot.draft);
  const unpublished = JSON.stringify(data.snapshot.draft) !== JSON.stringify(data.snapshot.published);

  async function refresh() {
    const response = await fetch('/api/admin/v1/control', { cache: 'no-store' });
    const next = await response.json() as AdminData & { error?: string };
    if (!response.ok) throw new Error(next.error || 'Unable to refresh controls.');
    setData(next);
    setDraft(structuredClone(next.snapshot.draft));
  }
  async function update(action: 'saveDraft' | 'publish' | 'restore', version?: number) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/v1/control', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, revision: data.snapshot.revision, control: draft, version }) });
      const result = await response.json() as { error?: string; snapshot?: AdminSnapshot };
      if (!response.ok || !result.snapshot) throw new Error(result.error || 'Unable to save.');
      await refresh();
      setPreview(''); setPreviewRevision(null);
      setMessage(action === 'saveDraft' ? 'Draft saved. Members still use the published version.' :
        action === 'publish' ? 'Published. Web and future app clients now use these controls.' : 'Older version loaded into your draft. Review it before publishing.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }
  async function runPreview() {
    setBusy(true); setError(''); setMessage(''); setPreview('');
    try {
      if (dirty) throw new Error('Save your draft before testing it.');
      const response = await fetch('/api/admin/v1/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area, persona, question }) });
      const result = await response.json() as { error?: string; result?: unknown; draftRevision?: number };
      if (!response.ok) throw new Error(result.error || 'Preview failed.');
      setPreview(typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2));
      setPreviewRevision(result.draftRevision ?? null);
      setMessage('Live preview completed with fictional data. Nothing was published or saved to a member.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Preview failed.'); }
    finally { setBusy(false); }
  }
  function changeGuidance(value: string) {
    setDraft(current => ({ ...current, guidance: { ...current.guidance, [area]: value } }));
    setPreview(''); setPreviewRevision(null);
  }
  return <div className="admin-shell">
    <a className="admin-skip" href="#admin-main">Skip to controls</a>
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <a className="admin-brand" href="/?tab=studio"><BrandMark /><span>sculptai <small>CONTROL CENTRE</small></span></a>
      <div className="admin-owner"><ShieldCheck size={18}/><span>Owner workspace<small>{data.owner.email}</small></span></div>
      <nav aria-label="Admin sections">{sections.map(item => <button key={item.id} type="button" className={section === item.id ? 'selected' : ''}
        aria-current={section === item.id ? 'page' : undefined} onClick={() => { setSection(item.id); setError(''); setMessage(''); }}>
        {item.id === 'overview' ? <Activity size={18}/> : item.id === 'coach' ? <Sparkles size={18}/> : item.id === 'library' ? <Dumbbell size={18}/> : item.id === 'settings' ? <Settings2 size={18}/> : <RotateCcw size={18}/>}{item.label}</button>)}</nav>
      <a className="admin-back" href="/?tab=studio"><ArrowLeft size={16}/> Back to SculptAI</a>
    </aside>
    <main id="admin-main" className="admin-main">
      <header className="admin-top"><div><p className="admin-eyebrow">SCULPTAI / OWNER SPACE</p><h1>{sections.find(item => item.id === section)?.label}</h1>
        <p>Manage the live experience from one place. Changes reach members only when you publish.</p></div>
        <span className="admin-private"><LockKeyhole size={15}/> Private to owner</span></header>
      {error && <div className="admin-feedback error" role="alert">{error}</div>}
      {message && <div className="admin-feedback success" role="status"><Check size={16}/>{message}</div>}
      {section === 'overview' && <>
        <div className="admin-stat-grid">
          <article className="admin-stat"><span>Member accounts</span><strong>{data.memberCount}</strong><small>Count only · no health records shown</small></article>
          <article className="admin-stat"><span>Published controls</span><strong>v{data.snapshot.publishedVersion}</strong><small>{unpublished ? 'A draft is waiting for review' : 'Draft and live settings match'}</small></article>
          <article className="admin-stat"><span>AI connection</span><strong className={data.aiConfigured ? 'status-good' : 'status-warn'}>{data.aiConfigured ? 'Configured' : 'Unavailable'}</strong><small>{data.model}</small></article>
        </div>
        <div className="admin-two-col"><section className="admin-card"><p className="admin-eyebrow">TODAY&apos;S CONTROLS</p><h2>What members can use</h2>
          {areas.map(key => <div className="admin-row" key={key}><span>{areaNames[key]}</span><strong className={data.snapshot.published.features[key] ? 'status-good' : 'status-warn'}>{data.snapshot.published.features[key] ? 'On' : 'Paused'}</strong></div>)}
          <button className="admin-link-button" onClick={() => setSection('settings')}>Manage app controls <ArrowUpRight size={16}/></button></section>
          <section className="admin-card"><p className="admin-eyebrow">SAFE WORKFLOW</p><h2>Draft → test → publish</h2><p>Edit Coach instructions and controls, save a draft, then test AI with fictional member data. Publishing updates the web backend and the versioned configuration endpoint for future clients.</p>
            <button className="admin-link-button" onClick={() => setSection('coach')}>Open Coach lab <ArrowUpRight size={16}/></button></section></div>
        <section className="admin-card admin-notice"><CircleHelp size={20}/><p>API keys stay in server secrets. This centre shows connection status, never the key. Preview calls use your configured AI model and may use API credit.</p></section>
      </>}
      {section === 'coach' && <div className="admin-two-col admin-lab">
        <section className="admin-card"><p className="admin-eyebrow">INSTRUCTION STUDIO</p><h2>AI Coach instructions</h2><p>Edit the complete instructions for Coach answers, workout plans, or meal plans. Fixed server safety and data rules still apply.</p>
          <div className="admin-segment" role="group" aria-label="Instruction area">{areas.map(key => <button key={key} type="button" className={area === key ? 'active' : ''} onClick={() => { setArea(key); setPreview(''); }}>{areaNames[key]}</button>)}</div>
          {area === 'workouts' && <details className="admin-field-note"><summary>Required readiness, time and volume rules</summary><p>These rules apply to every workout, including custom instructions below. Low readiness may shorten the recommended session, with an explanation to the member.</p><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{SESSION_PLANNING_RULES}</pre></details>}
          <label className="admin-label" htmlFor="admin-guidance">Full instructions · {areaNames[area]}</label>
          <textarea id="admin-guidance" value={draft.guidance[area]} maxLength={16000} rows={18} onChange={event => changeGuidance(event.target.value)} />
          <div className="admin-field-note"><span>Saved draft: {data.snapshot.revision} · Live version: {data.snapshot.publishedVersion}</span><span>{draft.guidance[area].length}/16,000</span></div>
          <button className="admin-link-button" type="button" disabled={busy || draft.guidance[area] === defaultControl.guidance[area]} onClick={() => changeGuidance(defaultControl.guidance[area])}><RotateCcw size={15}/> Restore default {areaNames[area].toLowerCase()} instructions</button>
          <div className="admin-actions"><button className="admin-primary" disabled={busy || !dirty} onClick={() => void update('saveDraft')}><Save size={16}/> Save draft</button><button className="admin-secondary" disabled={busy || dirty || !unpublished} onClick={() => { if (window.confirm('Publish this draft for all members?')) void update('publish'); }}>Publish changes</button></div>
        </section>
        <section className="admin-card"><p className="admin-eyebrow">PRIVATE TEST BENCH</p><h2>Try a fictional profile</h2><p>Preview the saved draft before publishing. This makes a live AI request and never touches a real member record.</p>
          <label className="admin-label" htmlFor="admin-persona">Example member</label><select id="admin-persona" value={persona} onChange={event => setPersona(event.target.value)}>{demoPersonas.map(name => <option key={name}>{name}</option>)}</select>
          {area === 'coach' && <><label className="admin-label" htmlFor="admin-question">Test question</label><textarea id="admin-question" rows={3} maxLength={400} value={question} onChange={event => setQuestion(event.target.value)} /></>}
          <button className="admin-primary admin-test" disabled={busy || dirty || !data.aiConfigured} onClick={() => void runPreview()}><FlaskConical size={16}/>{busy ? 'Testing…' : `Test ${areaNames[area]}`}</button>
          <div className="admin-preview" aria-live="polite"><div><span>PREVIEW OUTPUT</span><small>{previewRevision !== null ? `Draft revision ${previewRevision}` : 'Nothing published'}</small></div>
            {preview ? <pre>{preview}</pre> : <p>Choose a fictional profile and run a test to see the Coach&apos;s response here.</p>}</div>
        </section></div>}
      {section === 'library' && <section className="admin-card admin-library">
        <p className="admin-eyebrow">WORKOUT CONTENT</p><h2>Exercise availability</h2>
        <p>Hide movements you do not want in future AI generated workouts. Previously saved workouts stay as they are. The Coach tests here use the draft library; members use only the published version.</p>
        <div className="admin-library-filters"><label className="admin-label" htmlFor="admin-exercise-search">Search movements<input id="admin-exercise-search" type="search" value={exerciseSearch} onChange={event => setExerciseSearch(event.target.value)} placeholder="Search exercise or equipment" /></label>
          <label className="admin-label" htmlFor="admin-exercise-group">Training group<select id="admin-exercise-group" value={exerciseGroup} onChange={event => setExerciseGroup(event.target.value)}><option>All groups</option>{muscleGroups.map(group => <option key={group}>{group}</option>)}</select></label></div>
        <div className="admin-library-count">{exercises.length - draft.disabledExercises.length} available · {draft.disabledExercises.length} hidden</div>
        <div className="admin-library-list">{exercises.filter(exercise =>
          (exerciseGroup === 'All groups' || groupExercises[exerciseGroup as keyof typeof groupExercises]?.includes(exercise.name)) &&
          `${exercise.name} ${exercise.equipment}`.toLowerCase().includes(exerciseSearch.toLowerCase().trim()))
          .map(exercise => <label className="admin-library-row" key={exercise.name}>
            <span className="sr-only">Available: {exercise.name}</span><span><strong>{exercise.name}</strong><small>{exercise.equipment} · {exercise.cue}</small></span>
            <input type="checkbox" checked={!draft.disabledExercises.includes(exercise.name)} onChange={event => setDraft(current => ({ ...current,
              disabledExercises: event.target.checked ? current.disabledExercises.filter(name => name !== exercise.name) : [...current.disabledExercises, exercise.name].sort((a, b) => a.localeCompare(b)) }))} />
          </label>)}</div>
        <div className="admin-actions"><button className="admin-primary" disabled={busy || !dirty} onClick={() => void update('saveDraft')}><Save size={16}/> Save draft</button><button className="admin-secondary" disabled={busy || dirty || !unpublished} onClick={() => { if (window.confirm('Publish exercise availability for future workouts?')) void update('publish'); }}>Publish changes</button></div>
      </section>}
      {section === 'settings' && <div className="admin-two-col"><section className="admin-card"><p className="admin-eyebrow">FEATURE SWITCHES</p><h2>Control availability</h2><p>Pausing a feature blocks its server endpoint after publication. Existing member records remain available.</p>
        {areas.map(key => <label className="admin-toggle" key={key}><span className="sr-only">Toggle {areaNames[key]}</span><span><strong>{areaNames[key]}</strong><small>{key === 'coach' ? 'Member questions, Fuel explanations and automatic AI reviews' : key === 'workouts' ? 'New and regenerated workout plans' : 'New and regenerated meal plans'}</small></span><input type="checkbox" checked={draft.features[key]} onChange={event => setDraft(current => ({ ...current, features: { ...current.features, [key]: event.target.checked } }))} /></label>)}</section>
        <section className="admin-card"><p className="admin-eyebrow">MEMBER COMMUNICATION</p><h2>Studio notice</h2><p>A short announcement shown to signed-in members on the web. Future clients can read it from the same app configuration API.</p>
          <label className="admin-label" htmlFor="admin-notice">Notice text</label><textarea id="admin-notice" rows={5} maxLength={280} value={draft.memberNotice} placeholder="Leave blank to show no notice." onChange={event => setDraft(current => ({ ...current, memberNotice: event.target.value }))} /><div className="admin-field-note">{draft.memberNotice.length}/280</div></section>
        <div className="admin-actions admin-wide"><button className="admin-primary" disabled={busy || !dirty} onClick={() => void update('saveDraft')}><Save size={16}/> Save draft</button><button className="admin-secondary" disabled={busy || dirty || !unpublished} onClick={() => { if (window.confirm('Publish these settings for all members?')) void update('publish'); }}>Publish changes</button></div>
      </div>}
      {section === 'releases' && <section className="admin-card"><p className="admin-eyebrow">CONTROL HISTORY</p><h2>Published versions</h2><p>Restore copies an older version into your draft. It does not change the live app until you publish it.</p>
        {data.versions.length ? data.versions.map(item => <div className="admin-release" key={item.version}><div><strong>Version {item.version}</strong><small>{new Date(item.published_at).toLocaleString()}</small></div><button className="admin-secondary" disabled={busy || dirty || item.version === data.snapshot.publishedVersion} onClick={() => { if (window.confirm(`Load version ${item.version} into your draft?`)) void update('restore', item.version); }}>Load as draft</button></div>) : <p>No control versions published yet.</p>}
        <p className="admin-history-note">Code releases and API usage totals remain in their hosting and OpenAI dashboards. This history tracks Admin Control Centre settings.</p>
      </section>}
    </main>
  </div>;
}

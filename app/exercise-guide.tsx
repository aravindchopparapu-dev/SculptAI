'use client';
import { useEffect, useState } from 'react';
import { Activity, Dumbbell, Play, Pause } from 'lucide-react';
import mediaData from '@/lib/exercise-media.json';
import type { Plan } from '@/lib/fitness';
const media = mediaData as Record<string, { images: string[]; source: string }>;
const art: Record<string, number> = { 'Dumbbell bench press': 0, 'Incline dumbbell press': 1, 'Cable chest fly': 2, 'Dumbbell curl': 3, 'Incline dumbbell curl': 4, 'Hammer curl': 5, 'Bench press': 6, 'EZ-bar curl': 7, 'Dumbbell lateral raise': 9, 'Leg extension': 10, 'Cable triceps pushdown': 11 };
export default function ExerciseGuide({ exercise, index }: { exercise: Plan['days'][number]['exercises'][number]; index: number }) {
  const [playing, setPlaying] = useState(false), [frame, setFrame] = useState(0), [showGuide, setShowGuide] = useState(false), [failed, setFailed] = useState(false);
  const guide = media[exercise.name], tile = art[exercise.name];
  const timed = exercise.pattern === 'cardio' || exercise.pattern === 'hiit';
  const position = tile !== undefined ? tile % 6 : 0;
  useEffect(() => {
    if (!playing || !guide || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setFrame(value => (value + 1) % guide.images.length), 1400);
    return () => clearInterval(timer);
  }, [playing, guide]);
  function nextPosition() {
    setShowGuide(true);
    setPlaying(false);
    const next = (frame + 1) % (guide?.images.length || 2);
    setFrame(next);
  }
  return <article className="exercise-guide-card">
    <div className="exercise-guide-visual">
      {tile !== undefined && !showGuide ? <div role="img" aria-label={`Illustration of ${exercise.name} with working muscles highlighted`} className="exercise-atlas" style={{ backgroundPosition: `${(position % 3) * 50}% ${position < 3 ? 0 : 100}%`, backgroundImage: `url('/exercise-atlas${tile >= 6 ? '-2' : ''}.png')`, backgroundSize: `300% ${tile >= 6 ? (position < 3 ? 211 : 190) : (position < 3 ? 221.2 : 182.5)}%` }} /> : guide && !failed ? <img src={guide.images[frame]} alt={`${exercise.name}: ${frame === 0 ? 'starting' : 'finishing'} position`} loading="lazy" onError={() => setFailed(true)} /> : <div className="exercise-guide-fallback">{timed ? <Activity size={48} /> : <Dumbbell size={48} />}<span>Follow the written technique cue below.</span></div>}
      <span className="exercise-number">{String(index + 1).padStart(2, '0')}</span>
    </div>
    <div className="exercise-guide-content">
      <span className="eyebrow">{exercise.equipment}</span>
      <h3>{exercise.name}</h3>
      <div className="exercise-prescription"><span><b>{exercise.sets}</b> {exercise.pattern === 'hiit' ? 'rounds' : exercise.pattern === 'cardio' ? 'block' : 'sets'}</span><span><b>{exercise.reps}</b> {exercise.pattern === 'hiit' ? 'work' : exercise.pattern === 'cardio' ? 'duration' : 'reps'}</span>{exercise.rest > 0 && <span><b>{exercise.rest}s</b> rest</span>}</div>
      <p>{exercise.cue}</p>
      {guide && !failed && <><div className="card-actions"><button className="action-secondary compact" onClick={() => { setShowGuide(true); setPlaying(!playing); }}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause guide' : 'Play movement guide'}</button><button className="text-link" onClick={nextPosition}>Next position</button>{tile !== undefined && showGuide && <button className="text-link" onClick={() => { setPlaying(false); setShowGuide(false); }}>Illustration</button>}</div><small>Two-position photo guide · <a href={guide.source} target="_blank" rel="noreferrer">Image source</a></small></>}
      {!guide && <small>{tile !== undefined ? 'Original SculptAI illustration. Motion guide not yet available.' : 'Image guide not yet available for this movement.'}</small>}
    </div>
  </article>;
}

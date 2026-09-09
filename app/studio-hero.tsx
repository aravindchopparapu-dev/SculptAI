'use client';
import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Layers3,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Target,
  X,
  Orbit,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { movements, type Movement } from '@/lib/studio';
const AthleteScene = lazy(() => import('./athlete-scene'));
export default function StudioHero({
  onStart,
  label,
  active = true,
  summary,
}: {
  onStart: () => void;
  label: string;
  active?: boolean;
  summary: string;
}) {
  const [movement, setMovement] = useState<Movement>('curl'),
    [playing, setPlaying] = useState(false),
    [camera, setCamera] = useState(0),
    [immersive, setImmersive] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData
    )
      return;
    const id = setTimeout(() => setReady(true), 450);
    return () => clearTimeout(id);
  }, []);
  const selected = movements.find((m) => m.id === movement)!;
  return (
    <section
      className={`stage member-stage ${immersive ? 'stage-immersive' : ''}`}
      aria-label="Your training studio"
      hidden={!active}
    >
      <div className="stage-environment" />
      <div className="stage-vignette" />
      <div className="stage-editorial">
        <div className="season-label">
          <span>YOUR NEXT CHAPTER</span>
          <span>STARTS HERE</span>
        </div>
        <h1>
          A stronger you.
          <br />
          <em>Already in motion.</em>
        </h1>
        <p>{summary}</p>
        <div className="stage-actions">
          <button className="action-primary" onClick={onStart}>
            {label}
            <ArrowUpRight size={19} />
          </button>
          <button
            className="action-secondary icon-only"
            onClick={() => {
              setReady(true);
              setPlaying(!playing);
            }}
            aria-label={
              playing ? 'Pause athlete animation' : 'Play athlete animation'
            }
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
        <div className="intent-pill">
          <Layers3 size={23} />
          <div>
            <small>BUILD AT YOUR PACE</small>
            <p>One session. One step forward.</p>
          </div>
        </div>
      </div>
      <div className="athlete-stage">
        <Suspense
          fallback={
            <img
              className="model-fallback"
              src="/athlete-art.webp"
              alt="Athlete lifting dumbbells"
              fetchPriority="high"
            />
          }
        >
          {ready ? (
            <AthleteScene
              movement={movement}
              playing={playing}
              speed={1}
              cameraView={camera}
              highlight={false}
              active={active}
            />
          ) : (
            <div className="athlete-canvas">
              <img
                className="model-fallback"
                src="/athlete-art.webp"
                alt="Athlete lifting dumbbells"
                fetchPriority="high"
              />
              <button className="model-status" onClick={() => setReady(true)}>
                Open interactive 3D
              </button>
            </div>
          )}
        </Suspense>
      </div>
      <div className="stage-top-label">
        <span className="stage-dot" />
        SCULPT MOTION{' '}
        <span>0{movements.findIndex((m) => m.id === movement) + 1}/03</span>
      </div>
      <button
        className="stage-expand icon-button"
        aria-label={immersive ? 'Exit immersive view' : 'Enter immersive view'}
        onClick={() => setImmersive(!immersive)}
      >
        {immersive ? <X size={18} /> : <Maximize2 size={18} />}
      </button>
      <div className="floating-focus glass">
        <div className="focus-icon">
          <Target size={19} />
        </div>
        <div>
          <small>MOVEMENT FOCUS</small>
          <strong>{selected.area}</strong>
        </div>
      </div>
      <div className="athlete-caption">
        <span className="caption-line" />
        <div>
          <b>{selected.name}</b>
          <span>Movement illustration · not form assessment</span>
        </div>
      </div>
      <div className="movement-dock glass">
        <div className="dock-label">
          <Orbit size={16} />
          <span>EXPLORE A MOVEMENT</span>
        </div>
        <Tabs
          value={movement}
          onValueChange={(v) => setMovement(v as Movement)}
        >
          <TabsList className="movement-tabs">
            {movements.map((m, i) => (
              <TabsTrigger key={m.id} value={m.id}>
                <span>0{i + 1}</span>
                {m.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <button
          className="icon-button"
          aria-label="Change athlete camera angle"
          onClick={() => setCamera((camera + 1) % 3)}
        >
          <RotateCcw size={17} />
        </button>
      </div>
    </section>
  );
}

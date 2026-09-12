'use client';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Heart,
  Layers3,
  Maximize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Utensils,
  Orbit,
  MoveUpRight,
  Eye,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  movements,
  initialSession,
  logDemoSet,
  demoCompletion,
  type Movement,
} from '@/lib/studio';
const AthleteScene = lazy(() => import('./athlete-scene'));
const v1 =
  'https://sculptai-fitness-workspace.aravindchopparapu-ch.chatgpt.site';
const screens = ['Studio', 'My training', 'Insights', 'Fuel', 'Coach'];
function Glass({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`glass ${className}`}>{children}</section>;
}
function Ring({
  value,
  color,
  size = 100,
  width = 7,
  children,
}: {
  value: number;
  color: string;
  size?: number;
  width?: number;
  children?: ReactNode;
}) {
  const r = 44,
    c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke="white"
          strokeOpacity=".07"
          strokeWidth={width}
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth={width}
          fill="none"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div>{children}</div>
    </div>
  );
}
export default function FutureStudio() {
  const [screen, setScreen] = useState('Studio'),
    [movement, setMovement] = useState<Movement>('curl'),
    [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(1),
    [camera, setCamera] = useState(0),
    [focus, setFocus] = useState(false),
    [settings, setSettings] = useState(false),
    [immersive, setImmersive] = useState(false),
    [session, setSession] = useState(initialSession),
    [detail, setDetail] = useState<string | null>(null),
    [period, setPeriod] = useState('Week'),
    [diet, setDiet] = useState('Balanced'),
    [message, setMessage] = useState(''),
    [answer, setAnswer] = useState('');
  const chosen = movements.find((x) => x.id === movement)!;
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches)
      setPlaying(false);
  }, []);
  function start() {
    setSession({ ...initialSession, active: true });
    setMovement('curl');
    setScreen('My training');
    setPlaying(true);
  }
  function log() {
    const next = logDemoSet(session);
    setSession(next);
    if (!next.finished) setMovement(movements[next.exercise].id);
    if (next.finished) setPlaying(false);
  }
  const scene = (
    <Suspense
      fallback={
        <div className="scene-loading">
          <Orbit />
          <span>Opening your studio</span>
        </div>
      }
    >
      <AthleteScene
        movement={movement}
        playing={playing}
        speed={speed}
        cameraView={camera}
        highlight={focus}
      />
    </Suspense>
  );
  return (
    <div className={`future-app ${immersive ? 'is-immersive' : ''}`}>
      <div className="ambient-background" />
      <header className="navigation">
        <a className="logo" href="/">
          <span>
            <Layers3 size={22} />
          </span>
          sculpt<span className="logo-ai">ai</span>
          <small>STUDIO / 02</small>
        </a>
        <nav aria-label="Main navigation">
          <Tabs
            value={screen}
            onValueChange={(v) => {
              setScreen(String(v));
              setImmersive(false);
            }}
          >
            <TabsList className="navigation-tabs">
              {screens.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {s}
                  {s === 'Coach' && <span className="tiny-star">✦</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </nav>
        <div className="nav-right">
          <span className="preview-badge">
            <i /> Concept preview
          </span>
          <button
            className="icon-button"
            aria-label="Studio preferences"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={19} />
          </button>
          <button
            className="profile-chip"
            aria-label="About this preview"
            onClick={() => setDetail('preview')}
          >
            S
          </button>
        </div>
      </header>
      <main>
        <div className="context-row">
          <span>
            <i /> YOUR SPACE TO BECOME
          </span>
          <a href={v1} target="_blank" rel="noreferrer">
            Compare Version 1 <ArrowUpRight size={13} />
          </a>
        </div>
        {(screen === 'Studio' || screen === 'My training') && (
          <>
            <section className="stage">
              <div className="stage-environment" />
              <div className="stage-vignette" />
              <div className="stage-editorial">
                <div className="season-label">
                  <span>THE NEXT EVOLUTION</span>
                  <span>OF YOU</span>
                </div>
                <h1>
                  {screen === 'Studio' ? (
                    <>
                      A stronger you.
                      <br />
                      <em>Already in motion.</em>
                    </>
                  ) : session.finished ? (
                    <>
                      That feeling?
                      <br />
                      <em>You earned it.</em>
                    </>
                  ) : (
                    <>
                      Find your flow.
                      <br />
                      <em>Own this moment.</em>
                    </>
                  )}
                </h1>
                <p>
                  {screen === 'Studio'
                    ? 'A training space that moves with you. Find your focus, feel your rhythm, and build what comes next.'
                    : session.finished
                      ? 'You explored all nine sets in this sample session. Take a breath. Your next chapter is waiting.'
                      : 'A little intention. A little effort. Let everything else fade into the background.'}
                </p>
                <div className="stage-actions">
                  <button
                    className="action-primary"
                    onClick={
                      session.active ? () => setScreen('My training') : start
                    }
                  >
                    {session.active ? 'Continue session' : 'Enter your session'}
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="round-button"
                    aria-label={
                      playing
                        ? 'Pause athlete animation'
                        : 'Play athlete animation'
                    }
                    onClick={() => setPlaying(!playing)}
                  >
                    {playing ? <Pause size={17} /> : <Play size={17} />}
                  </button>
                </div>
                <div className="session-meta">
                  <span>
                    <Clock3 size={14} /> 35 min
                  </span>
                  <span className="meta-divider" />
                  <span>Strength · Full body</span>
                </div>
                <div className="intent-pill">
                  <span className="pulse-symbol">
                    <AudioLines size={20} />
                  </span>
                  <div>
                    <small>TODAY’S INTENTION</small>
                    <p>Progress over perfection.</p>
                  </div>
                </div>
              </div>
              <div className="athlete-stage">{scene}</div>
              <div className="stage-top-label">
                <span className="stage-dot" /> SCULPT MOTION{' '}
                <span>
                  0{movements.findIndex((m) => m.id === movement) + 1} / 03
                </span>
              </div>
              <button
                className="stage-expand icon-button"
                aria-label={
                  immersive ? 'Exit immersive view' : 'Enter immersive view'
                }
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
                  <strong>{chosen.area}</strong>
                </div>
                <span className="signal-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <div className="athlete-caption">
                <span className="caption-line" />
                <div>
                  <b>{chosen.name}</b>
                  <span>Human movement · 3D study</span>
                </div>
              </div>
              <div className="movement-dock glass">
                <div className="dock-label">
                  <Orbit size={16} />
                  <span>EXPLORE A MOVEMENT</span>
                </div>
                <Tabs
                  value={movement}
                  onValueChange={(v) => {
                    if (!session.active) setMovement(v as Movement);
                  }}
                >
                  <TabsList className="movement-tabs">
                    {movements.map((m, i) => (
                      <TabsTrigger
                        value={m.id}
                        key={m.id}
                        disabled={session.active && m.id !== movement}
                      >
                        <span>0{i + 1}</span>
                        {m.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <button
                  className="icon-button"
                  onClick={() => setCamera((camera + 1) % 3)}
                  aria-label="Change athlete camera angle"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </section>
            {screen === 'Studio' && (
              <>
                <div className="studio-subline">
                  <span>
                    <MoveUpRight size={14} /> Move with purpose. Recover with
                    intention.
                  </span>
                  <span>
                    Sample session & insights{' '}
                    <button
                      aria-label="About sample data"
                      onClick={() => setDetail('preview')}
                    >
                      <Eye size={13} />
                    </button>
                  </span>
                </div>
                <div className="bento">
                  <Glass className="readiness">
                    <div className="card-heading">
                      <span className="eyebrow">YOUR DAILY PULSE</span>
                      <button
                        className="icon-button"
                        aria-label="View sample readiness"
                        onClick={() => setDetail('readiness')}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="readiness-main">
                      <Ring value={86} color="#87edff" size={108}>
                        <strong>
                          86<small>%</small>
                        </strong>
                      </Ring>
                      <div>
                        <span className="status-label">
                          <i /> In a good rhythm
                        </span>
                        <h2>
                          Ready for
                          <br />
                          what’s next.
                        </h2>
                        <p>A little stronger. A little more you.</p>
                      </div>
                    </div>
                    <div className="card-bottom">
                      <span>
                        <Heart size={13} /> Sample readiness
                      </span>
                      <button onClick={() => setScreen('Insights')}>
                        Explore insights <ArrowRight size={13} />
                      </button>
                    </div>
                  </Glass>
                  <Glass className="training-card">
                    <div className="card-heading">
                      <span className="eyebrow">CURATED FOR TODAY</span>
                      <span className="small-pill">STRENGTH</span>
                    </div>
                    <div className="training-card-body">
                      <div>
                        <h2>
                          Build your
                          <br />
                          foundation.
                        </h2>
                        <p>3 movements · 9 sets · 35 min</p>
                        <button className="text-link" onClick={start}>
                          Let’s get into it <ArrowRight size={15} />
                        </button>
                      </div>
                      <div className="training-art">
                        <img
                          src="/athlete-art.webp"
                          alt="Generated gym portrait of an adult athlete lifting a dumbbell"
                        />
                      </div>
                    </div>
                    <div className="workout-days">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <span
                          className={[0, 2, 4].includes(i) ? 'scheduled' : ''}
                          key={i}
                        >
                          {i === 0 ? <Check size={13} /> : d}
                        </span>
                      ))}
                      <small>A rhythm you can keep.</small>
                    </div>
                  </Glass>
                  <Glass className="momentum">
                    <div className="card-heading">
                      <span className="eyebrow">SMALL WINS, BIGGER YOU</span>
                      <TrendingUp size={17} />
                    </div>
                    <h2>
                      Your momentum
                      <br />
                      is building.
                    </h2>
                    <div
                      className="momentum-chart"
                      aria-label="Sample weekly training chart"
                    >
                      {[32, 57, 44, 76, 61, 88, 72].map((h, i) => (
                        <div key={i}>
                          <span style={{ height: `${h}%` }} />
                          <small>
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                          </small>
                        </div>
                      ))}
                    </div>
                    <div className="card-bottom">
                      <strong>
                        +12.4% <span>sample monthly volume</span>
                      </strong>
                    </div>
                  </Glass>
                </div>
                <div className="horizon-strip">
                  <span className="orb-icon">
                    <Sparkles size={22} />
                  </span>
                  <div>
                    <span className="eyebrow">MORE THAN A WORKOUT</span>
                    <h3>Meet the space between effort and possibility.</h3>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setScreen('Coach')}
                  >
                    Explore your companion <ArrowUpRight size={16} />
                  </button>
                </div>
              </>
            )}
            {screen === 'My training' && (
              <section className="training-workspace">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">YOUR SESSION, YOUR PACE</span>
                    <h2>
                      {session.finished
                        ? 'Session explored. Momentum started.'
                        : session.active
                          ? 'You’re in. Make it count.'
                          : 'A little structure. A lot of possibility.'}
                    </h2>
                  </div>
                  <span className="small-pill">INTERACTIVE DEMO</span>
                </div>
                {session.finished ? (
                  <Glass className="completion">
                    <span className="completion-check">
                      <Check size={30} />
                    </span>
                    <h2>All nine sample sets complete.</h2>
                    <p>
                      You’ve experienced the workout flow. This concept session
                      is temporary and isn’t saved as your fitness history.
                    </p>
                    <button className="action-primary" onClick={start}>
                      Explore again <RotateCcw size={16} />
                    </button>
                  </Glass>
                ) : (
                  <div className="session-layout">
                    <Glass className="session-exercises">
                      {movements.map((m, i) => (
                        <button
                          key={m.id}
                          className={`session-exercise ${movement === m.id ? 'current' : ''}`}
                          disabled={session.active}
                          onClick={() => setMovement(m.id)}
                        >
                          <span className="exercise-number">
                            {session.exercise > i && session.active ? (
                              <Check size={17} />
                            ) : (
                              String(i + 1).padStart(2, '0')
                            )}
                          </span>
                          <span>
                            <strong>{m.name}</strong>
                            <small>
                              {m.area} · {m.sets} sets × {m.reps} reps
                            </small>
                          </span>
                          <span>
                            {m.load} kg <ChevronRight size={15} />
                          </span>
                        </button>
                      ))}
                    </Glass>
                    <Glass className="session-control">
                      <span className="eyebrow">
                        {session.active
                          ? `MOVEMENT ${session.exercise + 1} OF 3`
                          : 'PREVIEW A SESSION'}
                      </span>
                      <h2>{chosen.name}</h2>
                      <p>{chosen.cue}</p>
                      <div className="set-stats">
                        <div>
                          <strong>{chosen.reps}</strong>
                          <span>reps</span>
                        </div>
                        <div>
                          <strong>
                            {chosen.load}
                            <small> kg</small>
                          </strong>
                          <span>sample load</span>
                        </div>
                        <div>
                          <strong>
                            {session.active ? session.done + 1 : 1}
                            <small> / 3</small>
                          </strong>
                          <span>set</span>
                        </div>
                      </div>
                      <Progress value={demoCompletion(session)} />
                      <button
                        className="action-primary"
                        onClick={session.active ? log : start}
                      >
                        {session.active
                          ? 'Mark sample set complete'
                          : 'Start sample session'}
                        <Check size={17} />
                      </button>
                      {session.active && (
                        <button
                          className="text-link"
                          onClick={() => {
                            setSession(initialSession);
                            setPlaying(false);
                          }}
                        >
                          End preview session
                        </button>
                      )}
                    </Glass>
                  </div>
                )}
                <p className="quiet-note">
                  The animated movement is a visual concept, not exercise
                  technique instruction. Sample loads are not personal
                  recommendations.
                </p>
              </section>
            )}
          </>
        )}
        {screen === 'Insights' && (
          <section className="secondary-page">
            <div className="section-title">
              <div>
                <span className="eyebrow">LOOK AT YOU GO</span>
                <h1>
                  Progress you can <em>feel.</em>
                </h1>
                <p>
                  Your effort, connected. A preview of a more thoughtful way to
                  see your training.
                </p>
              </div>
              <Tabs value={period} onValueChange={(v) => setPeriod(String(v))}>
                <TabsList>
                  {['Week', 'Month'].map((v) => (
                    <TabsTrigger value={v} key={v}>
                      {v}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="insight-grid">
              <Glass className="activity-card">
                <span className="eyebrow">A BALANCED RHYTHM</span>
                <div className="concentric">
                  <Ring
                    value={period === 'Week' ? 78 : 87}
                    color="#8cdaff"
                    size={250}
                    width={6}
                  >
                    <Ring
                      value={period === 'Week' ? 66 : 73}
                      color="#b7a7ff"
                      size={200}
                      width={7}
                    >
                      <Ring value={92} color="#9bf2cf" size={150} width={8}>
                        <span>
                          <strong>{period === 'Week' ? '3' : '14'}</strong>
                          <small>sample sessions</small>
                        </span>
                      </Ring>
                    </Ring>
                  </Ring>
                </div>
                <div className="ring-legend">
                  <span>
                    <i style={{ background: '#8cdaff' }} />
                    Move
                  </span>
                  <span>
                    <i style={{ background: '#b7a7ff' }} />
                    Build
                  </span>
                  <span>
                    <i style={{ background: '#9bf2cf' }} />
                    Recover
                  </span>
                </div>
              </Glass>
              <Glass className="insight-chart">
                <div className="card-heading">
                  <span className="eyebrow">STRENGTH IS A JOURNEY</span>
                  <TrendingUp size={18} />
                </div>
                <h2>
                  {period === 'Week'
                    ? 'A week of showing up.'
                    : 'A month of becoming.'}
                </h2>
                <p>Sample training volume · kg</p>
                <div className="big-chart">
                  <svg
                    viewBox="0 0 700 220"
                    role="img"
                    aria-label={
                      period === 'Week'
                        ? 'Sample weekly volume rises from 600 to 1400 kg'
                        : 'Sample monthly volume rises from 2100 to 5600 kg'
                    }
                  >
                    <defs>
                      <linearGradient
                        id="chart-area"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop stopColor="#8de0ff" stopOpacity=".3" />
                        <stop offset="1" stopColor="#8de0ff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[40, 95, 150, 205].map((y) => (
                      <line
                        key={y}
                        x1="0"
                        x2="700"
                        y1={y}
                        y2={y}
                        stroke="#ffffff14"
                        strokeDasharray="3 6"
                      />
                    ))}
                    <path
                      d={
                        period === 'Week'
                          ? 'M0 170 C65 170 65 95 120 115 S220 150 280 100 S380 110 430 55 S560 90 620 40 S680 30 700 15 L700 220 L0 220Z'
                          : 'M0 200 C150 190 150 130 250 145 S400 120 450 85 S620 70 700 10 L700 220 L0 220Z'
                      }
                      fill="url(#chart-area)"
                    />
                    <path
                      d={
                        period === 'Week'
                          ? 'M0 170 C65 170 65 95 120 115 S220 150 280 100 S380 110 430 55 S560 90 620 40 S680 30 700 15'
                          : 'M0 200 C150 190 150 130 250 145 S400 120 450 85 S620 70 700 10'
                      }
                      fill="none"
                      stroke="#9cdfff"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="chart-dates">
                    {(period === 'Week'
                      ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
                      : ['WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4']
                    ).map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                </div>
                <div className="insight-numbers">
                  <div>
                    <strong>
                      {period === 'Week' ? '4,820' : '19,280'}
                      <small> kg</small>
                    </strong>
                    <span>Sample total volume</span>
                  </div>
                  <div>
                    <strong>
                      +12.4<small>%</small>
                    </strong>
                    <span>Sample change</span>
                  </div>
                </div>
              </Glass>
            </div>
            <div className="insight-mini-grid">
              {[
                [
                  Heart,
                  'Recovery is part of progress.',
                  'Leave room for rest between demanding sessions.',
                  '#ffb8c8',
                ],
                [
                  Target,
                  'Consistency over intensity.',
                  'A routine you can repeat is a routine you can build on.',
                  '#b5a4ff',
                ],
                [
                  Flame,
                  'Your own kind of strong.',
                  'Your goals set the direction. Your habits do the work.',
                  '#a5e6ff',
                ],
              ].map(([Icon, title, copy, color]) => {
                const I = Icon as typeof Heart;
                return (
                  <Glass key={String(title)}>
                    <I size={22} style={{ color: String(color) }} />
                    <h3>{String(title)}</h3>
                    <p>{String(copy)}</p>
                  </Glass>
                );
              })}
            </div>
            <p className="quiet-note">
              All values are illustrative sample data for design review. No
              wearable, health or body measurements are being collected.
            </p>
          </section>
        )}
        {screen === 'Fuel' && (
          <section className="secondary-page">
            <div className="section-title">
              <div>
                <span className="eyebrow">ENERGY FOR YOUR EVERYDAY</span>
                <h1>
                  Fuel the <em>possibility.</em>
                </h1>
                <p>
                  Simple structures. Flexible choices. A calmer relationship
                  with your daily nutrition.
                </p>
              </div>
              <Utensils size={30} />
            </div>
            <Tabs value={diet} onValueChange={(v) => setDiet(String(v))}>
              <TabsList>
                {['Balanced', 'Plant-forward', 'Vegetarian'].map((d) => (
                  <TabsTrigger value={d} key={d}>
                    {d}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="fuel-grid">
              <Glass className="fuel-main">
                <span className="eyebrow">A DAY IN BALANCE</span>
                <h2>
                  A little of everything
                  <br />
                  that keeps you going.
                </h2>
                <div className="macro-display">
                  <Ring value={80} color="#9bdfff" size={185}>
                    <span>
                      <Utensils size={28} />
                      <small>Build your plate</small>
                    </span>
                  </Ring>
                  <div className="macro-legend">
                    <span>
                      <i />A source of protein
                    </span>
                    <span>
                      <i />
                      Grains or other carbohydrates
                    </span>
                    <span>
                      <i />
                      Colorful fruit & vegetables
                    </span>
                    <span>
                      <i />A source of fat
                    </span>
                  </div>
                </div>
                <p>
                  Personal nutrition targets come after you choose the final
                  version and complete your profile.
                </p>
              </Glass>
              <div className="meal-cards">
                {[
                  [
                    '01',
                    'Start bright',
                    diet === 'Balanced'
                      ? 'Yogurt, oats & fruit'
                      : diet === 'Vegetarian'
                        ? 'Eggs, wholegrain toast & fruit'
                        : 'Soy yogurt, oats & berries',
                  ],
                  [
                    '02',
                    'Keep your energy',
                    diet === 'Balanced'
                      ? 'Chicken, rice & roasted vegetables'
                      : diet === 'Vegetarian'
                        ? 'Lentils, rice & roasted vegetables'
                        : 'Chickpeas, rice & roasted vegetables',
                  ],
                  [
                    '03',
                    'Finish feeling good',
                    diet === 'Balanced'
                      ? 'Fish, potatoes & greens'
                      : 'Tofu, potatoes & greens',
                  ],
                ].map(([n, title, copy]) => (
                  <Glass key={n}>
                    <span className="meal-index">{n}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{copy}</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`View ${title} meal example`}
                      onClick={() => setDetail(`meal:${copy}`)}
                    >
                      <Plus size={19} />
                    </button>
                  </Glass>
                ))}
              </div>
            </div>
            <p className="quiet-note">
              General meal examples only. No personalized targets, calculated
              nutrient totals, or medical nutrition advice.
            </p>
          </section>
        )}
        {screen === 'Coach' && (
          <section className="companion-page">
            <div className="companion-glow">
              <span>
                <Sparkles size={38} />
              </span>
            </div>
            <span className="eyebrow">A SPACE TO FIND YOUR NEXT STEP</span>
            <h1>
              Less noise.
              <br />
              <em>More direction.</em>
            </h1>
            <p>
              Imagine a companion that connects your training to the bigger
              picture.
              <br />
              Thoughtful. Encouraging. Built around you.
            </p>
            <div className="companion-prompts">
              {[
                'Find my focus',
                'Explain my session',
                'Plan a shorter workout',
              ].map((q) => (
                <button
                  className="glass"
                  key={q}
                  onClick={() => {
                    setMessage(q);
                    setAnswer('');
                  }}
                >
                  {q}
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
            <form
              className="companion-input glass"
              onSubmit={(e) => {
                e.preventDefault();
                setAnswer(
                  'This is a preview of the coaching experience. Your question has not been sent to an AI service. After you choose your preferred website, we can connect a coach to your real profile and training history.',
                );
              }}
            >
              <Sparkles size={19} />
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What’s on your mind?"
                aria-label="Preview coach message"
                maxLength={1000}
              />
              <button
                className="round-button"
                type="submit"
                disabled={!message.trim()}
                aria-label="Preview coach response"
              >
                <ArrowRight size={20} />
              </button>
            </form>
            {answer && (
              <p role="status" className="coach-answer">
                {answer}
              </p>
            )}
            <span className="small-pill">
              DESIGN PREVIEW · AI NOT CONNECTED
            </span>
          </section>
        )}
        <footer>
          <a className="footer-mark" href="/">
            sculptai <span>STUDIO / 02</span>
          </a>
          <p>Designed for the person you’re becoming.</p>
          <button onClick={() => setDetail('preview')}>
            About this concept <ArrowUpRight size={13} />
          </button>
        </footer>
      </main>
      <Sheet open={settings} onOpenChange={setSettings}>
        <SheetContent className="preferences">
          <SheetTitle>Your studio. Your atmosphere.</SheetTitle>
          <SheetDescription>
            Make the motion and view feel right for you.
          </SheetDescription>
          <div className="preference-row">
            <div>
              <h3>Athlete motion</h3>
              <p>Play or pause the movement study.</p>
            </div>
            <Switch
              checked={playing}
              onCheckedChange={setPlaying}
              aria-label="Animate athlete"
            />
          </div>
          <div className="preference-row">
            <div>
              <h3>Focus lighting</h3>
              <p>Illuminate the movement in cool cyan.</p>
            </div>
            <Switch
              checked={focus}
              onCheckedChange={setFocus}
              aria-label="Focus lighting"
            />
          </div>
          <div className="speed-control">
            <div>
              <h3>Movement tempo</h3>
              <span>{speed.toFixed(1)}×</span>
            </div>
            <Slider
              min={0.4}
              max={1.5}
              step={0.1}
              value={[speed]}
              onValueChange={(v) => setSpeed(Array.isArray(v) ? v[0] : v)}
              aria-label="Movement speed"
            />
          </div>
          <h3>Camera perspective</h3>
          <div className="camera-options">
            {['Front', 'Three-quarter', 'Side'].map((v, i) => (
              <button
                className={camera === i ? 'selected' : ''}
                key={v}
                onClick={() => setCamera(i)}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="quiet-note">
            Drag the 3D scene to explore. Motion starts paused when your device
            requests reduced motion.
          </p>
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      >
        <DialogContent className="concept-dialog">
          <DialogTitle>
            {detail === 'preview'
              ? 'Meet SculptAI Studio / 02'
              : detail === 'readiness'
                ? 'A preview of your daily pulse'
                : 'A little meal inspiration'}
          </DialogTitle>
          <DialogDescription>
            {detail === 'preview'
              ? 'A separate visual concept for your review. Version 1 remains available and unchanged.'
              : detail === 'readiness'
                ? 'The readiness number is sample design data. It is not a health assessment.'
                : 'A flexible example, not a personalized diet.'}
          </DialogDescription>
          <p>
            {detail?.startsWith('meal:')
              ? detail.slice(5) +
                '. Choose portions and ingredients appropriate for you, and adapt around allergies or other dietary needs.'
              : detail === 'readiness'
                ? 'In a completed product, this space could bring together your own check-ins and training consistency. A validated approach and explicit consent would come before any health-related scoring.'
                : 'Explore the animated human, change camera views and motion, complete a temporary sample session, and browse sample insights. Real accounts, lasting fitness records and live AI are intentionally deferred until you choose the direction.'}
          </p>
          <button className="action-primary" onClick={() => setDetail(null)}>
            Back to the studio <ArrowRight size={16} />
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

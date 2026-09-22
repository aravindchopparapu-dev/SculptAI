import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { generateCustomWorkout, validateMuscles, workoutReadiness } from '@/lib/custom-workout';
import { readState } from '@/lib/repository';
import { readPublishedControl } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
});
async function reserveGeneration(db: D1Database, userId: string) {
  const now = Math.floor(Date.now() / 1000), expired = now - 3600;
  const result = await db.prepare(
    `INSERT INTO coach_limits (user_id, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id) DO UPDATE SET
       window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
       count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END
     WHERE window_start <= ? OR count < 20`,
  ).bind(userId, now, expired, expired, expired).run();
  return Boolean(result.meta.changes);
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in to create an AI workout.' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ error: 'This request must come from SculptAI.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Expected JSON.' }, 415);
  try {
    const raw = await request.text();
    if (raw.length > 500) return json({ error: 'Invalid selection.' }, 413);
    const body = JSON.parse(raw) as { selectedMuscles?: unknown; regeneratePlanId?: string };
    const selected = validateMuscles(body.selectedMuscles);
    const db = getDb();
    const { control } = await readPublishedControl(db);
    if (!control.features.workouts) return json({ error: 'Workout generation is temporarily paused.' }, 503);
    const { state } = await readState(db, user.userId);
    if (!state.profile) return json({ error: 'Complete your profile first.' }, 400);
    const previous = body.regeneratePlanId ? state.plans.find(p => p.id === body.regeneratePlanId) : undefined;
    if (body.regeneratePlanId && (!previous || JSON.stringify([...previous.selectedMuscles ?? []].sort()) !== JSON.stringify([...selected].sort()))) return json({ error: 'Choose an existing workout to regenerate.' }, 400);
    const priorNames = [...(previous?.days.flatMap(day => day.exercises.map(e => e.name)) ?? []), ...(state.draftWorkout?.selectedMuscles.every(g => selected.includes(g as typeof selected[number])) ? state.draftWorkout.day.exercises.map(e => e.name) : [])];
    workoutReadiness(state);
    const runtime = env as unknown as { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
    if (!(await reserveGeneration(db, user.userId)))
      return json({ error: 'AI Coach has reached its hourly limit. Try again later.' }, 429);
    return json(await generateCustomWorkout(state, selected, {
      OPENAI_API_KEY: runtime.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      OPENAI_MODEL: runtime.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      adminGuidance: control.guidance.workouts,
    }, fetch, priorNames));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI Coach is temporarily unavailable.' }, 400);
  }
}

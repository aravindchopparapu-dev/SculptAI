import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { isAdminUser, readAdminSnapshot } from '@/lib/admin-control';
import { createDemo, demoPersonas } from '@/lib/demo';
import { answerCoach } from '@/lib/live-coach';
import { generateCustomWorkout } from '@/lib/custom-workout';
import { generateMealPlan } from '@/lib/meal-coach';
import { syncFuelTarget } from '@/lib/fuel-adaptation';

export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
});

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in first.' }, 401);
  const runtime = env as unknown as { SCULPTAI_ADMIN_USER_ID?: string; SCULPTAI_ADMIN_EMAIL?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
  if (!isAdminUser(user, runtime)) return json({ error: 'Not found.' }, 404);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
  const raw = await request.text();
  if (raw.length > 800) return json({ error: 'Preview request is too large.' }, 413);
  let body: { area?: string; persona?: string; question?: string };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!['coach', 'workouts', 'meals'].includes(body.area ?? '') || !demoPersonas.includes(body.persona ?? ''))
    return json({ error: 'Choose a fictional profile and area.' }, 400);
  if (body.area === 'coach' && (typeof body.question !== 'string' || body.question.trim().length < 2 || body.question.length > 400))
    return json({ error: 'Enter a test question of 2–400 characters.' }, 400);
  try {
    const db = getDb();
    const snapshot = await readAdminSnapshot(db);
    const key = runtime.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) return json({ error: 'Connect AI Coach before running a live preview.' }, 503);
    const now = Math.floor(Date.now() / 1000), expired = now - 3600;
    const reservation = await db.prepare(`INSERT INTO coach_limits (user_id, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(user_id) DO UPDATE SET window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
      count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END WHERE window_start <= ? OR count < 12`)
      .bind(`admin-preview:${user.userId}`, now, expired, expired, expired).run();
    if (!reservation.meta.changes) return json({ error: 'Preview limit reached. Try again in an hour.' }, 429);
    const state = createDemo(body.persona);
    const config = { OPENAI_API_KEY: key, OPENAI_MODEL: runtime.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      adminGuidance: snapshot.draft.guidance[body.area as keyof typeof snapshot.draft.guidance],
      disabledExercises: snapshot.draft.disabledExercises };
    if (body.area === 'coach') {
      const result = await answerCoach(state, body.question!.trim(), config);
      if (result.mode !== 'openai') return json({ error: 'Live AI did not answer this preview. No settings were published.' }, 503);
      return json({ area: 'coach', result: result.answer, persona: body.persona, draftRevision: snapshot.revision });
    }
    if (body.area === 'workouts') {
      const result = await generateCustomWorkout(state, ['Chest'], config);
      return json({ area: 'workouts', result, persona: body.persona, draftRevision: snapshot.revision });
    }
    state.mealFoods = { breakfast: ['Rolled oats, dry', 'Whole eggs, boiled', 'Plain yogurt'],
      lunch: ['Chicken breast, cooked', 'Brown rice, cooked', 'Broccoli, cooked', 'Olive oil'],
      dinner: ['Salmon, cooked', 'Potatoes, boiled', 'Spinach, cooked'],
      morningSnack: [], eveningSnack: [], lateSnack: [] };
    state.profile = { ...state.profile!, sex: 'Male', diet: 'Omnivore', eligible: true };
    syncFuelTarget(state);
    const result = await generateMealPlan(state, config);
    return json({ area: 'meals', result: result.draft, persona: body.persona, draftRevision: snapshot.revision });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Preview failed. No settings were published.' }, 503);
  }
}

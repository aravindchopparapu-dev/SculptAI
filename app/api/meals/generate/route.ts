import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { Conflict, DuplicateOperation, readState, mutateState } from '@/lib/repository';
import { mealPlanContext, validateMealFoods } from '@/lib/meal-plan';
import { generateMealPlan } from '@/lib/meal-coach';
import { readPublishedControl } from '@/lib/admin-control';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in to create your meal plan.' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'This request must come from SculptAI.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
  const raw = await request.text();
  if (raw.length > 12000) return json({ error: 'Invalid request.' }, 413);
  let body: { operationId?: unknown; foods?: unknown; targetId?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!body || typeof body.operationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.operationId)) return json({ error: 'Invalid request.' }, 400);
  try {
    const db = getDb();
    const { control } = await readPublishedControl(db);
    if (!control.features.meals) return json({ error: 'Meal plan generation is temporarily paused.' }, 503);
    const { state, revision } = await readState(db, user.userId);
    const context = mealPlanContext(state);
    if (JSON.stringify(validateMealFoods(body.foods)) !== JSON.stringify(context.foods) || body.targetId !== state.targets.at(-1)?.id)
      return json({ error: 'Your foods or Fuel targets changed. Refresh and try again.' }, 409);
    const runtime = env as unknown as { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
    const config = { OPENAI_API_KEY: runtime.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      OPENAI_MODEL: runtime.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      adminGuidance: control.guidance.meals };
    if (!config.OPENAI_API_KEY) return json({ error: 'Connect AI Coach before generating a meal plan. Your foods are saved.' }, 503);
    const now = Math.floor(Date.now() / 1000), expired = now - 3600;
    const reservation = await db.prepare(`INSERT INTO coach_limits (user_id, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(user_id) DO UPDATE SET
      window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
      count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END WHERE window_start <= ? OR count < 20`)
      .bind(user.userId, now, expired, expired, expired).run();
    if (!reservation.meta.changes) return json({ error: 'AI Coach has reached its hourly limit. Try again later.' }, 429);
    const { draft, contextKey } = await generateMealPlan(state, config);
    return json(await mutateState(db, user.userId, revision, body.operationId, { type: 'generatedMealPlan', draft, contextKey }));
  } catch (error) {
    if (error instanceof Conflict || error instanceof DuplicateOperation)
      return json({ error: 'Your saved data changed while the plan was being generated. Please try again.' }, 409);
    const message = error instanceof Error ? error.message : '';
    if (error instanceof SyntaxError || /D1|SQL|database|binding|fetch failed|abort|timeout/i.test(message))
      return json({ error: 'AI Coach could not finish this meal plan. Your saved foods and previous plan are safe. Please try again.' }, 503);
    return json({ error: message || 'Unable to generate this meal plan. Please try again.' }, 400);
  }
}

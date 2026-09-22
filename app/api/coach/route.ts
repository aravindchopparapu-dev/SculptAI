import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { answerCoach } from '@/lib/live-coach';
import { answerFuelExplanation, fuelExplanationFacts } from '@/lib/fuel-explanation';
import { readState } from '@/lib/repository';
import { readPublishedControl } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  });

async function reserveCoachRequest(db: D1Database, userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const expired = now - 3600;
  const result = await db
    .prepare(
      `INSERT INTO coach_limits (user_id, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id) DO UPDATE SET
         window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
         count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END
       WHERE window_start <= ? OR count < 20`,
    )
    .bind(userId, now, expired, expired, expired)
    .run();
  return Boolean(result.meta.changes);
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in to use AI Coach.' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ error: 'This request must come from SculptAI.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Expected JSON.' }, 415);

  try {
    const raw = await request.text();
    if (raw.length > 2500) return json({ error: 'Question is too long.' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid request.' }, 400);
    }
    const fuelExplanation = body && typeof body === 'object' &&
      'intent' in body && (body as { intent: unknown }).intent === 'fuel-explanation';
    const message =
      body && typeof body === 'object' && 'message' in body
        ? (body as { message: unknown }).message
        : null;
    if (!fuelExplanation && (
      typeof message !== 'string' ||
      message.trim().length < 2 ||
      message.length > 1000
    ))
      return json({ error: 'Enter a question of 2–1000 characters.' }, 400);

    const db = getDb();
    const { control } = await readPublishedControl(db);
    if (!control.features.coach) return json({ error: 'AI Coach is temporarily paused.' }, 503);
    const { state } = await readState(db, user.userId);
    if (!state.profile)
      return json({ error: 'Complete your profile first.' }, 400);
    if (fuelExplanation) {
      try { fuelExplanationFacts(state); }
      catch (error) { return json({ error: (error as Error).message }, 400); }
    }
    const runtime = env as unknown as {
      OPENAI_API_KEY?: string;
      OPENAI_MODEL?: string;
    };
    const config = {
      OPENAI_API_KEY: runtime.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      OPENAI_MODEL:
        runtime.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      adminGuidance: control.guidance.coach,
    };
    if (config.OPENAI_API_KEY && !(await reserveCoachRequest(db, user.userId)))
      return json(
        { error: 'AI Coach has reached its 20-question hourly limit. Try again later.' },
        429,
      );
    return json(fuelExplanation
      ? await answerFuelExplanation(state, config)
      : await answerCoach(state, (message as string).trim(), config));
  } catch {
    return json(
      { error: 'AI Coach is temporarily unavailable. Please try again.' },
      503,
    );
  }
}

import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import {
  Conflict,
  DuplicateOperation,
  mutateState,
  readState,
} from '@/lib/repository';
import { analyzeFuelTrend, analyzeFuelTimeline } from '@/lib/fuel-coach';
import { readPublishedControl } from '@/lib/admin-control';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  });
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in to access your training.' }, 401);
  try {
    return json({
      ...(await readState(getDb(), user.userId)),
      user: { name: user.displayName, email: user.email },
    });
  } catch {
    return json(
      { error: 'Your saved data is temporarily unavailable. Please retry.' },
      503,
    );
  }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in to save your training.' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ error: 'This request must come from SculptAI.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Expected JSON.' }, 415);
  try {
    const text = await request.text();
    if (text.length > 20_000)
      return json({ error: 'This change is too large.' }, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Invalid request.' }, 400);
    }
    if (
      !body ||
      !Number.isInteger(body.revision) ||
      body.revision < 0 ||
      typeof body.operationId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(body.operationId) ||
      !body.action ||
      typeof body.action.type !== 'string'
    )
      return json({ error: 'Invalid request.' }, 400);
    if (['start', 'set', 'finish', 'sessionNotes', 'pain'].includes(body.action.type)) return json({ error: 'Workout logging is currently disabled.' }, 400);
    if (['coachFuelReview', 'coachTimeline', 'generatedMealPlan'].includes(body.action.type)) return json({ error: 'Coach review is server managed.' }, 400);
    if (body.action.type === 'plan')
      return json(
        { error: 'New workout plans are paused until AI Coach is connected.' },
        400,
      );
    try {
      let saved = await mutateState(
          getDb(),
          user.userId,
          body.revision,
          body.operationId,
          body.action,
        );
      if (['profile', 'metric', 'fuelSync'].includes(body.action.type)) {
        // A control read failure must never turn an already saved check-in into
        // a failed response or permit an unreviewed AI adjustment.
        let coachEnabled = false;
        try { coachEnabled = (await readPublishedControl(getDb())).control.features.coach; }
        catch { /* Keep the saved profile/check-in; skip optional AI analysis. */ }
        if (coachEnabled) {
          const runtime = env as unknown as { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
          const config = {
            OPENAI_API_KEY: runtime.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
            OPENAI_MODEL: runtime.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
          };
          try {
            const recommendation = await analyzeFuelTrend(saved.state, config);
            if (recommendation) saved = await mutateState(getDb(), user.userId, saved.revision,
              crypto.randomUUID(), { type: 'coachFuelReview', ...recommendation });
          } catch {
            saved = await readState(getDb(), user.userId);
          }
          try {
            const timeline = await analyzeFuelTimeline(saved.state, config);
            if (timeline) saved = await mutateState(getDb(), user.userId, saved.revision,
              crypto.randomUUID(), { type: 'coachTimeline', ...timeline });
          } catch {
            saved = await readState(getDb(), user.userId);
          }
        }
      }
      return json(saved);
    } catch (error) {
      if (error instanceof Conflict || error instanceof DuplicateOperation)
        return json(
          { error: error.message, ...(await readState(getDb(), user.userId)) },
          409,
        );
      if (
        error instanceof Error &&
        !/D1|SQL|database|binding/i.test(error.message)
      )
        return json({ error: error.message }, 400);
      throw error;
    }
  } catch {
    return json(
      {
        error:
          'We could not save this change. Your previous data is safe. Retry when connected.',
      },
      503,
    );
  }
}

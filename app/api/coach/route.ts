import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { readState } from '@/lib/repository';
import { env } from 'cloudflare:workers';
import { answerCoach, type CoachConfig } from '@/lib/live-coach';
import { safetyResponse } from '@/lib/coach';
export const dynamic = 'force-dynamic';
const json = (v: unknown, status = 200) =>
  Response.json(v, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in to use your guide.' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ error: 'This request must come from SculptAI.' }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 5000)
      return json({ error: 'Keep your question under 2,000 characters.' }, 413);
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return json({ error: 'Enter a valid question.' }, 400);
    }
    if (
      !input ||
      typeof input.message !== 'string' ||
      !input.message.trim() ||
      input.message.length > 2000
    )
      return json({ error: 'Enter a question of 1–2,000 characters.' }, 400);
    const safety = safetyResponse(input.message);
    if (safety) return json({ answer: safety, mode: 'safety' });
    const { state } = await readState(getDb(), user.userId);
    const config = env as unknown as CoachConfig;
    if (config.OPENAI_API_KEY && config.OPENAI_MODEL) {
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const limit = await getDb()
        .prepare(
          'INSERT INTO coach_limits (user_id, window_start, count) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, count = CASE WHEN coach_limits.window_start = excluded.window_start THEN coach_limits.count + 1 ELSE 1 END WHERE coach_limits.window_start != excluded.window_start OR coach_limits.count < 20',
        )
        .bind(user.userId, hourBucket)
        .run();
      if (!limit.meta.changes)
        return json(
          {
            error:
              'You have reached the 20-message hourly AI limit. Your training and history remain available.',
          },
          429,
        );
    }
    return json(await answerCoach(state, input.message, config));
  } catch {
    return json(
      {
        error:
          'The guide is temporarily unavailable. Your saved workouts remain available.',
      },
      503,
    );
  }
}

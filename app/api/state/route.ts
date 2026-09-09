import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import {
  Conflict,
  DuplicateOperation,
  mutateState,
  readState,
} from '@/lib/repository';
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
    try {
      return json(
        await mutateState(
          getDb(),
          user.userId,
          body.revision,
          body.operationId,
          body.action,
        ),
      );
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

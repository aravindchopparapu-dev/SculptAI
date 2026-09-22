import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { isAdminUser, publishAdminDraft, readAdminSnapshot, restoreAdminDraft, saveAdminDraft, validateControl } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
});
const runtime = () => env as unknown as { SCULPTAI_ADMIN_USER_ID?: string; SCULPTAI_ADMIN_EMAIL?: string };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in first.' }, 401);
  if (!isAdminUser(user, runtime())) return json({ error: 'Not found.' }, 404);
  try {
    const db = getDb();
    const [snapshot, members, versions] = await Promise.all([
      readAdminSnapshot(db),
      db.prepare('SELECT count(*) AS total FROM members').first<{ total: number }>(),
      db.prepare('SELECT version, published_at, published_by FROM admin_versions ORDER BY version DESC LIMIT 8').all<{ version: number; published_at: string; published_by: string }>(),
    ]);
    return json({ snapshot, memberCount: members?.total ?? 0, versions: versions.results,
      aiConfigured: Boolean((env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY || process.env.OPENAI_API_KEY),
      model: (env as unknown as { OPENAI_MODEL?: string }).OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      owner: { name: user.displayName, email: user.email } });
  } catch {
    return json({ error: 'Admin controls are temporarily unavailable.' }, 503);
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in first.' }, 401);
  if (!isAdminUser(user, runtime())) return json({ error: 'Not found.' }, 404);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
  const raw = await request.text();
  if (raw.length > 30000) return json({ error: 'Controls are too large.' }, 413);
  let body: { action?: string; revision?: number; control?: unknown; version?: number };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!Number.isInteger(body.revision) || body.revision! < 0) return json({ error: 'Invalid revision.' }, 400);
  try {
    const db = getDb();
    let snapshot;
    if (body.action === 'saveDraft') snapshot = await saveAdminDraft(db, body.revision!, validateControl(body.control), user.userId);
    else if (body.action === 'publish') snapshot = await publishAdminDraft(db, body.revision!, user.userId);
    else if (body.action === 'restore' && Number.isInteger(body.version) && body.version! > 0) snapshot = await restoreAdminDraft(db, body.revision!, body.version!, user.userId);
    else return json({ error: 'Unknown action.' }, 400);
    return json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save controls.';
    if (/changed in another tab|unavailable or controls changed/.test(message)) return json({ error: message }, 409);
    if (/D1|SQL|database|binding/i.test(message)) return json({ error: 'Admin controls are temporarily unavailable.' }, 503);
    return json({ error: message }, 400);
  }
}

import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { approvePairing, beginPairing, completePairing, reservePairing, revokeMobile } from '@/lib/mobile-auth';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', Vary: 'Authorization, Cookie' } });
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
  const raw = await request.text();
  if (raw.length > 512) return json({ error: 'Request too large.' }, 413);
  try {
    const body = JSON.parse(raw), db = getDb();
    if (body.action === 'begin') {
      if (!await reservePairing(db, `begin:${request.headers.get('cf-connecting-ip') ?? 'local'}`, 10)) return json({ error: 'Too many pairing attempts. Try again later.' }, 429);
      return json(await beginPairing(db));
    }
    if (body.action === 'poll' && typeof body.deviceSecret === 'string') return json(await completePairing(db, body.deviceSecret));
    if (body.action === 'approve') {
      const user = await getChatGPTUser();
      if (!user || user.authMethod === 'mobile') return json({ error: 'Sign in on the SculptAI website to approve this iPhone.' }, 401);
      if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
      if (!await reservePairing(db, `approve:${user.userId}`, 20)) return json({ error: 'Too many attempts. Try again later.' }, 429);
      if (typeof body.code !== 'string' || !/^[a-fA-F0-9\s-]{10,14}$/.test(body.code)) return json({ error: 'Enter the code shown on your iPhone.' }, 400);
      await approvePairing(db, body.code, user);
      return json({ approved: true });
    }
    if (body.action === 'revoke') { await revokeMobile(db, request.headers.get('authorization')); return json({ revoked: true }); }
    return json({ error: 'Invalid pairing action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return json({ error: /expired|already|Invalid pairing/.test(message) ? message : 'Pairing is temporarily unavailable. Please try again.' }, 400);
  }
}

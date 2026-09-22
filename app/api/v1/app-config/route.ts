import { getDb } from '@/db';
import { readPublishedControl } from '@/lib/admin-control';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { version, control } = await readPublishedControl(getDb());
    return Response.json({ version, features: control.features, memberNotice: control.memberNotice },
      { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch {
    return Response.json({ error: 'App configuration unavailable.' }, { status: 503 });
  }
}

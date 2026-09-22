import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import { notFound } from 'next/navigation';
import { getChatGPTUser, requireChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { isAdminUser, readAdminSnapshot } from '@/lib/admin-control';
import AdminCentre from './admin-centre';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin Control Centre · SculptAI', robots: { index: false, follow: false } };

export default async function AdminPage() {
  const user = await getChatGPTUser() ?? await requireChatGPTUser('/admin');
  const runtime = env as unknown as { SCULPTAI_ADMIN_USER_ID?: string; SCULPTAI_ADMIN_EMAIL?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
  if (!isAdminUser(user, runtime)) notFound();
  const db = getDb();
  const [snapshot, members, versions] = await Promise.all([
    readAdminSnapshot(db),
    db.prepare('SELECT count(*) AS total FROM members').first<{ total: number }>(),
    db.prepare('SELECT version, published_at, published_by FROM admin_versions ORDER BY version DESC LIMIT 8').all<{ version: number; published_at: string; published_by: string }>(),
  ]);
  return <AdminCentre initial={{ snapshot, memberCount: members?.total ?? 0, versions: versions.results,
    aiConfigured: Boolean(runtime.OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    model: runtime.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    owner: { name: user.displayName, email: user.email } }} />;
}

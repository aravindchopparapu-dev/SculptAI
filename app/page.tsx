import MemberStudio from './member-studio';
import { getChatGPTUser } from './chatgpt-auth';
import { getDb } from '@/db';
import { emptyState } from '@/lib/fitness';
import { readState } from '@/lib/repository';
import { screenForTab } from '@/lib/studio-navigation';
import type { MemberSnapshot } from '@/lib/use-member';
import { env } from 'cloudflare:workers';
import { isAdminUser, readPublishedControl } from '@/lib/admin-control';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[]; demo?: string | string[] }>;
}) {
  const params = await searchParams;
  const tab = typeof params.tab === 'string' ? params.tab : null;
  const initialScreen = screenForTab(tab);
  let initialMember: MemberSnapshot | null = null;
  let isAdmin = false;
  let memberNotice = '';
  if (params.demo !== '1') {
    try {
      const user = await getChatGPTUser();
      isAdmin = isAdminUser(user, env as unknown as { SCULPTAI_ADMIN_USER_ID?: string; SCULPTAI_ADMIN_EMAIL?: string });
      initialMember = user
        ? { ...(await readState(getDb(), user.userId)), user: { name: user.displayName, email: user.email } }
        : { state: emptyState(), revision: 0 };
      if (user) memberNotice = (await readPublishedControl(getDb())).control.memberNotice;
    } catch {
      // Keep the normal client retry path when the account service is unavailable.
    }
  }
  return <MemberStudio initialScreen={initialScreen ?? 'Studio'} screenInUrl={initialScreen !== null} initialMember={initialMember} renderedAt={Date.now()} isAdmin={isAdmin} memberNotice={memberNotice} />;
}

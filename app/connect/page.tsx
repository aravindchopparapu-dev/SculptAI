import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { mobileConnectParams } from '@/lib/mobile-connect';
import ConnectPhone from './connect-phone';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in to SculptAI · iPhone', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = mobileConnectParams(await searchParams);
  const user = await requireChatGPTUser(params.returnTo);
  return <ConnectPhone name={user.displayName} initialCode={params.code} appState={params.state} />;
}

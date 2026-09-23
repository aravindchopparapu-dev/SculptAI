import { requireChatGPTUser } from '@/app/chatgpt-auth';
import ConnectPhone from './connect-phone';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connect your iPhone · SculptAI', robots: { index: false, follow: false } };
export default async function Page() {
  const user = await requireChatGPTUser('/connect');
  return <ConnectPhone name={user.displayName} />;
}

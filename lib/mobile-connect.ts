// Only allow the app's fixed callback. Tokens and the device secret never enter a URL.
export function mobileConnectParams(query: Record<string, string | string[] | undefined>) {
  const code = typeof query.code === 'string' && /^[a-fA-F0-9]{10}$/.test(query.code) ? query.code.toUpperCase() : '';
  const state = typeof query.state === 'string' && /^[a-fA-F0-9-]{36}$/.test(query.state) ? query.state : '';
  const app = query.app === '1' && Boolean(code && state);
  const returnTo = app ? `/connect?${new URLSearchParams({ app: '1', code, state })}` : '/connect';
  return { code: app ? code : '', state: app ? state : '', returnTo };
}
export function mobileConnectCallback(state: string) {
  return /^[a-fA-F0-9-]{36}$/.test(state) ? `sculptai://auth-complete?${new URLSearchParams({ state })}` : null;
}

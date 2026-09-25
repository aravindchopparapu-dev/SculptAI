'use client';
import { applyAction } from './actions';
import { createDemo } from './demo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyState, type State } from './fitness';
import type { Action } from './actions';
type ApiSnapshot = Snapshot & { error?: string };
export type MemberSnapshot = {
  state: State;
  revision: number;
  user?: { name: string; email: string };
};
type Snapshot = MemberSnapshot;
export function useMember(initialSnapshot: MemberSnapshot | null = null) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot ?? {
    state: emptyState(),
    revision: 0,
  });
  const current = useRef(snapshot),
    queue = useRef(Promise.resolve());
  const busyRef = useRef(false);
  const initialized = useRef(Boolean(initialSnapshot));
  const [demo, setDemo] = useState(false);
  const demoRef = useRef(false);
  const [loading, setLoading] = useState(!initialSnapshot),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const update = useCallback((next: Snapshot) => {
    current.current = { ...current.current, ...next };
    setSnapshot(current.current);
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (new URLSearchParams(window.location.search).get('demo') === '1') {
        demoRef.current = true;
        setDemo(true);
        const raw = sessionStorage.getItem('sculptai-spec-demo');
        let state = createDemo();
        if (raw) {
          try {
            state = JSON.parse(raw);
          } catch {
            /* Start a clean fictional demo. */
          }
        }
        update({
          state,
          revision: 0,
          user: { name: 'Demo explorer', email: 'fictional-demo@example.test' },
        });
        return;
      }
      const r = await fetch('/api/state', { cache: 'no-store' }),
        d = (await r.json()) as ApiSnapshot;
      if (r.status === 401) {
        update({ state: emptyState(), revision: 0, user: undefined });
        return;
      }
      if (!r.ok) throw new Error(d.error);
      update(d);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to connect. Please retry.',
      );
    } finally {
      setLoading(false);
    }
  }, [update]);
  const refreshQuietly = useCallback(async () => {
    if (demoRef.current || busyRef.current || document.visibilityState !== 'visible') return;
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      const next = (await response.json()) as ApiSnapshot;
      if (busyRef.current) return;
      if (response.status === 401) update({ state: emptyState(), revision: 0, user: undefined });
      else if (response.ok && next.revision >= current.current.revision) update(next);
    } catch { /* Keep the last saved view while offline. */ }
  }, [update]);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const onReturn = () => { void refreshQuietly(); };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    const interval = window.setInterval(onReturn, 30_000);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
      window.clearInterval(interval);
    };
  }, [refreshQuietly]);
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [busy]);
  const mutate = useCallback(
    (action: Action): Promise<boolean> => {
      setBusy(true);
      busyRef.current = true;
      const run = async () => {
        setError('');
        setSaved('Saving…');
        if (demoRef.current) {
          try {
            const state =
              action.type === 'demoPersona'
                ? createDemo(String(action.persona))
                : applyAction(current.current.state, action);
            sessionStorage.setItem('sculptai-spec-demo', JSON.stringify(state));
            update({
              ...current.current,
              state,
              revision: current.current.revision + 1,
            });
            setSaved('Demo changes saved in this tab');
            return true;
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save demo.');
            setSaved('Demo change not saved');
            return false;
          }
        }
        const body = JSON.stringify({
          revision: current.current.revision,
          operationId: crypto.randomUUID(),
          action,
        });
        try {
          let response: Response;
          try {
            response = await fetch('/api/state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            });
          } catch {
            response = await fetch('/api/state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            });
          }
          const data = (await response.json()) as ApiSnapshot;
          if (data.state) update(data);
          if (!response.ok) throw new Error(data.error || 'Unable to save.');
          setSaved('All changes saved');
          return true;
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : 'Unable to save. Retry when connected.',
          );
          setSaved('Not saved — retry required');
          return false;
        }
      };
      const result = queue.current.then(run, run);
      queue.current = result.then(() => undefined);
      const tail = queue.current;
      void result.finally(() => {
        if (queue.current === tail) { busyRef.current = false; setBusy(false); }
      });
      return result;
    },
    [update],
  );
  return {
    ...snapshot,
    demo,
    loading,
    busy,
    error,
    saved,
    mutate,
    refresh,
    setError,
    receiveSnapshot: update,
  };
}

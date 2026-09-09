'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyState, type State } from './fitness';
import type { Action } from './actions';
type ApiSnapshot = Snapshot & { error?: string };
type Snapshot = {
  state: State;
  revision: number;
  user?: { name: string; email: string };
};
export function useMember() {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    state: emptyState(),
    revision: 0,
  });
  const current = useRef(snapshot),
    queue = useRef(Promise.resolve());
  const [loading, setLoading] = useState(true),
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
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [busy]);
  const mutate = useCallback(
    (action: Action): Promise<boolean> => {
      setBusy(true);
      const run = async () => {
        setError('');
        setSaved('Saving…');
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
        if (queue.current === tail) setBusy(false);
      });
      return result;
    },
    [update],
  );
  return {
    ...snapshot,
    loading,
    busy,
    error,
    saved,
    mutate,
    refresh,
    setError,
  };
}

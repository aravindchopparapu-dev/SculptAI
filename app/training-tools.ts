'use client';
import { useEffect, useRef } from 'react';
import type { State } from '@/lib/fitness';
export function useTrainingTools(state: State) {
  const view = useRef(state);
  useEffect(() => {
    view.current = state;
  }, [state]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_training_summary',
            description:
              'Read the signed-in member’s current goal, plan and saved workout counts. Does not change data.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== 'object' || Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('No arguments expected.');
              const s = view.current;
              return {
                goal: s.profile?.goal ?? null,
                planVersion: s.plans.at(-1)?.version ?? null,
                completedWorkouts: s.sessions.filter((x) => x.completed).length,
                activeWorkout:
                  s.sessions.find((x) => !x.completed)?.name ?? null,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
}

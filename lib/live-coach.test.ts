import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from './fitness.ts';
import { answerCoach, coachContext } from './live-coach.ts';
const state = emptyState();
state.profile = {
  name: 'Private name',
  age: 30,
  sex: 'Male',
  height: 175,
  weight: 75,
  goal: 'Strength',
  days: 3,
  minutes: 45,
  equipment: 'Gym',
  experience: 'Beginner',
  activity: 1.375,
  units: 'Metric',
  diet: 'Vegan',
  exclusions: 'Private diet note',
  avoid: 'Private medical note',
  eligible: false,
};
void test('AI context excludes identity and sensitive free-text notes', () => {
  const context = JSON.stringify(coachContext(state));
  assert.ok(!context.includes('Private'));
  assert.ok(!context.includes('age'));
  assert.ok(!context.includes('weight'));
});
void test('Unconfigured AI and safety requests make no provider request', async () => {
  let calls = 0;
  const request = (async () => {
    calls++;
    throw new Error('should not call');
  }) as typeof fetch;
  assert.equal(
    (await answerCoach(state, 'summarize', {}, request)).mode,
    'built-in',
  );
  assert.equal(
    (
      await answerCoach(
        state,
        'I have chest pain',
        { OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model' },
        request,
      )
    ).mode,
    'safety',
  );
  assert.equal(calls, 0);
});
void test('AI integration parses Responses output, disables storage and never changes records', async () => {
  const before = structuredClone(state);
  let body: Record<string, unknown> = {};
  const request = (async (_url: unknown, init: RequestInit) => {
    body = JSON.parse(init.body as string);
    return Response.json({
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'No completed workouts have been recorded.',
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
  const result = await answerCoach(
    state,
    'summarize',
    { OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model' },
    request,
  );
  assert.equal(result.mode, 'openai');
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 700);
  assert.deepEqual(state, before);
});
void test('Provider errors and timeouts preserve the built-in guide', async () => {
  for (const request of [
    (async () => new Response('', { status: 429 })) as typeof fetch,
    (async () => {
      throw new DOMException('Timed out', 'TimeoutError');
    }) as typeof fetch,
  ]) {
    const result = await answerCoach(
      state,
      'summarize',
      { OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model' },
      request,
    );
    assert.equal(result.mode, 'built-in');
    assert.match(result.answer, /workouts are unaffected/);
  }
});

'use client';

import { useState, type SyntheticEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Glass } from './member-forms';

type Answer = { answer: string; mode: 'openai' | 'built-in' | 'safety' };

export default function CoachPanel({
  hasProfile,
  demo,
  onProfile,
}: {
  hasProfile: boolean;
  demo: boolean;
  onProfile: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<Answer | null>(null);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);

  async function ask(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (waiting) return;
    setWaiting(true);
    setError('');
    setReply(null);
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question.trim() }),
      });
      const result = (await response.json()) as Answer & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      setReply(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setWaiting(false);
    }
  }

  return (
    <Glass className="coach-panel">
      <span className="eyebrow">SCULPTAI COACH</span>
      <h1>Ask about your training.</h1>
      <p>
        AI Coach can explain your saved profile and workout history. It cannot
        change your records or create meal and workout plans yet.
      </p>
      {demo ? (
        <p className="member-alert">
          Coach questions are available in your signed-in account. Fictional
          demo data is not sent to the AI service.
        </p>
      ) : !hasProfile ? (
        <button className="action-primary" onClick={onProfile}>
          Set up your profile <ArrowRight size={17} />
        </button>
      ) : (
        <>
          <form onSubmit={(event) => void ask(event)}>
            <label className="field">
              Your question
              <textarea
                required
                minLength={2}
                maxLength={1000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="For example: What do my saved workouts show?"
              />
            </label>
            <button
              className="action-primary"
              type="submit"
              disabled={waiting || question.trim().length < 2}
            >
              {waiting ? 'Thinking…' : 'Ask AI Coach'}
              <ArrowRight size={17} />
            </button>
          </form>
          {error && <p className="member-alert" role="alert">{error}</p>}
          {reply && (
            <div className="coach-response" role="status">
              <span className="eyebrow">
                {reply.mode === 'openai'
                  ? 'CONNECTED AI COACH'
                  : reply.mode === 'safety'
                    ? 'SAFETY GUIDANCE'
                    : 'BUILT-IN GUIDE'}
              </span>
              <p>{reply.answer}</p>
            </div>
          )}
          <p className="quiet-note">
            AI responses may be imperfect. For pain, medical conditions or a
            prescribed diet, speak with a qualified professional.
          </p>
        </>
      )}
    </Glass>
  );
}

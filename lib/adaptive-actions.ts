import { type State, type Plan } from './fitness.ts';
import {
  POLICY_VERSION,
  RULE_VERSION,
  assertCleared,
  normalizedState,
  validateReadiness,
  evaluateAdaptation,
  validateDays,
  receiptStatus,
  weeklySummary,
  type PlanDiff,
  type Receipt,
} from './adaptation.ts';
type Action = { type: string; [key: string]: unknown };
export function trainingFingerprint(state: State) {
  return JSON.stringify({
    sessions: state.sessions,
    readiness: normalizedState(state).readiness.at(-1),
    profile: state.profile,
  });
}
export function recordProposal(state: State, diff: PlanDiff): Receipt {
  const s = normalizedState(state),
    old = s.plans.at(-1)!;
  const receipt: Receipt = {
    ...structuredClone(diff),
    receiptId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    toVersion: old.version + (diff.changeType === 'hold' ? 0 : 1),
    userDecision: 'pending',
    profileSnapshot: JSON.stringify(s.profile),
    beforePlan: structuredClone(old),
    readinessId: s.readiness.at(-1)?.id,
    trainingSnapshot: trainingFingerprint(state),
  };
  s.receipts.push(receipt);
  state.receipts = s.receipts;
  return receipt;
}
export function recordManualChange(
  state: State,
  before: Plan | undefined,
  after: Plan,
  action: Action,
) {
  if (!before) return;
  const r = recordProposal(state, {
    planId: before.id,
    fromVersion: before.version,
    dayIndex: Number(action.dayIndex ?? 0),
    changeType: action.type === 'substitute' ? 'exercise' : 'duration',
    before: before.days,
    after: after.days,
    ruleId: `user-${action.type}`,
    ruleVersion: RULE_VERSION,
    reasonPlain:
      action.type === 'plan'
        ? 'You reviewed and requested a fresh four-week plan from your current profile.'
        : action.type === 'shorten'
          ? 'You reviewed and requested a shorter session, preserving rest and warm-up.'
          : 'You reviewed and selected a compatible movement alternative.',
    confidence: 'high',
    inputsUsed: [{ name: 'User request', value: action.type }],
    safetyChecks: [
      {
        name: 'Plan validated against profile and prescription caps',
        passed: true,
      },
    ],
    evidenceRefs: [],
  });
  state.decisions = [
    ...normalizedState(state).decisions,
    {
      id: crypto.randomUUID(),
      receiptId: r.receiptId,
      decision: 'accepted',
      createdAt: new Date().toISOString(),
      reason: 'Confirmed in plan preview',
      planId: after.id,
    },
  ];
}
export function applyAdaptiveAction(state: State, action: Action): boolean {
  const s = normalizedState(state),
    now = new Date().toISOString();
  if (action.type === 'safety') {
    if (
      action.accepted !== true ||
      !['clear', 'guidance', 'emergency'].includes(String(action.status))
    )
      throw new Error(
        'Accept the testing notice and answer the activity safety check.',
      );
    if (
      s.safetyScreens.some((x) => x.status === 'emergency') &&
      action.status !== 'emergency'
    )
      throw new Error(
        'An urgent safety flag cannot be cleared in this testing version. Seek professional guidance.',
      );
    s.consents.push({
      id: crypto.randomUUID(),
      createdAt: now,
      version: POLICY_VERSION,
      documents: ['testing terms', 'privacy notice', 'adult wellness boundary'],
    });
    s.safetyScreens.push({
      id: crypto.randomUUID(),
      createdAt: now,
      version: POLICY_VERSION,
      status: action.status as 'clear' | 'guidance' | 'emergency',
    });
    Object.assign(state, s);
    return true;
  }
  if (action.type === 'readiness') {
    assertCleared(s);
    const p = action.beforePlan ? { id: 'readiness', version: 0, created: now, days: [{ name: 'Today', exercises: [] }] } : s.plans.at(-1);
    if (!p || !s.profile) throw new Error('Complete your profile first.');
    if (!action.beforePlan && s.sessions.some((x) => !x.completed))
      throw new Error('Finish your active workout before another check-in.');
    s.draftWorkout = undefined;
    s.readiness.push({
      ...validateReadiness(action.readiness, s.profile, p),
      id: crypto.randomUUID(),
      createdAt: now,
    });
  } else if (action.type === 'proposeAdaptation') {
    assertCleared(s);
    if (s.sessions.some((x) => !x.completed))
      throw new Error('Finish your workout before changing its plan.');
    const r = s.readiness.at(-1);
    if (
      !r ||
      Date.now() - Date.parse(r.createdAt) > 12 * 3600000 ||
      r.dayIndex !== action.dayIndex
    )
      throw new Error('Save a fresh readiness check for this session first.');
    recordProposal(s, evaluateAdaptation(s, Number(action.dayIndex)));
  } else if (action.type === 'decideAdaptation') {
    const r = s.receipts.find((x) => x.receiptId === action.receiptId);
    if (!r || receiptStatus(s, r.receiptId) !== 'pending')
      throw new Error(
        'This suggestion has already been decided or is unavailable.',
      );
    if (!['accepted', 'rejected'].includes(String(action.decision)))
      throw new Error('Accept or reject the suggestion.');
    if (typeof action.reason !== 'string' || action.reason.length > 300)
      throw new Error('Keep your decision note under 300 characters.');
    let planId: string | undefined;
    if (action.decision === 'accepted') {
      assertCleared(s);
      const old = s.plans.at(-1)!;
      if (old.id !== r.planId || trainingFingerprint(s) !== r.trainingSnapshot)
        throw new Error(
          'Your plan or check-in changed. Dismiss this suggestion and review again.',
        );
      if (s.sessions.some((x) => !x.completed))
        throw new Error('Finish the active workout before accepting a change.');
      if (r.changeType !== 'hold') {
        validateDays(r.after, s.profile!);
        const next = {
          ...structuredClone(old),
          id: crypto.randomUUID(),
          version: old.version + 1,
          created: now,
          days: structuredClone(r.after),
        };
        s.plans.push(next);
        planId = next.id;
      }
    }
    s.decisions.push({
      id: crypto.randomUUID(),
      receiptId: r.receiptId,
      decision: action.decision as 'accepted' | 'rejected',
      createdAt: now,
      reason: action.reason,
      ...(planId ? { planId } : {}),
    });
  } else if (action.type === 'undoAdaptation') {
    assertCleared(s);
    const r = s.receipts.find((x) => x.receiptId === action.receiptId),
      last = s.decisions.filter((x) => x.receiptId === action.receiptId).at(-1),
      old = s.plans.at(-1);
    if (
      !r ||
      !old ||
      last?.decision !== 'accepted' ||
      !last.planId ||
      last.planId !== old.id
    )
      throw new Error('Only the latest accepted plan change can be undone.');
    if (s.sessions.some((x) => !x.completed))
      throw new Error(
        'Finish the active workout before undoing a plan change.',
      );
    if (r.profileSnapshot !== JSON.stringify(s.profile))
      throw new Error(
        'Your profile changed. Generate a new plan instead of restoring older preferences.',
      );
    validateDays(r.before, s.profile!);
    const restored = {
      ...structuredClone(r.beforePlan),
      id: crypto.randomUUID(),
      version: old.version + 1,
      created: now,
    };
    s.plans.push(restored);
    s.decisions.push({
      id: crypto.randomUUID(),
      receiptId: r.receiptId,
      decision: 'undone',
      createdAt: now,
      reason: 'User restored the previous prescription',
      planId: restored.id,
    });
  } else if (action.type === 'pain') {
    const session = s.sessions.find((x) => x.id === action.sessionId);
    if (!session || session.completed)
      throw new Error('Choose an active workout.');
    if (
      typeof action.exercise !== 'string' ||
      !session.sets.some((x) => x.exercise === action.exercise) ||
      !['pain', 'urgent'].includes(String(action.severity))
    )
      throw new Error('Choose the affected movement and symptom level.');
    if (typeof action.note !== 'string' || action.note.length > 500)
      throw new Error('Keep the pain note under 500 characters.');
    session.painEvents = [
      ...(session.painEvents ?? []),
      {
        id: crypto.randomUUID(),
        createdAt: now,
        exercise: action.exercise,
        severity: action.severity as 'pain' | 'urgent',
        note: action.note,
      },
    ];
    session.sets = session.sets.map((x) =>
      !x.done &&
      (x.exercise === action.exercise || action.severity === 'urgent')
        ? { ...x, skipped: true }
        : x,
    );
    if (action.severity === 'urgent')
      s.safetyScreens.push({
        id: crypto.randomUUID(),
        createdAt: now,
        version: POLICY_VERSION,
        status: 'emergency',
      });
  } else if (action.type === 'weeklyReview') {
    if (
      typeof action.barrier !== 'string' ||
      !['None', 'Time', 'Energy', 'Equipment', 'Pain', 'Other'].includes(
        action.barrier,
      ) ||
      typeof action.reflection !== 'string' ||
      action.reflection.length > 500 ||
      !Number.isInteger(action.nutritionDays) ||
      Number(action.nutritionDays) < 0 ||
      Number(action.nutritionDays) > 7
    )
      throw new Error(
        'Complete the weekly reflection with 0–7 nutrition days.',
      );
    s.reviews.push({
      id: crypto.randomUUID(),
      createdAt: now,
      barrier: action.barrier,
      nutritionDays: Number(action.nutritionDays),
      reflection: action.reflection,
      summary: weeklySummary(s),
    });
  } else return false;
  Object.assign(state, s);
  return true;
}

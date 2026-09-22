import { fuelReviewDue, weightTrend } from './fuel-adaptation.ts';
import type { State } from './fitness.ts';

type Config = { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
export async function analyzeFuelTrend(state: State, config: Config, request: typeof fetch = fetch) {
  const trend = fuelReviewDue(state);
  if (!trend || !config.OPENAI_API_KEY || !config.OPENAI_MODEL) return null;
  const profile = state.profile!;
  const response = await request('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      model: config.OPENAI_MODEL, store: false, max_output_tokens: 350,
      instructions: `You review adult fitness nutrition targets. Return ONLY JSON: {"delta": integer, "explanation": short string}. Delta is a change in daily kcal from the CURRENT saved target, restricted to -100, 0, or 100. Analyze the weight trend against the goal, but treat hydration and body composition readings as noisy. There are no verified food intake or adherence records. Prefer 0 unless the multi-week trend clearly supports a small change. Do not assume current calories equal actual intake. Do not attempt medical care or rapid weight change. The server will validate the response.`,
      input: JSON.stringify({ task: 'Review JSON weight trend and recommend a conservative target adjustment.', goal: profile.goal, targetWeightKg: profile.targetWeight,
        trend, latestBodyMetric: (() => { const m = state.metrics.at(-1); return m ? { bodyFat: m.bodyFat ?? null, waist: m.waist ?? null } : null; })(),
        currentTarget: { calories: state.targets.at(-1)!.calories, protein: state.targets.at(-1)!.protein,
          adjustment: state.targets.at(-1)!.adjustment ?? 0 },
        dataLimit: 'No intake, adherence, medication, pregnancy, or clinical history is recorded.' }),
      text: { format: { type: 'json_object' } },
    }),
  });
  if (!response.ok) return null;
  const raw = await response.text();
  if (raw.length > 20_000) return null;
  const result = JSON.parse(raw) as { status?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
  if (result.status !== 'completed') return null;
  const output = result.output?.filter(x => x.type === 'message').flatMap(x => x.content ?? []).find(x => x.type === 'output_text')?.text;
  if (!output) return null;
  const analysis = JSON.parse(output) as { delta?: unknown; explanation?: unknown };
  if (![-100, 0, 100].includes(analysis.delta as number) || typeof analysis.explanation !== 'string' || !analysis.explanation.trim() || analysis.explanation.length > 300) return null;
  return { delta: analysis.delta as number, explanation: analysis.explanation.trim() };
}

export async function analyzeFuelTimeline(state: State, config: Config, request: typeof fetch = fetch) {
  const target = state.targets.at(-1);
  const bounds = target?.timeline;
  if (!state.profile?.targetWeight || !target?.inputs.targetWeight || !bounds || bounds.source === 'ai-coach' || !config.OPENAI_API_KEY || !config.OPENAI_MODEL) return null;
  const latest = state.metrics.at(-1);
  const response = await request('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      model: config.OPENAI_MODEL, store: false, max_output_tokens: 350,
      instructions: `Estimate a cautious planning RANGE in weeks for an adult to move between two scale weights. Return ONLY JSON: {"minWeeks": integer, "maxWeeks": integer, "explanation": short string}. Both numbers must stay within the supplied planning bounds and minWeeks <= maxWeeks. No individual progress rate, food intake or adherence has been measured. Do not promise a date or imply all weight gain is muscle or all loss is fat. Mention that future check-ins can change the range. Prefer a wide range if evidence is limited.`,
      input: JSON.stringify({task:'Estimate JSON planning range for target scale weight.', currentKg: target.inputs.weight,
        targetKg: target.inputs.targetWeight, startingKg: state.profile?.weight ?? null, goal: state.profile?.goal,
        checkInCount: state.metrics.length, latestCheckInDate: latest?.date ?? null,
        weightTrend: weightTrend(state.metrics), planningBoundsWeeks: {min:bounds.minWeeks,max:bounds.maxWeeks}}),
      text: {format:{type:'json_object'}},
    }),
  });
  if (!response.ok) return null;
  const raw = await response.text();
  if (raw.length > 20_000) return null;
  const result = JSON.parse(raw) as {status?:string;output?:{type:string;content?:{type:string;text?:string}[]}[]};
  if (result.status !== 'completed') return null;
  const output = result.output?.filter(x => x.type === 'message').flatMap(x => x.content ?? []).find(x => x.type === 'output_text')?.text;
  if (!output) return null;
  const analysis = JSON.parse(output) as {minWeeks?:unknown;maxWeeks?:unknown;explanation?:unknown};
  if (!Number.isInteger(analysis.minWeeks) || !Number.isInteger(analysis.maxWeeks)
    || (analysis.minWeeks as number) < bounds.minWeeks || (analysis.maxWeeks as number) > bounds.maxWeeks
    || (analysis.minWeeks as number) > (analysis.maxWeeks as number)
    || typeof analysis.explanation !== 'string' || !analysis.explanation.trim() || analysis.explanation.length > 280) return null;
  return {targetId:target.id,minWeeks:analysis.minWeeks as number,maxWeeks:analysis.maxWeeks as number,explanation:analysis.explanation.trim()};
}

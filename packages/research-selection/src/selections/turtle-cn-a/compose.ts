import type { PolicyResult, SelectionResult } from "@trade-signal/research-contracts";

import type { SelectionPluginContext } from "../../selection-registry.js";

type TurtlePayload = {
  strategyId?: string;
  score?: number;
  decision?: string;
  confidence?: "high" | "medium" | "low" | "unknown";
  passesUniverseGate?: boolean;
  metrics?: {
    penetrationR?: number | null;
    roe?: number | null;
    fcfYield?: number | null;
    evEbitda?: number | null;
    floorPremium?: number | null;
  };
};

function payload(result: PolicyResult): TurtlePayload {
  return (result.payload ?? {}) as TurtlePayload;
}

function finite(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function normalize(values: Array<number | undefined>, current: number | undefined, higherBetter: boolean): number {
  const finiteValues = values.filter((v): v is number => v !== undefined && Number.isFinite(v));
  if (current === undefined || finiteValues.length < 2) return 0;
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (max - min < 1e-9) return 0;
  const clamped = Math.min(max, Math.max(min, current));
  const raw = (clamped - min) / (max - min);
  return higherBetter ? raw : 1 - raw;
}

function scorePolicy(result: PolicyResult, all: PolicyResult[]): number {
  const m = payload(result).metrics ?? {};
  const rows = all.map((it) => payload(it).metrics ?? {});
  return (
    0.2 * normalize(rows.map((it) => finite(it.roe)), finite(m.roe), true) +
    0.2 * normalize(rows.map((it) => finite(it.fcfYield)), finite(m.fcfYield), true) +
    0.25 * normalize(rows.map((it) => finite(it.penetrationR)), finite(m.penetrationR), true) +
    0.15 * normalize(rows.map((it) => finite(it.evEbitda)), finite(m.evEbitda), false) +
    0.2 * normalize(rows.map((it) => finite(it.floorPremium)), finite(m.floorPremium), false)
  );
}

function decision(score: number): { decision: "buy" | "watch" | "avoid"; confidence: "high" | "medium" | "low" } {
  if (score >= 0.65) return { decision: "buy", confidence: score >= 0.78 ? "high" : "medium" };
  if (score >= 0.45) return { decision: "watch", confidence: score >= 0.55 ? "medium" : "low" };
  return { decision: "avoid", confidence: "low" };
}

export function composeTurtleCnASelection(ctx: SelectionPluginContext): SelectionResult {
  const policyResults = (ctx.policyResults ?? []).filter((it) => it.policyId === "policy:turtle");
  const eligible = policyResults.filter((it) => payload(it).passesUniverseGate === true);
  const ranked = eligible
    .map((it) => {
      const score = scorePolicy(it, eligible);
      const verdict = decision(score || (payload(it).score ?? 0));
      return { result: it, score, ...verdict };
    })
    .filter((it) => it.decision !== "avoid")
    .sort((a, b) => b.score - a.score || a.result.code.localeCompare(b.result.code));

  const sliced = typeof ctx.maxCandidates === "number" && ctx.maxCandidates > 0
    ? ranked.slice(0, Math.floor(ctx.maxCandidates))
    : ranked;

  return {
    selectionId: ctx.selectionId,
    runId: ctx.runId,
    universe: ctx.universe,
    candidates: sliced.map((it) => ({
      code: it.result.code,
      score: it.score,
      decision: it.decision,
      confidence: it.confidence,
      policyContributions: {
        turtleScore: it.score,
      },
    })),
    drillDownTopicIds: ["topic:turtle-strategy-explainer", "topic:business-six-dimension"],
  };
}

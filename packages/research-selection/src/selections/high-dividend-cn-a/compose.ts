import type { PolicyResult, SelectionResult } from "@trade-signal/research-contracts";

import type { SelectionPluginContext } from "../../selection-registry.js";

type HighDividendPayload = {
  strategyId?: string;
  score?: number;
  decision?: string;
  confidence?: "high" | "medium" | "low" | "unknown";
  passesUniverseGate?: boolean;
};

const DECISION_RANK: Record<string, number> = {
  buy: 2,
  watch: 1,
  avoid: 0,
};

function readPayload(result: PolicyResult): HighDividendPayload {
  return (result.payload ?? {}) as HighDividendPayload;
}

export function composeHighDividendCnASelection(ctx: SelectionPluginContext): SelectionResult {
  const policyResults = (ctx.policyResults ?? []).filter((it) => it.policyId === "policy:high_dividend");
  const ranked = policyResults
    .filter((it) => readPayload(it).passesUniverseGate)
    .sort((a, b) => {
      const pa = readPayload(a);
      const pb = readPayload(b);
      const da = DECISION_RANK[pa.decision ?? "avoid"] ?? 0;
      const db = DECISION_RANK[pb.decision ?? "avoid"] ?? 0;
      if (db !== da) return db - da;
      return (pb.score ?? 0) - (pa.score ?? 0);
    });

  const sliced = typeof ctx.maxCandidates === "number" && ctx.maxCandidates > 0
    ? ranked.slice(0, Math.floor(ctx.maxCandidates))
    : ranked;

  return {
    selectionId: ctx.selectionId,
    runId: ctx.runId,
    universe: ctx.universe,
    candidates: sliced.map((it) => {
      const payload = readPayload(it);
      return {
        code: it.code,
        score: payload.score,
        decision: payload.decision,
        confidence: payload.confidence,
        policyContributions: {
          highDividendScore: payload.score ?? 0,
        },
      };
    }),
    drillDownTopicIds: ["topic:business-six-dimension", "topic:turtle-strategy-explainer"],
  };
}

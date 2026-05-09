#!/usr/bin/env node

import assert from "node:assert/strict";

import type { FeatureSet, PolicyResult } from "@trade-signal/research-contracts";
import { resolvePolicyPlugin } from "@trade-signal/research-policy";
import { POLICY_IDS } from "@trade-signal/research-policy";
import { HIGH_DIVIDEND_CN_A_SELECTION_ID, resolveSelectionPlugin } from "@trade-signal/research-selection";

import { bootstrapV2PluginRegistry } from "../bootstrap/v2-plugin-registry.js";
import { resolvePolicyPayloadEvaluator } from "../strategy/registry.js";

function sampleFeatureSet(runId: string, code: string, dv: number, pe: number): FeatureSet {
  return {
    runId,
    code,
    features: {
      code,
      name: `样本${code}`,
      market: "CN_A",
      industry: "食品饮料",
      dv,
      pe,
      pb: 1.8,
      roe: 4.0,
      debtRatio: 40,
      grossMargin: 30,
      marketCap: 9000,
      turnover: 0.8,
    },
    sourceRefs: [],
  };
}

async function main(): Promise<void> {
  bootstrapV2PluginRegistry();
  const runId = "smoke-run";
  const policyId = POLICY_IDS.highDividend;
  const policy = resolvePolicyPlugin(policyId);
  const payloadEvaluator = resolvePolicyPayloadEvaluator(policyId);
  const featureSets = [
    sampleFeatureSet(runId, "600887", 4.6, 15),
    sampleFeatureSet(runId, "000651", 5.1, 11),
    sampleFeatureSet(runId, "600036", 3.8, 7),
  ];
  const policyResults: PolicyResult[] = await Promise.all(
    featureSets.map((featureSet) =>
      Promise.resolve(
        policy.evaluate({
          policyId,
          runId,
          code: featureSet.code,
          featureSet,
          payload: payloadEvaluator(featureSet),
        }),
      ),
    ),
  );
  const selectionPlugin = resolveSelectionPlugin(HIGH_DIVIDEND_CN_A_SELECTION_ID);
  const selectionResult = await selectionPlugin.compose({
    selectionId: HIGH_DIVIDEND_CN_A_SELECTION_ID,
    runId,
    universe: "cn_a",
    policyResults,
    maxCandidates: 2,
  });
  assert.ok(selectionResult.candidates.length > 0);
  assert.ok((selectionResult.drillDownTopicIds ?? []).length > 0);
  assert.ok(selectionResult.candidates.length <= 2);
  console.log("[quality] selection plugin smoke passed");
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

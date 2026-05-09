#!/usr/bin/env node

import assert from "node:assert/strict";

import type { FeatureSet } from "@trade-signal/research-contracts";
import { resolvePolicyPlugin } from "@trade-signal/research-policy";
import { POLICY_IDS } from "@trade-signal/research-policy";

import { bootstrapV2PluginRegistry } from "../bootstrap/v2-plugin-registry.js";
import { resolvePolicyPayloadEvaluator } from "../strategy/registry.js";

async function main(): Promise<void> {
  bootstrapV2PluginRegistry();
  const runId = "smoke-run";
  const featureSet: FeatureSet = {
    runId,
    code: "600887",
    features: {
      code: "600887",
      name: "伊利股份",
      market: "CN_A",
      industry: "食品饮料",
      dv: 4.8,
      pe: 16,
      pb: 2.2,
      roe: 0.04,
      debtRatio: 45,
      grossMargin: 31,
      marketCap: 12000,
      turnover: 0.9,
    },
    sourceRefs: [],
  };
  const policyId = POLICY_IDS.highDividend;
  const payloadEvaluator = resolvePolicyPayloadEvaluator(policyId);
  const plugin = resolvePolicyPlugin(policyId);
  const result = await plugin.evaluate({
    policyId,
    runId,
    code: featureSet.code,
    featureSet,
    payload: payloadEvaluator(featureSet),
  });
  assert.equal(result.policyId, policyId);
  assert.equal(result.code, featureSet.code);
  assert.ok(typeof result.payload.score === "number");
  assert.ok(typeof result.payload.decision === "string");
  assert.ok(result.payload.metrics && typeof result.payload.metrics === "object");
  console.log("[quality] policy plugin smoke passed");
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

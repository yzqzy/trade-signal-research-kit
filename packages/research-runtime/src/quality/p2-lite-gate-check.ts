#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { evaluateP2LiteCoverageGate } from "../contracts/report-topic-contract.js";

async function main(): Promise<void> {
  const sample600941 = {
    code: "600941",
    industryCycle: { position: "middle", confidence: "high" },
    governanceEvents: { events: [{ severity: "medium", summary: "问询函" }] },
    earningsGuidance: [{ reportDate: "2025-12-31", predictType: "略增" }],
    businessHighlights: [{ mainPoint: "算力与云网协同" }],
    themeSignals: [{ boardName: "算力" }],
  };

  const sample002714 = {
    code: "002714",
    industryCycle: { position: "bottom", confidence: "medium" },
    governanceEvents: { events: [] },
    earningsGuidance: [],
    businessHighlights: [{ mainPoint: "主营业务结构优化" }],
    themeSignals: [],
  };

  const gate600941 = evaluateP2LiteCoverageGate(sample600941);
  const gate002714 = evaluateP2LiteCoverageGate(sample002714);

  assert.equal(gate600941.status, "pass", "600941 should pass P2-lite gate");
  assert.ok(gate600941.coverageCount >= 3, "600941 should have at least 3 P2-lite blocks");

  assert.equal(gate002714.status, "degraded", "002714 should degrade when P2-lite coverage is low");
  assert.ok(gate002714.coverageCount < 3, "002714 should have less than 3 meaningful P2-lite blocks");
  assert.ok(gate002714.missingBlocks.length > 0, "002714 should expose missing P2-lite blocks");

  console.log("[quality] P2-lite gate check passed (600941 pass, 002714 degraded)");
}

void main();

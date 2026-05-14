#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ensureAnnualPdfOnDisk } from "../crosscut/preflight/ensure-annual-pdf.js";

async function main(): Promise<void> {
  const runDir = await mkdtemp(path.join(tmpdir(), "ms-pdf-required-"));
  const prevFeed = process.env.FEED_BASE_URL;
  try {
    delete process.env.FEED_BASE_URL;
    await assert.rejects(
      () =>
        ensureAnnualPdfOnDisk({
          normalizedCode: "600000",
          fiscalYear: "2024",
          category: "年报",
          outputRunDir: runDir,
          discoverPolicy: "strict",
          allowFiscalYearFallback: false,
          discoveryErrorStyle: "workflow-strict",
        }),
      /自动发现年报失败|需要 FEED_BASE_URL|strict/u,
    );
  } finally {
    if (prevFeed === undefined) delete process.env.FEED_BASE_URL;
    else process.env.FEED_BASE_URL = prevFeed;
    await rm(runDir, { recursive: true, force: true });
  }
  console.log("[test:financial-minesweeper-pdf-required] ok");
}

void main();

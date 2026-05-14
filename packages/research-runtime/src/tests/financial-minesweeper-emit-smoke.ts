#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { FinancialMinesweeperManifestV1 } from "../contracts/financial-minesweeper-manifest.js";
import {
  emitSiteReportsFromRun,
  findPublishedMarkdownQualityViolations,
} from "../reports-site/emit-site-reports.js";
import { evaluateMinesweeperRules } from "../runtime/financial-minesweeper/minesweeper-rules.js";
import { renderFinancialMinesweeperMarkdown } from "../runtime/financial-minesweeper/report-markdown.js";
import { validateTopicFinalMarkdown } from "../runtime/topic-finalization/finalization-gate.js";

async function main(): Promise<void> {
  const evaluation = evaluateMinesweeperRules({
    code: "600000",
    anchorYear: 2024,
    companyName: "测试公司",
    industry: "银行",
    snapshots: [],
    trends: [],
    governanceEvents: [],
    annualMetaByYear: {},
    incomeByYear: {},
    balanceByYear: {},
    cashflowByYear: {},
  });
  const md = renderFinancialMinesweeperMarkdown({
    companyName: "测试公司",
    code: "600000",
    anchorYear: 2024,
    evaluation,
  });
  assert.equal(validateTopicFinalMarkdown("financial-minesweeper", md).status, "complete");
  assert.deepEqual(findPublishedMarkdownQualityViolations(md), []);

  const root = await mkdtemp(path.join(tmpdir(), "minesweeper-emit-"));
  try {
    const runDir = path.join(root, "run");
    const siteDir = path.join(root, "site");
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, "financial_minesweeper_report.md"), md, "utf-8");
    await writeFile(
      path.join(runDir, "financial_minesweeper_analysis.json"),
      JSON.stringify({ evaluation }, null, 2),
      "utf-8",
    );
    const manifest: FinancialMinesweeperManifestV1 = {
      manifestVersion: "1.0",
      generatedAt: "2026-05-14T10:00:00.000Z",
      outputLayout: { code: "600000", runId: "ms-test-run", area: "financial-minesweeper" },
      input: { code: "600000", year: "2024", companyName: "测试公司" },
      outputs: {
        reportMarkdownPath: "financial_minesweeper_report.md",
        analysisJsonPath: "financial_minesweeper_analysis.json",
      },
      summary: {
        totalScore: evaluation.totalScore,
        riskBand: evaluation.riskBand,
        failCount: 0,
        warnCount: 0,
        skipCount: 1,
      },
    };
    await writeFile(path.join(runDir, "financial_minesweeper_manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    await emitSiteReportsFromRun({ runDir, siteDir });
    const timeline = JSON.parse(await readFile(path.join(siteDir, "views", "timeline.json"), "utf-8")) as Array<{
      topicType: string;
      entryId: string;
    }>;
    assert.ok(timeline.some((it) => it.topicType === "financial-minesweeper"));
    const entryId = timeline.find((it) => it.topicType === "financial-minesweeper")!.entryId;
    const content = await readFile(path.join(siteDir, "entries", entryId, "content.md"), "utf-8");
    assert.match(content, /排雷结论摘要/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  console.log("[test:financial-minesweeper-emit] ok");
}

void main();

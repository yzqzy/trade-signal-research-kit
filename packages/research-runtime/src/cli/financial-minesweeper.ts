#!/usr/bin/env node

import { initCliEnv } from "../lib/init-cli-env.js";
import { emitSiteReportsFromRun } from "../reports-site/emit-site-reports.js";
import { runFinancialMinesweeper } from "../runtime/financial-minesweeper/orchestrator.js";
import { parseFinancialMinesweeperArgs } from "./financial-minesweeper-args.js";

async function main(): Promise<void> {
  initCliEnv();
  const args = parseFinancialMinesweeperArgs(process.argv.slice(2));
  if (!args.code) throw new Error("Missing required argument: --code <stock-code>");
  if (!args.year?.trim()) throw new Error("Missing required argument: --year <fiscal-year>");

  const result = await runFinancialMinesweeper({
    code: args.code,
    year: args.year.trim(),
    outputDirArg: args.outputDir,
    companyName: args.companyName,
    reportUrl: args.reportUrl,
  });

  console.log(`[financial-minesweeper] outputDir -> ${result.outputDir}`);
  console.log(`[financial-minesweeper] report -> ${result.reportMarkdownPath}`);
  console.log(`[financial-minesweeper] analysis -> ${result.analysisJsonPath}`);
  if (result.pdfPath) console.log(`[financial-minesweeper] pdf -> ${result.pdfPath}`);
  if (result.reportUrlResolved) console.log(`[financial-minesweeper] report-url -> ${result.reportUrlResolved}`);
  if (result.phase2aJsonPath) console.log(`[financial-minesweeper] phase2a -> ${result.phase2aJsonPath}`);
  if (result.phase2bMarkdownPath) console.log(`[financial-minesweeper] phase2b -> ${result.phase2bMarkdownPath}`);
  console.log(`[financial-minesweeper] manifest -> ${result.manifestPath}`);

  if (args.reportsSiteDir) {
    const { siteDir } = await emitSiteReportsFromRun({
      runDir: result.outputDir,
      siteDir: args.reportsSiteDir,
    });
    console.log(`[financial-minesweeper] reports-site -> ${siteDir}`);
  }
}

void main();

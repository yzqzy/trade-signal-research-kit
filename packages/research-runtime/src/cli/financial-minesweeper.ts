#!/usr/bin/env node

import { initCliEnv } from "../lib/init-cli-env.js";
import { emitSiteReportsFromRun } from "../reports-site/emit-site-reports.js";
import { runFinancialMinesweeper } from "../runtime/financial-minesweeper/orchestrator.js";

type CliArgs = {
  code?: string;
  year?: string;
  companyName?: string;
  outputDir?: string;
  reportsSiteDir?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--") continue;
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for argument: ${key}`);
    values[key.slice(2)] = value;
    i += 1;
  }
  return {
    code: values.code,
    year: values.year,
    companyName: values["company-name"],
    outputDir: values["output-dir"],
    reportsSiteDir: values["reports-site-dir"]?.trim() || undefined,
  };
}

async function main(): Promise<void> {
  initCliEnv();
  const args = parseArgs(process.argv.slice(2));
  if (!args.code) throw new Error("Missing required argument: --code <stock-code>");
  if (!args.year?.trim()) throw new Error("Missing required argument: --year <fiscal-year>");

  const result = await runFinancialMinesweeper({
    code: args.code,
    year: args.year.trim(),
    outputDirArg: args.outputDir,
    companyName: args.companyName,
  });

  console.log(`[financial-minesweeper] outputDir -> ${result.outputDir}`);
  console.log(`[financial-minesweeper] report -> ${result.reportMarkdownPath}`);
  console.log(`[financial-minesweeper] analysis -> ${result.analysisJsonPath}`);
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

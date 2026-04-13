#!/usr/bin/env node

import { runResearchWorkflow } from "./orchestrator.js";

type CliArgs = {
  code?: string;
  year?: string;
  companyName?: string;
  from?: string;
  to?: string;
  outputDir?: string;
  pdfPath?: string;
  reportUrl?: string;
  category?: string;
  phase1bChannel?: "http" | "mcp";
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

  const channel = values["phase1b-channel"];
  if (channel && channel !== "http" && channel !== "mcp") {
    throw new Error(`Invalid --phase1b-channel: ${channel}`);
  }

  return {
    code: values.code,
    year: values.year,
    companyName: values["company-name"],
    from: values.from,
    to: values.to,
    outputDir: values["output-dir"],
    pdfPath: values.pdf,
    reportUrl: values["report-url"],
    category: values.category,
    phase1bChannel: channel as "http" | "mcp" | undefined,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.code) throw new Error("Missing required argument: --code <stock-code>");

  const result = await runResearchWorkflow({
    code: args.code,
    year: args.year,
    companyName: args.companyName,
    from: args.from,
    to: args.to,
    outputDir: args.outputDir,
    pdfPath: args.pdfPath,
    reportUrl: args.reportUrl,
    category: args.category,
    phase1bChannel: args.phase1bChannel,
  });

  console.log(`[workflow] outputDir -> ${result.outputDir}`);
  console.log(`[workflow] phase1a -> ${result.phase1aJsonPath}`);
  console.log(`[workflow] marketPack -> ${result.marketPackPath}`);
  console.log(`[workflow] phase1b -> ${result.phase1bMarkdownPath}`);
  if (result.phase2aJsonPath) console.log(`[workflow] phase2a -> ${result.phase2aJsonPath}`);
  if (result.phase2bMarkdownPath) console.log(`[workflow] phase2b -> ${result.phase2bMarkdownPath}`);
  console.log(`[workflow] phase3 valuation -> ${result.valuationPath}`);
  console.log(`[workflow] phase3 report(md) -> ${result.reportMarkdownPath}`);
  console.log(`[workflow] phase3 report(html) -> ${result.reportHtmlPath}`);
  console.log(`[workflow] manifest -> ${result.manifestPath}`);
}

void main();

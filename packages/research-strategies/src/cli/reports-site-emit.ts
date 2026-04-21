#!/usr/bin/env node

import { initCliEnv } from "../lib/init-cli-env.js";
import { resolveInputPath, resolveOutputPath } from "../crosscut/normalization/resolve-monorepo-path.js";
import { emitSiteReportsFromRun, rebuildSiteReportsIndex } from "../reports-site/emit-site-reports.js";

type CliArgs = {
  runDir?: string;
  siteDir?: string;
  reindexOnly?: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--") continue;
    if (key === "--reindex-only") {
      flags.add("reindex-only");
      continue;
    }
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for argument: ${key}`);
    values[key.slice(2)] = value;
    i += 1;
  }
  return {
    runDir: values["run-dir"]?.trim(),
    siteDir: values["site-dir"]?.trim(),
    reindexOnly: flags.has("reindex-only"),
  };
}

async function main(): Promise<void> {
  initCliEnv();
  const args = parseArgs(process.argv.slice(2));
  const siteDir = resolveOutputPath((args.siteDir ?? "output/site/reports").trim() || "output/site/reports");

  if (args.reindexOnly) {
    await rebuildSiteReportsIndex(siteDir);
    console.log(`[reports-site:emit] reindexed -> ${siteDir}`);
    return;
  }

  if (!args.runDir?.trim()) {
    throw new Error("[reports-site:emit] 需要 --run-dir <workflow|business-analysis run 根目录>，或传 --reindex-only");
  }

  const { siteDir: out } = await emitSiteReportsFromRun({
    runDir: resolveInputPath(args.runDir.trim()),
    siteDir,
  });
  console.log(`[reports-site:emit] wrote entries + views -> ${out}`);
}

void main();

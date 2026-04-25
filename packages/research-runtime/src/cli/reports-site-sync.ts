#!/usr/bin/env node

import path from "node:path";

import { initCliEnv } from "../lib/init-cli-env.js";
import { resolveInputPath, resolveOutputPath } from "../crosscut/normalization/resolve-monorepo-path.js";
import { syncSiteReportsToPublicDir } from "../reports-site/emit-site-reports.js";

function parseArgs(argv: string[]): {
  siteDir?: string;
  targetDir?: string;
  legacyDocs?: boolean;
} {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--") continue;
    if (key === "--legacy-docs") {
      flags.add("legacy-docs");
      continue;
    }
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for argument: ${key}`);
    values[key.slice(2)] = value;
    i += 1;
  }
  return {
    siteDir: values["site-dir"]?.trim(),
    targetDir: values["target-dir"]?.trim(),
    legacyDocs: flags.has("legacy-docs"),
  };
}

function defaultAppPublicReportsDir(): string {
  return resolveOutputPath(path.join("apps", "research-hub", "public", "reports"));
}

function defaultLegacyDocsPublicReportsDir(): string {
  return resolveOutputPath(path.join("..", "trade-signal-docs", "public", "reports"));
}

async function main(): Promise<void> {
  initCliEnv();
  const args = parseArgs(process.argv.slice(2));
  const siteDirRaw = (args.siteDir ?? "output/site/reports").trim() || "output/site/reports";
  const siteDir = path.isAbsolute(siteDirRaw) ? siteDirRaw : resolveInputPath(siteDirRaw);

  let target: string;
  if (args.targetDir?.trim()) {
    target = resolveInputPath(args.targetDir.trim());
  } else if (args.legacyDocs) {
    target = defaultLegacyDocsPublicReportsDir();
  } else {
    target = defaultAppPublicReportsDir();
  }

  await syncSiteReportsToPublicDir({ siteDir, targetPublicReportsDir: target });
  const mode = args.legacyDocs ? "legacy-docs" : args.targetDir ? "custom" : "research-hub";
  console.log(`[reports-site:sync] mode=${mode} ${siteDir} -> ${target}`);
}

void main();

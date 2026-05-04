#!/usr/bin/env node

import { initCliEnv } from "../lib/init-cli-env.js";
import { loadOrFetchUniverseSnapshot } from "./universe-snapshot.js";
import type { ScreenerMarket } from "./types.js";

type CliArgs = {
  market: ScreenerMarket;
  outputDir: string;
  feedBaseUrl?: string;
  feedApiBasePath?: string;
  feedApiKey?: string;
  pageSize?: number;
  refresh: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--") continue;
    if (key === "--refresh") {
      flags.add("refresh");
      continue;
    }
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for argument: ${key}`);
    values[key.slice(2).replaceAll("-", "_")] = value;
    i += 1;
  }
  return {
    market: (values.market ?? "CN_A") as ScreenerMarket,
    outputDir: values.output_dir ?? values.output ?? "output",
    feedBaseUrl: values.feed_base_url,
    feedApiBasePath: values.feed_api_base_path,
    feedApiKey: values.feed_api_key,
    pageSize: values.page_size !== undefined ? Number(values.page_size) : undefined,
    refresh: flags.has("refresh"),
  };
}

async function main(): Promise<void> {
  initCliEnv();
  const args = parseArgs(process.argv.slice(2));
  const result = await loadOrFetchUniverseSnapshot({
    market: args.market,
    outputRoot: args.outputDir,
    feedBaseUrl: args.feedBaseUrl,
    feedApiBasePath: args.feedApiBasePath,
    feedApiKey: args.feedApiKey,
    pageSize: args.pageSize,
    refresh: args.refresh,
  });
  console.log(
    `[screener:fetch-universe] market=${result.meta.market} date=${result.meta.date} ` +
      `count=${result.meta.count} reused=${result.meta.reused}`,
  );
  console.log(`[screener:fetch-universe] json -> ${result.dataPath}`);
  console.log(`[screener:fetch-universe] manifest -> ${result.metaPath}`);
}

void main();

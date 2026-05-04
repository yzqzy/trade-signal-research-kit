import path from "node:path";
import { readFile } from "node:fs/promises";

import type { RankingsIndex } from "@/lib/rankings/types";

const EMPTY_RANKINGS_INDEX: RankingsIndex = {
  version: "1.0",
  generatedAt: "",
  strategyCount: 0,
  listCount: 0,
  defaultStrategyId: "turtle",
  lists: [],
};

export async function readRankingsData(): Promise<RankingsIndex> {
  const root = path.join(process.cwd(), "public", "reports", "rankings");
  try {
    const raw = await readFile(path.join(root, "index.json"), "utf-8");
    return JSON.parse(raw) as RankingsIndex;
  } catch {
    return EMPTY_RANKINGS_INDEX;
  }
}

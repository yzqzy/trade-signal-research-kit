import path from "node:path";
import { readFile } from "node:fs/promises";

import type { TimelineItem } from "./ReportsTimelineClient";

type SiteIndex = {
  version: string;
  generatedAt: string;
  entryCount: number;
  timelineHref: string;
};

export async function readTimelineData(): Promise<{
  index: SiteIndex | null;
  items: TimelineItem[];
}> {
  const root = path.join(process.cwd(), "public", "reports");
  try {
    const [idxRaw, tlRaw] = await Promise.all([
      readFile(path.join(root, "index.json"), "utf-8"),
      readFile(path.join(root, "views", "timeline.json"), "utf-8"),
    ]);
    return {
      index: JSON.parse(idxRaw) as SiteIndex,
      items: JSON.parse(tlRaw) as TimelineItem[],
    };
  } catch {
    return { index: null, items: [] };
  }
}

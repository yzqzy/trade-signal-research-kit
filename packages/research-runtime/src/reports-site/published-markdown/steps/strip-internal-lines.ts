import type { MarkdownTransform } from "../pipeline.js";
import { PUBLISH_DROP_LINE_PATTERNS } from "../patterns.js";

export const stripInternalLines: MarkdownTransform = (markdown) =>
  markdown
    .split(/\r?\n/u)
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed || !PUBLISH_DROP_LINE_PATTERNS.some((re) => re.test(trimmed));
    })
    .join("\n");

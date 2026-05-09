import type { MarkdownTransform } from "../pipeline.js";

export const moveEvidenceGapsBeforeAppendix: MarkdownTransform = (markdown) => {
  const gapRe = /^##\s+证据缺口清单(?:（(?:Phase1B|外部证据)）)?\s*[\s\S]*?(?=^##\s+附录：证据索引\s*$|(?![\s\S]))/imu;
  const m = markdown.match(gapRe);
  if (!m?.[0]) return markdown;
  const without = markdown.replace(gapRe, "").replace(/\n{3,}/g, "\n\n").trim();
  const appendixAt = without.search(/^##\s+附录：证据索引\s*$/imu);
  if (appendixAt < 0) return [without, m[0].trim()].join("\n\n");
  return [without.slice(0, appendixAt).trim(), m[0].trim(), without.slice(appendixAt).trim()].join("\n\n");
};

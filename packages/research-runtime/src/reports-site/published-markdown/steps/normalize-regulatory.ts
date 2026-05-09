import type { MarkdownTransform } from "../pipeline.js";

export const normalizeRegulatorySection: MarkdownTransform = (markdown) => {
  const re = /^##\s+监管与合规要点\s*\n([\s\S]*?)(?=^##\s+)/mu;
  const m = markdown.match(re);
  if (!m?.[1]) return markdown;
  const lines = m[1].trim().split(/\r?\n/u).filter((line) => line.trim());
  const bullets = Array.from(new Set(lines.filter((line) => line.trim().startsWith("- "))));
  if (bullets.length === 0) return markdown;
  const block = [
    "## 监管与合规要点",
    "",
    ...bullets,
    "",
  ].join("\n");
  return markdown.replace(re, `${block}\n`);
};

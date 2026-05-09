import type { MarkdownTransform } from "../pipeline.js";
import { publicEvidenceLocator } from "../evidence-attachments.js";

export const sanitizeEvidenceAppendix: MarkdownTransform = (markdown) =>
  markdown
    .split(/\r?\n/u)
    .map((line) => {
      let next = line.replace(/\|\s*链接或定位\s*\|/u, "| 公开定位 |");
      if (/^\|/.test(next) && /\/Users\/|\/private\/|\/var\/folders\/|output\/(?:workflow|business-analysis|site)\//u.test(next)) {
        const cells = next.split("|");
        if (cells.length >= 6) {
          cells[cells.length - 2] = ` ${publicEvidenceLocator(cells[cells.length - 2] ?? "")} `;
          next = cells.join("|");
        }
      }
      next = next.replace(
        /`?[\w./-]*?(?:data_pack_report(?:_interim)?|phase1b_qualitative|data_pack_market|phase1a_data_pack|valuation_computed|analysis_report|phase3_preflight)\.(?:md|json)`?/gu,
        (m) => publicEvidenceLocator(m),
      );
      next = next
        .replace(/\[市场与行业证据摘要 · 可展开\/下载\]\(#attachment-market-pack\)\s*§18/gu, "费用率趋势（市场包 §18）")
        .replace(/\[市场与行业证据摘要 · 可展开\/下载\]\(#attachment-market-pack\)\s*§19/gu, "营运资本与现金转换周期（市场包 §19）")
        .replace(/\[市场与行业证据摘要 · 可展开\/下载\]\(#attachment-market-pack\)\s*§21/gu, "治理与监管事件时间线（市场包 §21）")
        .replace(/\[市场与行业证据摘要 · 可展开\/下载\]\(#attachment-market-pack\)\s*§22/gu, "行业关键变量（市场包 §22）");
      return next.replace(/\/Users\/[^\s|)]+/gu, "内部证据包摘要，已转写入正文");
    })
    .join("\n");

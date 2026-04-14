import type { ScreenerRunOutput } from "./types.js";

function esc(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function fmt(n: number | undefined): string {
  return n === undefined || !Number.isFinite(n) ? "" : n.toFixed(4);
}

/** 与 Python 控制台 `display_cols` 顺序一致（在报告表中扩展展示）。 */
export function renderScreenerMarkdown(input: ScreenerRunOutput): string {
  const top = input.results.slice(0, 50);
  const lines = [
    `# Screener Report (${input.market})`,
    "",
    `- mode: ${input.mode}`,
    `- generated_at: ${input.generatedAt}`,
    `- total_universe: ${input.totalUniverse}`,
    `- tier1_count: ${input.tier1Count}`,
    `- passed_count: ${input.passedCount}`,
    input.tier1Only ? "- pipeline: tier1_only" : "",
    "",
    "| code | name | industry | channel | decision | composite | roe | fcf_yld | R | ev/ebitda | floor% | tier1 | veto |",
    "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...top.map((r) => {
      const f = r.factors;
      return `| ${r.code} | ${r.name} | ${r.industry ?? ""} | ${r.channel} | ${r.decision} | ${fmt(r.screenerScore)} | ${fmt(r.roe)} | ${fmt(r.fcfYield)} | ${fmt(f.penetrationR)} | ${fmt(f.evEbitda)} | ${fmt(f.floorPremium)} | ${fmt(r.tier1Score)} | ${r.vetoReason ?? ""} |`;
    }),
  ].filter((l) => l !== "");
  return `${lines.join("\n")}\n`;
}

export function renderScreenerHtml(input: ScreenerRunOutput): string {
  const rows = input.results
    .slice(0, 50)
    .map((r) => {
      const f = r.factors;
      return `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.industry ?? "")}</td><td>${esc(r.channel)}</td><td>${esc(r.decision)}</td><td>${fmt(r.screenerScore)}</td><td>${fmt(r.roe)}</td><td>${fmt(r.fcfYield)}</td><td>${fmt(f.penetrationR)}</td><td>${fmt(f.evEbitda)}</td><td>${fmt(f.floorPremium)}</td><td>${fmt(r.tier1Score)}</td><td>${esc(r.vetoReason ?? "")}</td></tr>`;
    })
    .join("");
  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><title>Screener Report</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head>",
    "<body>",
    `<h1>Screener Report (${esc(input.market)})</h1>`,
    `<p>mode=${esc(input.mode)} | universe=${input.totalUniverse} | tier1=${input.tier1Count} | passed=${input.passedCount}${input.tier1Only ? " | tier1_only" : ""}</p>`,
    "<table><thead><tr><th>code</th><th>name</th><th>industry</th><th>channel</th><th>decision</th><th>composite</th><th>roe</th><th>fcf_yld</th><th>R</th><th>ev/ebitda</th><th>floor%</th><th>tier1</th><th>veto</th></tr></thead><tbody>",
    rows,
    "</tbody></table></body></html>",
  ].join("");
}

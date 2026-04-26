import type { ValuationComputed, ValuationMethodResult } from "@trade-signal/schema-core";

function isValuationComputedShape(v: unknown): v is ValuationComputed {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.code === "string" && Array.isArray(o.methods);
}

function fmtNum(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 2 : abs >= 10 ? 2 : 4;
  return n.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function fmtPctMaybe(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${fmtNum(n)}%`;
}

function companyTypeZh(t: ValuationComputed["companyType"]): string {
  if (t === "blue_chip_value") return "蓝筹价值";
  if (t === "growth") return "成长";
  if (t === "hybrid") return "混合";
  return t ?? "—";
}

function assumptionsCell(a: ValuationMethodResult["assumptions"]): string {
  if (!a || Object.keys(a).length === 0) return "—";
  return Object.entries(a)
    .map(([k, v]) => `${k}=${typeof v === "number" ? fmtNum(v) : String(v)}`)
    .join("；");
}

function methodRow(m: ValuationMethodResult): string {
  const hasValue = m.value !== undefined && m.value !== null && Number.isFinite(m.value);
  const r = m.range;
  const rangeCell =
    r && (r.conservative !== undefined || r.central !== undefined || r.optimistic !== undefined)
      ? `${fmtNum(r.conservative)} / ${fmtNum(r.central)} / ${fmtNum(r.optimistic)}`
      : "—";
  const valCell = hasValue ? fmtNum(m.value) : "—";
  const noteCell = m.note?.trim() || "—";
  const assumptions = assumptionsCell(m.assumptions);
  return `| ${m.method} | ${valCell} | ${rangeCell} | ${noteCell} | ${assumptions} |`;
}

/**
 * 将 `valuation_computed.json` 渲染为可读 Markdown（与研报站 emit 逻辑一致）。
 */
export function renderValuationComputedMarkdownFromJson(rawJson: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return ["## 估值数据（解析失败）", "", "```text", rawJson.trim(), "```"].join("\n");
  }
  if (!isValuationComputedShape(parsed)) {
    return ["## 估值数据（结构异常）", "", "```json", JSON.stringify(parsed, null, 2), "```"].join("\n");
  }
  const v = parsed;
  const lines: string[] = [
    "## 估值结果（valuation_computed）",
    "",
    "| 字段 | 内容 |",
    "|:-----|:-----|",
    `| 标的代码 | ${v.code} |`,
    `| 生成时间 | ${v.generatedAt} |`,
    `| 公司画像 | ${companyTypeZh(v.companyType)} |`,
    `| WACC | ${v.wacc !== undefined ? fmtPctMaybe(v.wacc) : "—"} |`,
    `| Ke | ${v.ke !== undefined ? fmtPctMaybe(v.ke) : "—"} |`,
    "",
    "### 分方法估值",
    "",
    "| 方法 | 估值 | 区间（保守 / 中枢 / 乐观） | 说明 | 关键假设 |",
    "|:-----|-----:|:-----------------------------|:-----|:---------|",
    ...v.methods.map(methodRow),
    "",
  ];

  const cv = v.crossValidation;
  if (cv) {
    lines.push("### 交叉验证", "", "| 字段 | 数值 |", "|:-----|:-----|");
    lines.push(`| 加权平均 | ${fmtNum(cv.weightedAverage)} |`);
    lines.push(`| 变异系数（CV） | ${fmtNum(cv.coefficientOfVariation)} |`);
    lines.push(`| 一致性 | ${cv.consistency ?? "—"} |`);
    if (cv.activeWeights && Object.keys(cv.activeWeights).length > 0) {
      const w = Object.entries(cv.activeWeights)
        .map(([k, n]) => `${k}=${fmtNum(n)}`)
        .join("；");
      lines.push(`| 活跃权重 | ${w} |`);
    }
    const rr = cv.range;
    if (rr && (rr.conservative !== undefined || rr.central !== undefined || rr.optimistic !== undefined)) {
      lines.push(`| 合成区间 | ${fmtNum(rr.conservative)} / ${fmtNum(rr.central)} / ${fmtNum(rr.optimistic)} |`);
    }
    lines.push("");
  }

  const ie = v.impliedExpectations;
  const impliedPctKey =
    /^(wacc|ke|modelWacc|modelKe|rf|erp|kdPre|taxRate|fcfYield|gTerminal|gTerminalDefault|historicalProfitCagr)$/i;

  if (ie && Object.keys(ie).length > 0) {
    lines.push("### 隐含预期与模型参数", "", "| 参数 | 数值 |", "|:-----|:-----|");
    for (const [k, val] of Object.entries(ie)) {
      const cell =
        typeof val === "number"
          ? impliedPctKey.test(k)
            ? fmtPctMaybe(val)
            : fmtNum(val)
          : val === null || val === undefined
            ? "—"
            : String(val);
      lines.push(`| ${k} | ${cell} |`);
    }
    lines.push("");
  }

  lines.push(
    "> **说明**：上表由本次 run 的结构化估值结果生成；站点正文以表格为准，原始 JSON 仅作为发布链路的内部证据文件。",
    "",
  );

  return lines.join("\n");
}

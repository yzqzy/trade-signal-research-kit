import type { AnalysisReport } from "@trade-signal/schema-core";

import { parseDataPackMarket } from "./market-pack-parser.js";
import { parseDataPackReport } from "./report-pack-parser.js";
import { runPhase3ValuationEngine } from "./valuation-engine.js";
import { runFactor1A, runFactor1B } from "./factors/factor1.js";
import { runFactor2 } from "./factors/factor2.js";
import { runFactor3 } from "./factors/factor3.js";
import { runFactor4 } from "./factors/factor4.js";
import { applyInterimNormalization } from "./factors/step15-normalize.js";
import type {
  Confidence,
  Phase3Decision,
  Phase3ExecutionResult,
  Phase3Context,
} from "./types.js";

export interface RunPhase3StrictInput {
  marketMarkdown: string;
  reportMarkdown?: string;
  interimReportMarkdown?: string;
}

function appendCheckpoint(ctx: Phase3Context, text: string): void {
  ctx.checkpoints.push(text);
}

function validateCriticalData(ctx: Phase3Context): void {
  const latest = ctx.marketPack.financials[0];
  if (!latest) throw new Error("Step1 failed: 无财务年度数据");
  if (latest.netProfit === undefined || latest.ocf === undefined || latest.capex === undefined) {
    throw new Error("Step1 failed: 关键字段缺失（净利润/OCF/Capex）");
  }
}

function decisionFromFactor4(position: string, passed: boolean): Phase3Decision {
  if (!passed || position === "排除") return "avoid";
  if (position.includes("标准")) return "buy";
  return "watch";
}

function confidenceFromContext(ctx: Phase3Context, trust?: "high" | "medium" | "low"): Confidence {
  const highWarnings = ctx.marketPack.warnings.filter((w) => w.level === "high").length;
  const dataComplete = Boolean(ctx.marketPack.financials[0]?.netProfit !== undefined && ctx.marketPack.financials[0]?.ocf !== undefined);
  const a = dataComplete ? "high" : "low";
  const b = trust ?? "medium";
  const c: Confidence = highWarnings >= 2 ? "low" : highWarnings === 1 ? "medium" : "high";
  const votes = [a, b, c];
  const lows = votes.filter((v) => v === "low").length;
  const highs = votes.filter((v) => v === "high").length;
  if (lows >= 2) return "low";
  if (highs >= 2) return "high";
  return "medium";
}

function buildRejectReport(code: string, reason: string, checkpoints: string[]): AnalysisReport {
  return {
    meta: {
      code,
      schemaVersion: "v0.1-alpha",
      dataSource: "phase3-strict",
      generatedAt: new Date().toISOString(),
      capabilityFlags: [],
    },
    title: `龟龟投资策略 · 选股分析报告：${code}`,
    decision: "avoid",
    confidence: "medium",
    sections: [
      { heading: "执行中断（否决门触发）", content: reason },
      { heading: "Checkpoint", content: checkpoints.join("\n\n") || "(无)" },
    ],
  };
}

export function runPhase3Strict(input: RunPhase3StrictInput): Phase3ExecutionResult {
  const ctx: Phase3Context = {
    marketPack: parseDataPackMarket(input.marketMarkdown),
    reportPack: parseDataPackReport(input.reportMarkdown),
    interimReportPack: parseDataPackReport(input.interimReportMarkdown),
    checkpoints: [],
  };

  // Step1: read and validate
  validateCriticalData(ctx);
  appendCheckpoint(ctx, "Step1: 已完成 data_pack 读取与关键字段校验。");

  // Step1.5
  const normNotes = applyInterimNormalization(ctx.marketPack);
  if (normNotes.length > 0) appendCheckpoint(ctx, `Step1.5: ${normNotes.join(" ")}`);

  // Factor1A
  const f1a = runFactor1A(ctx.marketPack);
  appendCheckpoint(ctx, `因子1A: ${f1a.passed ? "通过" : f1a.reason}`);
  if (!f1a.passed) {
    const report = buildRejectReport(ctx.marketPack.code, f1a.reason ?? "因子1A否决", ctx.checkpoints);
    return {
      valuation: {
        code: ctx.marketPack.code,
        generatedAt: new Date().toISOString(),
        methods: [],
      },
      report,
      decision: "avoid",
      confidence: "medium",
      factor1A: f1a,
      methods: [],
    };
  }

  // Factor1B
  const f1b = runFactor1B(ctx.marketPack, ctx.reportPack);
  appendCheckpoint(ctx, `因子1B: ${f1b.passed ? "通过" : f1b.reason}`);
  if (!f1b.passed) {
    const report = buildRejectReport(ctx.marketPack.code, f1b.reason ?? "因子1B否决", ctx.checkpoints);
    return {
      valuation: {
        code: ctx.marketPack.code,
        generatedAt: new Date().toISOString(),
        methods: [],
      },
      report,
      decision: "avoid",
      confidence: "medium",
      factor1A: f1a,
      factor1B: f1b,
      methods: [],
    };
  }

  // Factor2
  const f2 = runFactor2(ctx.marketPack, f1b);
  appendCheckpoint(ctx, `因子2: ${f2.passed ? "通过" : f2.reason}`);
  if (!f2.passed) {
    const report = buildRejectReport(ctx.marketPack.code, f2.reason ?? "因子2否决", ctx.checkpoints);
    return {
      valuation: {
        code: ctx.marketPack.code,
        generatedAt: new Date().toISOString(),
        methods: [],
      },
      report,
      decision: "avoid",
      confidence: "medium",
      factor1A: f1a,
      factor1B: f1b,
      factor2: f2,
      methods: [],
    };
  }

  // Factor3
  const f3 = runFactor3(ctx.marketPack, f1b, f2);
  appendCheckpoint(ctx, `因子3: ${f3.passed ? "通过" : f3.reason}`);
  if (!f3.passed) {
    const report = buildRejectReport(ctx.marketPack.code, f3.reason ?? "因子3否决", ctx.checkpoints);
    return {
      valuation: {
        code: ctx.marketPack.code,
        generatedAt: new Date().toISOString(),
        methods: [],
      },
      report,
      decision: "avoid",
      confidence: "medium",
      factor1A: f1a,
      factor1B: f1b,
      factor2: f2,
      factor3: f3,
      methods: [],
    };
  }

  // Factor4
  const f4 = runFactor4(ctx.marketPack, f3);
  appendCheckpoint(ctx, `因子4: ${f4.passed ? "通过" : f4.reason}`);

  const valuation = runPhase3ValuationEngine({
    code: ctx.marketPack.code,
    name: ctx.marketPack.name,
    market: "CN_A",
    currency: "CNY",
    price: ctx.marketPack.price,
    marketCap: ctx.marketPack.marketCap,
    totalShares: ctx.marketPack.totalShares,
    riskFreeRate: ctx.marketPack.rf,
    financials: ctx.marketPack.financials.map((f) => ({
      year: f.year,
      revenue: f.revenue,
      netProfit: f.netProfit,
      operatingCashFlow: f.ocf,
      capex: f.capex,
      basicEps: f.basicEps,
      dividendPerShare: f.dps,
      minorityPnL: f.minorityPnL,
    })),
  });

  const decision = decisionFromFactor4(f4.position, f4.passed);
  const confidence = confidenceFromContext(ctx, f3.extrapolationTrust);
  const report: AnalysisReport = {
    meta: {
      code: ctx.marketPack.code,
      schemaVersion: "v0.1-alpha",
      dataSource: "phase3-strict",
      generatedAt: new Date().toISOString(),
      capabilityFlags: [],
    },
    title: `龟龟投资策略 · 选股分析报告：${ctx.marketPack.name ?? ctx.marketPack.code}（${ctx.marketPack.code}）`,
    decision,
    confidence,
    sections: [
      { heading: "Checkpoints", content: ctx.checkpoints.join("\n\n") },
    ],
  };

  return {
    valuation,
    report,
    decision,
    confidence,
    factor1A: f1a,
    factor1B: f1b,
    factor2: f2,
    factor3: f3,
    factor4: f4,
    methods: valuation.methods,
  };
}

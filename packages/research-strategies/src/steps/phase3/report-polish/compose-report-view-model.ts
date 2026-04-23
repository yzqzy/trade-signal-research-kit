import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ValuationComputed } from "@trade-signal/schema-core";

import { parseDataPackMarket } from "../market-pack-parser.js";
import type { Phase3ExecutionResult } from "../types.js";
import type {
  ReportPolishComposeResult,
  ReportViewModelTodoV1,
  ReportViewModelV1,
} from "./report-view-model.js";

function rel(outputDir: string, filePath: string): string {
  const r = path.relative(outputDir, filePath);
  return r && !r.startsWith("..") ? r : path.basename(filePath);
}

function pickPdfGate(md: string): "OK" | "DEGRADED" | "CRITICAL" | undefined {
  const m = md.match(/gateVerdict[^`]*`([A-Z_]+)`/);
  const v = m?.[1];
  if (v === "OK" || v === "DEGRADED" || v === "CRITICAL") return v;
  return undefined;
}

function firstMeaningfulLine(md: string): string | undefined {
  for (const line of md.split(/\r?\n/u)) {
    const t = line.trim();
    if (t && !t.startsWith("<!--")) return t.slice(0, 200);
  }
  return undefined;
}

function isValuationComputed(v: unknown): v is ValuationComputed {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.code === "string" && Array.isArray(o.methods);
}

function summarizeValuation(raw: string): {
  summary: ReportViewModelV1["valuation"];
  todos: ReportViewModelTodoV1[];
} {
  const todos: ReportViewModelTodoV1[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    todos.push({
      id: "valuation-json-parse",
      message: "TODO：`valuation_computed.json` 解析失败，无法写入估值摘要字段。",
      suggestedSource: "valuation_computed.json",
    });
    return {
      summary: { code: "—", methodCount: 0 },
      todos,
    };
  }
  if (!isValuationComputed(parsed)) {
    todos.push({
      id: "valuation-json-shape",
      message: "TODO：`valuation_computed.json` 结构异常（缺少 code/methods）。",
      suggestedSource: "valuation_computed.json",
    });
    return {
      summary: { code: "—", methodCount: 0 },
      todos,
    };
  }
  const cv = parsed.crossValidation;
  return {
    summary: {
      code: parsed.code,
      generatedAt: parsed.generatedAt,
      companyType: parsed.companyType,
      wacc: parsed.wacc,
      ke: parsed.ke,
      methodCount: parsed.methods.length,
      weightedAverage: cv?.weightedAverage,
      coefficientOfVariation: cv?.coefficientOfVariation,
      consistency: cv?.consistency,
    },
    todos,
  };
}

function readPhase1aSummary(raw: string): ReportViewModelV1["phase1a"] {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const inst = j.instrument as Record<string, unknown> | undefined;
    if (!inst) return { notes: ["TODO：phase1a_data_pack.json 缺少 instrument 节点。"] };
    return {
      instrument: {
        code: typeof inst.code === "string" ? inst.code : undefined,
        name: typeof inst.name === "string" ? inst.name : undefined,
        market: typeof inst.market === "string" ? inst.market : undefined,
        currency: typeof inst.currency === "string" ? inst.currency : undefined,
      },
    };
  } catch {
    return { notes: ["TODO：phase1a_data_pack.json 非合法 JSON。"] };
  }
}

export type ComposeReportViewModelInput = {
  outputDir: string;
  runId?: string;
  normalizedCode: string;
  displayCompanyName?: string;
  phase1aJsonPath: string;
  marketPackPath: string;
  marketPackMarkdown: string;
  phase1bMarkdownPath: string;
  phase2bMarkdownPath?: string;
  phase2bInterimMarkdownPath?: string;
  valuationPath: string;
  reportMarkdownPath: string;
  phase3PreflightPath?: string;
  phase3Execution: Phase3ExecutionResult;
};

/**
 * 从磁盘与同进程 Phase3 结果组装 `ReportViewModelV1` 与渲染用全文缓冲。
 */
export async function composeReportViewModel(input: ComposeReportViewModelInput): Promise<ReportPolishComposeResult> {
  const outputDir = input.outputDir;
  const todos: ReportViewModelTodoV1[] = [];

  const phase1aRaw = await readFile(input.phase1aJsonPath, "utf-8");
  const phase1a = readPhase1aSummary(phase1aRaw);

  const parsedMarket = parseDataPackMarket(input.marketPackMarkdown);
  const market = {
    code: parsedMarket.code,
    name: parsedMarket.name,
    market: parsedMarket.market,
    currency: parsedMarket.currency,
    price: parsedMarket.price,
    marketCap: parsedMarket.marketCap,
    totalShares: parsedMarket.totalShares,
    riskFreeRate: parsedMarket.rf,
    warningsCount: parsedMarket.warnings?.length ?? 0,
  };

  const phase1bMarkdown = await readFile(input.phase1bMarkdownPath, "utf-8");
  const phase1bMeta = {
    present: phase1bMarkdown.trim().length > 0,
    charCount: phase1bMarkdown.length,
    leadLine: firstMeaningfulLine(phase1bMarkdown),
  };
  if (!phase1bMeta.present) {
    todos.push({
      id: "phase1b-empty",
      message: "TODO：Phase1B 稿件为空，商业质量页仅能降级展示。",
      suggestedSource: "phase1b_qualitative.md",
    });
  }

  let dataPackReportMarkdown = "";
  if (input.phase2bMarkdownPath) {
    try {
      dataPackReportMarkdown = await readFile(input.phase2bMarkdownPath, "utf-8");
    } catch {
      todos.push({
        id: "data-pack-report-read",
        message: "TODO：无法读取 `data_pack_report.md`（年报证据包）。",
        suggestedSource: rel(outputDir, input.phase2bMarkdownPath),
      });
    }
  } else {
    todos.push({
      id: "data-pack-report-missing",
      message: "TODO：本 run 未挂载 `data_pack_report.md`（phase2bMarkdownPath）。",
      suggestedSource: "data_pack_report.md",
    });
  }

  const dataPackReport = {
    present: dataPackReportMarkdown.trim().length > 0,
    pdfGateVerdict: dataPackReportMarkdown ? pickPdfGate(dataPackReportMarkdown) : undefined,
    charCount: dataPackReportMarkdown.length,
  };

  let interimMd = "";
  if (input.phase2bInterimMarkdownPath) {
    try {
      interimMd = await readFile(input.phase2bInterimMarkdownPath, "utf-8");
    } catch {
      /* optional */
    }
  }

  const valuationRawJson = await readFile(input.valuationPath, "utf-8");
  const { summary: valuation, todos: valTodos } = summarizeValuation(valuationRawJson);
  todos.push(...valTodos);

  const analysisReportMarkdown = await readFile(input.reportMarkdownPath, "utf-8");
  const exec = input.phase3Execution;
  const report = exec.report;

  const phase3: ReportViewModelV1["phase3"] = {
    decision: exec.decision,
    confidence: exec.confidence,
    reportMode: exec.reportMode,
    reportTitle: report.title,
    factor2: exec.factor2
      ? {
          passed: exec.factor2.passed,
          R: exec.factor2.R,
          II: exec.factor2.II,
          rejectType: exec.factor2.rejectType,
          reason: exec.factor2.reason,
        }
      : undefined,
    factor3: exec.factor3
      ? {
          passed: exec.factor3.passed,
          GG: exec.factor3.GG,
          HH: exec.factor3.HH,
          extrapolationTrust: exec.factor3.extrapolationTrust,
          reason: exec.factor3.reason,
        }
      : undefined,
    factor4: exec.factor4
      ? {
          passed: exec.factor4.passed,
          trapRisk: exec.factor4.trapRisk,
          position: exec.factor4.position,
        }
      : undefined,
  };

  if (!dataPackReport.present) {
    todos.push({
      id: "narrative-data-pack",
      message: "TODO：缺少年报 `data_pack_report.md` 时，叙事层不得编造章节置信；请在 Phase2B 后重跑。",
      suggestedSource: "data_pack_report.md",
    });
  }

  const evidence: ReportViewModelV1["evidence"] = {
    phase1aJsonRelative: rel(outputDir, input.phase1aJsonPath),
    dataPackMarketMdRelative: rel(outputDir, input.marketPackPath),
    phase1bQualitativeMdRelative: rel(outputDir, input.phase1bMarkdownPath),
    dataPackReportMdRelative: input.phase2bMarkdownPath ? rel(outputDir, input.phase2bMarkdownPath) : undefined,
    dataPackReportInterimMdRelative: input.phase2bInterimMarkdownPath
      ? rel(outputDir, input.phase2bInterimMarkdownPath)
      : undefined,
    valuationComputedJsonRelative: rel(outputDir, input.valuationPath),
    analysisReportMdRelative: rel(outputDir, input.reportMarkdownPath),
    phase3PreflightMdRelative: input.phase3PreflightPath ? rel(outputDir, input.phase3PreflightPath) : undefined,
  };

  const viewModel: ReportViewModelV1 = {
    schema: "report_view_model",
    version: "1.0",
    generatedAt: new Date().toISOString(),
    runId: input.runId,
    normalizedCode: input.normalizedCode,
    displayCompanyName: input.displayCompanyName ?? phase1a.instrument?.name ?? parsedMarket.name,
    evidence,
    phase1a,
    market,
    dataPackReport,
    phase1b: phase1bMeta,
    phase3,
    valuation,
    todos,
  };

  return {
    viewModel,
    buffers: {
      phase1bMarkdown,
      dataPackReportMarkdown,
      interimDataPackMarkdown: interimMd,
      marketPackMarkdown: input.marketPackMarkdown,
      analysisReportMarkdown,
      valuationRawJson,
    },
  };
}

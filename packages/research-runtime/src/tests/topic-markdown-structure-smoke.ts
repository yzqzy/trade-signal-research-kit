#!/usr/bin/env node
import assert from "node:assert/strict";

import { validateFinalNarrativeMarkdown } from "../runtime/business-analysis/final-narrative-status.js";
import { renderAllReportPolishMarkdowns } from "../steps/phase3/report-polish/render-report-polish-markdown.js";
import type {
  ReportPolishComposeBuffers,
  ReportViewModelV1,
} from "../steps/phase3/report-polish/report-view-model.js";

function sampleVm(): ReportViewModelV1 {
  return {
    schema: "report_view_model",
    version: "1.0",
    generatedAt: "2026-04-25T00:00:00.000Z",
    runId: "r1",
    normalizedCode: "600887",
    displayCompanyName: "测试公司",
    evidence: {
      phase1aJsonRelative: "phase1a_data_pack.json",
      dataPackMarketMdRelative: "data_pack_market.md",
      phase1bQualitativeMdRelative: "phase1b_qualitative.md",
      dataPackReportMdRelative: "data_pack_report.md",
      valuationComputedJsonRelative: "valuation_computed.json",
      analysisReportMdRelative: "analysis_report.md",
      phase3PreflightMdRelative: "phase3_preflight.md",
    },
    phase1a: { instrument: { code: "600887", name: "测试公司", market: "CN_A", currency: "CNY" } },
    market: {
      code: "600887",
      name: "测试公司",
      market: "CN_A",
      currency: "CNY",
      price: 20,
      marketCap: 1000,
      totalShares: 50,
      riskFreeRate: 2,
      warningsCount: 1,
    },
    dataPackReport: { present: true, pdfGateVerdict: "DEGRADED", charCount: 1000 },
    phase1b: { present: true, charCount: 1000, leadLine: "# Phase1B" },
    phase3: {
      decision: "buy",
      confidence: "high",
      reportMode: "full",
      reportTitle: "测试",
      factor2: { passed: true, R: 8, II: 4, reason: "ok" },
      factor3: { passed: true, GG: 6, extrapolationTrust: "medium" },
      factor4: { passed: true, trapRisk: "low", position: "标准仓位" },
    },
    valuation: {
      code: "600887",
      generatedAt: "2026-04-25T00:00:00.000Z",
      companyType: "blue_chip_value",
      wacc: 7,
      ke: 8,
      methodCount: 1,
      weightedAverage: 30,
      coefficientOfVariation: 10,
      consistency: "medium",
    },
    policyResult: {
      policyId: "policy:turtle",
      runId: "r1",
      code: "600887",
      payload: { decision: "buy" },
      reasonRefs: [{ kind: "file", ref: "analysis_report.md" }],
    },
    topicReports: [
      {
        topicId: "topic:business-six-dimension",
        runId: "r1",
        code: "600887",
        siteTopicType: "business-quality",
        markdownPath: "business_quality.md",
        qualityStatus: "degraded",
        blockingReasons: ["草稿"],
        evidenceRefs: [{ kind: "file", ref: "data_pack_report.md" }],
      },
    ],
    todos: [],
  };
}

function sampleBuffers(): ReportPolishComposeBuffers {
  return {
    phase1bMarkdown: "## 7. 管理层与治理\n无裸链接正文\n## 8. 行业与竞争\n未搜索到相关信息\n## 10. MD&A 摘要",
    dataPackReportMarkdown: "gateVerdict `DEGRADED`\n## MDA 管理层讨论与分析\n摘录",
    interimDataPackMarkdown: "",
    marketPackMarkdown: "# 测试公司（600887）\n\n## §13 Warnings\n- ok",
    analysisReportMarkdown: "## 四、因子2\nR ok\n## 五、因子3\nGG ok\n## 六、因子4",
    valuationRawJson: JSON.stringify({
      code: "600887",
      generatedAt: "2026-04-25T00:00:00.000Z",
      methods: [{ method: "DCF", fairValue: 30, weight: 1 }],
    }),
  };
}

function assertTopicStructures(): void {
  const rendered = renderAllReportPolishMarkdowns(sampleVm(), sampleBuffers());
  assert.match(rendered.turtleOverviewMarkdown, /## Turtle KPI Snapshot/);
  assert.match(rendered.turtleOverviewMarkdown, /## 投资论点卡（Thesis Card）/);
  assert.match(rendered.businessQualityMarkdown, /## 维度一：商业模式与资本特征/);
  assert.match(rendered.businessQualityMarkdown, /## 监管与合规要点/);
  assert.doesNotMatch(rendered.businessQualityMarkdown, /https?:\/\//);
  assert.match(rendered.penetrationReturnMarkdown, /## STEP 0 数据校验与口径锚定/);
  assert.match(rendered.penetrationReturnMarkdown, /## STEP 11 交叉验证与可信度评级/);
  assert.match(rendered.valuationMarkdown, /## 六、反向估值：当前价格隐含了什么？/);
  assert.match(rendered.valuationMarkdown, /## 八、关键假设与风险提示/);
}

function assertFinalNarrativeValidation(): void {
  const completeReport = [
    "[终稿状态: 完成]",
    "> PDF 抽取质量声明：gate=DEGRADED，涉及年报章节均降级引用。",
    "## 监管与合规要点",
    "审计意见正常。[E1]",
    "## 附录：证据索引",
    "| 证据ID | 类型 | 摘要 | 链接或定位 |",
  ].join("\n\n");
  const d1d6 = [
    "[终稿状态: 完成]",
    "> PDF 抽取质量声明：gate=DEGRADED。",
    ...["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => `## ${d} 测试\n核心判断。[E1]\n证据链条。[E1]\n结论。`),
    "## 附录：证据索引",
    "| 证据ID | 类型 | 摘要 | 链接或定位 |",
  ].join("\n\n");
  assert.equal(
    validateFinalNarrativeMarkdown({
      qualitativeReportMarkdown: completeReport,
      qualitativeD1D6Markdown: d1d6,
      dataPackReportMarkdown: "gateVerdict `DEGRADED`",
    }).status,
    "complete",
  );
  assert.equal(
    validateFinalNarrativeMarkdown({
      qualitativeReportMarkdown: completeReport.replace("## 附录：证据索引", "https://example.com\n## 附录：证据索引"),
      qualitativeD1D6Markdown: d1d6,
      dataPackReportMarkdown: "gateVerdict `DEGRADED`",
    }).status,
    "draft",
  );
  assert.equal(
    validateFinalNarrativeMarkdown({
      qualitativeReportMarkdown: completeReport,
      qualitativeD1D6Markdown: d1d6,
      dataPackReportMarkdown: "gateVerdict `CRITICAL`",
    }).status,
    "blocked",
  );
}

assertTopicStructures();
assertFinalNarrativeValidation();
console.log("[test:topic-markdown-structure] ok");

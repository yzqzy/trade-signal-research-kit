#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateFinalNarrativeMarkdown } from "../runtime/business-analysis/final-narrative-status.js";
import { PHASE1B_WEB_SEARCH_ITEMS } from "../adapters/websearch/query-templates.js";
import {
  emitSiteReportsFromRun,
  findPublishedMarkdownQualityViolations,
  rebuildSiteReportsIndex,
} from "../reports-site/emit-site-reports.js";
import { renderPublicEvidencePackContent } from "../reports-site/public-evidence-pack-renderer.js";
import { filterPhase1BHighSensitivityEvidencesForTest } from "../steps/phase1b/collector.js";
import { renderPhase1BMarkdown } from "../steps/phase1b/renderer.js";
import { renderQualitativeD1D6Scaffold } from "../runtime/business-analysis/d1-d6-scaffold.js";
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
    phase1b: { present: true, charCount: 1000, leadLine: "# 外部证据" },
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
  const allMarkdown = Object.values(rendered).join("\n\n");
  assert.deepEqual(findPublishedMarkdownQualityViolations(allMarkdown), []);
  for (const forbidden of [
    "机械锚点",
    "候选片段",
    "供六维成稿引用",
    "站点只展示",
    "完整发布依据",
    "审计用",
    "缺口与 TODO",
    "本 run 无显式 TODO",
    "valuation_computed.json 为准",
    "估值结果（valuation_computed）",
    "原始 JSON",
    "发布链路",
    "F10 主链路",
    "结构化接口",
    "Position Recommendation",
    "Topic 质量标准",
    "结构化证据",
    "同一次分析",
    "不跨行业硬套指标",
    "治理风险进入折价而非口号",
    "行业 profile 决定",
    "gateVerdict",
    "PDF gate",
    "gate=OK",
    "本报告可完成终稿",
    "结论应表述为",
    "终稿置信度",
    "本 run",
    "Phase1B",
  ]) {
    assert.doesNotMatch(allMarkdown, new RegExp(forbidden, "u"));
  }
  assert.match(rendered.turtleOverviewMarkdown, /## Turtle KPI Snapshot/);
  assert.match(rendered.turtleOverviewMarkdown, /## 投资论点卡（Thesis Card）/);
  assert.match(rendered.turtleOverviewMarkdown, /现有材料未形成稳定股东回报证据|现有材料未形成可发布摘要/u);
  assert.match(rendered.businessQualityMarkdown, /## 维度一：商业模式与资本特征/);
  assert.match(rendered.businessQualityMarkdown, /## 监管与合规要点/);
  assert.doesNotMatch(rendered.businessQualityMarkdown, /https?:\/\//);
  assert.match(rendered.penetrationReturnMarkdown, /## STEP 0 数据校验与口径锚定/);
  assert.match(rendered.penetrationReturnMarkdown, /## STEP 11 交叉验证与可信度评级/);
  assert.match(rendered.penetrationReturnMarkdown, /## 附录：计算底稿摘要/);
  assert.doesNotMatch(rendered.penetrationReturnMarkdown, /结论：通过|通过门槛/);
  assert.match(rendered.valuationMarkdown, /## 五、DCF 敏感性矩阵/);
  assert.match(rendered.valuationMarkdown, /## 七、PE Band 历史分位区间/);
  assert.match(rendered.valuationMarkdown, /## 八、DDM \/ PEG 适用性说明/);
  assert.match(rendered.valuationMarkdown, /## 附录：结构化估值明细/);
  assert.ok(rendered.valuationMarkdown.indexOf("## 附录：结构化估值明细") > rendered.valuationMarkdown.indexOf("## 十一、估值结论"));
  assert.match(rendered.valuationMarkdown, /## 十、反向估值：当前价格隐含了什么？/);
  assert.match(rendered.valuationMarkdown, /## 十二、关键假设与风险提示/);
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
  assert.equal(
    validateFinalNarrativeMarkdown({
      qualitativeReportMarkdown: completeReport.replace(
        "审计意见正常。[E1]",
        "测试公司 的商业质量终稿基于年报包、市场包和 外部证据完成。当前证据显示，公司处于 白色家电 相关行业，周期位置为 middle，行业周期判断置信度为 medium；因此商业质量不能只看单期利润或榜单排名。[E1]",
      ),
      qualitativeD1D6Markdown: d1d6,
      dataPackReportMarkdown: "gateVerdict `DEGRADED`",
    }).status,
    "draft",
  );
  assert.equal(
    validateFinalNarrativeMarkdown({
      qualitativeReportMarkdown: completeReport,
      qualitativeD1D6Markdown: [
        "[终稿状态: 完成]",
        "> PDF 抽取质量声明：gate=DEGRADED。",
        ...["D1", "D2", "D3", "D4", "D5", "D6"].map(
          (d) =>
            `## ${d} 测试\n\n**证据链条**：市场包提供行业和同业上下文，年报包提供经营与财务原始披露，Phase1B 提供治理、行业与 MD&A 补充；本维结论以 [E1] 交叉验证。\n\n| 指标 | 为何重要 | 当前读法 | 来源 |\n|:--|:--|:--|:--|\n| 指标A | 验证本维判断是否持续 | 当前仅按证据包建立方向性跟踪，不扩大为确定预测 | [E1] |\n\n**结论**：测试公司 在本维已有可审计证据基础，但仍需后续季报、公告和行业数据复核；若新增证据与当前证据冲突，应优先调整结论强度。[E1]`,
        ),
        "## 附录：证据索引",
        "| 证据ID | 类型 | 摘要 | 链接或定位 |",
      ].join("\n\n"),
      dataPackReportMarkdown: "gateVerdict `DEGRADED`",
    }).status,
    "draft",
  );
}

async function assertPublishedQualityGate(): Promise<void> {
  assert.deepEqual(findPublishedMarkdownQualityViolations("## qualitative_report.md\n\n正文"), ["文件名包装标题"]);
  assert.deepEqual(findPublishedMarkdownQualityViolations("本页是草稿，待 Claude Code 收口。"), [
    "内部状态词：草稿",
    "内部状态词：待 Claude",
  ]);
  assert.deepEqual(findPublishedMarkdownQualityViolations("估值页以 valuation_computed.json 为准，是机械锚点。"), [
    "内部流程词：机械锚点",
    "内部流程词：valuation_computed.json 为准",
  ]);
  assert.deepEqual(findPublishedMarkdownQualityViolations("本页包含候选片段，供六维成稿引用，站点只展示完整发布依据，审计用。"), [
    "内部流程词：候选片段",
    "内部流程词：供六维成稿引用",
    "内部流程词：站点只展示",
    "内部流程词：完整发布依据",
    "内部流程词：审计用",
  ]);
  assert.deepEqual(findPublishedMarkdownQualityViolations("## 缺口与 TODO\n\n_本 run 无显式 TODO 缺口项。_"), [
    "内部流程词：缺口与 TODO",
    "内部流程词：本 run",
  ]);
  assert.deepEqual(findPublishedMarkdownQualityViolations("## 估值结果（valuation_computed）\n原始 JSON 仅作为发布链路。"), [
    "内部流程词：估值结果 valuation_computed",
    "内部流程词：原始 JSON",
    "内部流程词：发布链路",
  ]);
  assert.deepEqual(
    findPublishedMarkdownQualityViolations(
      "本报告可完成终稿，因为年报抽取 gate=OK，结论应表述为“已确认事件”，而不是提前定性。",
    ),
    [
      "内部流程词：本报告可完成终稿",
      "内部流程词：PDF gate",
      "内部流程词：结论应表述为",
    ],
  );
  assert.deepEqual(findPublishedMarkdownQualityViolations("| 终稿置信度 | high | PDF gate=OK |"), [
    "内部流程词：PDF gate",
    "内部流程词：终稿置信度",
  ]);
  assert.deepEqual(findPublishedMarkdownQualityViolations("gateVerdict=OK，F10 主链路可用，仍需补充结构化接口。"), [
    "内部流程词：F10 主链路",
    "内部流程词：结构化接口",
    "内部流程词：gateVerdict",
  ]);
  assert.deepEqual(findPublishedMarkdownQualityViolations("/Users/heora/project/output/data_pack_report.md"), [
    "本地绝对路径",
  ]);
  assert.deepEqual(
    findPublishedMarkdownQualityViolations(
      "Position Recommendation：观察；观察。数值与判断来自同一次分析的结构化证据，并按 Topic 质量标准发布。",
    ),
    [
      "内部流程词：Position Recommendation",
      "内部流程词：Topic 质量标准",
      "内部流程词：结构化证据",
      "内部流程词：同一次分析",
    ],
  );
  assert.deepEqual(
    findPublishedMarkdownQualityViolations(
      "行业 profile 决定该跟踪哪些 KPI；不跨行业硬套指标；治理风险进入折价而非口号。",
    ),
    [
      "非研报表达：不跨行业硬套指标",
      "非研报表达：治理风险进入折价而非口号",
      "非研报表达：行业 profile 决定",
    ],
  );
}

function assertPublicEvidencePackRenderer(): void {
  const publicMarkdown = renderPublicEvidencePackContent(
    [
      '<!-- PDF_EXTRACT_QUALITY:{"gateVerdict":"DEGRADED"} -->',
      "- **extractQuality.gateVerdict**: `DEGRADED`",
      "Phase1B 本 run /Users/heora/project/output/workflow/600941/run/data_pack_report.md",
    ].join("\n"),
    "markdown",
    {
      normalizeMarkdown: (markdown) =>
        markdown
          .replace(/extractQuality\.gateVerdict/gu, "年报抽取质量")
          .replace(/gateVerdict/gu, "年报抽取质量")
          .replace(/Phase1B/gu, "外部证据")
          .replace(/本 run/gu, "本次证据包"),
      validateContent: findPublishedMarkdownQualityViolations,
    },
  );
  assert.doesNotMatch(publicMarkdown, /gateVerdict|Phase1B|本 run|\/Users\/|output\/workflow/u);
  assert.deepEqual(findPublishedMarkdownQualityViolations(publicMarkdown), []);

  const publicJson = renderPublicEvidencePackContent('{"code":"600941","value":1}', "json", {
    normalizeMarkdown: (markdown) => markdown,
    validateContent: findPublishedMarkdownQualityViolations,
  });
  assert.match(publicJson, /"code": "600941"/);
}

async function assertSiteDedupPrefersComplete(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "reports-dedup-"));
  try {
    const siteDir = path.join(root, "site");
    const entries = path.join(siteDir, "entries");
    const degraded = path.join(entries, "2026-04-25-600887-biz-quality-aaaa1111");
    const complete = path.join(entries, "2026-04-25-600887-biz-quality-bbbb2222");
    await mkdir(degraded, { recursive: true });
    await mkdir(complete, { recursive: true });
    const base = {
      code: "600887",
      topicType: "business-quality",
      displayTitle: "测试公司（600887.SH） · 商业质量评估",
      publishedAt: "2026-04-25T01:00:00.000Z",
      sourceRunId: "r",
      confidenceState: "high",
      contentFile: "content.md",
    };
    await writeFile(
      path.join(degraded, "meta.json"),
      JSON.stringify({ ...base, entryId: path.basename(degraded), requiredFieldsStatus: "degraded" }, null, 2),
      "utf-8",
    );
    await writeFile(path.join(degraded, "content.md"), "# degraded", "utf-8");
    await writeFile(
      path.join(complete, "meta.json"),
      JSON.stringify({ ...base, entryId: path.basename(complete), requiredFieldsStatus: "complete" }, null, 2),
      "utf-8",
    );
    await writeFile(path.join(complete, "content.md"), "# complete", "utf-8");
    await rebuildSiteReportsIndex(siteDir);
    const timeline = JSON.parse(await readFile(path.join(siteDir, "views", "timeline.json"), "utf-8")) as Array<{
      entryId: string;
      requiredFieldsStatus: string;
    }>;
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0]?.entryId, path.basename(complete));
    assert.equal(timeline[0]?.requiredFieldsStatus, "complete");
    await assert.rejects(readFile(path.join(degraded, "meta.json"), "utf-8"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function assertBusinessAnalysisPublishesSingleMarkdown(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "reports-ba-"));
  try {
    const runDir = path.join(root, "run");
    const siteDir = path.join(root, "site");
    await mkdir(runDir, { recursive: true });
    const report = [
      "[终稿状态: 完成]",
      "# 测试公司（600887）· 商业质量评估",
      "> PDF 抽取质量声明：gate=DEGRADED，年报章节降级使用。[E1]",
      "## Executive Summary",
      "核心判断。[E1]",
      "## 关键发现",
      "- 发现一。[E1]",
      "## 监管与合规要点",
      "监管披露完整。[E1]",
      "## 交叉验证与深度分析",
      "数字与叙事一致。[E1]",
      "## 深度总结",
      "质量结论清晰。[E1]",
      "## 未来1-3年关键观察变量",
      "| 变量 | 观察 |",
      "|:--|:--|",
      "| 现金流 | 跟踪 |",
      "## 附录：证据索引",
      "| 证据ID | 类型 | 摘要 | 链接或定位 |",
      "|:--|:--|:--|:--|",
      "| E1 | 年报 | 摘要 | data_pack_report.md |",
    ].join("\n\n");
    const d1d6 = [
      "[终稿状态: 完成]",
      "> PDF 抽取质量声明：gate=DEGRADED。[E1]",
      ...["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => `## ${d} 测试\n\n核心判断。[E1]\n\n证据链条。[E1]\n\n结论。`),
      "## 附录：证据索引",
      "| 证据ID | 类型 | 摘要 | 链接或定位 |",
      "| E1 | 年报 | 摘要 | data_pack_report.md |",
    ].join("\n\n");
    await writeFile(path.join(runDir, "qualitative_report.md"), report, "utf-8");
    await writeFile(path.join(runDir, "qualitative_d1_d6.md"), d1d6, "utf-8");
    await writeFile(
      path.join(runDir, "data_pack_report.md"),
      '<!-- PDF_EXTRACT_QUALITY:{"gateVerdict":"DEGRADED","missingCritical":[],"lowConfidenceCritical":["P13"],"allowsFinalNarrativeComplete":true,"humanReviewPriority":["P13"]} -->\n\n# 年报证据包\n\n主营与现金流摘要。',
      "utf-8",
    );
    await writeFile(path.join(runDir, "data_pack_market.md"), "# 测试公司（600887）\n\n## §18 费用率趋势\n\n费用率摘要。", "utf-8");
    await writeFile(path.join(runDir, "phase1b_qualitative.md"), "# 外部证据\n\n监管补充摘要。", "utf-8");
    await writeFile(
      path.join(runDir, "phase1b_qualitative.json"),
      JSON.stringify(
        {
          stockCode: "600887",
          companyName: "测试公司",
          year: "2024",
          generatedAt: "2026-04-25T02:00:00.000Z",
          channel: "http",
          section7: [
            {
              item: "违规/处罚记录",
              content: "公司收到立案告知书，涉及信息披露违法违规风险。",
              evidences: [
                {
                  title: "关于公司收到立案告知书的公告",
                  url: "https://example.com/reg.pdf",
                  source: "交易所",
                  snippet: "公司涉嫌信息披露违法违规，被证监会立案调查。",
                },
              ],
              retrievalDiagnostics: {
                webSearchUsed: false,
                feedFallbackUsed: true,
                feedEvidenceCount: 1,
                evidenceRetrievalStatus: "feed_hit",
              },
            },
          ],
          section8: [],
          section10: [],
        },
        null,
        2,
      ),
      "utf-8",
    );
    await writeFile(
      path.join(runDir, "business_analysis_manifest.json"),
      JSON.stringify(
        {
          manifestVersion: "1.0",
          generatedAt: "2026-04-25T02:00:00.000Z",
          finalNarrativeStatus: "complete",
          finalNarrativeBlockingReasons: [],
          outputLayout: { code: "600887", runId: "ba-run" },
          input: {
            code: "600887",
            runId: "ba-run",
            companyName: "测试公司",
            reportUrl: "https://static.cninfo.com.cn/finalpage/2026-04-25/mock.PDF",
          },
          outputs: {
            qualitativeReportPath: "qualitative_report.md",
            qualitativeD1D6Path: "qualitative_d1_d6.md",
            marketPackPath: "data_pack_market.md",
            phase1bJsonPath: "phase1b_qualitative.json",
            phase1bMarkdownPath: "phase1b_qualitative.md",
            dataPackReportPath: "data_pack_report.md",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );
    await emitSiteReportsFromRun({ runDir, siteDir });
    const entriesRoot = path.join(siteDir, "entries");
    const entryId = "2026-04-25-600887-biz-quality-barun";
    const content = await readFile(path.join(entriesRoot, entryId, "content.md"), "utf-8");
    const meta = JSON.parse(await readFile(path.join(entriesRoot, entryId, "meta.json"), "utf-8")) as {
      confidenceState: string;
      attachments?: Array<{ id: string; href: string; previewable: boolean }>;
      sourceLinks?: Array<{ id: string; href: string; kind: string }>;
    };
    assert.equal(meta.confidenceState, "medium");
    assert.ok(meta.attachments?.some((a) => a.id === "annual-report-pack" && a.href === "attachments/annual-report-pack.md"));
    assert.ok(meta.attachments?.some((a) => a.id === "market-pack" && a.previewable));
    assert.ok(meta.attachments?.some((a) => a.id === "regulatory-evidence"));
    assert.ok(meta.sourceLinks?.some((s) => s.id === "annual-pdf-official" && s.kind === "pdf"));
    const attachmentNames = ["annual-report-pack.md", "market-pack.md", "regulatory-evidence.md"];
    for (const name of attachmentNames) {
      const attachment = await readFile(path.join(entriesRoot, entryId, "attachments", name), "utf-8");
      assert.doesNotMatch(attachment, /\/Users\/|output\/(?:workflow|business-analysis|site)\//u);
      assert.deepEqual(findPublishedMarkdownQualityViolations(attachment), []);
    }
    assert.doesNotMatch(content, /^##\s+qualitative_report\.md$/imu);
    assert.doesNotMatch(content, /^##\s+qualitative_d1_d6\.md$/imu);
    assert.doesNotMatch(content.slice(0, 300), /PDF 抽取质量声明/);
    assert.doesNotMatch(content, /rate_limit_exceeded|Volc WebSearch API/);
    assert.match(content, /证据质量：年报抽取降级可用，P13 需复核；本文已按较保守口径处理。/);
    assert.match(content, /## 证据质量与限制/);
    assert.match(content, /## 六维深度分析/);
    assert.match(content, /年报证据包 · 可展开\/下载/);
    assert.doesNotMatch(content, /\[(?:E\d+|M:§\d+)\]\[(?:E\d+|M:§\d+)\]/u);
    assert.doesNotMatch(content, /不跨行业硬套指标|治理风险进入折价而非口号|行业 profile 决定/u);
    assert.doesNotMatch(content, /见本页 \[M:§\] 引用/);
    assert.equal((content.match(/^##\s+质量快照\s*$/gmu) ?? []).length, 1);
    assert.match(content, /\| 商业质量 \| 偏弱\/观察 \|/);
    assert.doesNotMatch(content, /\| 商业质量 \| 较强/);
    assert.deepEqual(findPublishedMarkdownQualityViolations(content), []);

    await writeFile(
      path.join(runDir, "qualitative_report.md"),
      report.replace(
        "核心判断。[E1]",
        "测试公司 的商业质量终稿基于年报包、市场包和 外部证据完成。当前证据显示，公司处于 白色家电 相关行业，周期位置为 middle，行业周期判断置信度为 medium；因此商业质量不能只看单期利润或榜单排名。[E1]",
      ),
      "utf-8",
    );
    await emitSiteReportsFromRun({ runDir, siteDir });
    await assert.rejects(readFile(path.join(entriesRoot, entryId, "content.md"), "utf-8"));
    const timeline = JSON.parse(await readFile(path.join(siteDir, "views", "timeline.json"), "utf-8")) as Array<{
      entryId: string;
      topicType: string;
    }>;
    assert.equal(timeline.some((it) => it.entryId === entryId || it.topicType === "business-quality"), false);
    const byTopic = JSON.parse(
      await readFile(path.join(siteDir, "views", "by-topic", "business-quality.json"), "utf-8"),
    ) as unknown[];
    assert.deepEqual(byTopic, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function assertWorkflowTopicsRequireFinalization(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "reports-workflow-final-"));
  try {
    const runDir = path.join(root, "run");
    const siteDir = path.join(root, "site");
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, "data_pack_market.md"), "# 测试公司（600887）\n\n市场证据。", "utf-8");
    await writeFile(path.join(runDir, "analysis_report.md"), "# 策略计算底稿\n\n规则输出。", "utf-8");
    await writeFile(path.join(runDir, "turtle_overview.md"), "# 草稿\n\n结构化龟龟草稿。", "utf-8");
    await writeFile(path.join(runDir, "valuation.md"), "# 草稿\n\n结构化估值草稿。", "utf-8");
    await writeFile(path.join(runDir, "penetration_return.md"), "# 草稿\n\n结构化穿透草稿。", "utf-8");
    await writeFile(path.join(runDir, "business_quality.md"), "# 草稿\n\n结构化商业质量草稿。", "utf-8");
    await writeFile(
      path.join(runDir, "workflow_manifest.json"),
      JSON.stringify(
        {
          manifestVersion: "1.0",
          generatedAt: "2026-04-25T03:00:00.000Z",
          outputLayout: { code: "600887", runId: "wf-run" },
          input: { code: "600887", companyName: "测试公司" },
          outputs: {
            marketPackPath: "data_pack_market.md",
            reportMarkdownPath: "analysis_report.md",
            turtleOverviewMarkdownPath: "turtle_overview.md",
            businessQualityMarkdownPath: "business_quality.md",
            penetrationReturnMarkdownPath: "penetration_return.md",
            valuationMarkdownPath: "valuation.md",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    await emitSiteReportsFromRun({ runDir, siteDir });
    const timeline1 = JSON.parse(await readFile(path.join(siteDir, "views", "timeline.json"), "utf-8")) as unknown[];
    assert.deepEqual(timeline1, []);
    const manifest1 = JSON.parse(await readFile(path.join(runDir, "topic_manifest.json"), "utf-8")) as {
      topics: Array<{ siteTopicType: string; qualityStatus: string; blockingReasons?: string[] }>;
    };
    assert.equal(manifest1.topics.every((t) => t.qualityStatus === "draft" || t.qualityStatus === "degraded"), true);
    assert.ok(manifest1.topics.some((t) => t.siteTopicType === "turtle-strategy" && (t.blockingReasons ?? []).join("\n").includes("缺少 finalized markdown")));

    await mkdir(path.join(runDir, "finalized"), { recursive: true });
    await writeFile(
      path.join(runDir, "finalized", "turtle-strategy.md"),
      [
        "# 测试公司（600887）· 龟龟投资策略分析",
        "## 投资结论",
        "测试公司的龟龟结论并不是简单的规则通过，而是现金转换、估值安全边际与经营纪律共同支撑的观察型机会。",
        "## 触发条件",
        "若未来两个季度经营现金流继续覆盖利润、估值仍低于安全边际，并且收入没有继续恶化，则策略信号可以从观察转向更积极。",
        "## 仓位与纪律",
        "仓位纪律应以组合风险预算为上限，单一标的不因短期排名靠前而突破既定仓位约束。",
        "## 关键指标解释",
        "穿透 R、ROE、FCF 与安全边际需要一起阅读：R 解释长期回报弹性，FCF 解释利润兑现质量，ROE 解释资本效率。",
        "## 反证条件",
        "如果现金流转弱、估值修复只来自情绪扩张，或主营增长继续下滑，当前龟龟判断应降级。",
        "## 跟踪清单",
        "后续重点跟踪现金流覆盖率、费用率、估值折价和分红纪律，任何一项持续恶化都会削弱策略结论。",
      ].join("\n\n"),
      "utf-8",
    );

    await emitSiteReportsFromRun({ runDir, siteDir });
    const timeline2 = JSON.parse(await readFile(path.join(siteDir, "views", "timeline.json"), "utf-8")) as Array<{
      topicType: string;
      entryId: string;
    }>;
    assert.equal(timeline2.length, 1);
    assert.equal(timeline2[0]?.topicType, "turtle-strategy");
    assert.match(await readFile(path.join(siteDir, "entries", timeline2[0]!.entryId, "content.md"), "utf-8"), /投资结论/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function assertPhase1BRetrievalPresentation(): void {
  assert.equal(PHASE1B_WEB_SEARCH_ITEMS.has("违规/处罚记录"), false);
  assert.equal(PHASE1B_WEB_SEARCH_ITEMS.has("行业监管动态"), true);

  const md = renderPhase1BMarkdown({
    stockCode: "600887",
    companyName: "测试公司",
    year: "2024",
    generatedAt: "2026-04-25T02:00:00.000Z",
    channel: "http",
    section7: [
      {
        item: "违规/处罚记录",
        content: "⚠️ 未搜索到相关信息",
        evidences: [],
        retrievalDiagnostics: {
          webSearchUsed: true,
          webSearchProviderId: "volc",
          webSearchFailureReason: "UNKNOWN(rate_limit_exceeded): upstream",
          feedFallbackUsed: true,
          feedEvidenceCount: 0,
          evidenceRetrievalStatus: "web_limited_feed_empty",
        },
      },
    ],
    section8: [],
    section10: [],
  });
  assert.match(md, /官方源与开放信息补充检索均未形成可确认事项/);
  assert.doesNotMatch(md, /回退 Feed|WebSearch 受限/);

  const filtered = filterPhase1BHighSensitivityEvidencesForTest("违规/处罚记录", [
    {
      title: "募集资金专项账户开立及签署资金存储三方监管协议的核查意见",
      url: "https://example.com/a.pdf",
      source: "公告",
    },
    {
      title: "关于收到监管警示函的公告",
      url: "https://example.com/b.pdf",
      source: "交易所",
    },
  ]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.title, "关于收到监管警示函的公告");
}

function assertBusinessModelFeatureSliceInD1(): void {
  const md = renderQualitativeD1D6Scaffold({
    phase1b: {
      stockCode: "600887",
      companyName: "测试公司",
      year: "2024",
      generatedAt: "2026-04-25T02:00:00.000Z",
      channel: "http",
      section7: [],
      section8: [],
      section10: [],
    },
    marketMarkdown: [
      "# 测试公司（600887）",
      "## §3 利润表",
      "营业收入与主营业务摘要。",
      "## §5 现金流量表",
      "经营活动现金流 OCF 与资本开支 Capex 摘要。",
      "## §22 行业关键变量",
      "行业关键变量包括价格与销量。",
    ].join("\n"),
    dataPackReportExcerpt: "主营业务、固定资产、资本开支与收入结构摘录。",
  });
  assert.match(md, /### businessModel FeatureSlice（D1 输入真源）/);
  assert.match(md, /"modelType"/);
  assert.match(md, /"cashConversionProfile"/);
  assert.match(md, /"capexProfile"/);
  assert.match(md, /D1 必须消费下方 `businessModel` FeatureSlice/);
  assert.doesNotMatch(md, /客户需求 \/ 价值主张 \/ 收入模型的可验证描述/);
}

assertTopicStructures();
assertFinalNarrativeValidation();
await assertPublishedQualityGate();
assertPublicEvidencePackRenderer();
await assertSiteDedupPrefersComplete();
await assertBusinessAnalysisPublishesSingleMarkdown();
await assertWorkflowTopicsRequireFinalization();
assertPhase1BRetrievalPresentation();
assertBusinessModelFeatureSliceInD1();
console.log("[test:topic-markdown-structure] ok");

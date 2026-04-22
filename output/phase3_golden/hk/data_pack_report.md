# data_pack_report

<!-- PDF_EXTRACT_QUALITY:{"gateVerdict":"OK","missingCritical":[],"lowConfidenceCritical":[],"sectionsFound":5,"sectionsTotal":7,"allowsFinalNarrativeComplete":true,"humanReviewPriority":[],"pdfTextBackendsUsed":[],"aiVerifierApplied":false,"aiVerifierNote":null} -->

- **reportKind**: `annual`（年度报告契约）
> 语义对齐 Turtle：P2/P3/P4/P6/P13 + **MDA** + SUB（7 章关键块）。

- pdfFile: fixture.pdf
- totalPages: 10
- sectionsFound: 5/7
- annexStartPageEstimate: （未估计）
- extractTime: 2026-04-22T13:23:09.380Z
- **pdfTextBackendsUsed**: —
- **extractQuality.gateVerdict**: `OK`（关键块缺失→**CRITICAL**（编排/终稿硬阻断）；关键块仅低置信→**DEGRADED**（允许在强制 PDF 声明下终稿标「完成」））
- **allowsFinalNarrativeComplete**: `true`

## PDF 抽取缺陷摘要（机器可读）

```json
{
  "gateVerdict": "OK",
  "missingCritical": [],
  "lowConfidenceCritical": [],
  "sectionsFound": 5,
  "sectionsTotal": 7,
  "criticalSectionIds": [
    "MDA",
    "P4",
    "P13"
  ],
  "allowsFinalNarrativeComplete": true,
  "humanReviewPriority": [],
  "pdfTextBackendsUsed": [],
  "aiVerifierApplied": false,
  "aiVerifierNote": null
}
```
## P2 受限资产

> **sourcePageRange**: p.1–p.2；**confidence**: `high`；**warningCodes**: `none`

定位置信度：**high**（页码 1-2）

```text
受限资产摘录
```

## P3 应收账款账龄

> **sourcePageRange**: —；**confidence**: —；**warningCodes**: `SECTION_MISSING`

> ⚠️ [PHASE2B|high] **章节缺失**：Phase2A 未定位到可靠命中，未静默占位正文。

> **可能原因（启发式）**：
> - 附注标题与关键词不一致（如「应收款项融资」「合同资产」分流，或账龄表并入「应收账款及应收票据」组合披露）；
> - 目录页/交叉引用（详见/参见）触发惩罚导致得分偏低；
> - 文本层表格列顺序被打乱，`pdf-parse` 与 `pdfjs-dist` 仍可能无法稳定拼出行。

> **建议人工动作**：在 PDF 内全文检索该章核心词；核对是否为扫描件无文本层；必要时手工摘录表格再并入证据包。

（空缺 — 请检查 PDF 是否含对应附注/章节标题，或启用更清晰的文本层 PDF。）

## P4 关联方交易

> **sourcePageRange**: p.3–p.3；**confidence**: `high`；**warningCodes**: `none`

定位置信度：**high**（页码 3-3）

```text
关联方交易摘录
```

## P6 或有负债

> **sourcePageRange**: —；**confidence**: —；**warningCodes**: `SECTION_MISSING`

> ⚠️ [PHASE2B|high] **章节缺失**：Phase2A 未定位到可靠命中，未静默占位正文。

> **可能原因（启发式）**：
> - 关键词未命中、目录干扰、或章节跨页边界被截断。

> **建议人工动作**：在 PDF 内全文检索该章核心词；核对是否为扫描件无文本层；必要时手工摘录表格再并入证据包。

（空缺 — 请检查 PDF 是否含对应附注/章节标题，或启用更清晰的文本层 PDF。）

## P13 非经常性损益

> **sourcePageRange**: p.4–p.4；**confidence**: `high`；**warningCodes**: `none`

定位置信度：**high**（页码 4-4）

```text
非经常性损益摘录
```

## MDA 管理层讨论与分析（MD&A）

> **sourcePageRange**: p.5–p.6；**confidence**: `high`；**warningCodes**: `none`

定位置信度：**high**（页码 5-6）

```text
MD&A 摘录
```

## SUB 主要控股参股公司

> **sourcePageRange**: —；**confidence**: —；**warningCodes**: `SECTION_MISSING`

> ⚠️ [PHASE2B|high] **章节缺失**：Phase2A 未定位到可靠命中，未静默占位正文。

> **可能原因（启发式）**：
> - 关键词未命中、目录干扰、或章节跨页边界被截断。

> **建议人工动作**：在 PDF 内全文检索该章核心词；核对是否为扫描件无文本层；必要时手工摘录表格再并入证据包。

（空缺 — 请检查 PDF 是否含对应附注/章节标题，或启用更清晰的文本层 PDF。）

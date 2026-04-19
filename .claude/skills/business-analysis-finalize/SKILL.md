---
name: business-analysis-finalize
description: "PDF-first：TS 跑证据链；默认在同一会话用 Claude 完成六维终稿写回（qualitative_report / qualitative_d1_d6）。"
---

# business-analysis-finalize 执行规范

> 由入口 `/business-analysis` 默认调用；该 skill 只定义 AI 收口执行规范，不定义用户入口参数。

## 架构边界

- **TS/CLI**：只做 **evidence-pack** 与确定性合并（**cli-evidence-only**），不调 Anthropic/OpenAI HTTP/SDK 做「自动叙事」。
- **Claude（本 skill）**：编排成功后 **默认**执行 **final-narrative** 收口（非可选增强），写回终稿文件。

契约：[docs/guides/entrypoint-narrative-contract.md](../../docs/guides/entrypoint-narrative-contract.md)。

## 顺序（与实现一致）

1. **Stage A / PDF**：无 `--pdf`/`--report-url` 时，在 run 目录下按 Feed **自动发现**年报 URL 并 Phase0 下载（**非 `--strict`** 为 best-effort；**`--strict`** 为强制，失败 fail-fast）。与 `workflow --mode turtle-strict` 共用 `ensureAnnualPdfOnDisk` 语义。
2. **Phase 1A**：结构化市场数据 → `data_pack_market.md`。
3. **Phase 2A/2B（有本地 PDF 时）**：精提取 → `data_pack_report.md`。
4. **Phase 1B**：HTTP/MCP 检索补充 → 合并写入 `qualitative_report.md`（§7/§8/§10）与 `qualitative_d1_d6.md`（含可选 `data_pack_report` 摘录）——此为 **草稿/证据合并**，**不等于**终稿叙事。
5. **AI 六维终稿（Claude，默认）**：通读 `data_pack_market.md`、（若有）`data_pack_report.md`、`phase1b_qualitative.md`，将 `qualitative_report.md` 写为 **六维叙事终稿**，将 `qualitative_d1_d6.md` 各维写为 **实质正文**（去掉「待补全」类占位）。若证据不足，**明确阻断**并列出缺口，**不**宣称已完成终稿。

## 降级与告警

- 无可用 PDF：不生成 `data_pack_report.md`；Phase1B 仍为事实补充；D5 **交付级**须有报告包（见 `phase3_preflight.md` 规则 A/B；`qualitative_d1_d6.md` 的 D5 会提示缺口）。
- **`--strict`**：禁止「无报告包」静默成功；自动发现失败、缺少可解析 PDF 或 2B 未产出则 **fail-fast**（规则 C；前缀 `[strict:business-analysis]`），并启用 Phase1A Pre-flight（`[strict:preflight]`）。

## 输出标准

- `qualitative_report.md`：终稿目标为 **六维叙事主文**（Claude 写回）；CLI 初次落盘可为 Phase1B 合并草稿。
- `qualitative_d1_d6.md`：终稿目标为 **各维已填充** 的 Turtle D1~D6 稿（Claude 写回）；CLI 初次落盘可为骨架+摘录。
- `phase1b_evidence_quality.json`：§7/§8 证据结构离线指标。
- `business_analysis_manifest.json`：`input.mode` / `input.strategy`、`input.runId` / `input.outputDirParent`、按需写入的 `from`/`to`/`category` 等复跑字段、`pipeline.pdfBranch`、`pipeline.valuation`；`suggestedWorkflowFullCommand` 含 `--run-id` 等与当次 run 对齐的参数。供 `valuation:run --from-manifest`（未传 `--code` 时用 `outputLayout.code` 分区）与全链路衔接。

## 入口映射

- **Claude Code**：`/business-analysis`（推荐）
- **CLI**：`pnpm run business-analysis:run -- ...`（支持 `--strict`、`--mode`、`--strategy`；CI、无 IDE）

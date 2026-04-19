---
description: 全流程研究编排（严格 PDF 链 + Phase3 估值与规则报告）；深度六维定性终稿在 Claude 会话收口，TS 不调模型叙事 API
argument-hint: [--code] [--mode standard|turtle-strict] [--pdf|--report-url] [--run-id] [--strategy turtle|value_v1]
---

在 **monorepo 根目录**执行。

## 入口与执行映射

- **入口（command）**：`/workflow-analysis`
- **默认执行 skill**：`workflow-strict`（文件：`.claude/skills/workflow-strict/SKILL.md`；名称与入口不同是为了区分“用户入口名”与“严格执行规范名”）

## 与「终稿叙事」的关系

- **CLI / LangGraph**：确定性阶段、估值与 `analysis_report.*`（**cli-evidence-only** 语义延伸至「不含模型厂商叙事 HTTP」；见架构红线）。
- **Claude**：若要对齐 Turtle 六维叙事深度，在编排完成后于会话内对照 **evidence-pack** 与 `.claude/skills/workflow-strict/SKILL.md` 做 **final-narrative** 补强；失败时不得宣称终稿已完成。

契约：[docs/guides/entrypoint-narrative-contract.md](../../docs/guides/entrypoint-narrative-contract.md)。

## Slash → CLI（脚本 / CI，严格主链）

```bash
pnpm run workflow:run -- \
  --code <必填> \
  --mode turtle-strict \
  [--year 2024] \
  [--pdf "./path/to/annual.pdf"] \
  [--report-url "https://..."] \
  [--output-dir "./output/workflow/<code>"] \
  [--run-id "<与 manifest 对齐的 runId>"] \
  [--phase1b-channel http|mcp] \
  [--strategy turtle|value_v1] \
  [--preflight strict|off]
```

续跑（`--resume-from-stage`）时 **`--run-id` 无效**，以 checkpoint 的 `runId`/`threadId` 为准。

## 标准模式（兼容旧行为）

```bash
pnpm run workflow:run -- --code 600887 --year 2024
```

无 PDF 时 Phase3 仍可能运行（`data_pack_report` 为空输入），与 `turtle-strict` 不同。

## `--mode turtle-strict` 行为

- 启动前：优先使用显式 `--pdf` 或 `--report-url`；若两者均缺失，将尝试基于 `--code`+`--year` 通过 Feed `/stock/report/search` 自动发现年报 PDF（需 `FEED_BASE_URL`）。
- Phase1A 后：**Pre-flight** 默认开启（亦可用 `--preflight strict|off` 覆盖）；失败前缀 `[strict:preflight]`。
- 管线结束后：必须已成功生成 `data_pack_report.md`，否则 fail-fast 并提示检查 PDF/下载/2A/2B。
- CLI 报错前缀统一为 **`[strict:workflow:strict]`**（与 Slash `/workflow-analysis` 对齐，便于检索）。

## 产物

- `valuation_computed.json`
- `analysis_report.md` / `analysis_report.html`
- `workflow_manifest.json`
- 以及 Phase1A/1B/2A/2B 中间产物（同 `workflow:run` 文档）。

## 相关 skill

执行顺序与检查清单见 `.claude/skills/workflow-strict/SKILL.md`。

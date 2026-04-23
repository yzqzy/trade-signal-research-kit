---
name: workflow-strict
description: "`workflow:run --mode turtle-strict`：TS 跑严格证据链、Phase3 与 **report-polish**（多页 Markdown + `report_view_model.json`）；六维定性终稿不在本入口写回。"
---

# workflow-strict 执行规范

> 由入口 `/workflow-analysis` 默认调用；本 skill 定义严格执行与 **report-polish 验收**，不替代 CLI 参数说明。

## 目标

- 与仓库根 **`/workflow-analysis`**（等价 `pnpm run workflow:run -- --mode turtle-strict ...`）一致：**PDF 链 + 报告包 + Pre-flight + Phase3 + report-polish**。
- **策略可切换**：Stage E 由 `--strategy turtle|value_v1` 决定；入口名不含策略名。
- **叙事分层**：编排层 **不**调用 Anthropic/OpenAI 做自动叙事。`/workflow-analysis` **不**承担「六维定性终稿」写回；该类终稿由 **`/business-analysis` + `business-analysis-finalize`** 完成（见 [entrypoint-narrative-contract.md](../../../docs/guides/entrypoint-narrative-contract.md)）。
- **发布型终稿**：以 **report-polish** 落盘的 4 份 Markdown + `report_view_model.json` 为准，经 `reports-site:emit` → `sync:reports-to-app` 进入研报站。

## 顺序与检查

1. **initPrep**：无 `--pdf`/`--report-url` 时按 Feed 自动发现（`turtle-strict` 下失败即抛错）。
2. 在 **`turtle-strict`** 下：
   - Phase1A 后跑 **Pre-flight**（`[strict:preflight]`）。
   - 缺 `data_pack_report.md` 时 **fail-fast**（`[strict:workflow:strict]`）。
3. **report-polish（Stage F，TS 已编排）**：`workflow:run` 成功结束后，run 目录须存在：
   - `report_view_model.json`
   - `turtle_overview.md`、`business_quality.md`、`penetration_return.md`、`valuation.md`
   - `workflow_manifest.json` 的 `outputs` 含上述路径字段（供 `reports-site:emit` 优先消费）
4. **助手验收约定**：用户通过 `/workflow-analysis` 发起且 CLI 编排成功后，助手应**核对**上节文件齐全、体积非空；若缺失则提示重跑 `pnpm run build` 后重跑 workflow，**不要求**在会话内对 workflow run 做「六维终稿写回」替代 report-polish。
5. **仅以下情形可先与用户确认再继续**（例如发布或覆盖）：
   - 用户明确要求「仅 CLI、不 emit / 不同步站点」；
   - 将覆盖用户刚手改的 `turtle_overview.md` 等 polish 文件且未确认保留；
   - 证据门禁阻断（如 `gateVerdict=CRITICAL`、缺核心输入）需先补链。

## 关键差异（`standard` vs `turtle-strict`）

| 项 | standard | turtle-strict |
|----|----------|---------------|
| 自动发现年报 | 否（除非显式 URL / 其他入口） | 是（无 PDF/URL 时） |
| Phase1A Pre-flight 默认 | off | strict |
| 缺 `data_pack_report` 进 Phase3 | 可能继续 | 禁止 |

## 入口映射

- **Claude Code**：`/workflow-analysis`（语义为 `workflow:run --mode turtle-strict`）
- **CLI**：`pnpm run workflow:run -- --mode turtle-strict ...`

## 产物速查

- `analysis_report.md`（规则审计 / Phase3）
- `valuation_computed.json`
- `workflow_manifest.json`
- **report-polish**：`report_view_model.json`、`turtle_overview.md`、`business_quality.md`、`penetration_return.md`、`valuation.md`

## Phase1B · WebSearch（火山，可选）

- **用途**：在配置了 `WEB_SEARCH_API_KEY` 时，Phase1B 对 **`违规/处罚记录` / `行业监管动态` / `回购计划`** 优先走联网搜索；无有效命中再回退到 Feed 公告检索（不静默补数）。
- **环境变量**：见仓库根目录 `.env.example` 与 [docs/guides/data-source.md](../../../docs/guides/data-source.md)；开通步骤见 [references/byted-web-search/references/setup-guide.md](../../../references/byted-web-search/references/setup-guide.md)。
- **Smoke（验证 Key 与网络）**：

```bash
pnpm run build
pnpm --filter @trade-signal/research-strategies run run:websearch-smoke -- --query "牧原股份 回购" --limit 3
```

- **业务回归**：配置 Key 后跑一次 `pnpm run business-analysis:run -- --code 002714`，检查 `phase1b_qualitative.md` 上述三条是否出现可追溯 `http(s)` 链接；**六维终稿**写回仍须遵守 `business-analysis-finalize`（正文无裸 URL；附录证据索引等）。

## 质量门禁（可选）

- `pnpm run test:linkage`
- `pnpm run quality:all`

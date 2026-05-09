# Report Polish（Markdown-first）叙事与证据契约

本仓库在 **Phase3（`stageE`）之后** 增加 **`reportPolish`** 阶段：生成 `report_view_model.json` 与四份 Markdown（`turtle_overview.md`、`business_quality.md`、`penetration_return.md`、`valuation.md`）。这些文件现在统一视为 **Topic draft**：可审计、可复现、可供 AI/Agent finalization 使用，但不直接等于站点正式研报。正式发布稿必须写入 `finalized/<siteTopicType>.md`（或 `<draft>.final.md`），并通过 Topic Finalization Gate。

## 角色与默认行为

| 角色 | 职责 |
|:-----|:-----|
| **结构化填充** | 从 `phase1a_data_pack.json`、`data_pack_market.md`、`phase1b_qualitative.md`、`data_pack_report.md`（若存在）、`valuation_computed.json`、`analysis_report.md` 与 Phase3 内存结果组装 `report_view_model.json`，并写入各页固定章节骨架。 |
| **Topic finalization** | 在 AI/Agent 会话中基于 draft 与证据包写回 `finalized/<siteTopicType>.md`；所有数值与判定须可回溯，不得引入证据外事实。 |
| **Publisher** | 只发布通过 finalization gate 的 finalized Markdown；draft/degraded/blocked 只进入 `topic_manifest.json` 审计状态，不进入 `/reports`。 |

## 硬约束（质量门禁）

1. **不得超证据扩写**：禁止引入证据文件中不存在的财务数字、监管结论、行业排名等。
2. **缺口显式化**：无法从当前 run 解析或缺失的文件，写入 `report_view_model.todos[]` 与对应 Markdown 的 `TODO` 段落，**禁止静默造数**。
3. **引用边界**：workflow 的四份 Markdown 都是 Topic draft；发布层不得把 draft 当正式 Topic 展示。
4. **估值页**：估值表体由 `valuation_computed.json` **机械渲染**（`renderValuationComputedMarkdownFromJson`），finalization 可以解释权重、敏感性与反向估值含义，但不得覆盖 JSON 中未出现的假设参数。
5. **发布门禁**：龟龟、估值、穿透、商业质量都必须通过 Topic Finalization Gate；缺少 finalized Markdown 或命中模板/工程枚举/字段拼接表达时，站点隐藏正文并在 `topic_manifest.json` 写入阻断原因。

## 可选开关（未来扩展）

CLI / 输入级开关可扩展为 `reportPolishNarrative: "off" | "on"`（默认 `on`）。`off` 时仅输出骨架与表格填充，省略衔接性段落；**证据表与 TODO 行为不变**。

## 验收对齐

- 同一次 `workflow:run` 在输出目录稳定生成 **4 份 Markdown + `report_view_model.json`**。
- `reports-site:emit --run-dir …` 在 workflow manifest 含 polish 路径时，只把 polish 文件作为 draft 来源写入 `topic_manifest.json`；只有 `finalized/<siteTopicType>.md` 通过门禁时才写入站点 entry。
- 同一自然日 + 股票代码 + Topic 去重按 `complete > degraded > missing` 优先；business-analysis complete 商业质量页覆盖 workflow 降级入口。

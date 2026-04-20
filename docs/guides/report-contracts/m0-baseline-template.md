# M0 基线冻结模板（通用）

本模板用于任意标的（`<code>`）在进入专题渲染前完成“事实源与产物基线”的统一，避免多入口口径冲突。

## 1) 产物矩阵模板

| artifactType | pathPattern | sourceStage | ownerContract | publishReadiness | riskNotes |
|:--|:--|:--|:--|:--|:--|
| quantitative_report | `output/workflow/<code>/<runId>/analysis_report.md` | Phase3 | `phase3/types` | yes/no/blocked |  |
| valuation_json | `output/workflow/<code>/<runId>/valuation_computed.json` | Phase3 | `valuation-engine` | yes/no/blocked |  |
| qualitative_report | `output/business-analysis/<code>/<runId>/qualitative_report.md` | Phase1B/2B + 会话终稿 | `entrypoint-narrative-contract` | yes/no/blocked |  |
| qualitative_d1d6 | `output/business-analysis/<code>/<runId>/qualitative_d1_d6.md` | Phase1B/2B + 会话终稿 | `entrypoint-narrative-contract` | yes/no/blocked |  |
| market_pack | `output/*/<code>/<runId>/data_pack_market.md` | Phase1A | `schema-core FinancialSnapshot` | yes/no/blocked |  |
| report_pack | `output/*/<code>/<runId>/data_pack_report.md` | Phase2B | `phase2b` | yes/no/blocked |  |
| phase1b_evidence | `output/*/<code>/<runId>/phase1b_qualitative.md` | Phase1B | `phase1b` | yes/no/blocked |  |
| publish_page | `site/reports/<latest|runs>/.../*.html` | 发布层 | `report-topic-contract` | yes/no/blocked |  |

### 字段说明

- `artifactType`: 产物类别（用于专题映射与审计）。
- `pathPattern`: 通用路径模板，不写死样本 run。
- `sourceStage`: 责任阶段（Phase1A/1B/2B/3 或发布层）。
- `ownerContract`: 主约束契约（代码或文档）。
- `publishReadiness`: `yes|no|blocked`。
- `riskNotes`: 风险、冲突或降级说明。

## 2) 事实源优先级（统一规则）

当同一字段在多个来源出现时，按以下优先级裁决：

1. `data_pack_market.md`
2. `data_pack_report.md`
3. `valuation_computed.json`
4. `phase1b_qualitative.*`（仅补充，不覆盖核心财务口径）
5. `references/analysis/*`（仅展示参考，不作为数值真源）

> 若专题字段要求与以上优先级冲突，应在专题契约中显式标注“override reason”。

## 3) 冲突日志（conflictLog）模板

| fieldKey | candidateSources | selectedSource | selectedValue | reason | checkedAt |
|:--|:--|:--|:--|:--|:--|
| `netProfit_2025` | market_pack, reference_html | market_pack | `137264` | 事实源优先级裁决 | ISO-8601 |

### conflictLog 生成规则

- 同名字段候选值不一致时，必须记录一条冲突日志。
- `reason` 必须可审计（例如“优先级规则命中”“来源口径不一致，按契约裁决”）。
- 未生成 `conflictLog` 时，不允许进入发布状态 `Pass`。

## 4) M0 验收清单（通用）

- 任意 `<code>` 可填写该模板并完成事实源裁决。
- 所有发布专题对应的关键字段可追溯到至少一个 `ownerContract`。
- 冲突字段均有 `conflictLog`，且 `checkedAt` 为有效时间戳。

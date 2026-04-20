# M0/M1 复用验证记录（双标的）

> 目标：验证 M0/M1 模板与契约可复用，不依赖单一样本。  
> 验证对象：`600941`（workflow 全链路样本）与 `002714`（business-analysis 样本）。  
> 验证时间：本地执行期。

## 1) 样本与输入

| code | run scope | runId | 主要输入 |
|:--|:--|:--|:--|
| 600941 | workflow | `65da80ff-d00c-454d-b6e4-16df3bdd1280` | `analysis_report.md`, `valuation_computed.json`, `qualitative_d1_d6.md` |
| 002714 | business-analysis | `e05ba22b-fdea-40e8-acfb-00f94b257ec9` | `qualitative_report.md`, `qualitative_d1_d6.md`, `data_pack_report.md` |

## 2) 契约命中情况（按专题）

| code | topicType | requiredFieldsStatus | 结论 |
|:--|:--|:--|:--|
| 600941 | `business_quality` | pass | D1~D6、证据索引、终稿状态齐备，可作为 Pass 样本。 |
| 600941 | `valuation` | pass | `valuation_computed.json` 存在且有有效方法（DCF/PS），可生成估值专题。 |
| 600941 | `penetration_quant` | pass | `analysis_report.md` 含 Owner Earnings、粗算/精算穿透率、阈值对比。 |
| 600941 | `turtle_strategy` | pass | A/B/C 三专题输入可聚合。 |
| 002714 | `business_quality` | degraded | 六维骨架存在，但包含“待补全正文”与结构化参数未完成，需降级提示。 |
| 002714 | `valuation` | fail | 该 run 缺 `valuation_computed.json` 与 `analysis_report.md`。 |
| 002714 | `penetration_quant` | fail | 该 run 缺 `analysis_report.md`。 |
| 002714 | `turtle_strategy` | degraded/fail | 取决于是否允许跨 run 聚合；同 run 内因 B/C 缺失至少为 degraded。 |

## 3) 关键证据（字段命中）

- `600941` `analysis_report.md` 命中：
  - `Owner Earnings`
  - `粗算穿透回报率`
  - `精算穿透回报率`
  - `最终判断`
- `600941` `qualitative_d1_d6.md` 命中：
  - `## D1` 至 `## D6`
  - `## 附录：证据索引`
  - `[终稿状态: 完成]`
- `002714` `qualitative_d1_d6.md` 命中：
  - `## D1` 至 `## D6`
  - 存在 `待补全正文`（触发 degraded 逻辑）

## 4) 复用性结论

- M0 模板可跨标的复用：两个样本均可按同一产物矩阵登记。
- M1 契约可跨标的复用：`requiredFieldsStatus` 能区分 pass/degraded/fail。
- 门禁有效：不会把缺失核心输入（如估值、穿透率）误判为可发布。

## 5) 后续动作

1. 在实现层接入 `report-topic-contract.ts` 的自动校验，生成 `requiredFieldsStatus`。
2. 将本记录中的人工判定替换为程序化校验产物（建议输出到 `index.json`）。
3. 进入 M2 时优先处理 P0 透传字段，以减少 `degraded` 触发率。

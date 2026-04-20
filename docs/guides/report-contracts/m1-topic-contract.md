# M1 四专题契约（通用）

本契约定义四类专题页面的输入来源、字段分级与降级规则，适用于任意标的（`<code>`）。

## 1) 专题与输入映射

| topicType | displayName | primaryInputs | secondaryInputs |
|:--|:--|:--|:--|
| `business_quality` | 商业质量评估 | `qualitative_report.md`, `qualitative_d1_d6.md` | `phase1b_qualitative.md` |
| `valuation` | 估值分析 | `valuation_computed.json`, `analysis_report.md` | `data_pack_market.md` |
| `penetration_quant` | 穿透回报率定量分析 | `analysis_report.md`, `data_pack_market.md` | `valuation_computed.json` |
| `turtle_strategy` | 龟龟投资策略分析 | 上述三专题聚合 | `phase3_preflight.md` |

## 2) 字段分级规范

- `requiredFields`: 缺失即阻断发布（Fail）。
- `optionalFields`: 可缺失；缺失时进入 Degraded 并提示。
- `degradedFallback`: 缺失时显示占位文案与缺口说明，禁止静默省略。

## 3) 四专题最小必填字段（MVP）

### business_quality（商业质量评估）

- `requiredFields`
  - `title`, `code`, `verdict`
  - `dimensionSummaries`（至少 D1~D6 摘要）
  - `evidenceSummary`, `confidenceBoundary`
- `optionalFields`
  - `governanceHighlights`, `missingDataNotice`

### valuation（估值分析）

- `requiredFields`
  - `title`, `code`
  - `valuation.methods`（至少 1 个有效方法）
  - `valuation.range.central`
  - `assumptionSummary`
- `optionalFields`
  - `valuation.range.conservative`, `valuation.range.optimistic`, `crossValidation`

### penetration_quant（穿透回报率定量分析）

- `requiredFields`
  - `title`, `code`
  - `ownerEarnings`, `roughPenetrationRate`, `finePenetrationRate`
  - `thresholdCompare`
- `optionalFields`
  - `factorBreakdown`, `riskFlags`

### turtle_strategy（龟龟投资策略分析）

- `requiredFields`
  - `title`, `code`, `finalDecision`
  - `topicLinks`（A/B/C 三专题可追溯链接）
  - `riskSummary`, `confidenceBoundary`
- `optionalFields`
  - `positionSuggestion`, `watchlistSignals`

## 4) 命名与索引规范

- 页面展示标题：`个股名称 (代码) · 页面名称`
- URL 路径：ASCII slug（示例：`meidi-group-000333-sz-business-quality`）
- 索引 `index.json` 必含：
  - `displayTitle`
  - `topicType`
  - `requiredFieldsStatus`
  - `confidenceState`
  - `href`

## 5) 可审计最低要求

所有专题页面必须包含：

- `evidenceSummary`
- `confidenceBoundary`
- `missingDataNotice`（无缺口时可写“无”）

## 6) 发布门禁

### Fail（阻断）

- 任一 `requiredFields` 缺失。
- 缺失 `evidenceSummary` 或 `confidenceBoundary`。
- 存在冲突字段但无 `conflictLog`。

### Degraded（降级可发）

- `optionalFields` 缺失，且 `requiredFields` 完整。
- 必须带降级说明与缺口提示。

### Pass（放行）

- `requiredFields` 完整。
- 审计字段齐备，冲突字段可追溯裁决。

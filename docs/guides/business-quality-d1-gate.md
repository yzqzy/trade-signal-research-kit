# 商业质量 D1：数据化渲染与发布门禁

与 [reports-site-publish.md](./reports-site-publish.md) 及 `packages/research-runtime` 实现对齐。

## 编排层（`nodeReportPolish`）

1. `composeReportViewModel` 写入 **`businessModel`**（`business-model-classifier.ts` + `business-quality-facts.ts`）。
2. `renderBusinessQualityMarkdown` 使用 **`renderBusinessQualityD1Section`** 生成维度一（多年表、同业、监控阈值）。
3. 写出 `business_quality.md` 前，将 **`evaluateBusinessQualityPublishGate`** 与 **`evaluateBusinessQualityPublicationHardBlock`** 结果写入 **`report_view_model.json` → `businessQualityGate`**，并按结果更新 **`topic:business-six-dimension`** 的 `qualityStatus` / `blockingReasons`。

## 站点 emit（workflow 路径）

`emit-site-reports.ts` 在读取 `report_view_model.json` 后，对 **`business_quality.md`** 再次执行上述门禁，合并 **business-quality** 专题的 `topic_manifest.json` 质量字段（防编排与发布之间的漂移）。

## 量化验收（4 样本）

对 `000651`、`000915`、`002818`、`601919` 各执行一次完整 **`workflow:run --mode turtle-strict`**（或等价已落盘 run），然后对每份 `business_quality.md` 检查：

| 指标 | 门槛 | 实现参考 |
|------|------|----------|
| D1 数字个数 | ≥8 | `evaluateBusinessQualityPublishGate` 的 `d1DigitCount` |
| D1 数值密度 | ≥5% | 同上 `numericDensity` |
| 监控阈值行 | ≥3 行含可执行门槛 | 同上对「监控阈值」小节解析 |
| 主模型分布 | 4 份不得全相同 | 人工比对 `report_view_model.json` 的 `businessModel.l1Key` |
| 首段同质度 | 两两 <60%（计划） | 对首段做简单字符 n-gram 或编辑距离脚本（仓库未内置时可外挂） |

CLI 侧可将上述检查写为小脚本：读取 run 根目录的 `business_quality.md` + `report_view_model.json`，调用 `evaluateBusinessQualityPublishGate(md, { hasBusinessModel: !!vm.businessModel })` 打印 JSON 行报告。

# 研报中心发布（entries / views 协议）

[返回 workflows](./workflows.md) · [文档索引](../README.md)

## 职责边界

| 组件 | 职责 |
|------|------|
| `trade-signal-schema-kit`（`@trade-signal/research-strategies`） | 从单次 `workflow` / `business-analysis` run 归一化生成 `output/site/reports/**` |
| `apps/research-hub`（`@trade-signal/research-hub`） | 基于 **Nextra docs**（由 `trade-signal-docs` 迁入）+ 消费 `public/reports/**`，静态导出 `/reports` 列表与详情 |

## 目录协议（`site/reports`）

- `index.json`：`version`、`generatedAt`、`entryCount`、`timelineHref`
- `views/timeline.json`：时间流列表项（`entryId`、`displayTitle`、`topicType`、`code`、`publishedAt`、`href`、`requiredFieldsStatus`、`confidenceState`）
- `views/by-topic/<topicType>.json`、`views/by-code/<code>.json`：分类视图
- `entries/<entryId>/meta.json`、`entries/<entryId>/index.html`：详情元数据 + 可独立托管的静态页

`entryId`：`<date>-<code>-<topicSlug>-<runIdShort>`（去重键：`date + code + topicType`，timeline 保留最新 `publishedAt`）。

## 常用命令

在 **schema-kit 仓库根**：

```bash
# 从已有 run 目录聚合写入 output/site/reports（并重建 views/index）
pnpm run reports-site:emit -- --run-dir output/workflow/600941/<runId>

# 仅重建索引（entries 已存在）
pnpm --filter @trade-signal/research-strategies run run:reports-site-emit -- --reindex-only

# 同步到本仓库 apps/research-hub/public/reports（默认）
pnpm run sync:reports-to-app

# 仍同步到兄弟仓库 trade-signal-docs（可选，需目录存在）
pnpm run sync:reports-to-docs

# 自定义目标目录
pnpm --filter @trade-signal/research-strategies run run:reports-site-sync -- \
  --target-dir /path/to/any/public/reports
```

`workflow:run` / `business-analysis:run` 可选 **`--reports-site-dir output/site/reports`**：跑完后追加写入同一聚合目录。

## GitHub Pages（仅站点子树）

1. 在 CI 或本地生成并同步：`reports-site:emit` → `sync:reports-to-app`，再 `pnpm --filter @trade-signal/research-hub run build`（或直接部署 `output/site/reports` 子树）。
2. 静态托管可将 **`research-hub/out/`** 作为站点根，入口 **`/reports/`**；若单独发布 `site/reports`，按托管商配置子路径。

## 与 `report-to-html` 的关系

`report-to-html` 为 **legacy / 调试** 单文件 HTML，**不作为** 研报中心主发布链路；主链路以 **`entries` + `views` + 程序化索引** 为准。

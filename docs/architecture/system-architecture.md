# 系统架构说明

[返回项目首页](../../README.md) · [文档索引](../README.md)

`trade-signal-schema-kit` 采用三层结构：

1. 研究流程层：负责策略、估值、筛选、报告编排
2. 标准字段层：统一领域模型与 `MarketDataProvider` 契约
3. 数据接入层：`feed` 的 HTTP/MCP 双通道适配

其中研究流程层支持「策略注册」模式：在统一 **Stage 编排骨架**下挂接不同策略实现（如 Turtle），避免框架被单一策略绑定。详见 [策略与流程解耦](./strategy-orchestration-architecture.md)。

## 架构图

```text
research-strategies + reporting
            │
        schema-core
            │
    ┌───────┴────────┐
 provider-http   provider-mcp
            │
      trade-signal-feed
```

## 设计边界

- 研究流程层只消费标准字段，不引用上游原始字段
- 适配器层负责数据映射、错误转换、语义对齐
- 同一查询在 HTTP/MCP 通道输出保持一致（由 `quality:conformance` 等在 fixture 上校验）
- 策略规则可替换，数据与报告契约保持稳定

## 编排与通道（当前实现要点）

- **`workflow:run`**：Phase1A 固定经 **HTTP** `FeedHttpProvider`（`FEED_BASE_URL`）；Phase1B 默认 HTTP，可在代码中切换 MCP 并注入 `mcpCallTool`。
- **双通道切换**：独立脚本或库代码可任选 `createFeedHttpProviderFromEnv()` / `createFeedMcpProviderFromEnv(callTool)`；并非所有编排入口都已暴露「运行时切换」。

## 相关文档

- [流程与 CLI（Stage 真源）](../guides/workflows.md)
- [策略插件与编排边界](./strategy-orchestration-architecture.md)
- [Agent 编排选型](../strategy/agent-framework-comparison.md)

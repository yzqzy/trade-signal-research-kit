# Screener Python ↔ TypeScript 能力对照

参考：`references/projects/Turtle_investment_framework/scripts/screener_core.py`、`screener_config.py`、`tests/test_screener.py`（逻辑参考，数据源以本仓 feed / 自选 universe 为准）。

| 能力域 | 参考实现 (Python) | TS (`packages/research-strategies/src/screener`) | 状态 |
|--------|-------------------|--------------------------------------------------|------|
| Tier1 全市场快照 | 脚本内合并多表 | 由上游 **universe JSON**（或 HTTP feed）提供等价字段 | 已对齐（数据契约） |
| ST/PT/退市 名称过滤 | `_tier1_filter` | `cn-a.ts` 同名正则 | 已对齐 |
| 银行股 | `include_bank` | `includeBank` | 已对齐 |
| 上市年限 | `list_date` 日历截断 | `listDate` YYYYMMDD 日历截断 | 已对齐 |
| 市值门槛 | 脚本侧「万元→亿元」换算 | `marketCap` **百万元** ≥ `minMarketCapYi * 100` | 已对齐 |
| 换手率 | `min_turnover_pct`（%） | `minTurnoverPct` | 已对齐 |
| PB 区间 | `0 < pb <= max_pb` | 同左 | 已对齐 |
| 双通道 PE | 主通道：`pe` 有效且 `0<PE<=max_pe`；观察：`pe` **缺失** | 主通道同左；观察：**仅 `pe` 缺失**（finite `pe<=0` 整体丢弃） | 已对齐 |
| 主通道股息 | 股息率 > 0 | `dv > 0` | 已对齐 |
| Tier1 打分权重 | `dv_weight/pe_weight/pb_weight` | `ScreenerConfig` 三权重 | 已对齐 |
| Tier1 主通道裁剪 | `tier2_main_limit` | `tier2MainLimit` | 已对齐 |
| Tier2 硬否决 | 质押、审计意见 | 行字段 `pledgeRatio`、`auditResult`（无字段则跳过该检查） | 已对齐（契约） |
| Tier2 财务质量（主） | ROE/毛利率/负债率 | `roe`/`grossMargin`/`debtRatio` 与阈值 | 已对齐 |
| 观察通道质量 | FCF 边际、OCF>0、5 年 FCF 正年数等 | `validateObservationQuality` 使用 `ocf`/`capex`/`revenue`/`fcfPositiveYears` | 已对齐（需 universe 提供） |
| Factor2 R | `R = AA*(M/100)/mkt_cap*100` | `computeFactorSummary`：`payoutRatio`(M)、AA 分项、`marketCap` | 已对齐（M 缺省弱回退） |
| Factor4 / 打分 | 五维分位 + 权重 | `computeStandaloneScore` 同结构 | 已对齐 |
| Floor premium | `_extract_floor_price.premium` | `floorPremium` 行字段或 `pe/3` 回退 | 部分对齐（无 5 法底价） |
| 缓存分层 TTL | Parquet + meta；financial/market/global | `ScreenerDiskCache` JSON + `.meta.json`；分层 TTL 配置项 | 已对齐（实现形态不同） |
| CLI | `--tier1-only`、`--tier2-limit`、阈值覆盖、缓存刷新 | `cli.ts` 同名语义 | 已对齐 |
| 导出 CSV/HTML | 参考脚本列顺序 | `exportScreenerResultsCsv` / 报告表列 | 已对齐 |
| 数据源 | 参考脚本内联拉取 | **`fetchScreenerUniverseFromHttp`** 对接 **trade-signal-feed**（或同源）的 universe/selection 端点；CLI 使用 `--input-json`；字段映射由 feed 适配层完成 | 按宿主 API 配置 |

## 数据接入（feed / 自选接口）

- **推荐**：在 feed 或网关暴露返回 `ScreenerUniverseRow[]`（或与之一致的 JSON）的接口；`http-source.ts` 会按顺序尝试若干相对路径，并支持 **`extraUniversePaths`** 指向你的 **selection** 路径，无需改核心筛选逻辑。
- **离线/批处理**：与现有一致，使用 `--input-json` 传入 universe 数组即可。

## 单位约定（TS universe）

- `marketCap`：**百万元**（与参考脚本中「万元总市值 → 百万元」换算结果一致）。
- `minMarketCapYi`：**亿元**，与参考配置 `min_market_cap_yi` 同语义。

## 弃用说明

- 旧配置键 `minMarketCap`（百万元绝对门槛）：`resolveScreenerConfig` 会转换为 `minMarketCapYi = minMarketCap/100`。
- `hardVetoDebtRatio`：参考 Python 默认无此项；若 overrides 仍传入则保留额外否决逻辑以兼容旧 JSON。

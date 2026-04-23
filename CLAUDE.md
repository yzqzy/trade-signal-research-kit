# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`trade-signal-schema-kit` is a TypeScript analysis framework for A-share and Hong Kong stock research. It provides data collection → qualitative analysis → quantitative evaluation → valuation → report output capabilities.

**Narrative split:** TypeScript orchestration is **cli-evidence-only** for LLM vendor narrative—no in-repo Anthropic/OpenAI HTTP/SDK for “auto narrative.” **`/workflow-analysis`** additionally runs **report-polish** (four Markdown pages + `report_view_model.json`) for **site publish** via `reports-site:emit`. **final-narrative** (Turtle-style six-dimension qualitative) is completed in **Claude Code** for **`/business-analysis`** and written back to `qualitative_report.md` / `qualitative_d1_d6.md`. See `docs/guides/entrypoint-narrative-contract.md` and `docs/guides/report-polish-narrative-contract.md`.

## Core Capability Overview

| Goal | Claude slash | Root command | Key outputs |
|------|--------------|--------------|-------------|
| Full workflow (strict branch) | `/workflow-analysis` | `pnpm run workflow:run -- --mode turtle-strict ...` | `analysis_report.md`, `valuation_computed.json`, `workflow_manifest.json`, report-polish（`report_view_model.json`, `turtle_overview.md`, `business_quality.md`, `penetration_return.md`, `valuation.md`） |
| Business analysis (PDF-first) | `/business-analysis` | `pnpm run business-analysis:run -- ...` | evidence-pack + `business_analysis_manifest.json`（CLI 的 `qualitative_report.md`/`qualitative_d1_d6.md` 可为草稿；终稿由 Claude 会话写回） |
| Valuation only | `/valuation` | `pnpm run valuation:run -- ...` | `valuation_computed.json`, `valuation_summary.md` |
| Download annual report | `/download-annual-report` | `pnpm run phase0:download -- ...` | local PDF |
| 研报中心静态索引 | — | `pnpm run reports-site:emit -- --run-dir ...` → `pnpm run sync:reports-to-app` | `output/site/reports/**`（`content.md` v2）→ `apps/research-hub/public/reports`（见 `docs/guides/reports-site-publish.md`） |

## Architecture (UML)

```mermaid
flowchart TD
  U["User Input (code + options)"] --> P0["Phase0 (optional): report discovery/download"]
  P0 --> P1A["Phase1A: structured market data"]
  P1A --> P2["Phase2A/2B (optional): annual PDF extraction"]
  P2 --> P1B["Phase1B: external evidence"]
  P1B --> P3["Phase3: strategy + valuation + report"]
  P3 --> O["analysis_report + valuation + manifests"]

  S["--strategy (turtle | value_v1 | ...)"] --> P3
```

Execution order for `workflow:run`: Phase 0 (optional) → Phase 1A → (if annual PDF available) Phase 2A/2B → Phase 1B → Phase 3.

## Three Quick Starts (Claude Code)

```text
/workflow-analysis 600887
/business-analysis 600887
/valuation 600887
```

- Use `/workflow-analysis` for end-to-end output.
- Use `/business-analysis` for PDF-first evidence pipeline and draft qualitative artifacts; finalize six-dimension narrative in the same Claude session.
- Use `/valuation` when inputs/manifest are already prepared.

## Strategy Switching

- Slash: `/workflow-analysis 600887 --strategy value_v1`
- CLI: `pnpm run workflow:run -- --code 600887 --mode turtle-strict --strategy value_v1`
- Keep entrypoint neutral: strategy is a parameter (`--strategy`), not an entry name.

## Common Commands

```bash
# Install dependencies
pnpm install

# Type check all packages
pnpm run typecheck

# Build all packages
pnpm run build

# Linkage smoke (after build) + quality gates
pnpm run test:linkage
pnpm run quality:all

# 研报中心：run 目录 → output/site/reports → ../trade-signal-docs/public/reports
pnpm run reports-site:emit -- --run-dir output/workflow/600941/<runId>
pnpm run sync:reports-to-app

# Work on specific package
pnpm --filter @trade-signal/schema-core run typecheck
pnpm --filter @trade-signal/provider-http run build

# research-strategies：根目录仍提供 workflow:run 等聚合命令；包内直跑请用 run:*（例：pnpm --filter @trade-signal/research-strategies run run:workflow）
# 产物目录 output v2：默认 `output/workflow/<code>/<runId>/`；`workflow:run` 可选 `--run-id` 固定子目录名（续跑以 checkpoint 为准）；business-analysis 默认 `output/business-analysis/<code>/<runId>/`（PDF 自动发现/下载与 workflow 共用 ensure-annual-pdf）；续跑必须 `--output-dir` 指向 run 根目录。详见 docs/guides/workflows.md
```

## Package Structure

| Package | Purpose |
|---------|---------|
| `schema-core` | Standard fields & MarketDataProvider contracts |
| `provider-http` | HTTP data adapter |
| `provider-mcp` | MCP data adapter |
| `research-strategies` | Strategy & research workflow orchestration |
| `reporting` | MD + HTML report output |

## Notes

- Skills: `business-analysis-finalize`（`.claude/skills/business-analysis-finalize/SKILL.md`）, `workflow-strict/SKILL.md`（严格链 + **report-polish** 验收）, `quality-gates/SKILL.md`.
- `workflow:run --mode standard` keeps legacy behavior (Phase3 may run without `data_pack_report.md`).
- Quality: `pnpm run quality:all` runs regression + golden for **cn_a** and **hk** (`output/phase3_golden/<suite>/`). HK suite is snapshot regression; full HK depth is not yet at A-share parity.

## Documentation

- **Index**: `docs/README.md`（`architecture` / `guides` / `strategy`）
- **Workflows & CLI (Stage)**: `docs/guides/workflows.md`

## Environment Requirements

- Node.js >= 20
- pnpm >= 10
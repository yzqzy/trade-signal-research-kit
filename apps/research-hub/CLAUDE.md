# Research Hub — 项目说明

## 概述

本包为 **研报静态站**：仅保留 `/`（跳转 `/reports`）、`/reports` 列表与 `/reports/[entryId]` 详情，数据来自 `public/reports/**`。不含独立文档站（无 Nextra / MDX 文档树）。

## 技术栈

- **框架**: Next.js 15（App Router），静态导出 `output: "export"`
- **样式**: Tailwind CSS 4 + `app/globals.css`（站点壳层 `.rh-site-*` 与研报区 `.rh-*`）
- **壳层组件**: [`components/SiteHeader.tsx`](components/SiteHeader.tsx)、[`components/SiteFooter.tsx`](components/SiteFooter.tsx)，由 [`app/layout.tsx`](app/layout.tsx) 组合
- **主题**: [`next-themes`](https://github.com/pacocoursey/next-themes)，默认 **跟随系统**；顶栏 **单按钮 + 下拉** 选浅色 / 深色 / 跟随系统（`storageKey: research-hub-theme`）
- **搜索**: 构建后 Pagefind（`postbuild`）

## 目录骨架（勿随意删）

- `app/layout.tsx` — 根布局：顶栏 + `<main>` + 页脚
- `app/page.tsx` — `/` 客户端跳转到 `/reports`
- `app/reports/**` — 研报路由与客户端时间流
- `lib/reports/**` — 研报解析与专题标签
- `public/reports/**` — 静态数据协议（由仓库脚本同步）
- `public/logo.svg`、`public/CNAME` — 品牌与部署域名

## 包管理

pnpm workspace：`@trade-signal/research-hub`

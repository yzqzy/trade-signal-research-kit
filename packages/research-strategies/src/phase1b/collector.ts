import { existsSync } from "node:fs";
import path from "node:path";

import { config as loadDotenv } from "dotenv";

import type {
  McpToolCaller,
  Phase1BChannel,
  Phase1BEvidence,
  Phase1BInput,
  Phase1BItem,
  Phase1BMdaSection,
  Phase1BQualitativeSupplement,
} from "./types.js";

type FeedSearchHit = {
  title?: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  snippet?: string;
  summary?: string;
  content?: string;
};

type FeedSearchResponse = {
  success?: boolean;
  data?: FeedSearchHit[] | { items?: FeedSearchHit[]; results?: FeedSearchHit[] };
  items?: FeedSearchHit[];
  results?: FeedSearchHit[];
  message?: string;
};

type FeedSearchQuery = {
  section: "7" | "8" | "10";
  item: string;
  query: string;
};

export interface FeedSearchClientOptions {
  baseUrl: string;
  apiBasePath?: string;
  apiKey?: string;
  endpointPath?: string;
}

export interface Phase1BCollectOptions extends Partial<FeedSearchClientOptions> {
  mcpCallTool?: McpToolCaller;
  mcpToolName?: string;
}

const NOT_FOUND_TEXT = "⚠️ 未搜索到相关信息";
const DEFAULT_ENDPOINT_PATH = "/stock/report/search";

function initEnv(cwd: string = process.cwd()): void {
  const candidates = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "../../.env"),
  ];
  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      loadDotenv({ path: filePath });
      break;
    }
  }
}

function resolveFeedSearchClientOptionsFromEnv(
  overrides: Partial<FeedSearchClientOptions> = {},
): FeedSearchClientOptions {
  const baseUrl = overrides.baseUrl ?? process.env.FEED_BASE_URL;
  if (!baseUrl) throw new Error("Missing FEED_BASE_URL for Phase1B collector");

  return {
    baseUrl,
    apiKey: overrides.apiKey ?? process.env.FEED_API_KEY,
    apiBasePath: overrides.apiBasePath ?? "/api/v1",
    endpointPath: overrides.endpointPath ?? DEFAULT_ENDPOINT_PATH,
  };
}

function normalizeHits(payload: FeedSearchResponse): FeedSearchHit[] {
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === "object") {
    const nested = payload.data.items ?? payload.data.results;
    if (Array.isArray(nested)) return nested;
  }
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function normalizeHitsFromUnknown(payload: unknown): FeedSearchHit[] {
  if (!payload || typeof payload !== "object") return [];
  return normalizeHits(payload as FeedSearchResponse);
}

function toEvidence(hit: FeedSearchHit): Phase1BEvidence | undefined {
  if (!hit.url) return undefined;
  return {
    title: hit.title ?? "未命名来源",
    url: hit.url,
    source: hit.source,
    publishedAt: hit.publishedAt,
    snippet: hit.snippet ?? hit.summary ?? hit.content,
  };
}

function summarize(evidences: Phase1BEvidence[]): string {
  if (evidences.length === 0) return NOT_FOUND_TEXT;
  const first = evidences[0];
  return first.snippet ?? first.title;
}

function buildQueries(input: Phase1BInput): FeedSearchQuery[] {
  const year = input.year ?? new Date().getFullYear().toString();
  const company = input.companyName;
  return [
    {
      section: "7",
      item: "控股股东及持股比例",
      query: `${company} 大股东 控股 持股比例 ${year}`,
    },
    {
      section: "7",
      item: "CEO/董事长/CFO 任期",
      query: `${company} 管理层 CEO 董事长 CFO 任期 ${year}`,
    },
    {
      section: "7",
      item: "管理层重大变更（5年）",
      query: `${company} 管理层变更 高管变动 近五年`,
    },
    {
      section: "7",
      item: "审计师与审计意见",
      query: `${company} 审计师 审计意见 年报 ${year}`,
    },
    {
      section: "7",
      item: "违规/处罚记录",
      query: `${company} 处罚 监管 财务造假`,
    },
    {
      section: "7",
      item: "大股东质押/减持",
      query: `${company} 大股东 质押 减持`,
    },
    {
      section: "7",
      item: "回购计划",
      query: `${company} 股份回购 计划`,
    },
    {
      section: "8",
      item: "主要竞争对手",
      query: `${company} 竞争对手 市场份额 ${year}`,
    },
    {
      section: "8",
      item: "行业监管动态",
      query: `${company} 行业 监管政策 ${year}`,
    },
    {
      section: "8",
      item: "行业周期位置",
      query: `${company} 行业周期 景气度 ${year}`,
    },
    {
      section: "10",
      item: "经营回顾",
      query: `${company} 年报 管理层讨论 经营回顾 ${year}`,
    },
    {
      section: "10",
      item: "前瞻指引",
      query: `${company} 年报 管理层讨论 前瞻 ${year}`,
    },
    {
      section: "10",
      item: "资本配置意图",
      query: `${company} 年报 管理层讨论 资本配置 ${year}`,
    },
    {
      section: "10",
      item: "风险因素",
      query: `${company} 年报 管理层讨论 风险因素 ${year}`,
    },
  ];
}

async function searchFeed(
  options: FeedSearchClientOptions,
  input: Phase1BInput,
  query: FeedSearchQuery,
): Promise<Phase1BEvidence[]> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const apiBasePath = (options.apiBasePath ?? "/api/v1").replace(/\/+$/, "");
  const endpointPath = (options.endpointPath ?? DEFAULT_ENDPOINT_PATH).replace(/^([^/])/, "/$1");
  const url = new URL(`${base}${apiBasePath}${endpointPath}`);
  const limit = input.limitPerQuery ?? 5;

  url.searchParams.set("code", input.stockCode);
  url.searchParams.set("year", input.year ?? "");
  url.searchParams.set("q", query.query);
  url.searchParams.set("query", query.query);
  url.searchParams.set("keyword", query.query);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    headers: {
      ...(options.apiKey ? { "x-api-key": options.apiKey } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Feed search failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as FeedSearchResponse;
  if (payload.success === false) {
    throw new Error(payload.message || "Feed search failed with success=false");
  }
  return normalizeHits(payload).map(toEvidence).filter((item): item is Phase1BEvidence => Boolean(item));
}

async function searchMcp(
  callTool: McpToolCaller,
  toolName: string,
  input: Phase1BInput,
  query: FeedSearchQuery,
): Promise<Phase1BEvidence[]> {
  const payload = await callTool(toolName, {
    code: input.stockCode,
    companyName: input.companyName,
    year: input.year,
    limit: input.limitPerQuery ?? 5,
    q: query.query,
    query: query.query,
    keyword: query.query,
    section: query.section,
  });
  return normalizeHitsFromUnknown(payload)
    .map(toEvidence)
    .filter((item): item is Phase1BEvidence => Boolean(item));
}

export async function collectPhase1BQualitative(
  input: Phase1BInput,
  options: Phase1BCollectOptions = {},
): Promise<Phase1BQualitativeSupplement> {
  const channel: Phase1BChannel = input.channel ?? "http";
  initEnv();
  const queries = buildQueries(input);

  let results: Array<{ query: FeedSearchQuery; evidences: Phase1BEvidence[] }>;
  if (channel === "http") {
    const clientOptions = resolveFeedSearchClientOptionsFromEnv(options);
    results = await Promise.all(
      queries.map(async (query) => ({
        query,
        evidences: await searchFeed(clientOptions, input, query),
      })),
    );
  } else {
    const mcpCallTool = options.mcpCallTool;
    if (!mcpCallTool) {
      throw new Error("Phase1B MCP mode requires options.mcpCallTool");
    }
    const toolName = options.mcpToolName ?? "search_stock_reports";
    results = await Promise.all(
      queries.map(async (query) => ({
        query,
        evidences: await searchMcp(mcpCallTool, toolName, input, query),
      })),
    );
  }

  const section7: Phase1BItem[] = results
    .filter((item) => item.query.section === "7")
    .map(({ query, evidences }) => ({
      item: query.item,
      content: summarize(evidences),
      evidences,
    }));

  const section8: Phase1BItem[] = results
    .filter((item) => item.query.section === "8")
    .map(({ query, evidences }) => ({
      item: query.item,
      content: summarize(evidences),
      evidences,
    }));

  const section10: Phase1BMdaSection[] = results
    .filter((item) => item.query.section === "10")
    .map(({ query, evidences }) => ({
      heading: query.item,
      points:
        evidences.length > 0
          ? evidences
              .slice(0, 3)
              .map((evidence) => evidence.snippet ?? evidence.title)
              .filter((point) => point.trim().length > 0)
          : [NOT_FOUND_TEXT],
      evidences,
    }));

  return {
    stockCode: input.stockCode,
    companyName: input.companyName,
    year: input.year,
    generatedAt: new Date().toISOString(),
    channel,
    section7,
    section8,
    section10,
  };
}

export async function collectPhase1BQualitativeWithMcp(
  input: Omit<Phase1BInput, "channel">,
  mcpCallTool: McpToolCaller,
  mcpToolName?: string,
): Promise<Phase1BQualitativeSupplement> {
  return collectPhase1BQualitative(
    { ...input, channel: "mcp" },
    { mcpCallTool, mcpToolName },
  );
}

/**
 * 从 HTTP feed（trade-signal-feed）拉取选股 universe。
 * 仅支持 **唯一** 契约：`GET {apiBasePath}/stock/screener/universe`，响应体为 `{ success, data: { total, page, pageSize, items, ... } }`。
 * 不再兼容顶层数组、`data` 为数组等历史形态；解析失败 **fail-fast** 抛错。
 */
export type ScreenerUniverseFetchMode = "all_pages" | "single_page";

export interface HttpScreenerSourceOptions {
  baseUrl: string;
  apiKey?: string;
  apiBasePath?: string;
  /** 每页条数，1–500，默认 500（与 feed `maxPageSize` 对齐） */
  pageSize?: number;
  /** `all_pages`（默认）：按 total 翻页拉满；`single_page`：仅请求第一页 */
  mode?: ScreenerUniverseFetchMode;
}

/** 单页 `data` 对象（与 feed 控制器经拦截器包装后的 `data` 一致） */
export interface ScreenerUniversePageData {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
  market?: unknown;
  capability?: unknown;
  degradeReasons?: unknown;
  pagination?: unknown;
  note?: unknown;
}

export type ScreenerUniverseFetchDiagnostics = {
  requestedPages: number;
  expectedTotal?: number;
  receivedCount: number;
  shortfall?: number;
  endedBy: "single_page" | "empty_page" | "short_page" | "reported_total" | "stagnation";
};

export type ScreenerUniverseFetchResult = {
  items: unknown[];
  diagnostics: ScreenerUniverseFetchDiagnostics;
};

/**
 * 校验并解析 feed 返回的 JSON（已解包为根对象；通常为 `{ success, data }`）。
 * @throws Error 契约不匹配时携带 `url` 便于排查
 */
export function parseScreenerUniversePayload(
  payload: unknown,
  contextUrl: string,
): ScreenerUniversePageData {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`[screener] 契约不匹配：根须为 JSON 对象（非数组），url=${contextUrl}`);
  }
  const root = payload as Record<string, unknown>;
  if (root.success === false) {
    const msg = typeof root.message === "string" ? root.message : "";
    throw new Error(`[screener] success=false${msg ? `: ${msg}` : ""}，url=${contextUrl}`);
  }
  const data = root.data;
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`[screener] 契约不匹配：data 须为对象（非数组），url=${contextUrl}`);
  }
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.items)) {
    throw new Error(`[screener] 契约不匹配：缺少 data.items 数组，url=${contextUrl}`);
  }
  for (const key of ["total", "page", "pageSize"] as const) {
    const v = d[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`[screener] 契约不匹配：data.${key} 须为有限数字，url=${contextUrl}`);
    }
  }
  return {
    items: d.items,
    total: d.total as number,
    page: d.page as number,
    pageSize: d.pageSize as number,
    market: d.market,
    capability: d.capability,
    degradeReasons: d.degradeReasons,
    pagination: d.pagination,
    note: d.note,
  };
}

/** 提取 row 上的标的代码，用于翻页去重；找不到时返回 `undefined`，调用方按原样保留。 */
function extractItemCode(item: unknown): string | undefined {
  if (item === null || typeof item !== "object") return undefined;
  const code = (item as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

export async function fetchScreenerUniverseFromHttp(
  options: HttpScreenerSourceOptions,
  market: "CN_A" | "HK",
): Promise<unknown[]> {
  return (await fetchScreenerUniverseFromHttpWithDiagnostics(options, market)).items;
}

export async function fetchScreenerUniverseFromHttpWithDiagnostics(
  options: HttpScreenerSourceOptions,
  market: "CN_A" | "HK",
): Promise<ScreenerUniverseFetchResult> {
  if (!options.baseUrl.trim()) {
    throw new Error("[screener] Missing FEED_BASE_URL or --feed-base-url for HTTP universe fetch");
  }
  const base = options.baseUrl.replace(/\/+$/, "");
  const apiBasePath = (options.apiBasePath ?? "/api/v1").replace(/\/+$/, "");
  const pageSizeRaw = options.pageSize ?? 500;
  const pageSize = Math.min(500, Math.max(1, Math.floor(pageSizeRaw)));
  const mode: ScreenerUniverseFetchMode = options.mode ?? "all_pages";

  const headers: Record<string, string> = {};
  if (options.apiKey) headers["x-api-key"] = options.apiKey;

  const all: unknown[] = [];
  const seenCodes = new Set<string>();
  let page = 1;
  let lastTotal = 0;
  let endedBy: ScreenerUniverseFetchDiagnostics["endedBy"] = "empty_page";
  const basePath = `${base}${apiBasePath}/stock/screener/universe`;

  for (;;) {
    const q = new URLSearchParams({
      market,
      page: String(page),
      pageSize: String(pageSize),
    });
    const url = `${basePath}?${q.toString()}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      throw new Error(`[screener] HTTP ${resp.status}，url=${url}`);
    }
    let payload: unknown;
    try {
      payload = (await resp.json()) as unknown;
    } catch {
      throw new Error(`[screener] 响应体非合法 JSON，url=${url}`);
    }
    const parsed = parseScreenerUniversePayload(payload, url);
    lastTotal = parsed.total;

    let addedThisPage = 0;
    let duplicatesThisPage = 0;
    for (const item of parsed.items) {
      const code = extractItemCode(item);
      if (code === undefined) {
        all.push(item);
        addedThisPage += 1;
        continue;
      }
      if (seenCodes.has(code)) {
        duplicatesThisPage += 1;
        continue;
      }
      seenCodes.add(code);
      all.push(item);
      addedThisPage += 1;
    }

    if (duplicatesThisPage > 0) {
      console.warn(
        `[screener] 翻页去重：page=${page} 收到 ${parsed.items.length} 条，重复 ${duplicatesThisPage} 条`,
      );
    }

    if (mode === "single_page") {
      endedBy = "single_page";
      break;
    }
    if (parsed.items.length === 0) {
      endedBy = "empty_page";
      break;
    }
    const effectivePageSize = Math.min(pageSize, Math.max(1, Math.floor(parsed.pageSize)));
    if (parsed.items.length < effectivePageSize) {
      endedBy = "short_page";
      break;
    }
    if (parsed.total > effectivePageSize && all.length >= parsed.total) {
      endedBy = "reported_total";
      break;
    }
    if (parsed.total <= effectivePageSize && parsed.items.length === effectivePageSize) {
      console.warn(
        `[screener] feed total=${parsed.total} 不足以判断全量（pageSize=${effectivePageSize} 且当前页满页），继续请求下一页`,
      );
    }
    if (addedThisPage === 0) {
      console.warn(
        `[screener] 翻页停滞：page=${page} 未新增任何记录（疑似 feed 分页 bug 或 total 偏大），提前退出 累计=${all.length} total=${parsed.total}`,
      );
      endedBy = "stagnation";
      break;
    }
    page += 1;
    if (page > 50_000) {
      throw new Error(`[screener] 分页安全上限：已超过 50000 页，base=${basePath}`);
    }
  }

  if (mode === "all_pages" && lastTotal > 0 && all.length !== lastTotal) {
    console.warn(
      `[screener] 翻页累计与 total 不一致：累计=${all.length} total=${lastTotal}（feed 契约可能不准；运维可加 --refresh-universe 验证）`,
    );
  }

  return {
    items: all,
    diagnostics: {
      requestedPages: page,
      expectedTotal: lastTotal > 0 ? lastTotal : undefined,
      receivedCount: all.length,
      shortfall: lastTotal > all.length ? lastTotal - all.length : undefined,
      endedBy,
    },
  };
}

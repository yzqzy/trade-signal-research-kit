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

export async function fetchScreenerUniverseFromHttp(
  options: HttpScreenerSourceOptions,
  market: "CN_A" | "HK",
): Promise<unknown[]> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const apiBasePath = (options.apiBasePath ?? "/api/v1").replace(/\/+$/, "");
  const pageSizeRaw = options.pageSize ?? 500;
  const pageSize = Math.min(500, Math.max(1, Math.floor(pageSizeRaw)));
  const mode: ScreenerUniverseFetchMode = options.mode ?? "all_pages";

  const headers: Record<string, string> = {};
  if (options.apiKey) headers["x-api-key"] = options.apiKey;

  const all: unknown[] = [];
  let page = 1;
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
    all.push(...parsed.items);

    if (mode === "single_page") break;
    if (parsed.items.length === 0) break;
    if (all.length >= parsed.total) break;
    page += 1;
    if (page > 50_000) {
      throw new Error(`[screener] 分页安全上限：已超过 50000 页，base=${basePath}`);
    }
  }

  return all;
}

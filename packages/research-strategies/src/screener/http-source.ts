/**
 * 从 HTTP feed（如 trade-signal-feed）拉取选股 universe。
 * 默认依次尝试 screener / selection 常见路径；可通过 `extraUniversePaths` 对接自定义 selection 接口。
 */
export interface HttpScreenerSourceOptions {
  baseUrl: string;
  apiKey?: string;
  apiBasePath?: string;
  /**
   * 追加在 `apiBasePath` 之后的相对路径（不含前导 `/`、不含 query），将自动附加 `?market=`。
   * 例如：`stock/feed/selection/universe` — 优先于内置默认路径尝试。
   */
  extraUniversePaths?: string[];
}

export async function fetchScreenerUniverseFromHttp(
  options: HttpScreenerSourceOptions,
  market: "CN_A" | "HK",
): Promise<unknown[]> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const apiBasePath = (options.apiBasePath ?? "/api/v1").replace(/\/+$/, "");
  const q = `?market=${encodeURIComponent(market)}`;

  const defaults = [
    `${base}${apiBasePath}/stock/screener/universe${q}`,
    `${base}${apiBasePath}/stock/screener${q}`,
    `${base}${apiBasePath}/stock/selection/universe${q}`,
  ];
  const extra = (options.extraUniversePaths ?? []).map((rel) => {
    const path = rel.replace(/^\/+/, "");
    return `${base}${apiBasePath}/${path}${q}`;
  });
  const candidates = [...extra, ...defaults];

  const headers: Record<string, string> = {};
  if (options.apiKey) headers["x-api-key"] = options.apiKey;

  for (const url of candidates) {
    const resp = await fetch(url, { headers });
    if (!resp.ok) continue;
    const payload = (await resp.json()) as unknown;
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object") {
      const data = (payload as { data?: unknown }).data;
      if (Array.isArray(data)) return data;
    }
  }
  return [];
}

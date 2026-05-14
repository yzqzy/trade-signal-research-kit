/**
 * 从 Feed 拉取多年三张表（与 provider-http 内 `/stock/financial/statements` 语义对齐）。
 */

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

export type StatementRow = {
  reportDate?: string;
  camel?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export type FeedFinancialStatementsPayload = {
  code?: string;
  years?: number;
  balance?: StatementRow[];
  income?: StatementRow[];
  cashflow?: StatementRow[];
};

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/u, "");
}

function apiBase(baseUrl: string, apiBasePath: string): string {
  const p = apiBasePath.replace(/\/+$/u, "");
  return `${normalizeBaseUrl(baseUrl)}${p}`;
}

export async function fetchFeedFinancialStatements(input: {
  code: string;
  years: number;
  reportType?: "annual" | "quarter";
}): Promise<FeedFinancialStatementsPayload | undefined> {
  const baseUrl = process.env.FEED_BASE_URL?.trim();
  if (!baseUrl) return undefined;
  const apiKey = process.env.FEED_API_KEY;
  const apiBasePath = (process.env.FEED_API_BASE_PATH ?? "/api/v1").replace(/\/+$/u, "");
  const url = new URL(
    `${apiBase(baseUrl, apiBasePath)}/stock/financial/statements/${encodeURIComponent(input.code)}`,
  );
  url.searchParams.set("reportType", input.reportType ?? "annual");
  url.searchParams.set("years", String(Math.min(15, Math.max(1, input.years))));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as ApiEnvelope<FeedFinancialStatementsPayload> | FeedFinancialStatementsPayload;
    if (payload && typeof payload === "object" && "data" in payload) {
      const wrapped = payload as ApiEnvelope<FeedFinancialStatementsPayload>;
      if (wrapped.success === false) return undefined;
      if (wrapped.data !== undefined) return wrapped.data;
    }
    return payload as FeedFinancialStatementsPayload;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

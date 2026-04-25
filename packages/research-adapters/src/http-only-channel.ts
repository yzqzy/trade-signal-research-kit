/**
 * V2 语义层默认数据通道：HTTP-only。
 * 旧开关仍可能存在，但新能力与文档必须以 HTTP 为默认真源。
 */
export type DataChannel = "http";

export function normalizeDataChannel(raw: string | undefined): DataChannel {
  const v = raw?.trim().toLowerCase();
  return v === "http" ? "http" : "http";
}

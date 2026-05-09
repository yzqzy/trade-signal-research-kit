import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import type { RankingList } from "@/lib/rankings/types";

dayjs.extend(utc);
dayjs.extend(timezone);

const REPORTS_TIMEZONE = process.env.NEXT_PUBLIC_REPORTS_TIMEZONE?.trim() || "local";

export function formatRankingTime(value: string): string {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value || "—";
  if (REPORTS_TIMEZONE === "Asia/Shanghai") {
    return `${parsed.tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss")} 北京时间`;
  }
  if (REPORTS_TIMEZONE !== "local") {
    return `${parsed.tz(REPORTS_TIMEZONE).format("YYYY-MM-DD HH:mm:ss")} ${REPORTS_TIMEZONE}`;
  }
  return parsed.format("YYYY-MM-DD HH:mm:ss");
}

export function capabilityLabel(list: RankingList): string {
  const status = list.capabilityStatus;
  if (status === "ok" || status === undefined) return "字段完整";
  if (status === "degraded_tier2_fields") return "字段降级";
  if (status === "blocked_missing_required_fields") return "字段缺失";
  if (status === "hk_not_ready") return "市场待接入";
  return status;
}

export function capabilityClass(list: RankingList): string {
  const status = list.capabilityStatus;
  if (status === "ok" || status === undefined) return "rh-status rh-status--complete";
  if (status === "degraded_tier2_fields") return "rh-status rh-status--degraded";
  return "rh-status rh-status--missing";
}

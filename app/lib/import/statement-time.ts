import { Temporal } from "@js-temporal/polyfill";
import { wallClockToInstant } from "./screenshot/time";
import type { StatementTimeOptions } from "./monthly-statement";
import type { TimeCandidateEvidence } from "./statement-rules";

export const STATEMENT_TIME_RULE_VERSION = "statement-time-v1";
type TimeKind = "execution" | "order" | "date";
export type StatementTimeResult =
  | {
      ok: true;
      executedAt: string;
      sourceTimezone: string;
      timePrecision: "second" | "date-only";
      timeEvidence: "row" | "document" | "user" | "inferred";
      timeConfidence?: number;
      timeInferenceReason?: string;
      timeRuleId?: string;
      timeCandidates?: TimeCandidateEvidence[];
      sourceTimeKind: TimeKind;
      marketCalendarDate: string;
      tradingDate?: string;
      timeRuleVersion: string;
    }
  | { ok: false; code: string; message: string };

/** Convert printed source time, never device time or settlement date. */
export function resolveStatementTime(input: {
  text: string;
  market: "US" | "HK";
  kind?: TimeKind;
  rowTimezone?: string;
  documentTimezone?: string;
  inferredTimezone?: string;
  inferenceConfidence?: number;
  inferenceReason?: string;
  inferenceRuleId?: string;
  inferenceCandidates?: TimeCandidateEvidence[];
  inferenceOverridesDocument?: boolean;
  options?: StatementTimeOptions;
  overnightNextDay?: boolean;
}): StatementTimeResult {
  const source = input.text.trim().replace(/\s+/g, " ");
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\s*,?\s*(.*))?$/.exec(source);
  if (!match) return failure("invalid-statement-time", "无法读取原始日期时间");
  let date: string;
  try {
    date = Temporal.PlainDate.from({ year: +match[1], month: +match[2], day: +match[3] }, { overflow: "reject" }).toString();
  } catch { return failure("invalid-statement-time", "原始日期无效"); }
  const kind = input.kind ?? (match[4] ? "execution" : "date");
  const marketZone = input.market === "US" ? "America/New_York" : "Asia/Hong_Kong";
  const printedZone = input.rowTimezone?.trim() || match[7]?.trim();
  const userZone = input.options?.sourceTimezone?.trim();
  const documentZone = input.documentTimezone === "market-local" ? marketZone : input.documentTimezone;
  const useUser = Boolean(userZone && (!documentZone || input.options?.overrideDocumentTimezone));
  const useInference = Boolean(input.inferredTimezone && (!documentZone || input.inferenceOverridesDocument));
  const zoneText = printedZone || (useUser ? userZone : useInference ? input.inferredTimezone : documentZone);
  const evidence = printedZone ? "row" : useUser ? "user" : useInference ? "inferred" : "document";
  const base = {
    sourceTimeKind: kind,
    timeEvidence: evidence,
    timeRuleVersion: STATEMENT_TIME_RULE_VERSION,
    ...(useInference ? { timeConfidence: input.inferenceConfidence, timeInferenceReason: input.inferenceReason } : {}),
    ...(useInference && input.inferenceRuleId ? { timeRuleId: input.inferenceRuleId } : {}),
    ...(useInference && input.inferenceCandidates ? { timeCandidates: input.inferenceCandidates.map((candidate) => ({ ...candidate, evidence: [...candidate.evidence] })) } : {}),
  } as const;

  // A date is a date, not midnight UTC. An order timestamp is not a fill time.
  if (kind === "date" || kind === "order" || !match[4]) {
    return { ok: true, ...base, executedAt: date, sourceTimezone: zoneText ? normalizeZone(zoneText) : "", timePrecision: "date-only", marketCalendarDate: date };
  }
  if (!match[6]) return failure("insufficient-statement-time", "账单仅有分钟精度，不能冒充秒级成交时间");
  if (!zoneText) return failure("missing-statement-timezone", "原件没有可确认的来源时区，请按账单证据选择时区后重新解析");
  const zone = normalizeZone(zoneText);
  const wall = `${date} ${match[4].padStart(2, "0")}:${match[5]}:${match[6]}`;
  const resolved = wallClockToInstant(wall, zone);
  if (!resolved.ok) {
    return failure(resolved.code, resolved.code === "ambiguous-wall-clock"
      ? "该当地时间处于夏令时重复小时，需要额外偏移证据"
      : resolved.code === "nonexistent-wall-clock"
        ? "该当地时间处于夏令时跳过的小时，无法对应真实时刻"
        : "日期、时间或来源时区无效");
  }
  const local = Temporal.Instant.from(resolved.executedAt).toZonedDateTimeISO(marketZone);
  const localDate = local.toPlainDate().toString();
  // Only an explicitly evidenced overnight convention enables next-day attribution.
  const tradingDate = input.market === "US" && input.overnightNextDay && local.hour >= 20
    ? local.toPlainDate().add({ days: 1 }).toString()
    : localDate;
  return {
    ok: true, ...base, executedAt: resolved.executedAt, sourceTimezone: zone,
    timePrecision: "second", marketCalendarDate: localDate,
    ...(input.overnightNextDay || input.market === "HK" ? { tradingDate } : {}),
  };
}

function failure(code: string, message: string): StatementTimeResult { return { ok: false, code, message }; }
export function normalizeZone(value: string): string {
  const text = value.trim();
  if (/^(?:US\/Eastern|America\/New_York)$/i.test(text)) return "America/New_York";
  if (/^(?:香港時間|香港时间|HKT|Asia\/Hong_Kong)$/i.test(text)) return "Asia/Hong_Kong";
  if (/^(?:Z|UTC|GMT)$/i.test(text)) return "UTC";
  const offset = /^(?:GMT|UTC)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(text);
  if (offset) return `${offset[1]}${offset[2].padStart(2, "0")}:${offset[3] ?? "00"}`;
  return text;
}

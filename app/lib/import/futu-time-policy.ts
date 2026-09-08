import { Temporal } from "@js-temporal/polyfill";
import type { TimeCandidateEvidence } from "./statement-rules";

export const FUTU_TIME_RULE_ID = "futu/time/market-session@1";

type FutuMarket = "US" | "HK";
type MarketTimePolicy = {
  timezone: "America/New_York" | "Asia/Hong_Kong";
  alternateTimezone: "America/New_York" | "Asia/Hong_Kong";
  sessionStartHour: number;
  sessionEndHour: number;
  marketConfidence: number;
  alternateConfidence: number;
  fallbackConfidence: number;
};

type FutuTimePolicy = {
  id: string;
  version: number;
  markets: Record<FutuMarket, MarketTimePolicy>;
};

const FUTU_TIME_POLICIES: readonly FutuTimePolicy[] = Object.freeze([
  Object.freeze({
    id: FUTU_TIME_RULE_ID,
    version: 1,
    markets: {
      US: {
        timezone: "America/New_York",
        alternateTimezone: "Asia/Hong_Kong",
        sessionStartHour: 4,
        sessionEndHour: 20,
        marketConfidence: 0.93,
        alternateConfidence: 0.78,
        fallbackConfidence: 0.72,
      },
      HK: {
        timezone: "Asia/Hong_Kong",
        alternateTimezone: "America/New_York",
        sessionStartHour: 8,
        sessionEndHour: 20,
        marketConfidence: 0.95,
        alternateConfidence: 0.78,
        fallbackConfidence: 0.72,
      },
    },
  } as FutuTimePolicy),
]);

export type FutuTimeInference = {
  timezone: "America/New_York" | "Asia/Hong_Kong";
  confidence: number;
  reason: string;
  overridesDocumentTimezone: boolean;
  ruleId: string;
  candidates: TimeCandidateEvidence[];
};

type TimePolicy = (typeof FUTU_TIME_POLICIES)[number];

function wallClock(text: string): Temporal.PlainDateTime | undefined {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})/.exec(text.trim());
  if (!match) return undefined;
  try {
    return Temporal.PlainDateTime.from({
      year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
      hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6]),
    }, { overflow: "reject" });
  } catch {
    return undefined;
  }
}

function fitsBroadMarketSession(wall: Temporal.PlainDateTime, sourceTimezone: string, policy: MarketTimePolicy) {
  try {
    const instant = Temporal.ZonedDateTime.from({
      year: wall.year,
      month: wall.month,
      day: wall.day,
      hour: wall.hour,
      minute: wall.minute,
      second: wall.second,
      timeZone: sourceTimezone,
    }, { disambiguation: "reject", overflow: "reject" }).toInstant();
    const local = instant.toZonedDateTimeISO(policy.timezone);
    return local.hour >= policy.sessionStartHour && local.hour < policy.sessionEndHour;
  } catch {
    return false;
  }
}

function policyFor(market: FutuMarket): MarketTimePolicy {
  const policy: TimePolicy = FUTU_TIME_POLICIES[0];
  return policy.markets[market];
}

function withVenue(reason: string, venue: string | undefined): string {
  return venue ? `${reason}（${venue}）` : reason;
}

/** Infer only when the statement has no row-level zone; keep the decision on each execution. */
export function inferFutuTransactionTimezone(input: {
  text: string;
  market: "US" | "HK";
  documentTimezone?: string;
  venue?: string;
}): FutuTimeInference | undefined {
  const wall = wallClock(input.text);
  if (!wall) return undefined;
  const policy = policyFor(input.market);
  const marketFits = fitsBroadMarketSession(wall, policy.timezone, policy);
  const alternateFits = fitsBroadMarketSession(wall, policy.alternateTimezone, policy);
  const venue = input.venue?.trim();
  const marketName = input.market === "US" ? "美股" : "港股";
  const marketLocalName = input.market === "US" ? "纽约" : "香港";

  if (input.documentTimezone !== "market-local") {
    return {
      timezone: policy.timezone,
      confidence: policy.marketConfidence,
      reason: withVenue(`富途历史账单缺少行内时区，按${marketName}市场及成交时段推断`, venue),
      overridesDocumentTimezone: false,
      ruleId: FUTU_TIME_RULE_ID,
      candidates: [{ timezone: policy.timezone, score: policy.marketConfidence, evidence: ["market-default", "market-session"] }],
    };
  }

  if (marketFits && !alternateFits) {
    return {
      timezone: policy.timezone,
      confidence: policy.marketConfidence,
      reason: withVenue(`原件声明为当地市场时间，${marketLocalName}市场时段与该笔时间一致`, venue),
      overridesDocumentTimezone: true,
      ruleId: FUTU_TIME_RULE_ID,
      candidates: [{ timezone: policy.timezone, score: policy.marketConfidence, evidence: ["market-session"] }],
    };
  }
  if (!marketFits && alternateFits) {
    return {
      timezone: policy.alternateTimezone,
      confidence: policy.alternateConfidence,
      reason: withVenue(`原件声明为当地市场时间，${marketLocalName}市场时段不匹配，替代时区与成交时段一致`, venue),
      overridesDocumentTimezone: true,
      ruleId: FUTU_TIME_RULE_ID,
      candidates: [{ timezone: policy.alternateTimezone, score: policy.alternateConfidence, evidence: ["alternate-market-session"] }],
    };
  }
  return {
    timezone: policy.timezone,
    confidence: policy.fallbackConfidence,
    reason: withVenue("原件声明为当地市场时间，但该笔时间无法由单一市场时段唯一确认", venue),
    overridesDocumentTimezone: true,
    ruleId: FUTU_TIME_RULE_ID,
    candidates: [
      { timezone: policy.timezone, score: policy.fallbackConfidence, evidence: ["ambiguous-market-session"] },
      { timezone: policy.alternateTimezone, score: policy.fallbackConfidence, evidence: ["ambiguous-market-session"] },
    ],
  };
}

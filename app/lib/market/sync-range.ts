import Decimal from "decimal.js";

import {
  CalendarOutOfRangeError,
  expectedTradingDates,
} from "./calendar";
import type { DateRange } from "./coverage-planner";
import type { SupportedMarket } from "./contracts";
import { marketLocalTimestampToIso } from "./providers/errors";
import { marketTimeZone, marketTradingDate } from "./trading-date";

/** Match the regular daily-candle knowledge cutoffs in `types.ts`. */
const REGULAR_MARKET_SESSION_CLOSES = {
  US: "16:00:00",
  HK: "16:10:00",
  "CN-SH": "15:00:00",
  "CN-SZ": "15:00:00",
} satisfies Record<SupportedMarket, string>;

/**
 * Verified session-schedule coverage. Unlisted dates deliberately use the
 * regular close as a conservative safe cutoff; this table does not claim
 * early-close coverage beyond its sources.
 *
 * Sources:
 * - NYSE 2026 calendar:
 *   https://www.nyse.com/trade/hours-calendars?ecid=psgonsgcgaen1n
 * - HKEX 2026 securities calendar (CE_SEHK_CT_075_2025, p. 2):
 *   https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2025/ce_SEHK_CT_075_2025.pdf
 * - HKEX securities trading hours (CAS latest 12:10):
 *   https://www.hkex.com.hk/Services/Trading-hours-and-Severe-Weather-Arrangements/Trading-Hours/Securities-Market?sc_lang=en
 * - SSE trading rules (regular session ends at 15:00):
 *   https://www.sse.com.cn/lawandrules/sselawsrules2025/stocks/exchange/c/c_20260424_10816482.shtml
 * - SZSE trading overview (regular session ends at 15:00):
 *   https://investor.szse.cn/English/services/trading/tradOverview/index.html
 */
const EARLY_MARKET_SESSION_CLOSES: Partial<
  Record<SupportedMarket, Record<string, string>>
> = {
  US: {
    "2026-11-27": "13:00:00",
    "2026-12-24": "13:00:00",
    "2027-11-26": "13:00:00",
    "2028-07-03": "13:00:00",
    "2028-11-24": "13:00:00",
  },
  HK: {
    "2026-02-16": "12:10:00",
    "2026-12-24": "12:10:00",
    "2026-12-31": "12:10:00",
  },
};

const VERIFIED_SESSION_SCHEDULE_YEARS: Partial<
  Record<SupportedMarket, ReadonlySet<number>>
> = {
  US: new Set([2026, 2027, 2028]),
  HK: new Set([2026]),
  // The current ticket has source-backed regular-session evidence for 2026
  // only. Historical CN sessions may have exceptional intraday closures;
  // no early-close dates are inferred for those years.
  "CN-SH": new Set([2026]),
  "CN-SZ": new Set([2026]),
};

function hasVerifiedSessionSchedule(
  market: SupportedMarket,
  date: string,
) {
  return (
    VERIFIED_SESSION_SCHEDULE_YEARS[market]?.has(Number(date.slice(0, 4))) ??
    false
  );
}

function marketSessionClose(
  market: SupportedMarket,
  date: string,
) {
  const verifiedEarlyClose = EARLY_MARKET_SESSION_CLOSES[market]?.[date];
  if (verifiedEarlyClose) {
    return { time: verifiedEarlyClose, source: "verified-early-close" as const };
  }
  return {
    time: REGULAR_MARKET_SESSION_CLOSES[market],
    source: "conservative-regular-cutoff" as const,
  };
}

export const MIN_FORWARD_DAILY_SESSIONS = 180;

function shiftIsoDate(timestamp: string, days: number) {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function latestCompletedSession(
  market: SupportedMarket,
  now: Date,
) {
  const localDate = marketTradingDate(now.toISOString(), market);
  const regularSessionCloseAt = Date.parse(
    marketLocalTimestampToIso(
      `${localDate} ${REGULAR_MARKET_SESSION_CLOSES[market]}`,
      marketTimeZone(market),
    ),
  );
  const isKnownTradingDate = expectedTradingDates(
    market,
    localDate,
    localDate,
  ).length > 0;
  if (
    isKnownTradingDate &&
    !hasVerifiedSessionSchedule(market, localDate) &&
    now.getTime() < regularSessionCloseAt
  ) {
    throw new CalendarOutOfRangeError(
      `${market} ${localDate.slice(0, 4)} 年半日交易时段尚未核实，无法确认 ${localDate} 是否已收盘`,
    );
  }
  const sessionClose = marketSessionClose(market, localDate);
  const sessionCloseAt = Date.parse(
    marketLocalTimestampToIso(
      `${localDate} ${sessionClose.time}`,
      marketTimeZone(market),
    ),
  );
  // When an early close is unverified, the regular close is a conservative
  // boundary: before it we cannot claim today's session is complete; at or
  // after it every earlier early close is necessarily complete.
  const latestCandidate =
    now.getTime() >= sessionCloseAt
      ? localDate
      : shiftIsoDate(`${localDate}T00:00:00.000Z`, -1);
  const lookback = shiftIsoDate(
    `${latestCandidate}T00:00:00.000Z`,
    -14,
  );
  const dates = expectedTradingDates(market, lookback, latestCandidate);
  const latest = dates.at(-1);
  if (latest === undefined) {
    throw new CalendarOutOfRangeError(
      `${market} 在 ${latestCandidate} 前没有可确认的已完成交易日`,
    );
  }
  return latest;
}

function dailyEndAfterLastTrade(
  lastTradeAt: string,
  market: SupportedMarket,
  now: Date,
) {
  const lastTradeDate = marketTradingDate(lastTradeAt, market);
  const latestAvailableDate = latestCompletedSession(market, now);
  if (latestAvailableDate <= lastTradeDate) return lastTradeDate;

  try {
    const forwardDates = expectedTradingDates(
      market,
      shiftIsoDate(`${lastTradeDate}T00:00:00.000Z`, 1),
      latestAvailableDate,
    );
    return (
      forwardDates[MIN_FORWARD_DAILY_SESSIONS - 1] ??
      forwardDates.at(-1) ??
      lastTradeDate
    );
  } catch (error) {
    if (!(error instanceof CalendarOutOfRangeError)) throw error;
    return latestAvailableDate;
  }
}

function dailyEndForOpenPosition(
  market: SupportedMarket,
  now: Date,
) {
  // An open holding is valued only through the latest completed session.
  // This also keeps an execution from an unfinished current session from
  // widening the daily request into a future bar.
  return latestCompletedSession(market, now);
}

export function requiredMarketDataRange(
  firstTradeAt: string,
  lastTradeAt: string,
  options?: {
    open?: boolean;
    market?: SupportedMarket;
    now?: Date;
  },
) {
  let endDate = shiftIsoDate(lastTradeAt, 35);
  if (options?.market) {
    const now = options.now ?? new Date();
    endDate = options.open
      ? dailyEndForOpenPosition(options.market, now)
      : dailyEndAfterLastTrade(lastTradeAt, options.market, now);
  }
  return {
    startDate: shiftIsoDate(firstTradeAt, -400),
    endDate,
  };
}

export function requiredRangeExpanded(
  before: DateRange | undefined,
  after: DateRange,
) {
  return (
    before === undefined ||
    after.startDate < before.startDate ||
    after.endDate > before.endDate
  );
}

export function hasOpenPosition(
  executions: Array<{
    accountId: string;
    side: "buy" | "sell";
    quantity: string;
  }>,
) {
  const positions = new Map<string, Decimal>();
  for (const execution of executions) {
    const signed = new Decimal(execution.quantity).times(
      execution.side === "buy" ? 1 : -1,
    );
    positions.set(
      execution.accountId,
      (positions.get(execution.accountId) ?? new Decimal(0)).plus(signed),
    );
  }
  return [...positions.values()].some((position) => !position.isZero());
}

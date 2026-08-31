import type {
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
  NativeIntradayInterval,
} from "./contracts";
import type { Timeframe } from "./types";

export type TimeframeAvailability = Record<
  Timeframe,
  { enabled: boolean; reason?: string }
>;

const INTRADAY_UNAVAILABLE_REASONS: Record<string, string> = {
  "provider-history-limit": "公开行情源未覆盖该交易日期的 15 分钟行情",
  "source-rate-limited": "公开行情源暂时限制访问",
  "source-forbidden": "公开行情源拒绝访问 15 分钟行情",
  "source-timeout": "公开行情源请求超时",
  "source-unavailable": "公开行情源暂不可用",
  "no-data": "该交易日期没有 15 分钟行情",
};

const INTRADAY_UNAVAILABLE_STATUSES: Partial<
  Record<IntervalCoverageSegment["status"], string>
> = {
  complete: "已获取该周期行情但没有可用的 15 分钟数据",
  syncing: "正在获取 15 分钟行情",
  partial: "15 分钟行情暂不可用",
  stale: "15 分钟行情需要更新",
  "source-rate-limited": "公开行情源暂时限制访问",
  "source-forbidden": "公开行情源拒绝访问 15 分钟行情",
  "source-unavailable": "公开行情源暂不可用",
  "invalid-response": "公开行情源返回的 15 分钟行情格式异常",
  "storage-error": "本地存储失败",
};

export function resolveTimeframeAvailability(input: {
  intradayCandles: MarketCandleRecord[];
  dailyCandles: DailyCandleRecord[];
  intradayCoverage: IntervalCoverageSegment[];
  intradayInterval?: NativeIntradayInterval;
}): TimeframeAvailability {
  const intradayInterval =
    input.intradayInterval ??
    (input.intradayCandles.some((candle) => candle.interval === "1h")
      ? "1h"
      : "15m");
  const hasIntraday = input.intradayCandles.some(
    (candle) => candle.interval === intradayInterval,
  );
  const hasDaily = input.dailyCandles.length > 0;
  const fifteenMinute = hasIntraday && intradayInterval === "15m"
    ? { enabled: true }
    : {
        enabled: false,
        reason:
          hasIntraday && intradayInterval === "1h"
            ? "原生 1 小时行情无法生成 15 分钟数据"
            : intradayUnavailableReason(input.intradayCoverage, "15m"),
      };
  const hourly = hasIntraday
    ? { enabled: true }
    : { enabled: false, reason: intradayUnavailableReason(input.intradayCoverage, intradayInterval) };
  const daily = hasDaily
    ? { enabled: true }
    : { enabled: false, reason: "尚未获取该周期行情" };

  return {
    "15m": { ...fifteenMinute },
    "1h": { ...hourly },
    "4h": { ...hourly },
    "1D": { ...daily },
    "1W": { ...daily },
  };
}

function intradayUnavailableReason(
  coverage: IntervalCoverageSegment[],
  interval: NativeIntradayInterval,
) {
  const intradayCoverage = coverage.filter((item) => item.interval === interval);
  if (intradayCoverage.length === 0) return "尚未获取该周期行情";

  const reason = intradayCoverage.find(
    (item) => item.reason && INTRADAY_UNAVAILABLE_REASONS[item.reason],
  )?.reason;
  if (reason) {
    return INTRADAY_UNAVAILABLE_REASONS[reason].replace(
      "15 分钟",
      interval === "1h" ? "1 小时" : "15 分钟",
    );
  }

  const status = intradayCoverage.find(
    (item) => item.status !== "not-requested",
  )?.status;
  if (status && INTRADAY_UNAVAILABLE_STATUSES[status]) {
    return INTRADAY_UNAVAILABLE_STATUSES[status];
  }
  return "尚未获取该周期行情";
}

import Decimal from "decimal.js";

import type {
  ProviderDailyCandle,
  ProviderMarketCandle,
} from "./contracts";

function decimal(value: string, field: string) {
  if (!value.trim()) {
    throw new Error(`${field}不是有效数字`);
  }
  try {
    const result = new Decimal(value);
    if (!result.isFinite()) {
      throw new Error(`${field}不是有限数字`);
    }
    return result;
  } catch {
    if (value === "NaN" || value.includes("Infinity")) {
      throw new Error(`${field}不是有限数字`);
    }
    throw new Error(`${field}不是有效数字`);
  }
}

function validateOhlcv(candle: {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}) {
  const open = decimal(candle.open, "开盘价");
  const high = decimal(candle.high, "最高价");
  const low = decimal(candle.low, "最低价");
  const close = decimal(candle.close, "收盘价");
  const volume = decimal(candle.volume, "成交量");

  if (
    low.isNegative() ||
    open.isNegative() ||
    high.isNegative() ||
    close.isNegative() ||
    low.gt(open) ||
    low.gt(close) ||
    high.lt(open) ||
    high.lt(close)
  ) {
    throw new Error("价格关系无效");
  }
  if (volume.isNegative()) {
    throw new Error("成交量不能为负数");
  }
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

export function validateProviderCandles(
  candles: ProviderDailyCandle[],
  startDate: string,
  endDate: string,
) {
  let previousDate = "";

  for (const candle of candles) {
    if (!isIsoDate(candle.tradingDate)) {
      throw new Error("交易日期无效");
    }
    if (
      candle.tradingDate < startDate ||
      candle.tradingDate > endDate
    ) {
      throw new Error("日期超出请求区间");
    }
    if (candle.tradingDate <= previousDate) {
      throw new Error("日期必须严格递增");
    }

    validateOhlcv(candle);
    previousDate = candle.tradingDate;
  }

  return candles;
}

export function validateProviderMarketCandles(
  candles: ProviderMarketCandle[],
  startTime: string,
  endTime: string,
) {
  let previousTimestamp = "";

  for (const candle of candles) {
    const timestamp = Date.parse(candle.timestamp);
    if (
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString() !== candle.timestamp
    ) {
      throw new Error("交易时间无效");
    }
    if (candle.timestamp < startTime || candle.timestamp > endTime) {
      throw new Error("时间超出请求区间");
    }
    if (candle.timestamp <= previousTimestamp) {
      throw new Error("时间必须严格递增");
    }

    validateOhlcv(candle);
    previousTimestamp = candle.timestamp;
  }

  return candles;
}

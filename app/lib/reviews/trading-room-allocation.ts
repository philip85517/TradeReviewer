import Decimal from "decimal.js";

import type { CurrentPortfolioModel, CurrentPortfolioRow } from "./trading-room-portfolio";
import {
  buildRoomMoneyView,
  roomMoneyValue,
  type RoomDisplayCurrency,
  type RoomFxSnapshot,
  type RoomTargetCurrency,
} from "./trading-room-scope";

export type RoomAllocationOptions = {
  dimension: "market" | "assetType";
  reportCurrency: RoomDisplayCurrency;
  fxSnapshot?: RoomFxSnapshot;
  targetCurrency?: RoomTargetCurrency;
  /** Original-currency mode is deliberately local to this card. */
  selectedCurrency?: string;
};

export type RoomAllocationItem = {
  label: string;
  /** Net value for this category. Signed in a long/short group. */
  amount: string | null;
  /** Net share. It remains null until every visible row is trusted. */
  percent: string | null;
  available: number;
  total: number;
  /** Gross side values used by the signed bar renderer. */
  longAmount: string | null;
  shortAmount: string | null;
  grossAmount: string | null;
  longPercent: string | null;
  shortPercent: string | null;
  reason: string | null;
};

export type RoomAllocationGroup = {
  currency: string;
  netValue: string | null;
  /** Sum of absolute trusted position values, never netted. */
  denominator: string;
  items: RoomAllocationItem[];
  signed: boolean;
  complete: boolean;
  available: number;
  total: number;
  missingReasons: string[];
  note: string;
};

function currencyCode(value: string | null | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$") return "HKD";
  if (currency === "美元" || currency === "US$") return "USD";
  return currency;
}

function displayCurrency(options: RoomAllocationOptions): RoomTargetCurrency | undefined {
  return options.targetCurrency
    ?? (options.reportCurrency === "CNY" || options.reportCurrency === "HKD" ? options.reportCurrency : undefined);
}

function targetAmount(
  row: CurrentPortfolioRow,
  targetCurrency: RoomTargetCurrency | undefined,
  fxSnapshot: RoomFxSnapshot | undefined,
): string | null {
  if (row.marketValue === null || !row.holding.settlementCurrency) return null;
  if (!targetCurrency) return row.marketValue;
  const view = buildRoomMoneyView([{
    currency: row.holding.settlementCurrency,
    amount: row.marketValue,
  }], fxSnapshot, targetCurrency);
  return view.converted ?? roomMoneyValue(view);
}

function labelFor(row: CurrentPortfolioRow, dimension: RoomAllocationOptions["dimension"]): string {
  if (dimension === "assetType") {
    if (row.holding.assetType === "etf") return "ETF";
    if (row.holding.assetType === "stock") return "股票";
    return "类型待核对";
  }
  const market = row.holding.market.trim().toUpperCase();
  if (["CN", "CN-SH", "CN-SZ", "SH", "SSE", "SZ", "SZSE"].includes(market)) return "A股";
  return row.holding.marketLabel || row.holding.market || "市场待核对";
}

function sourceCurrency(row: CurrentPortfolioRow): string {
  return currencyCode(row.holding.settlementCurrency) || "币种待核对";
}

function decimal(value: string | null): Decimal | null {
  if (value === null) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function text(value: Decimal | null): string | null {
  return value === null ? null : value.toString();
}

function percent(value: Decimal | null, denominator: Decimal, usable: boolean): string | null {
  if (!usable || value === null || !denominator.gt(0)) return null;
  return value.div(denominator).mul(100).toDecimalPlaces(8).toString();
}

type Bucket = {
  total: number;
  available: number;
  long: Decimal;
  short: Decimal;
  unknown: Decimal;
  reasons: Set<string>;
};

function itemFromBucket(
  label: string,
  bucket: Bucket,
  denominator: Decimal,
  complete: boolean,
  directionComplete: boolean,
  signed: boolean,
): RoomAllocationItem {
  const amount = bucket.long.plus(bucket.short).plus(bucket.unknown);
  const usable = complete && directionComplete && denominator.gt(0);
  const hasValue = bucket.available > 0;
  const netValue = hasValue ? text(amount) : null;
  const longValue = bucket.long.gt(0) ? text(bucket.long) : null;
  const shortValue = bucket.short.lt(0) ? text(bucket.short) : null;
  const gross = bucket.long.abs().plus(bucket.short.abs()).plus(bucket.unknown.abs());
  const reason = bucket.reasons.size > 0 ? [...bucket.reasons].join("；") : null;
  return {
    label,
    amount: netValue,
    percent: percent(hasValue ? amount : null, denominator, usable),
    available: bucket.available,
    total: bucket.total,
    longAmount: longValue,
    shortAmount: shortValue,
    grossAmount: hasValue ? text(gross) : null,
    longPercent: percent(bucket.long.gt(0) ? bucket.long : null, denominator, usable && signed),
    shortPercent: percent(bucket.short.lt(0) ? bucket.short : null, denominator, usable && signed),
    reason,
  };
}

function groupFor(
  rows: readonly CurrentPortfolioRow[],
  currency: string,
  options: RoomAllocationOptions,
  targetCurrency: RoomTargetCurrency | undefined,
): RoomAllocationGroup {
  const selected = targetCurrency
    ? rows
    : rows.filter(row => sourceCurrency(row) === currency);
  const buckets = new Map<string, Bucket>();
  let available = 0;
  let directionComplete = true;
  let signed = false;
  let denominator = new Decimal(0);
  const missingReasons = new Set<string>();
  const amountsForConversion = selected
    .filter(row => row.marketValue !== null && row.holding.settlementCurrency)
    .map(row => ({ currency: row.holding.settlementCurrency!, amount: row.marketValue }));
  const conversion = targetCurrency
    ? buildRoomMoneyView(amountsForConversion, options.fxSnapshot, targetCurrency)
    : null;

  for (const row of selected) {
    const label = labelFor(row, options.dimension);
    const bucket = buckets.get(label) ?? {
      total: 0,
      available: 0,
      long: new Decimal(0),
      short: new Decimal(0),
      unknown: new Decimal(0),
      reasons: new Set<string>(),
    };
    bucket.total += 1;
    const amount = targetAmount(row, targetCurrency, options.fxSnapshot);
    const direction = row.holding.direction;
    if (direction !== "long" && direction !== "short") {
      directionComplete = false;
      bucket.reasons.add("多空方向待核对");
    }
    if (amount === null) {
      if (row.marketValue === null) {
        bucket.reasons.add(row.holding.statusReason ?? "缺少可信行情，市值不可用");
        missingReasons.add(row.holding.statusReason ?? "缺少可信行情，市值不可用");
      } else if (!row.holding.settlementCurrency) {
        bucket.reasons.add("结算币种待核对，无法合计");
        missingReasons.add("结算币种待核对，无法合计");
      } else if (targetCurrency) {
        bucket.reasons.add(`缺少完整${targetCurrency}汇率，无法换算`);
        missingReasons.add(`缺少完整${targetCurrency}汇率，无法换算`);
      }
      buckets.set(label, bucket);
      continue;
    }
    const value = decimal(amount);
    if (value === null) {
      bucket.reasons.add("市值金额无效");
      missingReasons.add("市值金额无效");
      buckets.set(label, bucket);
      continue;
    }
    available += 1;
    bucket.available += 1;
    const absolute = value.abs();
    denominator = denominator.plus(absolute);
    if (direction === "short") {
      const shortValue = value.gt(0) ? value.negated() : value;
      bucket.short = bucket.short.plus(shortValue);
      signed = true;
    } else if (direction === "long") {
      bucket.long = bucket.long.plus(value.abs());
    } else {
      bucket.unknown = bucket.unknown.plus(value);
    }
    buckets.set(label, bucket);
  }

  const total = selected.length;
  const complete = total === 0 || available === total && directionComplete;
  if (!complete) missingReasons.add(`缺失估值：${total - available} 个仓位缺少可信市值`);
  if (!directionComplete) missingReasons.add("存在待核对的多空方向");
  if (conversion && conversion.conversion !== "same-currency" && conversion.converted === null) {
    missingReasons.add(conversion.note);
  }
  const items = [...buckets.entries()].map(([label, bucket]) => itemFromBucket(
    label,
    bucket,
    denominator,
    complete,
    directionComplete,
    signed,
  ));
  const netValue = items.some(item => item.amount !== null)
    ? items.reduce((sum, item) => sum.plus(item.amount ?? 0), new Decimal(0)).toString()
    : null;
  const noteParts = [
    complete ? "完整覆盖" : "可用小计，比例不可用",
    ...missingReasons,
  ];
  if (!targetCurrency && currency === "币种待核对") noteParts.push("未知币种不纳入已知币种分母");
  if (signed) noteParts.push(complete
    ? "空头以负条形表示，比例分母为多空绝对市值总敞口"
    : "空头保留负号，多空可信小计分开");
  return {
    currency,
    netValue,
    denominator: denominator.toString(),
    items,
    signed,
    complete,
    available,
    total,
    missingReasons: [...missingReasons],
    note: noteParts.join("；"),
  };
}

export function buildRoomAllocation(model: CurrentPortfolioModel, options: RoomAllocationOptions) {
  const targetCurrency = displayCurrency(options);
  const allCurrencies = [...new Set(model.rows.map(sourceCurrency))];
  const selectedCurrency = targetCurrency
    ? targetCurrency
    : options.selectedCurrency && allCurrencies.includes(currencyCode(options.selectedCurrency))
      ? currencyCode(options.selectedCurrency)
      : allCurrencies[0];
  const currencies = targetCurrency
    ? (model.rows.length ? [targetCurrency] : [])
    : allCurrencies;
  const allGroups = targetCurrency
    ? (model.rows.length ? [groupFor(model.rows, targetCurrency, options, targetCurrency)] : [])
    : allCurrencies.map(currency => groupFor(model.rows, currency, options, undefined));
  const groups = currencies
    .filter(currency => targetCurrency || options.selectedCurrency === undefined || currency === selectedCurrency)
    .map(currency => groupFor(model.rows, currency, options, targetCurrency));
  const available = targetCurrency
    ? groups.reduce((sum, group) => sum + group.available, 0)
    : model.rows.filter(row => sourceCurrency(row) === selectedCurrency && targetAmount(row, undefined, options.fxSnapshot) !== null).length;
  const total = targetCurrency
    ? model.rows.length
    : model.rows.filter(row => sourceCurrency(row) === selectedCurrency).length;
  const conversion = targetCurrency
    ? buildRoomMoneyView(model.rows.filter(row => row.marketValue !== null && row.holding.settlementCurrency).map(row => ({ currency: row.holding.settlementCurrency!, amount: row.marketValue })), options.fxSnapshot, targetCurrency)
    : null;
  const note = model.rows.length === 0
    ? "暂无可信持仓市值"
    : targetCurrency
      ? conversion?.note ?? `报告币种为${targetCurrency}`
      : allCurrencies.length > 1
        ? "原币仅显示当前选中币种，不能跨币种相加"
        : "原币按当前选中币种计算";
  const unknownCurrencyCount = model.rows.filter(row => sourceCurrency(row) === "币种待核对").length;
  const globalAvailable = allGroups.reduce((sum, group) => sum + group.available, 0);
  const globalTotal = model.rows.length;
  const globalMissingReasons = [...new Set([
    ...allGroups.flatMap(group => group.missingReasons),
    ...(unknownCurrencyCount > 0 ? [`${unknownCurrencyCount} 个仓位结算币种待核对`] : []),
  ])];
  const globalComplete = model.rows.length === 0 || allGroups.every(group => group.complete) && unknownCurrencyCount === 0;
  const globalNote = model.rows.length === 0
    ? "暂无可信持仓市值"
    : targetCurrency
      ? globalComplete ? `报告币种${targetCurrency}完整覆盖` : `报告币种${targetCurrency}仅保留可信小计，当前覆盖 ${globalAvailable}/${globalTotal} 个仓位`
      : allCurrencies.length > 1 || unknownCurrencyCount > 0
        ? `原币仅显示当前选中币种；全卡覆盖 ${globalAvailable}/${globalTotal} 个仓位${globalComplete ? "" : "，仍有币种或估值缺口"}`
        : "原币按当前选中币种计算";
  return {
    groups,
    currencies,
    selectedCurrency,
    complete: options.selectedCurrency === undefined ? globalComplete : groups.every(group => group.complete),
    globalComplete,
    globalAvailable,
    globalTotal,
    globalMissingReasons,
    globalNote,
    unknownCurrencyCount,
    available,
    total,
    asOf: model.asOf,
    note,
    empty: model.rows.length === 0,
  };
}

export type RoomAllocationModel = ReturnType<typeof buildRoomAllocation>;

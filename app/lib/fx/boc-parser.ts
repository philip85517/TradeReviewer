import Decimal from "decimal.js";

import type { RequiredForeignCurrency } from "./contracts";

export type ParsedBocRate = {
  currency: RequiredForeignCurrency;
  rate: string;
  publishedAt: string;
};

export class BocParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BocParseError";
  }
}

const CURRENCY_NAMES: Readonly<Record<string, RequiredForeignCurrency>> = {
  美元: "USD",
  "美元(USD)": "USD",
  USD: "USD",
  港币: "HKD",
  港元: "HKD",
  "港币(HKD)": "HKD",
  HKD: "HKD",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;?/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&#(x[\da-f]+|\d+);?/giu, (_match, code: string) => {
      const parsed = code.toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    });
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRows(html: string): string[] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/giu)].map((match) => match[1]);
}

function extractCells(row: string, tag: "td" | "th"): string[] {
  return [...row.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, "giu"))]
    .map((match) => textOf(match[1]));
}

function normalizeHeader(header: string): string {
  return header.replace(/[\s:：]/g, "");
}

function numericRate(value: string): string | undefined {
  const compact = value.replace(/[\s,，\u00a0]/g, "");
  if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(compact)) return undefined;
  try {
    const parsed = new Decimal(compact);
    if (!parsed.isFinite() || parsed.lte(0)) return undefined;
    const normalized = parsed.div(100);
    return normalized.isFinite() && normalized.gt(0) ? normalized.toString() : undefined;
  } catch {
    return undefined;
  }
}

function timestamp(dateValue: string, timeValue: string): string | undefined {
  const dateMatch = dateValue.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/);
  if (!dateMatch) return undefined;
  const [, year, month, day, dateHour, dateMinute, dateSecond, dateFraction] = dateMatch;
  const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/);
  const hour = dateHour ?? timeMatch?.[1];
  const minute = dateMinute ?? timeMatch?.[2];
  const second = dateSecond ?? timeMatch?.[3] ?? "00";
  const fraction = dateFraction ?? timeMatch?.[4];
  if (!hour || !minute || !timeMatch && !dateHour) return undefined;
  const numeric = [year, month, day, hour, minute, second].map(Number);
  const [yearNumber, monthNumber, dayNumber, hourNumber, minuteNumber, secondNumber] = numeric;
  const checked = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber, hourNumber, minuteNumber, secondNumber));
  if (
    !Number.isFinite(checked.getTime()) ||
    checked.getUTCFullYear() !== yearNumber ||
    checked.getUTCMonth() !== monthNumber - 1 ||
    checked.getUTCDate() !== dayNumber ||
    checked.getUTCHours() !== hourNumber ||
    checked.getUTCMinutes() !== minuteNumber ||
    checked.getUTCSeconds() !== secondNumber ||
    monthNumber < 1 || monthNumber > 12 ||
    hourNumber > 23 || minuteNumber > 59 || secondNumber > 59
  ) return undefined;
  const fractionText = fraction ? `.${fraction.slice(0, 3).padEnd(3, "0")}` : "";
  return `${yearNumber.toString().padStart(4, "0")}-${monthNumber.toString().padStart(2, "0")}-${dayNumber.toString().padStart(2, "0")}T${hourNumber.toString().padStart(2, "0")}:${minuteNumber.toString().padStart(2, "0")}:${secondNumber.toString().padStart(2, "0")}${fractionText}+08:00`;
}

function tableHtml(source: string): string {
  const match = source.match(/<table\b(?=[^>]*\bid\s*=\s*["']priceTable["'])[^>]*>([\s\S]*?)<\/table\s*>/iu);
  if (!match) throw new BocParseError("BOC price table not found");
  return match[1];
}

export function parseBocRates(source: string): Map<string, ParsedBocRate> {
  const table = tableHtml(source);
  const thead = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead\s*>/iu)?.[1];
  const headerRow = thead ? extractRows(thead)[0] : extractRows(table)[0];
  if (!headerRow) throw new BocParseError("BOC price table headers not found");
  const headers = extractCells(headerRow, "th");
  const resolvedHeaders = headers.length ? headers : extractCells(headerRow, "td");
  const headerIndex = (name: string) => resolvedHeaders.findIndex((header) => normalizeHeader(header).includes(name));
  const currencyIndex = headerIndex("货币名称");
  const rateIndex = headerIndex("中行折算价");
  const dateIndex = headerIndex("发布日期");
  const timeIndex = headerIndex("发布时间");
  if ([currencyIndex, rateIndex, dateIndex, timeIndex].some((index) => index < 0)) {
    throw new BocParseError("BOC price table headers not found");
  }

  const body = thead
    ? table.replace(/<thead\b[^>]*>[\s\S]*?<\/thead\s*>/iu, "")
    : table;
  const result = new Map<string, ParsedBocRate>();
  for (const row of extractRows(body)) {
    const cells = extractCells(row, "td");
    const requiredCellCount = Math.max(currencyIndex, rateIndex, dateIndex, timeIndex) + 1;
    if (cells.length < requiredCellCount) continue;
    const currency = CURRENCY_NAMES[cells[currencyIndex]];
    if (!currency) continue;
    const rate = numericRate(cells[rateIndex]);
    const publishedAt = timestamp(cells[dateIndex], cells[timeIndex]);
    if (!rate || !publishedAt) continue;
    const existing = result.get(currency);
    if (!existing || Date.parse(publishedAt) >= Date.parse(existing.publishedAt)) {
      result.set(currency, { currency, rate, publishedAt });
    }
  }
  return result;
}

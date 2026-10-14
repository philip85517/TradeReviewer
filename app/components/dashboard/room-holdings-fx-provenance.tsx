import type { RoomFxSnapshot } from "../../lib/reviews/trading-room-scope";
import Decimal from "decimal.js";
import styles from "./room-holdings-fx-provenance.module.css";

export type RoomHoldingsFxProvenanceProps = {
  snapshot: RoomFxSnapshot | undefined;
  currencies: readonly string[];
};

type ResolvedRate = {
  currency: string;
  rate: string;
  publicationDate: string | null;
};

function currencyCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (["人民币", "RMB", "CNY"].includes(normalized)) return "CNY";
  if (["港币", "HK$", "HKD"].includes(normalized)) return "HKD";
  if (["美元", "US$", "USD"].includes(normalized)) return "USD";
  return normalized;
}

function relevantCurrencies(currencies: readonly string[]): string[] {
  const unique = [...new Set(currencies.map(currencyCode).filter(currency => currency && currency !== "CNY"))];
  const order = ["USD", "HKD"];
  return unique.sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    return (leftIndex < 0 ? order.length : leftIndex) - (rightIndex < 0 ? order.length : rightIndex) || left.localeCompare(right);
  });
}

function dateParts(value: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatPublicationDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const parsed = parseDate(value);
  if (!parsed) return null;
  const parts = dateParts(parsed);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatFetchedAt(value: string | null | undefined): string | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const parts = dateParts(parsed);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}（GMT+8）`;
}

function sourceLabel(source: string): string {
  const normalized = source.trim();
  if (normalized.toUpperCase() === "BOC" || normalized.toLowerCase() === "bank of china") return "中行";
  return normalized || "来源未知";
}

function rateFor(snapshot: RoomFxSnapshot | undefined, currency: string): string | null {
  if (!snapshot) return null;
  const keys = [`${currency}/CNY`, `${currency}:CNY`, currency];
  for (const key of keys) {
    const value = snapshot.rates[key];
    if (typeof value !== "string" || !value.trim()) continue;
    try {
      const parsed = new Decimal(value.trim());
      if (parsed.isFinite() && parsed.gt(0)) return value.trim();
    } catch {
      // Ignore malformed metadata and keep the currency visibly unresolved.
    }
  }
  return null;
}

function publicationFor(snapshot: RoomFxSnapshot, currency: string): string | null {
  const currencyPublication = snapshot.publishedAtByCurrency?.[currency];
  return formatPublicationDate(currencyPublication) ?? formatPublicationDate(snapshot.publishedAt);
}

function rateLabel(rate: ResolvedRate): string {
  return `1 ${rate.currency} = ${rate.rate} CNY`;
}

function provenanceLabel(
  snapshot: RoomFxSnapshot,
  publicationDate: string | null,
): string {
  const source = sourceLabel(snapshot.source);
  if (publicationDate) return `汇率：${publicationDate}（${source}）`;
  const fetchedAt = formatFetchedAt(snapshot.fetchedAt);
  if (fetchedAt) return `获取于 ${fetchedAt}，发布日期未提供（${source}）`;
  return `汇率：发布日期未知（${source}）`;
}

export function RoomHoldingsFxProvenance({ snapshot, currencies }: RoomHoldingsFxProvenanceProps) {
  const relevant = relevantCurrencies(currencies);
  if (relevant.length === 0) return null;

  const resolved: ResolvedRate[] = [];
  const missing: string[] = [];
  for (const currency of relevant) {
    const rate = rateFor(snapshot, currency);
    if (!rate || !snapshot) {
      missing.push(currency);
      continue;
    }
    resolved.push({ currency, rate, publicationDate: publicationFor(snapshot, currency) });
  }

  const grouped = new Map<string, ResolvedRate[]>();
  for (const rate of resolved) {
    const label = provenanceLabel(snapshot!, rate.publicationDate);
    grouped.set(label, [...(grouped.get(label) ?? []), rate]);
  }

  return (
    <div
      className={styles.provenance}
      data-testid="room-holdings-fx-provenance"
      aria-label="汇率说明"
    >
      {[...grouped.entries()].map(([label, rates]) => (
        <p className={styles.line} key={label}>
          {label}｜{rates.map(rateLabel).join("；")}
        </p>
      ))}
      {missing.map(currency => (
        <p className={styles.line} key={`missing-${currency}`}>
          {currency}：暂无可用汇率，未计入人民币换算
        </p>
      ))}
      {snapshot && resolved.length > 0 && snapshot.status !== "complete" ? (
        <p className={styles.line}>部分汇率仅作参考，未计入人民币换算</p>
      ) : null}
      {snapshot?.error?.trim() && resolved.length > 0 ? (
        <p className={styles.line}>沿用缓存：{snapshot.error.trim()}</p>
      ) : null}
    </div>
  );
}

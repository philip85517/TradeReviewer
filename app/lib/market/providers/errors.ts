export type MarketDataErrorCode =
  | "source-rate-limited"
  | "source-forbidden"
  | "source-timeout"
  | "source-unavailable"
  | "invalid-response"
  | "unsupported-interval"
  | "provider-history-limit"
  | "no-data";

export class MarketDataProviderError extends Error {
  constructor(
    readonly code: MarketDataErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MarketDataProviderError";
  }
}

export function marketLocalTimestampToIso(
  value: string,
  timeZone: string,
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) throw new Error("行情时间格式已变化");

  const [, year, month, day, hour, minute, second = "00"] = match;
  const expected = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let timestamp = expected;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const observed = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const correction = expected - observed;
    if (correction === 0) return new Date(timestamp).toISOString();
    timestamp += correction;
  }
  throw new Error("行情时间格式已变化");
}

export async function readProviderJson(
  response: Response,
  providerLabel: string,
) {
  if (!response.ok) {
    const code =
      response.status === 429
        ? "source-rate-limited"
        : response.status === 403
          ? "source-forbidden"
          : "source-unavailable";
    throw new MarketDataProviderError(
      code,
      `${providerLabel}暂时不可用`,
      response.status,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new MarketDataProviderError(
      "invalid-response",
      `${providerLabel}返回了无法解析的数据`,
    );
  }
}

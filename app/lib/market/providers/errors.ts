export type MarketDataErrorCode =
  | "source-rate-limited"
  | "source-forbidden"
  | "source-timeout"
  | "source-unavailable"
  | "invalid-response"
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

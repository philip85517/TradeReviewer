import type {
  FxReadResponse,
  FxRefreshResponse,
} from "./contracts";

export type FxRatesClient = {
  getSnapshot: () => Promise<FxReadResponse>;
  refresh: () => Promise<FxRefreshResponse>;
};

export type { FxReadResponse, FxRefreshResponse, FxSnapshot } from "./contracts";

type FxFetcher = (input: string, init?: RequestInit) => Promise<Response>;

async function parseBody<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok && !(body && typeof body === "object" && "status" in body)) {
    const message = body && typeof body === "object" && "error" in body &&
      body.error && typeof body.error === "object" && "message" in body.error
      ? String(body.error.message)
      : "汇率状态读取失败";
    throw new Error(message);
  }
  return body as T;
}

export function createFxRatesClient(
  fetcher: FxFetcher = (input, init) => fetch(input, init),
): FxRatesClient {
  return {
    getSnapshot: async () => parseBody<FxReadResponse>(await fetcher("/api/fx", { cache: "no-store" })),
    refresh: async () => parseBody<FxRefreshResponse>(await fetcher("/api/fx", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })),
  };
}

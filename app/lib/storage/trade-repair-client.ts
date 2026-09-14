import type { TradeRevision, TradeRevisionRequest, TradeRevisionResult } from "./trade-revisions";
async function read<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const failure = body as { error?: { message?: string } } | null;
    throw new Error(typeof failure?.error?.message === "string" ? failure.error.message : "数据修订请求失败");
  }
  return body as T;
}
export const tradeRepairClient = {
  async history(instrumentId: string): Promise<TradeRevision[]> {
    return read(await fetch(`/api/storage/trade-revisions?instrumentId=${encodeURIComponent(instrumentId)}`, { cache: "no-store" }));
  },
  async revise(request: TradeRevisionRequest): Promise<TradeRevisionResult> {
    return read(await fetch("/api/storage/trade-revisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }));
  },
};

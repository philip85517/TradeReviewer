import type { TradeRevision, TradeRevisionRequest, TradeRevisionResult } from "./trade-revisions";
import { errorFromResponse, StorageHttpError } from "./sqlite-http-client";
async function read<T>(response: Response): Promise<T> {
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new StorageHttpError(response.status, response.ok ? "invalid-response" : "storage-request-failed", "数据修订响应无效"); }
  if (!response.ok) throw errorFromResponse(response.status, body);
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

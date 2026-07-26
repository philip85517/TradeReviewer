export type MarketDataSyncStatus =
  | "syncing"
  | "needs-provider"
  | "ready"
  | "error";

export function marketDataStatusLabel(status: MarketDataSyncStatus) {
  if (status === "syncing") return "正在更新行情";
  if (status === "ready") return "行情已更新";
  if (status === "error") return "行情更新失败";
  return "行情源待连接";
}

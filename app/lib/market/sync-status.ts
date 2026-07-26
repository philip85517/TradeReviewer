export type MarketDataSyncStatus =
  | "syncing"
  | "needs-provider"
  | "ready";

export function marketDataStatusLabel(status: MarketDataSyncStatus) {
  if (status === "syncing") return "正在更新行情";
  if (status === "ready") return "行情已更新";
  return "行情源待连接";
}

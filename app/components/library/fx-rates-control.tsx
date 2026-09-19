"use client";

import { useEffect, useEffectEvent, useState } from "react";

import {
  createFxRatesClient,
  type FxRatesClient,
  type FxSnapshot,
} from "../../lib/fx/client";

type Props = {
  client?: FxRatesClient;
  onSnapshotChange?: (snapshot: FxSnapshot | null) => void;
};

const defaultClient = createFxRatesClient();

function rateText(currency: "CNY" | "HKD" | "USD", snapshot: FxSnapshot) {
  return `1 ${currency} = ${snapshot.rates[currency].toFixed(4)} CNY`;
}

export function FxRatesControl({ client = defaultClient, onSnapshotChange }: Props) {
  const notifySnapshotChange = useEffectEvent((value: FxSnapshot | null) => {
    onSnapshotChange?.(value);
  });
  const [snapshot, setSnapshot] = useState<FxSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void client.getSnapshot()
      .then((result) => {
        if (!active) return;
        setSnapshot(result.snapshot);
        notifySnapshotChange(result.snapshot);
        setReadError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setReadError(error instanceof Error ? error.message : "汇率状态读取失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [client]);

  async function refresh() {
    setRefreshing(true);
    try {
      const result = await client.refresh();
      setSnapshot(result.snapshot);
      onSnapshotChange?.(result.snapshot);
      if (result.status === "unavailable") {
        setReadError(result.error?.message ?? "汇率源暂时不可用");
      } else {
        setReadError(null);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "汇率刷新失败";
      if (snapshot) {
        const cached: FxSnapshot = {
          ...snapshot,
          cacheStatus: "cached",
          lastAttemptedAt: new Date().toISOString(),
          lastError: message,
        };
        setSnapshot(cached);
        onSnapshotChange?.(cached);
      }
      setReadError(message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="fx-rates-control" aria-label="人民币汇率">
      <div className="fx-rates-control-heading">
        <div>
          <h2>人民币汇率</h2>
          <p>来源：<a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noreferrer">Frankfurter（ECB 参考汇率）</a></p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || refreshing} aria-label="刷新人民币汇率">
          {refreshing ? "正在刷新…" : "刷新汇率"}
        </button>
      </div>

      {loading && <p role="status">正在读取已保存汇率…</p>}
      {!loading && readError && !snapshot && <p role="alert">{readError}</p>}
      {!loading && !snapshot && !readError && <p role="status">尚无汇率快照，请手动刷新</p>}
      {!loading && !snapshot && <p>暂无法折算</p>}
      {snapshot && <>
        <p role="status">
          {snapshot.cacheStatus === "cached" ? "使用缓存汇率" : "最新汇率"} · 数据日期 {snapshot.rateDate} · 保存于 {new Date(snapshot.fetchedAt).toLocaleString("zh-CN")}
        </p>
        {snapshot.lastError && <p role="alert">刷新失败，仍使用已保存汇率：{snapshot.lastError}</p>}
        <dl>
          <div><dt>CNY</dt><dd>{rateText("CNY", snapshot)}</dd></div>
          <div><dt>HKD</dt><dd>{rateText("HKD", snapshot)}</dd></div>
          <div><dt>USD</dt><dd>{rateText("USD", snapshot)}</dd></div>
        </dl>
      </>}
    </section>
  );
}

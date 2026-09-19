"use client";

import type { FxState } from "../../lib/fx/contracts";

export type FxPanelProps = {
  state: FxState | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void | Promise<void>;
};

const CURRENCIES = [
  { code: "USD", label: "美元" },
  { code: "HKD", label: "港币" },
] as const;

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

export function FxPanel({ state, loading, refreshing, error, onRefresh }: FxPanelProps) {
  const sourceTime = state?.publishedAt ? formatTime(state.publishedAt) : null;
  const fetchedTime = state?.fetchedAt ? formatTime(state.fetchedAt) : null;
  const unavailable = !state || state.status === "missing";
  const staleError = state?.error;

  return (
    <div className="data-management-fx" aria-label="人民币估算汇率">
      <div className="data-management-fx-source">
        <span>中国银行 · 中行折算价（源报价每100单位外币，以下换算为1外币）</span>
        {sourceTime && <span>最近源数据：{sourceTime}</span>}
      </div>

      {loading && !state ? (
        <p className="data-management-fx-status">正在读取汇率…</p>
      ) : (
        <div className="data-management-fx-rates">
          {CURRENCIES.map(({ code, label }) => {
            const rate = state?.rates[code];
            const publishedAt = formatTime(state?.publishedAtByCurrency[code]);
            return (
              <div className="data-management-fx-rate" key={code}>
                <div>
                  <strong>{code}/CNY</strong>
                  <span>{label}</span>
                </div>
                <div className="data-management-fx-rate-value">
                  <strong>
                    <span>1 {code} = </span>
                    <span>{rate ?? "暂无"}</span>
                    <span> CNY</span>
                  </strong>
                  {publishedAt && <span>源发布时间：{publishedAt}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unavailable && !loading && (
        <p className="data-management-fx-status">暂无可用汇率，原币金额会继续保留。</p>
      )}
      {state?.status === "partial" && (
        <p className="data-management-fx-status">当前缺少部分币种，未能完整汇总；原币金额会继续保留。</p>
      )}
      {staleError?.startsWith("更新失败：") && fetchedTime && (
        <p className="data-management-fx-status">本次更新失败，沿用{fetchedTime}汇率。</p>
      )}
      {staleError && <p className="data-management-fx-error" role="alert">{staleError}</p>}
      {error && <p className="data-management-fx-error" role="alert">{error}</p>}
      {fetchedTime && <p className="data-management-fx-fetched">最近获取：{fetchedTime}</p>}

      <button
        type="button"
        className="data-management-fx-refresh"
        onClick={() => void onRefresh()}
        disabled={loading || refreshing}
      >
        {refreshing ? "刷新中…" : "刷新汇率"}
      </button>
    </div>
  );
}

"use client";

import type { SharedScope } from "../../lib/reviews/shared-scope";

export type LibraryScopeControlsProps = {
  scope: SharedScope;
  accountOptions?: readonly { id: string; label: string }[];
  onChange: (patch: Partial<SharedScope>) => void;
};

/** Compact, always visible scope controls for the trade library header. */
export function LibraryScopeControls({
  scope,
  accountOptions = [],
  onChange,
}: LibraryScopeControlsProps) {
  const selectedAccount = scope.accountIds.length === 1 ? scope.accountIds[0] : "all";

  return (
    <div className="library-scope-controls" aria-label="交易库交易范围">
      <fieldset className="library-scope-choice" aria-label="交易性质">
        <legend>性质</legend>
        {(["live", "simulation", "unknown"] as const).map((nature) => (
          <label key={nature}>
            <input
              type="radio"
              name="library-trade-nature"
              value={nature}
              checked={scope.nature === nature}
              onChange={() => onChange({ nature, accountIds: [], simulationRunId: null })}
            />
            <span>{nature === "live" ? "实盘" : nature === "simulation" ? "模拟盘" : "来源未知"}</span>
          </label>
        ))}
      </fieldset>
      <label className="library-scope-account">
        <span>账户</span>
        <select
          aria-label="共享账户"
          value={selectedAccount}
          onChange={(event) => onChange({ accountIds: event.target.value === "all" ? [] : [event.target.value] })}
        >
          <option value="all">全部账户</option>
          {accountOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <fieldset className="library-scope-choice library-scope-currency" aria-label="报告计价">
        <legend>计价</legend>
        {(["original", "CNY"] as const).map((currency) => (
          <label key={currency}>
            <input
              type="radio"
              name="library-report-currency"
              value={currency}
              checked={scope.reportCurrency === currency}
              onChange={() => onChange({ reportCurrency: currency })}
            />
            <span>{currency === "original" ? "原币" : "CNY参考"}</span>
          </label>
        ))}
      </fieldset>
      {scope.nature === "simulation" && (
        <label className="library-scope-run">
          <span>模拟运行</span>
          <input
            aria-label="共享模拟运行"
            value={scope.simulationRunId ?? ""}
            onChange={(event) => onChange({ simulationRunId: event.target.value || null })}
            placeholder="可选"
          />
        </label>
      )}
    </div>
  );
}

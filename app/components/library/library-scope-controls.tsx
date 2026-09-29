"use client";

import type { SharedScope } from "../../lib/reviews/shared-scope";
import { ScopeChoiceGroup, ScopeSelect } from "../scope/scope-control-primitives";

export type LibraryScopeControlsProps = {
  scope: SharedScope;
  accountOptions?: readonly { id: string; label: string }[];
  /** Legacy run choices remain available when the range has source-run evidence. */
  simulationRunOptions?: readonly { id: string; label: string }[];
  onChange: (patch: Partial<SharedScope>) => void;
};

/** Compact, always visible scope controls for the trade library header. */
export function LibraryScopeControls({
  scope,
  accountOptions = [],
  simulationRunOptions = [],
  onChange,
}: LibraryScopeControlsProps) {
  const selectedAccount = scope.accountIds.length === 1 ? scope.accountIds[0] : "all";
  const showSimulationRun = scope.nature === "simulation" &&
    (scope.simulationRunId !== null || simulationRunOptions.length > 0);

  return (
    <div className="library-scope-controls" aria-label="交易库交易范围">
      <ScopeChoiceGroup
        mode="radio"
        ariaLabel="交易性质"
        legend="性质"
        name="library-trade-nature"
        value={scope.nature}
        options={[
          { value: "live", label: "实盘" },
          { value: "simulation", label: "模拟盘" },
          { value: "unknown", label: "来源未知" },
        ]}
        className="library-scope-choice"
        onChange={nature => onChange({ nature, accountIds: [], simulationRunId: null })}
      />
      <ScopeSelect
        label="账户"
        ariaLabel="共享账户"
        layout="inline"
        value={selectedAccount}
        options={[
          { value: "all", label: "全部账户" },
          ...accountOptions.map(option => ({ value: option.id, label: option.label })),
        ]}
        className="library-scope-account"
        onChange={value => onChange({ accountIds: value === "all" ? [] : [value] })}
      />
      <ScopeChoiceGroup
        mode="radio"
        ariaLabel="报告计价"
        legend="计价"
        name="library-report-currency"
        value={scope.reportCurrency}
        options={[
          { value: "original", label: "原币" },
          { value: "CNY", label: "CNY参考" },
          { value: "HKD", label: "HKD参考" },
        ]}
        className="library-scope-choice library-scope-currency"
        onChange={reportCurrency => onChange({ reportCurrency })}
      />
      {showSimulationRun && (
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

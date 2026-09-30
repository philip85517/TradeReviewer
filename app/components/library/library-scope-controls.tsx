"use client";

import type { SharedScope } from "../../lib/reviews/shared-scope";
import { ScopeSelect } from "../scope/scope-control-primitives";
import { UnifiedScopeFields } from "../workspace/unified-page-header";

export type LibraryScopeControlsProps = {
  scope: SharedScope;
  accountOptions?: readonly { id: string; label: string }[];
  /** Legacy run choices remain available when the range has source-run evidence. */
  simulationRunOptions?: readonly { id: string; label: string }[];
  onChange: (patch: Partial<SharedScope>) => void;
};

function sharedNature(value: string): SharedScope["nature"] {
  return value === "simulation" || value === "unknown" ? value : "live";
}

function sharedReportCurrency(value: string): SharedScope["reportCurrency"] {
  return value === "CNY" || value === "HKD" ? value : "original";
}

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
  const hasCurrentRunOption = Boolean(scope.simulationRunId && simulationRunOptions.some(option => option.id === scope.simulationRunId));
  const runOptions = [
    { value: "", label: "可选" },
    ...simulationRunOptions.map(option => ({ value: option.id, label: option.label })),
    ...(scope.simulationRunId && !hasCurrentRunOption
      ? [{ value: scope.simulationRunId, label: `当前来源运行 · ${scope.simulationRunId}` }]
      : []),
  ];

  return (
    <div className="library-scope-controls" aria-label="共享交易范围">
      <UnifiedScopeFields
        nature={<ScopeSelect
        label="性质"
        ariaLabel="交易性质"
        value={scope.nature}
        fieldId="nature"
        options={[
          { value: "live", label: "实盘" },
          { value: "simulation", label: "模拟盘" },
          { value: "unknown", label: "来源未知" },
        ]}
        className="library-scope-choice"
        onChange={nature => onChange({ nature: sharedNature(nature), accountIds: [], simulationRunId: null })}
      />}
      account={<ScopeSelect
        label="账户范围"
        ariaLabel="共享账户"
        value={selectedAccount}
        fieldId="account"
        options={[
          { value: "all", label: "全部账户" },
          ...accountOptions.map(option => ({ value: option.id, label: option.label })),
        ]}
        className="library-scope-account"
        onChange={value => onChange({ accountIds: value === "all" ? [] : [value] })}
      />}
      run={showSimulationRun
        ? simulationRunOptions.length === 0 && scope.simulationRunId
          ? <label className="library-scope-run">
              <span>模拟运行</span>
              <input aria-label="共享模拟运行" value={scope.simulationRunId} onChange={event => onChange({ simulationRunId: event.target.value || null })} placeholder="可选" />
            </label>
          : <ScopeSelect
              label="模拟运行"
              ariaLabel="共享模拟运行"
              value={scope.simulationRunId ?? ""}
              fieldId="run"
              options={runOptions}
              onChange={value => onChange({ simulationRunId: value || null })}
            />
        : undefined}
      currency={<ScopeSelect
        label="报告计价"
        ariaLabel="报告计价"
        value={scope.reportCurrency}
        fieldId="currency"
        options={[
          { value: "original", label: "原币" },
          { value: "CNY", label: "CNY参考" },
          { value: "HKD", label: "HKD参考" },
        ]}
        className="library-scope-choice library-scope-currency"
        onChange={reportCurrency => onChange({ reportCurrency: sharedReportCurrency(reportCurrency) })}
      />}
      />
    </div>
  );
}

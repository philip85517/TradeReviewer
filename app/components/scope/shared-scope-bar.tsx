"use client";

import { useState } from "react";
import type { SharedScope } from "../../lib/reviews/shared-scope";
import { ScopeSelect } from "./scope-control-primitives";

export type SharedScopeBarProps = {
  scope: SharedScope;
  accountOptions?: readonly { id: string; label: string }[];
  onChange: (patch: Partial<SharedScope>) => void;
};

export function SharedScopeBar({ scope, accountOptions = [], onChange }: SharedScopeBarProps) {
  const [expanded, setExpanded] = useState(false);
  const currencyLabel = scope.reportCurrency === "original" ? "原币" : `${scope.reportCurrency}参考`;
  const scopeLabel = `${scope.nature === "live" ? "实盘" : scope.nature === "simulation" ? "模拟盘" : "性质未知"} · ${scope.accountIds.length ? `${scope.accountIds.length} 个账户` : "全部账户"} · ${currencyLabel}`;
  return (
    <div className={`shared-scope-container${expanded ? " expanded" : ""}`}><button type="button" className="shared-scope-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{scopeLabel}<span>{expanded ? "收起范围" : "调整范围"}</span></button><fieldset aria-label="共享范围" className="shared-scope-bar">
      <legend>共享范围</legend>
      <ScopeSelect
        label="性质"
        ariaLabel="共享交易性质"
        value={scope.nature}
        options={[{ value: "live", label: "实盘" }, { value: "simulation", label: "模拟盘" }, { value: "unknown", label: "性质未知" }]}
        onChange={(value) => onChange({ nature: value as SharedScope["nature"], accountIds: [], simulationRunId: null })}
      />
      <ScopeSelect
        label="账户"
        ariaLabel="共享账户"
        value={scope.accountIds[0] ?? "all"}
        options={[{ value: "all", label: "全部账户" }, ...accountOptions.map(option => ({ value: option.id, label: option.label }))]}
        onChange={(value) => onChange({ accountIds: value === "all" ? [] : [value] })}
      />
      <ScopeSelect
        label="报告计价"
        ariaLabel="报告计价偏好"
        value={scope.reportCurrency}
        options={[{ value: "original", label: "原币" }, { value: "CNY", label: "CNY参考折算" }, { value: "HKD", label: "HKD参考折算" }]}
        onChange={(value) => onChange({ reportCurrency: value as SharedScope["reportCurrency"] })}
      />
      {scope.nature === "simulation" && <label><span>模拟运行</span><input aria-label="共享模拟运行" value={scope.simulationRunId ?? ""} onChange={(event) => onChange({ simulationRunId: event.target.value || null })} /></label>}
    </fieldset></div>
  );
}

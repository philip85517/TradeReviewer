"use client";

import { useState } from "react";
import type { SharedScope } from "../../lib/reviews/shared-scope";

export type SharedScopeBarProps = {
  scope: SharedScope;
  accountOptions?: readonly { id: string; label: string }[];
  onChange: (patch: Partial<SharedScope>) => void;
};

export function SharedScopeBar({ scope, accountOptions = [], onChange }: SharedScopeBarProps) {
  const [expanded, setExpanded] = useState(false);
  const scopeLabel = `${scope.nature === "live" ? "实盘" : scope.nature === "simulation" ? "模拟盘" : "性质未知"} · ${scope.accountIds.length ? `${scope.accountIds.length} 个账户` : "全部账户"} · ${scope.reportCurrency === "original" ? "原币" : "CNY参考"}`;
  return (
    <div className={`shared-scope-container${expanded ? " expanded" : ""}`}><button type="button" className="shared-scope-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{scopeLabel}<span>{expanded ? "收起范围" : "调整范围"}</span></button><fieldset aria-label="共享范围" className="shared-scope-bar">
      <legend>共享范围</legend>
      <label><span>性质</span><select aria-label="共享交易性质" value={scope.nature} onChange={(event) => onChange({ nature: event.target.value as SharedScope["nature"], accountIds: [], simulationRunId: null })}>
        <option value="live">实盘</option><option value="simulation">模拟盘</option><option value="unknown">性质未知</option>
      </select></label>
      <label><span>账户</span><select aria-label="共享账户" value={scope.accountIds[0] ?? "all"} onChange={(event) => onChange({ accountIds: event.target.value === "all" ? [] : [event.target.value] })}>
        <option value="all">全部账户</option>{accountOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></label>
      <label><span>报告计价</span><select aria-label="报告计价偏好" value={scope.reportCurrency} onChange={(event) => onChange({ reportCurrency: event.target.value as SharedScope["reportCurrency"] })}>
        <option value="original">原币</option><option value="CNY">CNY参考折算</option>
      </select></label>
      {scope.nature === "simulation" && <label><span>模拟运行</span><input aria-label="共享模拟运行" value={scope.simulationRunId ?? ""} onChange={(event) => onChange({ simulationRunId: event.target.value || null })} /></label>}
    </fieldset></div>
  );
}


"use client";

import { completionHasPendingEvidence, monthlyHasPendingEvidence } from "../../lib/import/import-completion";
import type { ImportPreview } from "../../lib/import/import-preview";
import type { ImportDuplicateFact, ReviewFactValues, ReviewPlan, ReviewChange, TradeChangeChoices, StandardTradeChangeIntent, TradingViewIdentitySelection } from "../../lib/storage/sqlite-contracts";

import type { TradeExecution } from "../../lib/trades/types";
import type { ReconciliationDecision } from "../../lib/import/execution-reconciliation";
import type { ImportMaterialOption } from "./trade-import-material";

export function ImportMaterialSelection({ options, value, onChange, disabled = false, alreadyImported = false, tradingView = false }: { options: ImportMaterialOption[]; value: string; onChange: (value: string) => void; disabled?: boolean; alreadyImported?: boolean; tradingView?: boolean }) {
  return <section className="import-category-panel" aria-label="来源材料版本选择"><label>来源材料处理<select aria-label="来源材料处理" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}><option value="">{tradingView ? "核对精确重导或首次保存证据" : "作为独立材料保存"}</option>{tradingView && <option value="__tv_independent__">作为独立材料保存</option>}{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><p>{tradingView ? "精确重导须由服务器核对当前完整材料。" : "默认独立保存。"}选择已存材料表示：将此文件作为所选材料的新版本；请核对原文件、账户与月份。相同账户和月份不会自动合并。缺失成交仍须逐项决定保留或撤回。</p>{alreadyImported && <p role="status">历史材料中存在相同的旧指纹；这不能证明原文件已完整导入。服务器将继续核对成功凭据及逐笔成交。</p>}</section>;
}

export function importIntentForPreview(preview: ImportPreview): Extract<StandardTradeChangeIntent, { kind: "import" }> {
  return {
    kind: "import",
    ...(preview.sourceKind !== "screenshot" && preview.fileContent ? { fileImport: { ...preview.fileContent, complete: !preview.blocked && preview.unresolvedInstrumentCount === 0
      && !(preview.monthly && monthlyHasPendingEvidence(preview.monthly))
      && (preview.completionEvidence ? !completionHasPendingEvidence(preview.completionEvidence)
        && preview.completionEvidence.exclusions.reduce((total, item) => total + item.count, 0) === preview.exclusionGroups.reduce((total, item) => total + item.count, 0)
        : preview.excludedInstrumentCount === 0 && !preview.exclusionGroups.some(group => group.count > 0)),
      ...(preview.completionEvidence ? { evidence: preview.completionEvidence } : {}) } } : {}),
    candidates: preview.records.map(execution => ({ ...execution, source: { ...execution.source, batchId: preview.id } })),
    instruments: preview.instruments.map(item => item.instrument),
    ...(preview.sourceKind === "tradingview" ? { tradingViewImport: { policy: "tv-import-v1" as const, material: { kind: "reuse-exact-or-propose" as const }, ...(preview.tradingViewEvidence ? { evidence: preview.tradingViewEvidence } : {}) } } : {}),
    importHistory: [{
      id: preview.id, fileName: preview.fileName, sourceLabel: preview.sourceLabel,
      importedAt: new Date().toISOString(), firstTradeAt: preview.firstTradeAt, lastTradeAt: preview.lastTradeAt,
      tradeCount: preview.tradeCount, instrumentCount: preview.instrumentCount,
      excludedInstrumentCount: preview.excludedInstrumentCount,
      excludedRecordCount: preview.exclusionGroups.reduce((total, group) => total + group.count, 0),
      duplicateTradeCount: preview.duplicateTradeCount, unresolvedInstrumentCount: preview.unresolvedInstrumentCount,
      ...(preview.monthly ? { monthly: preview.monthly } : {}),
      ...(preview.tradeNature ? { tradeNature: preview.tradeNature } : {}),
      ...(preview.simulationRunId ? { simulationRunId: preview.simulationRunId } : {}),
      ...(preview.sourceKind === "screenshot" ? { sourceKind: "screenshot", captureCount: preview.captureCount ?? 0, conflictTradeCount: preview.conflictTradeCount ?? 0 } : {}),
      ...(preview.sourceKind === "tradingview" ? { sourceKind: "tradingview" } : {}),
    }],
  };
}

export function planNeedsChoices(plan: ReviewPlan) {
  return plan.status === "review-required" || plan.conflicts.length > 0 || plan.missingExecutions.length > 0 || plan.reactivateExecutionIds.length > 0;
}

export function identitySelectionForPlan(plan: ReviewPlan): TradingViewIdentitySelection {
  if (plan.reviewContract!=="trade-review-v2" || plan.status!=="review-required" || plan.tvImportGuard?.policy!=="tv-compat-v1" || !plan.identityReviews.length) throw new Error("当前计划没有可选择的来源身份审查");
  return {kind:"keep-independent",reviewPlanId:plan.planId,inputDigest:plan.summary.inputDigest,candidateIds:[...new Set(plan.identityReviews.flatMap(r=>r.incomingIds))].sort()};
}
export function tradePlanReadyForPreview(plan: ReviewPlan, preview: ImportPreview) {
  return preview.sourceKind!=="tradingview" || plan.reviewContract==="trade-review-v2" && plan.status==="ready" && plan.tvImportGuard?.policy==="tv-compat-v1" && !!plan.summary.tradingViewImport && plan.identityReviews.length===0;
}

function Fact({ value, records = [] }: { value: ReviewFactValues; records?: TradeExecution[] }) {
  // Server review facts preserve raw null/empty unknown fees without verifying a zero.
  const matching = records.find(e => e.instrument.id === value.instrumentId && (e.accountId || null) === value.accountId && e.side === value.side && e.quantity === value.quantity && e.price === value.price && e.executedAt === value.executedAt && (e.source.feeStatus === "unknown" ? value.fee === null || (value.fee === "" && e.fee === "") : e.fee === value.fee));
  const instrument = matching?.instrument;
  const name = instrument ? `${instrument.name}（${instrument.symbol}）` : value.instrumentId;
  const account = value.accountId === null ? "未知账户" : matching?.accountLabel || value.accountId;
  return <span>{name} · {account} · {value.side === "buy" ? "买入" : value.side === "sell" ? "卖出" : value.side} {value.quantity} @ {value.price} {value.currency ?? "未知币种"} · 费用 {value.fee === null || matching?.source.feeStatus === "unknown" ? "未知" : value.fee} · {executionDate(value.executedAt)}</span>;
}

const CHANGE_LABELS = { add: "新增", replace: "替换", revise: "修订", withdraw: "撤回", reactivate: "恢复", "material-version": "来源版本", link: "来源关联" };


export function tradePlanChoicesComplete(plan: ReviewPlan, choices: TradeChangeChoices): boolean {
  if (plan.reviewContract!==undefined && (plan.reviewContract!=="trade-review-v2" || plan.status!=="ready" || plan.identityReviews?.length!==0)) return false;
  return plan.conflicts.every(conflict => {
    const choice = choices.conflicts?.find(item => item.conflictId === conflict.id);
    return !!choice && conflict.allowed.includes(choice.decision) && (choice.decision !== "use-incoming" || !!choice.reason?.trim());
  }) && plan.missingExecutions.every(missing => {
    const choice = choices.missingExecutions?.find(item => item.executionId === missing.executionId);
    return !!choice && (choice.action === "keep" || (choice.action === "withdraw" && !!choice.reason?.trim()));
  }) && plan.reactivateExecutionIds.every(id => {
    const choice = choices.reactivateExecutions?.find(item => item.executionId === id);
    return !!choice && (choice.action === "keep-withdrawn" || (choice.action === "activate" && !!choice.reason?.trim()));
  });
}

function factValue(execution: TradeExecution): ReviewFactValues {
  return { instrumentId: execution.instrument.id, accountId: execution.accountId || null, side: execution.side, quantity: execution.quantity, price: execution.price, fee: execution.source.feeStatus === "unknown" ? null : execution.fee, currency: execution.instrument.currency, executedAt: execution.executedAt };
}
function executionDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}（仅日期）`;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? `${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(instant)}（北京时间）` : value;
}

function DuplicateFact({ fact }: { fact: ImportDuplicateFact }) {
  return <>
    <p className="trade-plan-fact">{fact.instrument.name}（{fact.instrument.symbol}） · {fact.accountLabel || fact.accountId || "未知账户"} · {fact.side === "buy" ? "买入" : "卖出"} {fact.quantity} @ {fact.price} {fact.instrument.currency} · 费用 {fact.fee === null || fact.fee.trim() === "" ? "未知" : fact.fee} · {executionDate(fact.executedAt)}</p>
    <p className="trade-plan-fact">来源：{fact.source.fileName ?? "未提供文件名"} · {fact.source.page === null ? "未提供页码" : `第 ${fact.source.page} 页`} · 第 {fact.source.row} 行</p>
  </>;
}
function selectedChange(change: ReviewChange, choices: TradeChangeChoices) {
  const condition = change.when;
  if (!condition) return true;
  if ("conflictId" in condition) return condition.decisions.includes(choices.conflicts?.find(c => c.conflictId === condition.conflictId)?.decision as ReconciliationDecision);
  if ("missingExecutionId" in condition) return choices.missingExecutions?.some(c => c.executionId === condition.missingExecutionId && c.action === condition.action) ?? false;
  return choices.reactivateExecutions?.some(c => c.executionId === condition.reactivateExecutionId && c.action === condition.action) ?? false;
}
const DECISION_LABELS = { "keep-existing": "保留已存成交", "use-incoming": "使用本次候选", "keep-both": "两者保留（确为两笔成交）" };

export function TradePlanReview({ plan, choices, onChoicesChange, executions = [], disabled = false, onKeepIndependent }: {
  plan: ReviewPlan; choices: TradeChangeChoices; onChoicesChange: (value: TradeChangeChoices) => void; executions?: TradeExecution[]; disabled?: boolean; onKeepIndependent?: (selection: TradingViewIdentitySelection) => void;
}) {
  const records = [...executions, ...plan.conflicts.flatMap(c => [...c.existing, ...c.incoming])];
  const setConflict = (id: string, patch: Partial<NonNullable<TradeChangeChoices["conflicts"]>[number]>) => onChoicesChange({ ...choices, conflicts: [...(choices.conflicts ?? []).filter(c => c.conflictId !== id), { ...choices.conflicts?.find(c => c.conflictId === id), ...patch, conflictId: id } as NonNullable<TradeChangeChoices["conflicts"]>[number]] });
  const setMissing = (id: string, patch: Partial<NonNullable<TradeChangeChoices["missingExecutions"]>[number]>) => onChoicesChange({ ...choices, missingExecutions: [...(choices.missingExecutions ?? []).filter(c => c.executionId !== id), { ...choices.missingExecutions?.find(c => c.executionId === id), ...patch, executionId: id } as NonNullable<TradeChangeChoices["missingExecutions"]>[number]] });
  const setReactivate = (id: string, patch: Partial<NonNullable<TradeChangeChoices["reactivateExecutions"]>[number]>) => onChoicesChange({ ...choices, reactivateExecutions: [...(choices.reactivateExecutions ?? []).filter(c => c.executionId !== id), { ...choices.reactivateExecutions?.find(c => c.executionId === id), ...patch, executionId: id } as NonNullable<TradeChangeChoices["reactivateExecutions"]>[number]] });
  const changes = plan.summary.changes.filter(change => selectedChange(change, choices));
  return <section className="import-category-panel trade-plan-review" aria-label="服务器审核计划">
    <h3>成交审核</h3>
    <p>本次候选 {plan.summary.candidateCount} 笔；按当前选择变更 {changes.length} 项。范围外已存成交保留。</p>
    {plan.summary.importDuplicates && <section aria-label="服务器重复核对">
      <p>服务器核对重复候选 {plan.summary.importDuplicates.count} 笔</p>
      {plan.summary.importDuplicates.count > 0 && <p>重复核对可能保留证据更完整的成交；保存后再核实实际结果。</p>}
      {plan.summary.importDuplicates.pairs.map((pair, index) => <fieldset className="trade-plan-item" key={index}>
        <legend>重复候选 {index + 1}</legend>
        <div className="trade-plan-fact-group" role="group" aria-label={`重复候选 ${index + 1} 保留事实`}><p className="trade-plan-group-title">保留事实</p><DuplicateFact fact={pair.kept} /></div>
        <div className="trade-plan-fact-group" role="group" aria-label={`重复候选 ${index + 1} 重复事实`}><p className="trade-plan-group-title">重复事实</p><DuplicateFact fact={pair.skipped} /></div>
      </fieldset>)}
    </section>}
    {plan.status==="review-required" && <section aria-label="来源身份审查"><h4>来源身份需要确认</h4><p>来源声明相似，但账户、证券、性质或原始运行身份尚未证明相同。当前计划不能保存；可将完整候选组确认为独立记录，再生成新计划。</p>{plan.identityReviews?.map(review=><div key={review.id}><p>本次：{review.incomingIds.join("、")}；已存：{review.existingIds.join("、")}</p><p>核对原因：{review.reasons.join("、")}</p>{[...review.existingScopes,...review.incomingScopes].map((scope,i)=><p key={i}>{scope.accountId || "未知账户"} · {scope.instrumentId} · {scope.nature} · 原始运行 {scope.rawRun.kind==="present"?scope.rawRun.raw:"未提供"}</p>)}</div>)}<button type="button" disabled={disabled || !onKeepIndependent} onClick={()=>onKeepIndependent?.(identitySelectionForPlan(plan))}>确认全部为独立记录并重新准备</button></section>}
    {plan.summary.tradingViewImport && <p role="status">{plan.summary.tradingViewImport.material.kind==="reuse-exact" ? "精确重导：复用已有完整材料，成交与来源沿革不变。" : plan.summary.tradingViewImport.material.kind==="save-evidence" ? "本次将保存来源证据与沿革；成交重复不代表材料已经存在。" : "本次仅有规范化成交，未提供原始解码观察。"}</p>}
    {plan.conflicts.map((conflict, index) => {
      const choice = choices.conflicts?.find(c => c.conflictId === conflict.id);
      return <fieldset className="trade-plan-item" key={conflict.id} disabled={disabled}><legend>成交冲突 {index + 1}</legend>
        <div className="trade-plan-fact-group" role="group" aria-label="已存成交">
          <p className="trade-plan-group-title">已存成交</p>
          {conflict.existing.map(e => <p className="trade-plan-fact" key={e.id}><Fact value={factValue(e)} records={records} /></p>)}
        </div>
        <div className="trade-plan-fact-group" role="group" aria-label="本次候选">
          <p className="trade-plan-group-title">本次候选</p>
          {conflict.incoming.map(e => <p className="trade-plan-fact" key={e.id}><Fact value={factValue(e)} records={records} /></p>)}
        </div>
        <label className="trade-plan-control">冲突处理 {index + 1}<select aria-label={`冲突处理 ${index + 1}`} value={choice?.decision ?? ""} onChange={e => setConflict(conflict.id, { decision: e.target.value as ReconciliationDecision })}><option value="" disabled>请选择处理方式</option>{conflict.allowed.map(decision => <option key={decision} value={decision}>{DECISION_LABELS[decision]}</option>)}</select></label>
        {choice?.decision === "use-incoming" && <label className="trade-plan-control">替换理由 {index + 1}<input aria-label={`替换理由 ${index + 1}`} value={choice.reason ?? ""} onChange={e => setConflict(conflict.id, { reason: e.target.value })} /></label>}
      </fieldset>;
    })}
    {plan.missingExecutions.map((missing, index) => {
      const choice = choices.missingExecutions?.find(c => c.executionId === missing.executionId);
      const before = plan.summary.changes.find(c => c.executionId === missing.executionId && c.kind === "withdraw")?.before;
      return <fieldset className="trade-plan-item" key={missing.executionId} disabled={disabled}><legend>新来源版本缺少成交 {index + 1}</legend>
        {before && <div className="trade-plan-fact-group" role="group" aria-label="当前已存成交"><p className="trade-plan-group-title">当前已存成交</p><p className="trade-plan-fact"><Fact value={before} records={records} /></p></div>}
        <div className="trade-plan-evidence" role="group" aria-label="成交依据"><p className="trade-plan-group-title">成交依据</p><p>上一版本依据 {missing.previousObservationIds.length} 项；其他来源 {missing.otherSourceObservationIds.length} 项；人工修订 {missing.revisionIds.length} 项。新文件缺行不会自动撤回。</p></div>
        <label className="trade-plan-control">缺失成交处理 {index + 1}<select aria-label={`缺失成交处理 ${index + 1}`} value={choice?.action ?? ""} onChange={e => setMissing(missing.executionId, { action: e.target.value as "keep" | "withdraw" })}><option value="" disabled>请选择处理方式</option><option value="keep">保留已存成交</option><option value="withdraw">撤回成交并保留审计</option></select></label>
        {choice?.action === "withdraw" && <label className="trade-plan-control">撤回理由 {index + 1}<input aria-label={`撤回理由 ${index + 1}`} value={choice.reason ?? ""} onChange={e => setMissing(missing.executionId, { reason: e.target.value })} /></label>}
      </fieldset>;
    })}
    {plan.reactivateExecutionIds.map((id, index) => {
      const choice = choices.reactivateExecutions?.find(c => c.executionId === id);
      const fact = plan.summary.changes.find(c => c.executionId === id && c.kind === "reactivate")?.after;
      return <fieldset className="trade-plan-item" key={id} disabled={disabled}><legend>已撤回成交再次出现 {index + 1}</legend>
        {fact && <div className="trade-plan-fact-group" role="group" aria-label="已撤回成交"><p className="trade-plan-group-title">已撤回成交</p><p className="trade-plan-fact"><Fact value={fact} records={records} /></p></div>}
        <label className="trade-plan-control">恢复成交处理 {index + 1}<select aria-label={`恢复成交处理 ${index + 1}`} value={choice?.action ?? ""} onChange={e => setReactivate(id, { action: e.target.value as "activate" | "keep-withdrawn" })}><option value="" disabled>请选择处理方式</option><option value="keep-withdrawn">保持撤回状态</option><option value="activate">恢复为当前成交</option></select></label>
        {choice?.action === "activate" && <label className="trade-plan-control">恢复理由 {index + 1}<input aria-label={`恢复理由 ${index + 1}`} value={choice.reason ?? ""} onChange={e => setReactivate(id, { reason: e.target.value })} /></label>}
      </fieldset>;
    })}
    {changes.length === 0 && <p>当前选择没有成交变更；来源证据按服务器计划保存。</p>}
    <ul className="trade-plan-change-list">{changes.map((change, index) => <li key={`${change.kind}:${index}`}><strong>{CHANGE_LABELS[change.kind]}</strong>{change.before && <div className="trade-plan-change-fact"><span>原值：</span><Fact value={change.before} records={records} /></div>}{change.after && <div className="trade-plan-change-fact"><span>结果：</span><Fact value={change.after} records={records} /></div>}{!change.before && !change.after && <span>来源证据更新</span>}</li>)}</ul>
    {!tradePlanChoicesComplete(plan, choices) && <p role="status">请逐项选择处理方式，并填写替换、撤回或恢复理由。</p>}
  </section>;
}

export function TradeImportPlan({ plan, preview, loading, error, onRetry, choices, onChoicesChange, disabled, onKeepIndependent, fileImportBlocked = false }: {
  plan: ReviewPlan | null; preview: ImportPreview; loading: boolean; error: string | null; onRetry: () => void; fileImportBlocked?: boolean;
  choices: TradeChangeChoices; onChoicesChange: (choices: TradeChangeChoices) => void; disabled?: boolean; onKeepIndependent?: (selection: TradingViewIdentitySelection) => void;
}) {
  return <>{loading && <p role="status">正在核对当前已存成交与本次候选…</p>}{error && (fileImportBlocked ? <section className="import-category-panel" aria-label="文件导入核对结果"><strong>本次不可导入</strong><p role="alert">{error}</p></section> : <><p role="alert">{error}</p><button className="secondary-button" disabled={disabled} onClick={onRetry}>重新准备审核计划</button></>)}{plan && !loading && !error && <TradePlanReview plan={plan} choices={choices} onChoicesChange={onChoicesChange} executions={preview.records} disabled={disabled} onKeepIndependent={onKeepIndependent} />}</>;
}

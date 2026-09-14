import type { TradeExecution } from "../trades/types";
import { canonicalRecord, type TradeChange } from "../storage/trade-revisions";
export type SupplementScope = { instrumentId: string; accountId: string; accountLabel: string; kind: "file" | "screenshot" };
export function scopedRecords(records: TradeExecution[], scope: SupplementScope) {
  return records.filter(e => e.instrument.id === scope.instrumentId && (scope.kind === "screenshot" || e.accountId === scope.accountId)).map(e => scope.kind === "screenshot" ? {...e, accountId: scope.accountId, accountLabel: scope.accountLabel} : e);
}
export function supplementChanges(before: TradeExecution[], after: TradeExecution[], scope: SupplementScope): TradeChange[] {
  const old = new Map(before.map(e=>[e.id,e])); const next = new Map(after.map(e=>[e.id,e]));
  const changes: TradeChange[] = [];
  for (const id of new Set([...old.keys(),...next.keys()])) {
    const a = old.get(id) ?? null; const b = next.get(id) ?? null;
    if (canonicalRecord(a) === canonicalRecord(b)) continue;
    if ([a,b].some(e=>e && (e.instrument.id !== scope.instrumentId || e.accountId !== scope.accountId))) throw new Error("补充导入超出当前股票或账户范围");
    changes.push({before:a,after:b});
  }
  return changes;
}

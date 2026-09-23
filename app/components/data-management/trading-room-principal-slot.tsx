"use client";

import { useMemo } from "react";

import type { PrincipalScope } from "../../lib/principal/principal-model";
import { usePrincipalSettings } from "../../lib/principal/use-principal-settings";
import {
  createDefaultRoomScope,
  type RoomFxSnapshot,
  type TradingRoomMetadataInput,
} from "../../lib/reviews/trading-room-scope";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import { ReferenceCapitalPanel } from "./reference-capital-panel";
import { useReferenceCapital } from "../../lib/principal/use-reference-capital";

export type TradingRoomPrincipalSlotProps = {
  entries: readonly TradeLibraryEntry[];
  instrumentMetadata?: TradingRoomMetadataInput;
  fxSnapshot?: RoomFxSnapshot;
  enabled?: boolean;
  sharedScope?: { nature: "live" | "simulation"; simulationRunId: string | null; accountIds?: readonly string[]; reportCurrency?: "original" | "CNY" };
};

export function TradingRoomPrincipalSlot({
  entries,
  enabled = true,
  sharedScope,
}: TradingRoomPrincipalSlotProps) {
  const scope = useMemo(() => ({ ...createDefaultRoomScope(), ...(sharedScope ?? {}) }), [sharedScope]);
  const principalScope = useMemo<PrincipalScope>(
    () => ({ nature: scope.nature, simulationRunId: scope.simulationRunId }),
    [scope.nature, scope.simulationRunId],
  );
  const settings = usePrincipalSettings({ scope: principalScope, enabled });
  const referenceCapital = useReferenceCapital({ enabled });
  const sharedAccountIds = useMemo(() => sharedScope?.accountIds ?? [], [sharedScope?.accountIds]);
  const accounts = useMemo(() => [...new Map(entries.filter(entry => entry.tradeNature === scope.nature && (scope.nature !== "simulation" || entry.simulationRunId === scope.simulationRunId)).flatMap(entry => entry.executions.filter(execution => !sharedAccountIds.length || sharedAccountIds.includes(execution.accountId)).map(execution => [execution.accountId, { id: execution.accountId, label: execution.accountLabel }] as const))).values()], [entries, scope.nature, scope.simulationRunId, sharedAccountIds]);
  const displayAccounts = accounts.map((account, index) => ({ ...account, label: accounts.filter(other => other.label === account.label).length > 1 ? `${account.label} · 账户 ${accounts.slice(0, index + 1).filter(other => other.label === account.label).length}` : account.label }));
  return <>
    {scope.nature !== "unknown" && <ReferenceCapitalPanel legacyConfig={settings.config} state={referenceCapital.state} accounts={displayAccounts} nature={scope.nature} simulationRunId={scope.simulationRunId} loading={referenceCapital.loading} saving={referenceCapital.saving} error={referenceCapital.error} onSave={referenceCapital.save} onRemove={referenceCapital.remove} />}
  </>;
}

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
import { sharedScopeMatchesEntry, type SharedReportCurrency, type SharedScope } from "../../lib/reviews/shared-scope";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../../lib/trades/tradingview-account-identity";
import { ReferenceCapitalPanel } from "./reference-capital-panel";
import { AccountPrincipalProvisionalPanel } from "./account-principal-provisional-panel";
import { useReferenceCapital } from "../../lib/principal/use-reference-capital";

export type TradingRoomPrincipalSlotProps = {
  entries: readonly TradeLibraryEntry[];
  instrumentMetadata?: TradingRoomMetadataInput;
  fxSnapshot?: RoomFxSnapshot;
  enabled?: boolean;
  sharedScope?: { nature: "live" | "simulation"; simulationRunId: string | null; accountIds?: readonly string[]; reportCurrency?: SharedReportCurrency };
};

export function TradingRoomPrincipalSlot({
  entries,
  enabled = true,
  sharedScope,
}: TradingRoomPrincipalSlotProps) {
  const scope = useMemo(() => ({ ...createDefaultRoomScope(), ...(sharedScope ?? {}) }), [sharedScope]);
  const principalAccountId = sharedScope?.accountIds?.length === 1 ? sharedScope.accountIds[0] : undefined;
  const principalScope = useMemo<PrincipalScope>(
    () => ({
      nature: scope.nature,
      simulationRunId: scope.simulationRunId,
      ...(principalAccountId !== undefined ? { accountId: principalAccountId } : {}),
    }),
    [principalAccountId, scope.nature, scope.simulationRunId],
  );
  const settings = usePrincipalSettings({ scope: principalScope, enabled });
  const referenceCapital = useReferenceCapital({ enabled });
  const sharedAccountIds = useMemo(() => sharedScope?.accountIds ?? [], [sharedScope?.accountIds]);
  const accounts = useMemo(() => {
    if (scope.nature === "unknown") return [];
    const filterScope: SharedScope = {
      nature: scope.nature,
      accountIds: sharedAccountIds,
      reportCurrency: sharedScope?.reportCurrency ?? "original",
      simulationRunId: scope.simulationRunId,
    };
    return [...new Map(
      entries
        .filter(entry => sharedScopeMatchesEntry(entry, filterScope))
        .flatMap(entry => entry.executions
          .filter(execution => !sharedAccountIds.length || sharedAccountIds.includes(execution.accountId))
          .map(execution => [execution.accountId, { id: execution.accountId, label: execution.accountLabel }] as const)),
    ).values()];
  }, [entries, scope.nature, scope.simulationRunId, sharedAccountIds, sharedScope?.reportCurrency]);
  const displayAccounts = accounts.map((account, index) => ({ ...account, label: accounts.filter(other => other.label === account.label).length > 1 ? `${account.label} · 账户 ${accounts.slice(0, index + 1).filter(other => other.label === account.label).length}` : account.label }));
  const showCanonicalProvisional = scope.nature === "simulation" &&
    scope.simulationRunId === null &&
    accounts.some(account => account.id === TRADINGVIEW_CANONICAL_ACCOUNT_ID);
  return <>
    {showCanonicalProvisional && <AccountPrincipalProvisionalPanel accountId={TRADINGVIEW_CANONICAL_ACCOUNT_ID} />}
    {scope.nature !== "unknown" && <ReferenceCapitalPanel legacyConfig={settings.config} state={referenceCapital.state} accounts={displayAccounts} nature={scope.nature} simulationRunId={scope.simulationRunId} loading={referenceCapital.loading} saving={referenceCapital.saving} error={referenceCapital.error} onSave={referenceCapital.save} onRemove={referenceCapital.remove} />}
  </>;
}

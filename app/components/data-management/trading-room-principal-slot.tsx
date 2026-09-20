"use client";

import { useMemo } from "react";

import {
  buildPrincipalReferenceSummary,
  principalScopeKey,
  type PrincipalScope,
} from "../../lib/principal/principal-model";
import { usePrincipalSettings } from "../../lib/principal/use-principal-settings";
import {
  buildTradingRoomModel,
  createDefaultRoomScope,
  type RoomFxSnapshot,
  type TradingRoomMetadataInput,
} from "../../lib/reviews/trading-room-scope";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import { RoomPrincipal } from "../dashboard/room-principal";

export type TradingRoomPrincipalSlotProps = {
  entries: readonly TradeLibraryEntry[];
  instrumentMetadata?: TradingRoomMetadataInput;
  fxSnapshot?: RoomFxSnapshot;
  enabled?: boolean;
};

export function TradingRoomPrincipalSlot({
  entries,
  instrumentMetadata,
  fxSnapshot,
  enabled = true,
}: TradingRoomPrincipalSlotProps) {
  const scope = useMemo(() => createDefaultRoomScope(), []);
  const principalScope = useMemo<PrincipalScope>(
    () => ({ nature: scope.nature, simulationRunId: scope.simulationRunId }),
    [scope.nature, scope.simulationRunId],
  );
  const settings = usePrincipalSettings({ scope: principalScope, enabled });
  const model = useMemo(
    () => buildTradingRoomModel(entries, { scope, instrumentMetadata, fxSnapshot }),
    [entries, fxSnapshot, instrumentMetadata, scope],
  );
  const summary = useMemo(
    () => buildPrincipalReferenceSummary(model.rows, scope, settings.state, fxSnapshot),
    [fxSnapshot, model.rows, scope, settings.state],
  );

  return (
    <RoomPrincipal
      key={principalScopeKey(principalScope)}
      scopeKey={principalScopeKey(principalScope)}
      config={settings.config}
      summary={summary}
      loading={settings.loading}
      saving={settings.saving}
      error={settings.error}
      onSave={settings.save}
      onClear={settings.clear}
    />
  );
}

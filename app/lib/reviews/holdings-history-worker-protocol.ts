import type { DailyCandleRecord } from "../market/contracts";
import type { TradeLibraryEntry } from "../trades/library";
import {
  buildHoldingsHistory,
  type HoldingsHistoryModel,
} from "./trading-room-history";
import type {
  RoomFxSnapshot,
  RoomScope,
  RoomTargetCurrency,
  TradingRoomMetadataInput,
} from "./trading-room-scope";

/** The fixed input snapshot sent to one worker calculation. */
export type HoldingsHistoryWorkerInput = {
  identity: string;
  entries: readonly TradeLibraryEntry[];
  observationScope: RoomScope;
  currentDayScope: RoomScope;
  instrumentMetadata?: TradingRoomMetadataInput;
  candlesByInstrument?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  /** Both windows use this same as-of instant so the result is one snapshot. */
  asOf?: string;
  fxSnapshot?: RoomFxSnapshot;
  targetCurrency?: RoomTargetCurrency;
};

export type HoldingsHistoryWorkerResult = {
  observation: HoldingsHistoryModel;
  currentDay: HoldingsHistoryModel;
};

export type HoldingsHistoryWorkerRequestMessage = {
  requestId: number;
  input: HoldingsHistoryWorkerInput;
};

export type HoldingsHistoryWorkerResponseMessage =
  | { requestId: number; result: HoldingsHistoryWorkerResult }
  | { requestId: number; error: string };

export function computeHoldingsHistory(input: HoldingsHistoryWorkerInput): HoldingsHistoryWorkerResult {
  const shared = {
    instrumentMetadata: input.instrumentMetadata,
    candlesByInstrument: input.candlesByInstrument,
    asOf: input.asOf,
    fxSnapshot: input.fxSnapshot,
    targetCurrency: input.targetCurrency,
  };
  return {
    observation: buildHoldingsHistory(input.entries, { ...shared, scope: input.observationScope }),
    currentDay: buildHoldingsHistory(input.entries, { ...shared, scope: input.currentDayScope }),
  };
}

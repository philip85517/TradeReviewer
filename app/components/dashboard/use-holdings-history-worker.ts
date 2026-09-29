"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import {
  createHoldingsHistoryWorkerController,
  type HoldingsHistoryWorkerController,
  type HoldingsHistoryWorkerInput,
  type HoldingsHistoryWorkerResult,
  type HoldingsHistoryWorkerState,
} from "../../lib/reviews/holdings-history-worker";
import type { HoldingsHistoryModel, HoldingsHistoryPoint } from "../../lib/reviews/trading-room-history";
import type {
  RoomFxSnapshot,
  RoomScope,
  RoomTargetCurrency,
  TradingRoomMetadataInput,
} from "../../lib/reviews/trading-room-scope";
import type { DailyCandleRecord } from "../../lib/market/contracts";

export type UseHoldingsHistoryWorkerInput = {
  identity: string;
  entries: readonly TradeLibraryEntry[];
  observationScope: RoomScope;
  currentDayScope: RoomScope;
  instrumentMetadata?: TradingRoomMetadataInput;
  candlesByInstrument?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  asOf?: string;
  fxSnapshot?: RoomFxSnapshot;
  targetCurrency?: RoomTargetCurrency;
};

export type UseHoldingsHistoryWorkerResult = {
  holdingsHistoryModel: HoldingsHistoryModel;
  currentDayHistory: HoldingsHistoryModel;
  currentDayPoint: HoldingsHistoryPoint | undefined;
  pending: boolean;
  error: string | null;
  statusReason: string | null;
  retry(): void;
};

function pendingModel(scope: RoomScope, fxSnapshot?: RoomFxSnapshot): HoldingsHistoryModel {
  return {
    points: [],
    start: scope.period.startDate,
    end: scope.period.endDate,
    reasons: ["持仓历史正在计算"],
    scope,
    fxSnapshotId: fxSnapshot?.id ?? null,
  };
}

function modelWithStatus(model: HoldingsHistoryModel, statusReason: string | null): HoldingsHistoryModel {
  if (!statusReason || model.reasons.includes(statusReason)) return model;
  return { ...model, reasons: [...model.reasons, statusReason] };
}

function stateForInput(state: HoldingsHistoryWorkerState, input: HoldingsHistoryWorkerInput): HoldingsHistoryWorkerState {
  if (state.identity === input.identity) return state;
  return {
    ...state,
    identity: input.identity,
    pending: true,
    result: null,
    error: null,
  };
}

function terminateAfterConfirmedUnmount(
  controller: HoldingsHistoryWorkerController,
  tokenRef: { current: number },
  token: number,
): void {
  queueMicrotask(() => {
    if (tokenRef.current === token) controller.terminate();
  });
}

export function useHoldingsHistoryWorker(input: UseHoldingsHistoryWorkerInput): UseHoldingsHistoryWorkerResult {
  const [controller] = useState<HoldingsHistoryWorkerController>(() => createHoldingsHistoryWorkerController());
  const workerInput = useMemo<HoldingsHistoryWorkerInput>(() => ({
    identity: input.identity,
    entries: input.entries,
    observationScope: input.observationScope,
    currentDayScope: input.currentDayScope,
    instrumentMetadata: input.instrumentMetadata,
    candlesByInstrument: input.candlesByInstrument,
    asOf: input.asOf,
    fxSnapshot: input.fxSnapshot,
    targetCurrency: input.targetCurrency,
  }), [
    input.asOf,
    input.candlesByInstrument,
    input.currentDayScope,
    input.entries,
    input.fxSnapshot,
    input.instrumentMetadata,
    input.observationScope,
    input.targetCurrency,
    input.identity,
  ]);
  const [workerState, setWorkerState] = useState<HoldingsHistoryWorkerState>(() => controller.getState());
  const cleanupToken = useRef(0);

  useEffect(() => controller.subscribe(setWorkerState), [controller]);
  useEffect(() => {
    controller.request(workerInput);
  }, [controller, workerInput]);
  useEffect(() => {
    const token = ++cleanupToken.current;
    return () => {
      // React StrictMode mounts effects, cleans them up, then mounts them
      // again in one turn. Delay termination so that probe cleanup cannot
      // dispose the controller used by the real second setup.
      terminateAfterConfirmedUnmount(controller, cleanupToken, token);
    };
  }, [controller]);

  const visibleState = stateForInput(workerState, workerInput);
  const statusReason = visibleState.error
    ? `持仓历史计算失败：${visibleState.error}`
    : visibleState.pending ? "持仓历史正在更新" : null;
  const result: HoldingsHistoryWorkerResult | null = visibleState.result;
  const holdingsHistoryModel = modelWithStatus(
    result?.observation ?? pendingModel(workerInput.observationScope, workerInput.fxSnapshot),
    statusReason,
  );
  const currentDayHistory = modelWithStatus(
    result?.currentDay ?? pendingModel(workerInput.currentDayScope, workerInput.fxSnapshot),
    statusReason,
  );

  return {
    holdingsHistoryModel,
    currentDayHistory,
    currentDayPoint: currentDayHistory.points.at(-1),
    pending: visibleState.pending,
    error: visibleState.error,
    statusReason,
    retry: () => controller.retry(),
  };
}

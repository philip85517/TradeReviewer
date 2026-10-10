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
  /** The exact input object currently being requested by the worker. */
  currentInput: HoldingsHistoryWorkerInput;
  /** The exact current input whose result is settled and accepted for display. */
  acceptedInput: HoldingsHistoryWorkerInput | null;
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

type AcceptedSnapshot = {
  input: HoldingsHistoryWorkerInput;
  result: HoldingsHistoryWorkerResult;
};

function structuralKey(input: HoldingsHistoryWorkerInput): string {
  return JSON.stringify([
    input.observationScope,
    input.currentDayScope,
    input.targetCurrency ?? null,
    input.fxSnapshot ?? null,
  ]);
}

function safeAsOfAdvance(previous: string | undefined, next: string | undefined): boolean {
  if (previous === next) return true;
  if (!previous || !next || !previous.includes("T") || !next.includes("T")) return false;
  const previousTime = Date.parse(previous);
  const nextTime = Date.parse(next);
  return Number.isFinite(previousTime) && Number.isFinite(nextTime) && nextTime >= previousTime;
}

function canRetain(previous: AcceptedSnapshot | null, input: HoldingsHistoryWorkerInput): boolean {
  return Boolean(previous && structuralKey(previous.input) === structuralKey(input) && safeAsOfAdvance(previous.input.asOf, input.asOf));
}

function resultMatchesInput(result: HoldingsHistoryWorkerResult | null, input: HoldingsHistoryWorkerInput): result is HoldingsHistoryWorkerResult {
  return Boolean(result
    && JSON.stringify(result.observation.scope) === JSON.stringify(input.observationScope)
    && JSON.stringify(result.currentDay.scope) === JSON.stringify(input.currentDayScope)
    && result.observation.fxSnapshotId === (input.fxSnapshot?.id ?? null)
    && result.currentDay.fxSnapshotId === (input.fxSnapshot?.id ?? null));
}

function stateForInput(state: HoldingsHistoryWorkerState, input: HoldingsHistoryWorkerInput): HoldingsHistoryWorkerState {
  if (state.identity === input.identity) return state;
  const retainCompleted = Boolean(
    state.completedResult
    && state.completedInput
    && canRetain({ input: state.completedInput, result: state.completedResult }, input),
  );
  return {
    ...state,
    identity: input.identity,
    pending: true,
    result: null,
    resultInput: null,
    completedResult: retainCompleted ? state.completedResult : null,
    completedInput: retainCompleted ? state.completedInput : null,
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
  const [previousWorkerInput, setPreviousWorkerInput] = useState(workerInput);
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
  const inputChanged = previousWorkerInput !== workerInput;
  if (inputChanged) setPreviousWorkerInput(workerInput);
  const currentResult = !inputChanged && visibleState.identity === workerInput.identity
    && visibleState.resultInput === workerInput
    && resultMatchesInput(visibleState.result, workerInput)
    ? visibleState.result
    : null;
  const acceptedInput = !visibleState.pending && !visibleState.error && currentResult ? workerInput : null;
  const stateSnapshot = visibleState.completedResult && visibleState.completedInput
    ? { input: visibleState.completedInput, result: visibleState.completedResult }
    : null;
  const stateRetainedResult = stateSnapshot && canRetain(stateSnapshot, workerInput) ? stateSnapshot.result : null;
  // A cold same-scope refresh has no acceptedSnapshot yet. The controller can
  // publish the first compatible completed result while its newer exact input
  // is pending; display it without treating it as an acknowledgement.
  const retainedResult = visibleState.pending || visibleState.error
    ? stateRetainedResult
    : null;
  const result = currentResult ?? retainedResult;
  const retainingSnapshot = Boolean(retainedResult && result === retainedResult && (visibleState.pending || visibleState.error));
  const statusReason = visibleState.error
    ? `持仓历史计算失败：${visibleState.error}${retainingSnapshot ? "（沿用上次快照）" : ""}`
    : visibleState.pending ? `持仓历史正在更新${retainingSnapshot ? "（沿用上次快照）" : ""}` : null;
  const pendingObservation = useMemo(() => pendingModel(workerInput.observationScope, workerInput.fxSnapshot), [workerInput.observationScope, workerInput.fxSnapshot]);
  const pendingCurrentDay = useMemo(() => pendingModel(workerInput.currentDayScope, workerInput.fxSnapshot), [workerInput.currentDayScope, workerInput.fxSnapshot]);
  const holdingsHistoryModel = useMemo(() => modelWithStatus(result?.observation ?? pendingObservation, statusReason), [pendingObservation, result, statusReason]);
  const currentDayHistory = useMemo(() => modelWithStatus(result?.currentDay ?? pendingCurrentDay, statusReason), [pendingCurrentDay, result, statusReason]);

  return {
    holdingsHistoryModel,
    currentDayHistory,
    currentDayPoint: currentDayHistory.points.at(-1),
    currentInput: workerInput,
    acceptedInput,
    pending: visibleState.pending,
    error: visibleState.error,
    statusReason,
    retry: () => controller.retry(),
  };
}

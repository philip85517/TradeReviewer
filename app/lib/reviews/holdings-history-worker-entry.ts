import {
  computeHoldingsHistory,
  type HoldingsHistoryWorkerRequestMessage,
  type HoldingsHistoryWorkerResponseMessage,
} from "./holdings-history-worker-protocol";

type WorkerScope = {
  addEventListener(type: "message", listener: (event: MessageEvent<HoldingsHistoryWorkerRequestMessage>) => void): void;
  postMessage(message: HoldingsHistoryWorkerResponseMessage): void;
};

const workerScope = globalThis as unknown as WorkerScope;

workerScope.addEventListener("message", event => {
  const { requestId, input } = event.data;
  try {
    workerScope.postMessage({ requestId, result: computeHoldingsHistory(input) });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error && error.message ? error.message : String(error),
    });
  }
});

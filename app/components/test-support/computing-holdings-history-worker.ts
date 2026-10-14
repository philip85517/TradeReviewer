import {
  computeHoldingsHistory,
  type HoldingsHistoryWorkerLike,
  type HoldingsHistoryWorkerRequestMessage,
  type HoldingsHistoryWorkerResponseMessage,
} from "../../lib/reviews/holdings-history-worker";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

/**
 * A test-local WorkerLike that keeps the real history calculation and only
 * replaces the browser transport with one queued microtask.
 */
export class ComputingHoldingsHistoryWorker implements HoldingsHistoryWorkerLike {
  onmessage: ((event: MessageEvent<HoldingsHistoryWorkerResponseMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  private terminated = false;

  postMessage(message: HoldingsHistoryWorkerRequestMessage): void {
    if (this.terminated) return;
    queueMicrotask(() => {
      if (this.terminated) return;

      let response: HoldingsHistoryWorkerResponseMessage;
      try {
        response = {
          requestId: message.requestId,
          result: computeHoldingsHistory(message.input),
        };
      } catch (error) {
        response = { requestId: message.requestId, error: errorMessage(error) };
      }

      if (this.terminated) return;
      this.onmessage?.({ data: response } as MessageEvent<HoldingsHistoryWorkerResponseMessage>);
    });
  }

  terminate(): void {
    this.terminated = true;
    this.onmessage = null;
    this.onerror = null;
  }
}

/**
 * Keeps cancellation ownership for refresh runs in one place.
 *
 * A refresh request can be initiated from the header, stock list, or a data
 * dialog. The registry makes those entry points idempotent: a second request
 * for the same key receives the existing run instead of starting another set
 * of provider calls. Controllers are removed only by the owner that created
 * them, so a late completion cannot clear a newer run.
 */
export type RefreshCancellationHandle = {
  key: string;
  controller: AbortController;
  signal: AbortSignal;
  duplicate: boolean;
};

export class RefreshCancellationService {
  private readonly controllers = new Map<string, AbortController>();

  begin(key: string): RefreshCancellationHandle {
    const current = this.controllers.get(key);
    if (current && !current.signal.aborted) {
      return {
        key,
        controller: current,
        signal: current.signal,
        duplicate: true,
      };
    }

    const controller = new AbortController();
    this.controllers.set(key, controller);
    return { key, controller, signal: controller.signal, duplicate: false };
  }

  cancel(key: string, reason?: unknown) {
    const controller = this.controllers.get(key);
    if (!controller || controller.signal.aborted) return false;
    controller.abort(reason ?? new DOMException("行情更新已取消", "AbortError"));
    return true;
  }

  cancelAll(reason?: unknown) {
    let cancelled = 0;
    for (const controller of this.controllers.values()) {
      if (controller.signal.aborted) continue;
      controller.abort(reason ?? new DOMException("行情更新已取消", "AbortError"));
      cancelled += 1;
    }
    return cancelled;
  }

  finish(key: string, controller: AbortController) {
    if (this.controllers.get(key) !== controller) return false;
    this.controllers.delete(key);
    return true;
  }

  isRunning(key: string) {
    const controller = this.controllers.get(key);
    return Boolean(controller && !controller.signal.aborted);
  }

  get activeKeys() {
    return [...this.controllers.entries()]
      .filter(([, controller]) => !controller.signal.aborted)
      .map(([key]) => key);
  }
}

/** Alias with the shorter name used by UI callers. */
export const MarketRefreshCancellationService = RefreshCancellationService;

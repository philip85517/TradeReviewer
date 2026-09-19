const GLOBAL_MARKET_REFRESH_LOCK_NAME =
  "trade-reviewer:global-market-refresh";

type LockManagerLike = {
  request<T>(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: unknown | null) => Promise<T> | T,
  ): Promise<T>;
};

type NavigatorWithLocks = Navigator & {
  locks?: LockManagerLike;
};

export { GLOBAL_MARKET_REFRESH_LOCK_NAME };

/**
 * Runs one refresh while holding an origin-wide exclusive lock. A missing
 * Web Locks implementation falls back to the existing in-page guards; an
 * unavailable lock never starts a request or writes a job.
 */
export async function withGlobalMarketRefreshLock<T>(
  operation: () => Promise<T>,
  onUnavailable?: () => void,
): Promise<T | undefined> {
  const lockManager = typeof navigator === "undefined"
    ? undefined
    : (navigator as NavigatorWithLocks).locks;

  if (!lockManager) return operation();

  let acquired = false;
  let result: T | undefined;
  await lockManager.request(
    GLOBAL_MARKET_REFRESH_LOCK_NAME,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock) {
        onUnavailable?.();
        return undefined;
      }
      acquired = true;
      result = await operation();
      return result;
    },
  );
  return acquired ? result : undefined;
}

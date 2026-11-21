import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryScope, LibraryScopeBootstrap, StorageBootstrap } from "../../lib/storage/sqlite-contracts";

type Client = {
  getBootstrap: () => Promise<StorageBootstrap>;
  getLibraryScope?: (request: LibraryScope, signal?: AbortSignal) => Promise<LibraryScopeBootstrap>;
};
type Entry = { accounts: string[]; instrumentId?: string; returnTo?: string; notice?: string };
type Phase = "loading" | "scoped" | "upgrading" | "full" | "error";
type Upgrade = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };

export function libraryScopeRequest(entry: Entry | undefined): LibraryScope | null {
  if (entry?.returnTo !== "/home" || entry.notice || entry.accounts.length !== 1) return null;
  const accountId = entry.accounts[0];
  const instrumentId = entry.instrumentId;
  if (!accountId?.trim() || accountId === "all" || accountId !== accountId.trim() ||
      !instrumentId?.trim() || instrumentId !== instrumentId.trim()) return null;
  return { accountId, instrumentId };
}

/** Only complete bootstrap application resolves an upgrade; a failed read keeps
 * the scoped page mounted. The workspace aborts each superseded read before it
 * can apply data. Scoped revisions are never compared with full revisions. */
export function useLibraryDataScope(client: Client, entry: Entry | undefined) {
  const [request] = useState(() => client.getLibraryScope ? libraryScopeRequest(entry) : null);
  const [phase, setPhase] = useState<Phase>(request ? "loading" : "full");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [directory, setDirectory] = useState<LibraryScopeBootstrap["accountDirectory"]>([]);
  const context = useRef<LibraryScopeBootstrap | null>(null);
  const fullRequested = useRef(!request);
  const applied = useRef(!request);
  const pending = useRef<Upgrade | null>(null);

  const read = useCallback(async (signal: AbortSignal) => {
    if (fullRequested.current || !request || !client.getLibraryScope) {
      const bootstrap = await client.getBootstrap();
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      context.current = null;
      return bootstrap;
    }
    let result: LibraryScopeBootstrap;
    try {
      result = await client.getLibraryScope(request, signal);
    } catch (error) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      // An invalid/retired entry is safe to browse through the complete path;
      // transient failures stay retryable at this same scoped entry.
      if (!(error instanceof Error) || !("status" in error) || error.status !== 400) throw error;
      fullRequested.current = true;
      const bootstrap = await client.getBootstrap();
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      context.current = null;
      return bootstrap;
    }
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (result.scope.accountId !== request.accountId || result.scope.instrumentId !== request.instrumentId) {
      throw new Error("返回的交易范围与当前入口不一致");
    }
    context.current = result;
    setDirectory(result.accountDirectory);
    return result.bootstrap;
  }, [client, request]);

  const complete = useCallback(() => {
    if (!context.current) applied.current = true;
    setError(null);
    setPhase(context.current ? "scoped" : "full");
    if (!context.current) {
      pending.current?.resolve();
      pending.current = null;
    }
  }, []);
  const fail = useCallback((failure: unknown) => {
    const error = failure instanceof Error ? failure : new Error("无法读取完整交易数据");
    setError(error.message);
    setPhase("error");
    pending.current?.reject(error);
    pending.current = null;
  }, []);
  const ensureFull = useCallback(() => {
    if (!context.current && applied.current && fullRequested.current) return Promise.resolve();
    if (pending.current) return pending.current.promise;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    pending.current = { promise, resolve, reject };
    fullRequested.current = true;
    setError(null);
    setPhase("upgrading");
    setReloadKey(value => value + 1);
    return promise;
  }, []);
  useEffect(() => () => {
    pending.current?.reject(new DOMException("Cancelled", "AbortError"));
    pending.current = null;
  }, []);

  return { phase, error, reloadKey, directory, context, read, complete, fail, ensureFull,
    isScoped: request !== null && phase !== "full", request, fullRequested };
}

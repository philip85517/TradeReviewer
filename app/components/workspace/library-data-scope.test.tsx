import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryScopeBootstrap, StorageBootstrap } from "../../lib/storage/sqlite-contracts";
import { libraryScopeRequest, useLibraryDataScope } from "./library-data-scope";
const entry = { accounts: ["live:a"], instrumentId: "US:A", returnTo: "/home" };
const bootstrap: StorageBootstrap = { schemaVersion: 1, migration: null, executions: [], importHistory: [], instruments: [], reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {} };
const scoped: LibraryScopeBootstrap = { scope: { accountId: "live:a", instrumentId: "US:A" }, revision: "scope-only", bootstrap, accountDirectory: [{ id: "live:a", label: "账户 A", natures: ["live"] }], accountAliases: [], recallSummaries: [] };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
afterEach(cleanup);
describe("explicit library data scope", () => {
  it("accepts only an unambiguous homepage account and security", () => {
    expect(libraryScopeRequest(entry)).toEqual(scoped.scope);
    for (const invalid of [undefined, { ...entry, accounts: [] }, { ...entry, accounts: ["a", "b"] }, { ...entry, accounts: ["all"] }, { ...entry, accounts: [" a "] }, { ...entry, instrumentId: "" }, { ...entry, notice: "invalid" }, { ...entry, returnTo: "/trades" }]) expect(libraryScopeRequest(invalid)).toBeNull();
  });
  it("reads only scope initially, coalesces full upgrades, and resolves only after application", async () => {
    const client = { getBootstrap: vi.fn(async () => bootstrap), getLibraryScope: vi.fn(async () => scoped) };
    const { result } = renderHook(() => useLibraryDataScope(client, entry));
    await act(async () => { await result.current.read(new AbortController().signal); result.current.complete(); });
    expect(client.getBootstrap).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("scoped");
    expect(result.current.directory).toEqual(scoped.accountDirectory);
    let first!: Promise<void>, second!: Promise<void>;
    act(() => { first = result.current.ensureFull(); second = result.current.ensureFull(); });
    expect(first).toBe(second);
    expect(result.current.phase).toBe("upgrading");
    expect(client.getBootstrap).not.toHaveBeenCalled();
    await act(async () => { await result.current.read(new AbortController().signal); result.current.complete(); await first; });
    expect(client.getBootstrap).toHaveBeenCalledTimes(1);
    expect(result.current.isScoped).toBe(false);
  });
  it("keeps scoped content after upgrade failure and actually retries full reading", async () => {
    const client = { getBootstrap: vi.fn(async () => bootstrap), getLibraryScope: vi.fn(async () => scoped) };
    const { result } = renderHook(() => useLibraryDataScope(client, entry));
    await act(async () => { await result.current.read(new AbortController().signal); result.current.complete(); });
    let rejected!: Promise<unknown>;
    act(() => { rejected = result.current.ensureFull().catch(error => error); });
    act(() => result.current.fail(new Error("offline")));
    expect(await rejected).toEqual(new Error("offline"));
    expect(result.current.context.current).toBe(scoped);
    expect(result.current.error).toBe("offline");
    let retry!: Promise<void>;
    act(() => { retry = result.current.ensureFull(); });
    await act(async () => { await result.current.read(new AbortController().signal); result.current.complete(); await retry; });
    expect(client.getBootstrap).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("full");
  });
  it("does not apply a late aborted scope response over a full read", async () => {
    const slow = deferred<LibraryScopeBootstrap>();
    const client = { getBootstrap: vi.fn(async () => bootstrap), getLibraryScope: vi.fn(() => slow.promise) };
    const { result } = renderHook(() => useLibraryDataScope(client, entry));
    const controller = new AbortController();
    const old = result.current.read(controller.signal).catch(error => error);
    controller.abort();
    let upgrade!: Promise<void>;
    act(() => { upgrade = result.current.ensureFull(); });
    await act(async () => { await result.current.read(new AbortController().signal); result.current.complete(); await upgrade; });
    slow.resolve(scoped);
    expect((await old).name).toBe("AbortError");
    expect(result.current.context.current).toBeNull();
    expect(result.current.phase).toBe("full");
  });
  it("falls back to complete reading for a retired or invalid scope", async () => {
    const client = { getBootstrap: vi.fn(async () => bootstrap), getLibraryScope: vi.fn(async (): Promise<LibraryScopeBootstrap> => { throw Object.assign(new Error("invalid"), { status: 400 }); }) };
    const { result } = renderHook(() => useLibraryDataScope(client, entry));
    await act(async () => { await result.current.read(new AbortController().signal); result.current.complete(); });
    expect(client.getBootstrap).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("full");
    expect(result.current.context.current).toBeNull();
  });

});

import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryScopeBootstrap, StorageBootstrap } from "../lib/storage/sqlite-contracts";
import type { TradeExecution } from "../lib/trades/types";
import { TradeReviewWorkspace } from "./trade-review-workspace";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";
const frame = { cursorIndex: 0, cursor: "2026-11-20T14:30:00.000Z", candles15m: [], executions: [], canGoBack: false, canGoForward: false };
const execution: TradeExecution = { id: "a-buy", source: { platform: "futu", row: 2 }, accountId: "acct", accountLabel: "账户 A", instrument: { id: "US:A", symbol: "A", name: "Alpha", market: "US", currency: "USD" }, side: "buy", executedAt: "2016-01-02T14:30:00.000Z", quantity: "1", price: "10", fee: "0" };
const bootstrap: StorageBootstrap = { schemaVersion: 1, migration: null, executions: [execution], importHistory: [], instruments: [], reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {} };
const scoped: LibraryScopeBootstrap = { scope: { accountId: "acct", instrumentId: "US:A" }, revision: "scope", bootstrap, accountDirectory: [{id:"acct",label:"账户 A",natures:["live"]}], accountAliases: [], recallSummaries: [] };
function deferred<T>() { let resolve!: (value:T)=>void; let reject!: (error:Error)=>void; const promise = new Promise<T>((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject}; }
function setup(scopeRead = vi.fn(async()=>scoped), from: string | null = null) {
  const full = deferred<StorageBootstrap>();
  const client = {...createLegacySqliteClient(), getLibraryScope: scopeRead, getBootstrap: vi.fn(()=>full.promise)};
  const alias = vi.fn(async()=>[]);
  render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={client} legacyStateExporter={async()=>null} activeAliasLoader={alias} homeLibraryEntry={{market:"all",accounts:["acct"],from,to:null,instrumentId:"US:A",returnTo:"/home",notice:""}} />);
  return {client,full,alias};
}
beforeEach(()=>{window.localStorage.clear();vi.stubGlobal("fetch",vi.fn(async()=>Response.json({})));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("real workspace scoped library lifecycle",()=>{
  it("renders real security rows without full/bootstrap/alias reads and retains search draft during upgrade",async()=>{
    const {client,full,alias}=setup();
    await waitFor(()=>expect(document.querySelector(".library-stock-row")?.textContent).toContain("Alpha"));
    expect(client.getBootstrap).not.toHaveBeenCalled();expect(alias).not.toHaveBeenCalled();
    const row=document.querySelector<HTMLButtonElement>(".library-stock-row")!;
    fireEvent.click(row);
    expect(client.getBootstrap).not.toHaveBeenCalled();
    const input=screen.getByRole("searchbox",{name:"搜索已导入标的"});
    fireEvent.change(input,{target:{value:"Alpha"}});
    fireEvent.focus(input);
    await waitFor(()=>expect(client.getBootstrap).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue("Alpha");
    expect(document.querySelector(".library-stock-row")?.textContent).toContain("Alpha");
    await act(async()=>{full.resolve(bootstrap);});
    await waitFor(()=>expect(screen.queryByText("正在读取完整交易库，当前证券和筛选保持不变…")).toBeNull());
    expect(screen.getByRole("searchbox",{name:"搜索已导入标的"})).toHaveValue("Alpha");
  });
  it("clears the homepage period using complete local security history without upgrading", async () => {
    const {client}=setup(undefined,"2026-01-01");
    await screen.findByRole("button",{name:"清除成交期间"});
    fireEvent.click(screen.getByRole("button",{name:"清除成交期间"}));
    await waitFor(()=>expect(document.querySelector(".library-stock-row")?.textContent).toContain("Alpha"));
    expect(client.getBootstrap).not.toHaveBeenCalled();
    expect(screen.getByRole("link",{name:"返回我的交易室"})).toHaveAttribute("href","/home");
  });
  it("opens the real global menu once and fills it after full reading, never displaying scoped counts",async()=>{
    const {client,full}=setup();
    await waitFor(()=>expect(document.querySelector(".library-stock-row")).not.toBeNull());
    expect(screen.queryByLabelText(/条待处理事项/)).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"打开待处理事项"}));
    await waitFor(()=>expect(client.getBootstrap).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog",{name:"待处理事项"})).toHaveTextContent("读取中");
    await act(async()=>full.resolve(bootstrap));
    await waitFor(()=>expect(screen.getByRole("dialog",{name:"待处理事项"})).not.toHaveTextContent("读取中"));
  });

  it("keeps actual rows and search draft on full failure, then retries from the same page",async()=>{
    const {client,full}=setup();
    await waitFor(()=>expect(document.querySelector(".library-stock-row")).not.toBeNull());
    const input=screen.getByRole("searchbox",{name:"搜索已导入标的"});
    fireEvent.change(input,{target:{value:"Alpha"}});fireEvent.focus(input);
    await waitFor(()=>expect(client.getBootstrap).toHaveBeenCalledTimes(1));
    await act(async()=>full.reject(new Error("offline")));
    expect(document.querySelector(".library-stock-row")?.textContent).toContain("Alpha");
    expect(input).toHaveValue("Alpha");
    client.getBootstrap.mockResolvedValueOnce(bootstrap);
    fireEvent.click(screen.getByRole("button",{name:"重试完整读取"}));
    await waitFor(()=>expect(client.getBootstrap).toHaveBeenCalledTimes(2));
    await waitFor(()=>expect(screen.queryByRole("button",{name:"重试完整读取"})).toBeNull());
    expect(screen.getByRole("searchbox",{name:"搜索已导入标的"})).toHaveValue("Alpha");
  });

  it("can retry an initial scoped failure or choose the complete library at that same entry",async()=>{
    const scopeRead=vi.fn(async():Promise<LibraryScopeBootstrap>=>{throw new Error("scope unavailable");});
    const {client,full}=setup(scopeRead);
    await screen.findByRole("button",{name:"读取完整交易库"});
    fireEvent.click(screen.getByRole("button",{name:"重试"}));
    await waitFor(()=>expect(scopeRead).toHaveBeenCalledTimes(2));
    expect(client.getBootstrap).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button",{name:"读取完整交易库"}));
    await waitFor(()=>expect(client.getBootstrap).toHaveBeenCalledTimes(1));
    await act(async()=>full.resolve(bootstrap));
    await waitFor(()=>expect(document.querySelector(".library-stock-row")?.textContent).toContain("Alpha"));
  });

});

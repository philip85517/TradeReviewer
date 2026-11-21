import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RecallWorkspaceProps } from "./recall/recall-workspace";
import type { LibraryScopeBootstrap, StorageBootstrap } from "../lib/storage/sqlite-contracts";
import type { TradeExecution } from "../lib/trades/types";
import { TradeReviewWorkspace } from "./trade-review-workspace";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";

// Keep the real selection, bootstrap and market hydration chain; inspect the
// exact candles delivered to the downstream chart consumer.
vi.mock("./recall/recall-workspace",()=>({RecallWorkspace:(props:RecallWorkspaceProps)=><output data-testid="recall-daily">{props.candlesByTimeframe?.["1D"]?.length??0}</output>}));
const execution: TradeExecution = { id:"a-buy",source:{platform:"futu",row:2},accountId:"acct",accountLabel:"账户 A",instrument:{id:"US:A",symbol:"A",name:"Alpha",market:"US",currency:"USD"},side:"buy",executedAt:"2016-01-04T14:30:00.000Z",quantity:"1",price:"10",fee:"0" };
const bootstrap: StorageBootstrap={schemaVersion:1,migration:null,executions:[execution],importHistory:[],instruments:[],reviews:[],reviewStates:[],tagSuggestions:[],marketDataJobs:[],settings:{}};
const scoped: LibraryScopeBootstrap={scope:{accountId:"acct",instrumentId:"US:A"},revision:"scope",bootstrap,accountDirectory:[{id:"acct",label:"账户 A",natures:["live"]}],accountAliases:[],recallSummaries:[]};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("keeps a successfully hydrated target daily cache through scoped-to-full review navigation",async()=>{
  window.localStorage.clear();vi.stubGlobal("fetch",vi.fn(async()=>Response.json({})));
  let resolve!: (value:StorageBootstrap)=>void;
  const full=new Promise<StorageBootstrap>(yes=>{resolve=yes;});
  const client={...createLegacySqliteClient(),getLibraryScope:vi.fn(async()=>scoped),getBootstrap:vi.fn(()=>full)};
  const getMarketData=vi.spyOn(client,"getMarketData").mockImplementation(async input=>({candles:[],intervalCoverage:[],...(input.dailyOnly?{dailyCandles:[{instrumentId:input.instrumentId,tradingDate:"2016-01-04",open:"10",high:"11",low:"9",close:"10",volume:"100",currency:"USD",provider:"yahoo" as const,providerSymbol:"A",adjustmentMode:"raw" as const,fetchedAt:"2026-11-20T00:00:00Z"}],coverage:[]}:{} )}));
  render(<TradeReviewWorkspace initialFrame={{cursorIndex:0,cursor:"2026-11-20T14:30:00Z",candles15m:[],executions:[],canGoBack:false,canGoForward:false}} showDemo={false} storageClient={client} legacyStateExporter={async()=>null} homeLibraryEntry={{market:"all",accounts:["acct"],from:null,to:null,instrumentId:"US:A",returnTo:"/home",notice:""}}/>);
  await waitFor(()=>expect(getMarketData.mock.calls.some(([input])=>input.dailyOnly)).toBe(true));
  // Flush the already-resolved daily read into the scoped library before navigation.
  await act(async()=>{await new Promise(yes=>setTimeout(yes,20));});
  fireEvent.click(document.querySelector<HTMLButtonElement>(".library-stock-row")!);
  fireEvent.click(await screen.findByRole("button",{name:/打开.*第.*次交易/}));
  await waitFor(()=>expect(client.getBootstrap).toHaveBeenCalledTimes(1));
  await act(async()=>resolve(bootstrap));
  await waitFor(()=>expect(screen.getByTestId("recall-daily")).toHaveTextContent("1"));
  expect(getMarketData.mock.calls.filter(([input])=>input.dailyOnly)).toHaveLength(1);
});

it("reloads expanded target history and initializes added securities through normal market reads",async()=>{
  window.localStorage.clear();vi.stubGlobal("fetch",vi.fn(async()=>Response.json({})));
  let resolve!: (value:StorageBootstrap)=>void;
  const full=new Promise<StorageBootstrap>(yes=>{resolve=yes;});
  const client={...createLegacySqliteClient(),getLibraryScope:vi.fn(async()=>scoped),getBootstrap:vi.fn(()=>full)};
  let releaseExpanded!: ()=>void; let dailyA=0;
  const expandedRead=new Promise<void>(yes=>{releaseExpanded=yes;});
  const getMarketData=vi.spyOn(client,"getMarketData").mockImplementation(async input=>{ if(input.dailyOnly && input.instrumentId==="US:A" && ++dailyA===2) await expandedRead; return ({candles:[],intervalCoverage:[],...(input.dailyOnly?{dailyCandles:[{instrumentId:input.instrumentId,tradingDate:"2016-01-04",open:"10",high:"11",low:"9",close:"10",volume:"100",currency:"USD",provider:"yahoo" as const,providerSymbol:"A",adjustmentMode:"raw" as const,fetchedAt:"2026-11-20T00:00:00Z"}],coverage:[]}:{} )});});
  render(<TradeReviewWorkspace initialFrame={{cursorIndex:0,cursor:"2026-11-20T14:30:00Z",candles15m:[],executions:[],canGoBack:false,canGoForward:false}} showDemo={false} storageClient={client} legacyStateExporter={async()=>null} homeLibraryEntry={{market:"all",accounts:["acct"],from:null,to:null,instrumentId:"US:A",returnTo:"/home",notice:""}}/>);
  await waitFor(()=>expect(getMarketData.mock.calls.some(([input])=>input.dailyOnly)).toBe(true));
  // Flush the already-resolved daily read into the scoped library before navigation.
  await act(async()=>{await new Promise(yes=>setTimeout(yes,20));});
  fireEvent.click(document.querySelector<HTMLButtonElement>(".library-stock-row")!);
  fireEvent.click(await screen.findByRole("button",{name:/打开.*第.*次交易/}));
  await waitFor(()=>expect(client.getBootstrap).toHaveBeenCalledTimes(1));
  const expanded = { ...bootstrap, executions: [execution,
    { ...execution, id:"a-older", accountId:"other-account", executedAt:"2015-01-05T14:30:00Z" },
    { ...execution, id:"b-buy", instrument:{...execution.instrument,id:"US:B",symbol:"B",name:"Beta"} },
  ] };
  await act(async()=>resolve(expanded));
  await waitFor(()=>expect(dailyA).toBe(2));
  expect(screen.queryByTestId("recall-daily")).toBeNull();
  expect(screen.getByText("正在读取本地行情与回放状态…")).toBeInTheDocument();
  await act(async()=>releaseExpanded());
  await waitFor(()=>expect(screen.getByTestId("recall-daily")).toHaveTextContent("1"));
  expect(getMarketData.mock.calls.filter(([input])=>input.dailyOnly && input.instrumentId==="US:A")).toHaveLength(2);
  expect(getMarketData.mock.calls.filter(([input])=>input.dailyOnly && input.instrumentId==="US:B")).toHaveLength(1);
});

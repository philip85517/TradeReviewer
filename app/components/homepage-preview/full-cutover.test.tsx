import {act,cleanup,fireEvent,render,renderHook,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FullHomepage} from './full-homepage';
import {fullLibraryParameters} from './full-client';
import {TradeLibrary} from '../library/trade-library';
import {FullHistoryPanel} from './full-history';
import {useFullHome} from './full-state';
import {defaultFullRequest,type FullResultV1,type FullDetail} from '../../lib/home/full-contracts';
import {createMockSource,DEFAULT_REQUEST} from './mock-source';
import {buildInstrumentTradeSummaries} from '../../lib/trades/instruments';
import {buildTradeLibraryEntries} from '../../lib/trades/library';
import type {TradeExecution} from '../../lib/trades/types';
import {fullLibraryActivityEntries,fullLibraryEntry,fullLibraryBrowse} from './full-library';
afterEach(()=>{cleanup();vi.unstubAllGlobals();sessionStorage.clear();window.history.replaceState(null,'','/home');vi.useRealTimers();});
const coverage={universeComplete:true,confirmedClosedCount:0,closedCount:0,knownNetCount:0,unknownNetCount:0,reasons:[],sourceRefsKey:"empty",affectedSourceRefs:[]};
const money={value:'0.00',currency:'CNY',reasons:[]};
async function response(market:'all'|'CN'|'HK'='all'):Promise<FullResultV1>{
 const core=await createMockSource({scenario:'normal',delayMs:0}).readHome(DEFAULT_REQUEST,new AbortController().signal);
 const request=defaultFullRequest('2026-11-18');request.selection.market=market;
 core.holdings.rows=core.holdings.rows.slice(0,1).map(row=>({...row,id:'position-101',accountId:'account-real-101'}));
 return {historyBounds:{fromYear:2020,toYear:2026},accountIdsByMarket:{CN:core.accounts.filter(a=>a.id!=='all').map(a=>a.id),HK:core.accounts.filter(a=>a.id!=='all').map(a=>a.id),US:[]},evidenceTransport:'release-key-v2',schema:'full-home-v1',releaseId:'release-real',manifest:{schema:'full-home-v1',releaseId:'release-real',sourceSequence:1,asOf:'2026-11-18T01:00:00Z',businessDate:'2026-11-18',timezone:'Asia/Shanghai',fx:{},fxVersion:'fx-1',capabilities:[],moduleComplete:true,modules:{}},request,selectionKey:market,queryArtifactId:market,core:{...core,snapshot:{releaseId:'release-real',scopeId:market,scopeVersion:'one',sourceSequence:1,computedAt:'2026-11-18',valuationCutoff:'2026-11-18',businessDate:'2026-11-18'}},history:{coverage,net:money,fees:money,confirmedNet:money,confirmedFees:money,winRate:null,confirmedWinRate:null,years:[],buckets:[]},contribution:{mode:'current',category:'long',rows:[],total:0,page:1,pages:1,net:money,fees:money,coverage,categories:[],markets:[]},capabilities:{globalOpenOnly:true,review:true,assetTypes:false,reasons:[]},catalogCount:299};
}
it('opens the clicked position beyond catalog page 100 without an empty search lookup',async()=>{
 const data=await response();const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const url=new URL(String(input),'http://localhost');if(url.pathname.endsWith('/detail')){const target=JSON.parse(url.searchParams.get('target')!);const detail:FullDetail={schema:'full-home-v1',releaseId:data.releaseId,target,items:[],holding:null,description:'第101标的真实身份',rounds:[],trades:[],nextCursor:null};return Response.json(detail);}return Response.json(data);});vi.stubGlobal('fetch',fetcher);
 render(<FullHomepage/>);fireEvent.click(await screen.findByRole('button',{name:/查看.*详情/}));await screen.findByRole('dialog');
 const detailCall=fetcher.mock.calls.find(([input])=>String(input).includes('/detail?'))!;const params=new URL(String(detailCall[0]),'http://localhost').searchParams;
 expect(JSON.parse(params.get('target')!)).toMatchObject({kind:'position',id:'position-101',accountScope:['account-real-101']});expect(JSON.parse(params.get('version')!)).toBe('release-real');expect(fetcher.mock.calls.some(([input])=>String(input).includes('/search'))).toBe(false);
});
it('commits the last complete selection and retains applied labels while requests are pending or fail',async()=>{
 const initial=await response(),cn=await response('CN'),hk=await response('HK');let cnResolve!:(r:Response)=>void,hkResolve!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{const params=new URL(String(input),'http://localhost').searchParams;const r=JSON.parse(params.get('request')!);if(r.selection.market==='CN')return new Promise<Response>(resolve=>cnResolve=resolve);if(r.selection.market==='HK')return new Promise<Response>(resolve=>hkResolve=resolve);return Response.json(initial);}));
 const hook=renderHook(()=>useFullHome());await waitFor(()=>expect(hook.result.current.result).not.toBeNull());
 act(()=>hook.result.current.change({market:'CN'}));expect(hook.result.current.request.selection.market).toBe('all');act(()=>hook.result.current.change({market:'HK'}));await act(async()=>hkResolve(Response.json(hk)));await act(async()=>cnResolve(Response.json(cn)));expect(hook.result.current.request.selection.market).toBe('HK');act(()=>hook.result.current.change({market:'CN'}));await act(async()=>cnResolve(Response.json({error:'市场不可用'},{status:422})));expect(hook.result.current.request.selection.market).toBe('HK');act(()=>hook.result.current.change({query:'local'}));await act(async()=>hkResolve(Response.json(hk)));expect(hook.result.current.request.selection.market).toBe('HK');
});
it('recovers an initial 503 via status and re-reads the complete publication',async()=>{
 const data=await response();let reads=0;const fetcher=vi.fn(async(input:RequestInfo|URL)=>{if(String(input).includes('/status'))return Response.json({fullReady:true,fullReleaseId:data.releaseId,state:'ready',canRetry:false,error:null});if(reads++===0)return Response.json({error:'首次构建中'},{status:503});return Response.json(data);});vi.stubGlobal('fetch',fetcher);
 const hook=renderHook(()=>useFullHome());await waitFor(()=>expect(hook.result.current.result?.releaseId).toBe(data.releaseId));expect(fetcher.mock.calls.some(([input])=>String(input).includes('/status'))).toBe(true);expect(reads).toBe(2);
});
it('waits minutes for first publication with bounded polling and resumes after visibility changes',async()=>{
 const data=await response();vi.useFakeTimers();let ready=false,statusReads=0,fullReads=0;
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{if(String(input).includes('/status')){statusReads++;return Response.json({fullReady:ready,fullReleaseId:ready?data.releaseId:null,state:'recovering',canRetry:false,error:null});}fullReads++;return ready?Response.json(data):Response.json({error:'首次构建中'},{status:503});}));
 const hook=renderHook(()=>useFullHome());await act(async()=>{});for(let i=0;i<18;i++)await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});
 expect(hook.result.current.result).toBeNull();expect(statusReads).toBeGreaterThan(8);expect(statusReads).toBeLessThan(25);expect(fullReads).toBe(1);
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});act(()=>document.dispatchEvent(new Event('visibilitychange')));const before=statusReads;
 await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});expect(statusReads).toBe(before);
 ready=true;Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(1);});
 expect(hook.result.current.result?.releaseId).toBe(data.releaseId);expect(fullReads).toBe(2);hook.unmount();const end=statusReads;await vi.advanceTimersByTimeAsync(60000);expect(statusReads).toBe(end);
});
it('keeps the latest market choice while waiting for first publication',async()=>{
 const data=await response('CN');vi.useFakeTimers();let ready=false;
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{if(String(input).includes('/status'))return Response.json({fullReady:ready,state:'recovering',canRetry:false,error:null});if(!ready)return Response.json({error:'首次构建中'},{status:503});const request=JSON.parse(new URL(String(input),'http://localhost').searchParams.get('request')!);expect(request.selection.market).toBe('CN');return Response.json(data);}));
 const hook=renderHook(()=>useFullHome());await act(async()=>{});await act(async()=>{hook.result.current.change({market:'CN'});});ready=true;await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(hook.result.current.request.selection.market).toBe('CN');expect(hook.result.current.result?.releaseId).toBe(data.releaseId);
});
it('keeps an open episode with activity in the homepage range, excludes inactive episodes and respects source trading date',()=>{
 const instrument={id:'US:ACT',symbol:'ACT',name:'Activity',market:'US',currency:'USD'};
 const fill=(id:string,day:string,accountId:string):TradeExecution=>({id,instrument,accountId,accountLabel:accountId,side:'buy',executedAt:day+'T23:00:00Z',quantity:'1',price:'10',fee:'0',source:{platform:'fixture',row:1,tradeNature:'live',tradingDate:day}});
 const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries([fill('in','2026-11-17','a'),fill('out','2026-10-17','b')]),{},{});
 const filtered=fullLibraryActivityEntries(entries,{from:'2026-11-17',to:'2026-11-17'});expect(filtered.flatMap(e=>e.episodes.map(p=>p.episode.accountId))).toEqual(['a']);expect(filtered[0].episodes[0].episode.status).toBe('open');expect(fullLibraryActivityEntries(entries,{from:'2026-11-18',to:'2026-11-18'})).toHaveLength(0);
});

it('translates displayed asset choices to API values and disables undefined fund filtering',async()=>{
 const data=await response();data.capabilities.assetTypes=true;const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const r=JSON.parse(new URL(String(input),'http://localhost').searchParams.get('request')!);return Response.json({...data,request:r});});vi.stubGlobal('fetch',fetcher);render(<FullHomepage/>);await screen.findByRole('button',{name:/查看.*详情/});fireEvent.click(screen.getByRole('button',{name:'附加筛选'}));expect(screen.getByRole('checkbox',{name:'基金'})).toBeDisabled();fireEvent.click(screen.getByRole('checkbox',{name:'股票'}));fireEvent.click(screen.getByRole('button',{name:'应用筛选'}));await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));expect(JSON.parse(new URL(String(fetcher.mock.lastCall![0]),'http://localhost').searchParams.get('request')!).selection.assetTypes).toEqual(['stock']);await screen.findByRole('button',{name:'移除股票筛选'});
});
it('cleans pending and timeout state on cancel while retaining the last applied complete result',async()=>{
 const data=await response();let reads=0;vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{if(reads++===0)return Response.json(data);return new Promise<Response>((_,reject)=>init?.signal?.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));}));const hook=renderHook(()=>useFullHome());await waitFor(()=>expect(hook.result.current.result).not.toBeNull());vi.useFakeTimers();act(()=>hook.result.current.change({market:'CN'}));await act(async()=>hook.result.current.cancel());expect(hook.result.current.pending).toBe(false);expect(hook.result.current.error).toBeNull();expect(hook.result.current.request.selection.market).toBe('all');act(()=>hook.result.current.change({market:'HK'}));await act(async()=>vi.advanceTimersByTimeAsync(15001));expect(hook.result.current.pending).toBe(false);expect(hook.result.current.error).toContain('读取超时');expect(hook.result.current.request.selection.market).toBe('all');
});
it('preserves explicit real library context and corrects malformed URL parameters visibly',()=>{
 expect(fullLibraryEntry({accounts:'["A","B"]',market:'CN',rangeMode:'custom',from:'2026-11-17',to:'2026-11-18',instrument:'CN-SH:600000',returnTo:'/home'})).toMatchObject({accounts:['A','B'],market:'CN',from:'2026-11-17',to:'2026-11-18',instrumentId:'CN-SH:600000',returnTo:'/home',notice:''});
 expect(fullLibraryEntry({accounts:'oops',market:'bad',from:'2026-02-30',to:'2026-01-01',returnTo:'https://outside.test'})).toMatchObject({accounts:[],market:'all',from:null,to:null,returnTo:undefined});expect(fullLibraryEntry({accounts:'oops'}).notice).toContain('账户参数无效');
});

it('maps a cross-market searched object to its actual market and explicit account in the live library contract',()=>{
 const request=defaultFullRequest('2026-11-18');request.selection.market='CN';const params=fullLibraryParameters(request,['CN-account'],{instrumentId:'US:ABC',market:'US',accountId:'US-account'});expect(fullLibraryEntry(Object.fromEntries(params))).toMatchObject({market:'US',accounts:['US-account'],instrumentId:'US:ABC',from:'2026-01-01',to:'2026-11-18',returnTo:'/home'});
});

it.each([
 {name:'selected historical year',entry:'contribution',mode:'historical',all:false,from:'2020-01-01',to:'2020-12-31'},
 {name:'all history',entry:'contribution',mode:'historical',all:true,from:null,to:null},
 {name:'holdings while historical contribution is selected',entry:'holding',mode:'historical',all:false,from:'2026-01-01',to:'2026-11-18'},
 {name:'current contribution',entry:'contribution',mode:'current',all:false,from:'2026-01-01',to:'2026-11-18'},
] as const)('preserves the library range from the $name entry',async({entry,mode,all,from,to})=>{
 const data=await response(),accountId='tiger:5793572';
 data.request.selection={...data.request.selection,market:'US',accountId};data.request.contribution.mode=mode;
 data.request.historyRange=all?{fromYear:2020,toYear:2026,scope:'all'}:{fromYear:2020,toYear:2020};
 data.core.accounts=[{id:'all',name:'全部实盘账户'},{id:accountId,name:'Tiger'}];data.accountIdsByMarket.US=[accountId];
 const item={id:'position-LI',instrumentId:'US:LI',accountId,market:'US' as const,name:'理想汽车',code:'LI',exchange:'NASDAQ',currency:'USD',assetType:'stock',positionKey:'position-LI',tradeSetId:'LI-trades',open:false};
 data.core.holdings.rows=data.core.holdings.rows.map(row=>({...row,...item}));
 data.contribution={...data.contribution,mode,total:1,rows:[{...item,net:money,realized:money,unrealizedChange:money,fees:money,roundCount:4}]};
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{const url=new URL(String(input),'http://localhost');if(url.pathname.endsWith('/detail')){const detail:FullDetail={schema:'full-home-v1',releaseId:data.releaseId,target:JSON.parse(url.searchParams.get('target')!),items:[item],holding:null,description:'LI',rounds:[],trades:[],nextCursor:null};return Response.json(detail);}return Response.json(data);}));
 const browser=window,assign=vi.fn(),location={get href(){return browser.location.href;},get search(){return browser.location.search;},assign};
 vi.stubGlobal('window',new Proxy(browser,{get:(target,key)=>key==='location'?location:Reflect.get(target,key)}));
 render(<FullHomepage/>);
 fireEvent.click(await screen.findByRole('button',{name:entry==='holding'?'查看理想汽车详情':'查看理想汽车贡献详情（US:LI）'}));
 const dialog=await screen.findByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'查看交易'}));
 expect(assign).toHaveBeenCalledOnce();const url=new URL(assign.mock.calls[0][0],'http://localhost');
 expect(url.pathname).toBe('/trades');expect(fullLibraryEntry(Object.fromEntries(url.searchParams))).toMatchObject({market:'US',accounts:[accountId],instrumentId:'US:LI',from,to,returnTo:'/home'});
 const saved=JSON.parse(sessionStorage.getItem('tradereview-full-home-context-v1')!);expect(saved.request).toEqual(data.request);expect(saved.focus).toMatchObject({id:item.id,source:entry==='holding'?'holdings-heading':'contribution-heading'});
});

it('keeps a daily chart date narrower than the historical library source',()=>{
 const request=defaultFullRequest('2026-11-18');request.contribution.mode='historical';request.historyRange={fromYear:2020,toYear:2020};
 const params=fullLibraryParameters(request,['Tiger'],undefined,'2026-11-17','historical-contribution');
 expect(fullLibraryEntry(Object.fromEntries(params))).toMatchObject({from:'2026-11-17',to:'2026-11-17'});expect(params.get('rangeMode')).toBe('custom');
});

it('keeps a slow market read cancelable and announces progress to screen readers',async()=>{
 const data=await response();let reads=0;vi.stubGlobal('fetch',vi.fn(async()=>{if(reads++===0)return Response.json(data);return new Promise<Response>(()=>{});}));render(<FullHomepage/>);await screen.findByRole('button',{name:/查看.*详情/});vi.useFakeTimers();fireEvent.click(screen.getByRole('button',{name:'A股'}));expect(screen.queryByText('更新中，仍显示上次完整结果')).not.toBeInTheDocument();await act(async()=>vi.advanceTimersByTimeAsync(499));expect(screen.queryByText('更新中，仍显示上次完整结果')).not.toBeInTheDocument();await act(async()=>vi.advanceTimersByTimeAsync(1));expect(screen.getByText('更新中，仍显示上次完整结果').parentElement).toHaveClass('hp-performance-chart__sr-only');fireEvent.click(screen.getByRole('button',{name:'取消读取'}));expect(screen.queryByText('更新中，仍显示上次完整结果')).not.toBeInTheDocument();
});
it('restores search context and exact selected result on a fresh homepage read after library return',async()=>{
 const data=await response('HK');const item={id:'position-search-201',instrumentId:'US:NVDA',accountId:'US-account',market:'US',name:'NVIDIA',code:'NVDA',exchange:'NASDAQ',currency:'USD',assetType:'stock',positionKey:'position-search-201',tradeSetId:'trades-201',open:false};sessionStorage.setItem('tradereview-full-home-context-v1',JSON.stringify({request:data.request,search:{query:'NVDA',open:true,selectedId:item.id},scroll:0,focus:{id:item.id,source:'performance-heading'}}));const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('/search')?Response.json({schema:'full-home-v1',releaseId:data.releaseId,items:[item]}):Response.json(data));vi.stubGlobal('fetch',fetcher);render(<FullHomepage/>);const result=await screen.findByRole('button',{name:/NVIDIA NVDA NASDAQ USD 股票 已平仓/});expect(screen.getByRole('searchbox',{name:'搜索全部标的'})).toHaveValue('NVDA');await waitFor(()=>expect(result).toHaveFocus());expect(JSON.parse(new URL(String(fetcher.mock.calls[0][0]),'http://localhost').searchParams.get('request')!).selection.market).toBe('HK');expect(new URL(String(fetcher.mock.calls[0][0]),'http://localhost').searchParams.has('version')).toBe(false);
});
it('shows future history cards and tooltip values as unknown despite backend empty numeric buckets',async()=>{
 const data=await response();data.history.buckets=[{key:'2027-01',granularity:'month',net:money,fees:money,count:0,knownWins:0,winRate:null,cumulativeNet:money,coverage}];render(<FullHistoryPanel request={DEFAULT_REQUEST} range={{fromYear:2027,toYear:2027}} onRangeChange={vi.fn()} history={data.history} today='2026-11-18' firstYear={2020}/>);const point=screen.getByRole('button',{name:/2027-01 该期间尚未到达/});fireEvent.focus(point);expect(screen.getByRole('tooltip')).toHaveTextContent('当期净盈亏：— CNY');expect(screen.getByRole('tooltip')).toHaveTextContent('盈利 / 全部回合：— / —');
});

it('shows identified rounds and the known-net subset rate when history coverage is partial',async()=>{
 const data=await response();const partial={...coverage,universeComplete:false,confirmedClosedCount:2,closedCount:null,knownNetCount:1,unknownNetCount:1,knownCount:1,knownWins:1,reasons:['round-financial-unavailable']};data.history.coverage=partial;data.history.confirmedWinRate='100.00';data.history.buckets=[{key:'2026-01',granularity:'month',net:{...money,value:null,reasons:['round-financial-unavailable']},fees:money,count:2,knownWins:1,winRate:null,cumulativeNet:{...money,value:null,reasons:['round-financial-unavailable']},coverage:partial}];render(<FullHistoryPanel request={DEFAULT_REQUEST} range={{fromYear:2026,toYear:2026}} onRangeChange={vi.fn()} history={data.history} today='2026-11-18' firstYear={2020}/>);
 expect(screen.getByText('已平仓回合')).toHaveAttribute('title','按交易表中的实际平仓记录统计，一条记录计一回合');expect(screen.getByTestId('history-win')).toHaveTextContent('已知净额胜率');expect(screen.getByTestId('history-win')).toHaveTextContent('100.00%');expect(screen.getByTestId('history-win')).toHaveTextContent('1 / 1');expect(screen.getByText(/已识别 2 笔交易/)).toBeInTheDocument();
 fireEvent.change(screen.getByRole('combobox',{name:'历史图表指标'}),{target:{value:'rounds'}});expect(screen.getByRole('button',{name:/2026-01 2 回合/})).toBeInTheDocument();
});

it('carries cumulative realized money across an inactive month while period net and win rates keep the gap',async()=>{
 const data=await response();const one={...coverage,confirmedClosedCount:1,closedCount:1,knownNetCount:1};data.history.buckets=[
  {key:'2026-01',granularity:'month',net:money,fees:money,count:1,knownWins:0,winRate:'0.00',cumulativeNet:money,coverage:one},
  {key:'2026-02',granularity:'month',net:{...money,value:null,reasons:['no-closed-transactions']},fees:money,count:0,knownWins:0,winRate:null,cumulativeNet:money,coverage},
  {key:'2026-03',granularity:'month',net:{...money,value:'1.00'},fees:money,count:1,knownWins:1,winRate:'100.00',cumulativeNet:{...money,value:'1.00'},coverage:one}
 ];render(<FullHistoryPanel request={DEFAULT_REQUEST} range={{fromYear:2026,toYear:2026}} onRangeChange={vi.fn()} history={data.history} today='2026-11-18' firstYear={2020}/>);
 const chart=screen.getByTestId('history-chart'),selector=screen.getByRole('combobox',{name:'历史图表指标'});
 for(const metric of ['net','win']){fireEvent.change(selector,{target:{value:metric}});expect(chart.querySelectorAll('circle.hp-history-point')).toHaveLength(metric==='net'?5:2);expect(chart.querySelector('circle.true-zero')).not.toBeNull();expect(chart.querySelectorAll('polyline.hp-history-series')).toHaveLength(metric==='net'?3:2);}
 fireEvent.focus(screen.getByRole('button',{name:/2026-02 该期间无已平仓成交/}));expect(screen.getByRole('tooltip')).toHaveTextContent('当期净盈亏：— CNY');expect(screen.getByRole('tooltip')).toHaveTextContent('累计净盈亏：0.00 CNY');
 fireEvent.change(selector,{target:{value:'cumulative'}});expect(chart.querySelectorAll('circle.hp-history-point')).toHaveLength(3);expect(chart.querySelectorAll('polyline.hp-history-series')).toHaveLength(1);
 fireEvent.change(selector,{target:{value:'rounds'}});expect(chart.querySelectorAll('circle.hp-history-point')).toHaveLength(3);expect(chart.querySelector('circle.true-zero')).not.toBeNull();
});

it('shows the source market with no activity rows and does not report a valid filtered instrument as changed',()=>{
 const instrument={id:'US:NVDA',symbol:'NVDA',name:'NVIDIA',market:'US',currency:'USD'};const execution:TradeExecution={id:'old-fill',instrument,accountId:'Tiger',accountLabel:'Tiger',side:'buy',executedAt:'2025-01-01T15:00:00Z',quantity:'1',price:'10',fee:'0',source:{platform:'tiger',row:1,tradeNature:'live'}};const full=buildTradeLibraryEntries(buildInstrumentTradeSummaries([execution]),{},{});const initial=fullLibraryBrowse({market:'US',accounts:['Tiger'],instrumentId:'US:NVDA'});render(<TradeLibrary entries={[]} scopeFilterEntries={full} initialBrowseState={initial} candlesByInstrument={{}} marketDataStatuses={{}} timeframe='1D' onTimeframeChange={vi.fn()} onOpenInReview={vi.fn()} onSaveReview={vi.fn()} reviewsHydrated/>);expect(screen.getByRole('combobox',{name:'按市场筛选'})).toHaveValue('US');expect(screen.queryByText(/原股票或交易回合已变化/)).not.toBeInTheDocument();expect(initial.roomFilters?.instrumentIds).toEqual(['US:NVDA']);
});

it('shares contribution market with the global header and retains applied values until complete selection commits',async()=>{
 const initial=await response(),cn=await response('CN'),hk=await response('HK');let resolve!:(r:Response)=>void;const requested:string[]=[];cn.core.dataRange={from:'2026-01-01',to:'2026-11-18'};
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{const r=JSON.parse(new URL(String(input),'http://localhost').searchParams.get('request')!);requested.push(r.selection.market);return requested.length===1?Response.json(initial):new Promise<Response>(next=>resolve=next);}));
 render(<FullHomepage/>);await screen.findByRole('button',{name:/查看.*详情/});const market=screen.getByRole('combobox',{name:'贡献全局市场'});
 fireEvent.change(market,{target:{value:'CN'}});expect(requested).toEqual(['all','CN']);expect(market).toHaveValue('all');expect(within(screen.getByLabelText('市场范围')).getByRole('button',{name:/^全部$/})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('button',{name:/^A股$/})).toHaveAttribute('aria-pressed','false');
 await act(async()=>resolve(Response.json(cn)));expect(market).toHaveValue('CN');expect(screen.getByRole('button',{name:/^A股$/})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:/历史年份范围/}));fireEvent.change(screen.getByRole('combobox',{name:'年份范围类型'}),{target:{value:'all'}});expect(within(screen.getByRole('dialog',{name:'历史年份范围选择'})).getByText('2020–2026')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:/^取消$/}));
 fireEvent.click(screen.getByRole('button',{name:/^港股$/}));expect(requested).toEqual(['all','CN','HK']);expect(market).toHaveValue('CN');await act(async()=>resolve(Response.json(hk)));expect(market).toHaveValue('HK');expect(screen.getByRole('button',{name:/^港股$/})).toHaveAttribute('aria-pressed','true');
});


it('ends initial no-publication loading after 503 and keeps retry available through repeated failure and recovery',async()=>{
 const data=await response();let finish!:(value:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).includes('/status')?Response.json({fullReady:false,fullReleaseId:null,state:'idle',canRetry:false,error:null}):new Promise<Response>(resolve=>finish=resolve)));
 const {container}=render(<FullHomepage/>);
 expect(screen.getAllByLabelText('金额加载中')).toHaveLength(4);
 expect(screen.getByRole('region',{name:'历史统计加载中'})).toHaveAttribute('aria-busy','true');
 const fail=async()=>{await act(async()=>finish(Response.json({error:'尚无已发布结果'},{status:503})));await screen.findByRole('button',{name:'重新读取'});};
 const unavailable=()=>{
  expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0);
  expect(screen.queryByLabelText('金额加载中')).not.toBeInTheDocument();
  expect(screen.queryByText(/图表加载中|持仓加载中|读取持仓中/)).not.toBeInTheDocument();
  expect(screen.getAllByTestId('hp-metric-value')).toHaveLength(4);
  for(const amount of screen.getAllByTestId('hp-metric-value'))expect(amount).toHaveTextContent('—');
  expect(screen.getByRole('region',{name:'历史统计暂不可用'})).toHaveAttribute('aria-busy','false');
  expect(screen.getByRole('region',{name:'贡献暂不可用'})).toHaveAttribute('aria-busy','false');
  expect(screen.getByText('持仓暂不可用')).toBeInTheDocument();
  expect(screen.getAllByText(/尚未就绪|暂不可用/).length).toBeGreaterThan(3);
 };
 await fail();unavailable();
 fireEvent.click(screen.getByRole('button',{name:'重新读取'}));expect(screen.getAllByLabelText('金额加载中')).toHaveLength(4);await fail();unavailable();
 fireEvent.click(screen.getByRole('button',{name:'重新读取'}));await act(async()=>finish(Response.json(data)));await screen.findByRole('button',{name:/查看.*详情/});
 expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(0);expect(screen.queryByText('持仓暂不可用')).not.toBeInTheDocument();expect(container.querySelector('[data-home-ready="true"]')).not.toBeNull();
});

it('recovers a removed saved account once before displaying the initial result',async()=>{
 const data=await response();const saved={...data.request,selection:{...data.request.selection,accountId:'former-account'}};
 window.history.replaceState(null,'','/home?'+new URLSearchParams({state:JSON.stringify(saved)}));
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
  const request=JSON.parse(new URL(String(input),'http://localhost').searchParams.get('request')!);
  return request.selection.accountId==='former-account'?Response.json({error:'账户范围不存在'},{status:404}):Response.json(data);
 });
 vi.stubGlobal('fetch',fetcher);const hook=renderHook(()=>useFullHome());
 await waitFor(()=>expect(hook.result.current.result).not.toBeNull());
 expect(hook.result.current.request.selection.accountId).toBe('all');expect(fetcher).toHaveBeenCalledTimes(2);
});

it('shows known fees without a positive sign and preserves unknown fees', async()=>{
 const data=await response(); data.history.fees={...money,value:'12.5'};
 const view=render(<FullHistoryPanel request={DEFAULT_REQUEST} range={{fromYear:2026,toYear:2026}} onRangeChange={vi.fn()} history={data.history} today='2026-11-18' firstYear={2020}/>);
 expect(screen.getByText('费用（已扣除）').parentElement).toHaveTextContent('12.50');
 expect(screen.getByText('费用（已扣除）').parentElement).not.toHaveTextContent('+');
 data.history.fees={...money,value:null}; view.rerender(<FullHistoryPanel request={DEFAULT_REQUEST} range={{fromYear:2026,toYear:2026}} onRangeChange={vi.fn()} history={data.history} today='2026-11-18' firstYear={2020}/>);
 expect(screen.getByText('费用（已扣除）').parentElement).toHaveTextContent('—');
});


it('defaults to period and cumulative money on one axis using backend cumulative precision',async()=>{
 const data=await response();const one={...coverage,confirmedClosedCount:1,closedCount:1,knownNetCount:1};
 data.history.buckets=[['2026-01','6000.00','6000.00'],['2026-02','6000.00','12000.00'],['2026-03','-0.01','11999.99'],['2026-04','0.01','12000.01']].map(([key,net,cumulative])=>({key,granularity:'month',net:{...money,value:net},fees:money,count:1,knownWins:1,winRate:'100.00',cumulativeNet:{...money,value:cumulative},coverage:one}));
 render(<FullHistoryPanel request={DEFAULT_REQUEST} range={{fromYear:2026,toYear:2026}} onRangeChange={vi.fn()} history={data.history} today='2026-11-18' firstYear={2020}/>);
 const chart=screen.getByTestId('history-chart'),selector=screen.getByRole('combobox',{name:'历史图表指标'});
 expect(selector).toHaveValue('net');expect(within(selector).getByRole('option',{name:/每月.*累计/})).toBeInTheDocument();
 expect(within(chart).getByRole('list',{name:'曲线图例'})).toHaveTextContent('各期净盈亏累计净盈亏');
 expect(chart.querySelectorAll('[data-history-series="net"] polyline')).toHaveLength(1);expect(chart.querySelectorAll('[data-history-series="cumulative"] polyline')).toHaveLength(1);
 for(const dot of chart.querySelectorAll('circle.hp-history-point'))expect(Number(dot.getAttribute('cy'))).toBeGreaterThanOrEqual(18);
 fireEvent.focus(screen.getByRole('button',{name:/2026-04/}));
 expect(screen.getByRole('tooltip')).toHaveTextContent('当期净盈亏：+0.01 CNY');expect(screen.getByRole('tooltip')).toHaveTextContent('累计净盈亏：+12,000.01 CNY');
 expect(screen.getByRole('button',{name:/2026-04/})).toHaveAccessibleName(/累计净盈亏.*12,000.01/);
 fireEvent.change(selector,{target:{value:'cumulative'}});expect(chart.querySelectorAll('[data-history-series="net"]')).toHaveLength(0);expect(chart.querySelectorAll('[data-history-series="cumulative"] polyline')).toHaveLength(1);
 fireEvent.change(selector,{target:{value:'win'}});expect(chart.querySelectorAll('[data-history-series="cumulative"]')).toHaveLength(0);
});

it('draws cumulative independently through known zero and missing period net while leaving unknown and future gaps',async()=>{
 const data=await response();const one={...coverage,confirmedClosedCount:1,closedCount:1,knownNetCount:1};
 data.history.buckets=[
  {key:'2026-01',net:money,cumulativeNet:money,coverage:one},
  {key:'2026-02',net:{...money,value:null,reasons:['no-closed-transactions']},cumulativeNet:money,coverage},
  {key:'2026-03',net:{...money,value:null,reasons:['missing']},cumulativeNet:{...money,value:'25.00'},coverage:one},
  {key:'2026-04',net:{...money,value:'1.00'},cumulativeNet:{...money,value:null,reasons:['missing']},coverage:one},
  {key:'2026-05',net:{...money,value:'2.00'},cumulativeNet:{...money,value:'28.00'},coverage:one},
  {key:'2026-12',net:money,cumulativeNet:money,coverage:one}
 ].map(b=>({...b,granularity:'month',fees:money,count:b.coverage.closedCount,knownWins:0,winRate:null}));
 render(<FullHistoryPanel request={DEFAULT_REQUEST} range={{fromYear:2026,toYear:2026}} onRangeChange={vi.fn()} history={data.history} today='2026-11-18' firstYear={2020}/>);
 const chart=screen.getByTestId('history-chart');
 expect(chart.querySelectorAll('[data-history-series="net"] circle')).toHaveLength(3);
 expect(chart.querySelectorAll('[data-history-series="cumulative"] circle')).toHaveLength(4);
 const cumulativePaths=chart.querySelectorAll('[data-history-series="cumulative"] polyline');expect(cumulativePaths).toHaveLength(2);expect(cumulativePaths[0].getAttribute('points')!.split(' ')).toHaveLength(3);
 fireEvent.focus(screen.getByRole('button',{name:/2026-03/}));expect(screen.getByRole('tooltip')).toHaveTextContent('当期净盈亏：— CNY');expect(screen.getByRole('tooltip')).toHaveTextContent('累计净盈亏：+25.00 CNY');
 fireEvent.focus(screen.getByRole('button',{name:/2026-04/}));expect(screen.getByRole('tooltip')).toHaveTextContent('累计净盈亏：— CNY');expect(screen.getByRole('tooltip')).toHaveTextContent('前期数据缺失，累计暂不可计算');
 fireEvent.focus(screen.getByRole('button',{name:/2026-12/}));expect(screen.getByRole('tooltip')).toHaveTextContent('累计净盈亏：— CNY');
});

import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PerformanceChart} from './performance-chart';
import {HomepagePreview} from './homepage-preview';
import {createMockSource,DEFAULT_REQUEST} from './mock-source';
import type {HomepageSource} from './display-contract';
afterEach(()=>{cleanup();vi.useRealTimers();});
it.each([0,600])('keeps a detail request taking %i ms stable while a search draft waits',async(delay)=>{
 window.history.replaceState(null,'','/home');
 const base=createMockSource({scenario:'normal',delayMs:0});
 render(<HomepagePreview source={{...base,readHolding:async(...args)=>{if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return base.readHolding(...args);}}}/>);
 const row=await screen.findByRole('button',{name:/查看贵州茅台详情/});
 vi.useFakeTimers();
 fireEvent.change(screen.getByLabelText('搜索持仓'),{target:{value:'NO_MATCH'}});
 fireEvent.click(row);
 await act(async()=>{await vi.advanceTimersByTimeAsync(delay+1);});
 expect(screen.getByRole('dialog')).toBeInTheDocument();
 await act(async()=>{await vi.advanceTimersByTimeAsync(500);});
 expect(screen.getByRole('dialog')).toBeInTheDocument();
 expect(new URLSearchParams(window.location.search).get('q')).toBe('');
 fireEvent.click(screen.getByRole('button',{name:'关闭持仓详情'}));
 await act(async()=>{await vi.advanceTimersByTimeAsync(301);});
 expect(screen.getByText('共 0 条持仓')).toBeInTheDocument();
 expect(new URLSearchParams(window.location.search).get('q')).toBe('NO_MATCH');
});
it('keeps the prior version frozen in detail while polling, then replaces the complete page after returning',async()=>{
 window.history.replaceState(null,'','/home');
 const base=createMockSource({scenario:'normal',delayMs:0});let version='one';
 const source:HomepageSource={...base,kind:'http',readStatus:async()=>({state:'ready',releaseId:version,asOf:'2026-11-14T00:00:00Z',pendingSequence:0,publishedSequence:0,pendingSince:null,error:null,canRetry:false}),readHome:async(r,s)=>{const v=await base.readHome(r,s);return{...v,stamp:{...v.stamp,version}};},readHolding:base.readHolding};
 // Keep the test's source identity contract explicit rather than depending on the mock's private version.
 source.readHolding=async(stamp,id,signal)=>{const home=await base.readHome(DEFAULT_REQUEST,signal);return{stamp,holding:home.holdings.rows.find(h=>h.id===id)!,description:'冻结详情'};};
 render(<HomepagePreview source={source}/>);
 const button=await screen.findByRole('button',{name:/查看贵州茅台详情/});fireEvent.click(button);
 await screen.findByRole('dialog');version='two';
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,2100));});
 expect(screen.getByRole('dialog')).toBeInTheDocument();expect(document.querySelector('[data-home-version]')).toHaveAttribute('data-home-version','one');
 fireEvent.click(screen.getByRole('button',{name:'关闭持仓详情'}));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,2100));});
 await waitFor(()=>expect(document.querySelector('[data-home-version]')).toHaveAttribute('data-home-version','two'));
 expect(screen.queryByText('Mock 预览')).not.toBeInTheDocument();
},15000);

it('reloads the complete version on explicit retry instead of treating the request as an unchanged partial read',async()=>{
 window.history.replaceState(null,'','/home');
 const base=createMockSource({scenario:'normal',delayMs:0});
 const readHome=vi.fn(async (...args:Parameters<typeof base.readHome>)=>({...await base.readHome(...args),reasons:["依据缺失"]}));const readChange=vi.fn(async(current)=>current);
 render(<HomepagePreview source={{...base,kind:'http',readHome,readChange}}/>);
 await screen.findByRole('button',{name:/查看贵州茅台详情/});
 // This fixture has a completeness warning with an explicit reread control.
 fireEvent.click(screen.getByRole('button',{name:'重新读取'}));
 await waitFor(()=>expect(readHome).toHaveBeenCalledTimes(2));
 expect(readChange).not.toHaveBeenCalled();
});
it('restores the requested scope and detail after first-install recovery',async()=>{
 const base=createMockSource({scenario:'normal',delayMs:0});
 const home=await base.readHome({...DEFAULT_REQUEST,market:'CN'},new AbortController().signal);
 const id=home.holdings.rows[0].id;
 window.history.replaceState(null,'',`/home?market=CN&holding=${encodeURIComponent(id)}&panel=detail`);
 let ready=false;
 const source:HomepageSource={...base,kind:'http',readHome:async(r,s)=>{if(!ready)throw new Error('正在重建');return base.readHome(r,s);},readStatus:async()=>({state:'ready',releaseId:home.stamp.version,asOf:home.stamp.asOf,pendingSequence:0,publishedSequence:0,pendingSince:null,error:null,canRetry:false})};
 render(<HomepagePreview source={source}/>);
 await screen.findByText('正在重建',{exact:false});ready=true;
 await waitFor(()=>expect(screen.getByRole('dialog')).toBeInTheDocument(),{timeout:6000});
 expect(screen.getByRole('button',{name:'A股'})).toHaveAttribute('aria-pressed','true');
},10000);
it('persists the frozen release in detail links and restores it after a reload',async()=>{
 window.history.replaceState(null,'','/home');
 const base=createMockSource({scenario:'normal',delayMs:0});let latest='one';
 const readHome=vi.fn(async(r,s,version?:string)=>{const home=await base.readHome(r,s);return {...home,stamp:{...home.stamp,version:version??latest}};});
 const source:HomepageSource={...base,kind:'http',readHome,readHolding:async(stamp,id,signal)=>{const home=await base.readHome(DEFAULT_REQUEST,signal);return {stamp,holding:home.holdings.rows.find(h=>h.id===id)!,description:'冻结详情'};}};
 render(<HomepagePreview source={source}/>);fireEvent.click(await screen.findByRole('button',{name:/查看贵州茅台详情/}));await screen.findByRole('dialog');
 expect(new URLSearchParams(window.location.search).get('release')).toBe('one');
 cleanup();latest='two';render(<HomepagePreview source={source}/>);await screen.findByRole('dialog');
 expect(readHome.mock.lastCall?.[2]).toBe('one');expect(document.querySelector('[data-home-version]')).toHaveAttribute('data-home-version','one');
});

it('preserves a pinned chart date when a new publication replaces its values',async()=>{
 const source=createMockSource({scenario:'normal',delayMs:0});
 const home=await source.readHome(DEFAULT_REQUEST,new AbortController().signal);
 const props={series:home.series,reportCurrency:home.stamp.reportCurrency,interactionKey:'CN/all/YTD'};
 const {rerender}=render(<PerformanceChart {...props}/>);
 const point=screen.getAllByTestId(/^hp-chart-point-/)[0];
 fireEvent.click(point);
 expect(screen.getByText('已固定')).toBeInTheDocument();
 rerender(<PerformanceChart {...props} series={{...home.series,version:'new-publication'}}/>);
 expect(screen.getByText('已固定')).toBeInTheDocument();
 rerender(<PerformanceChart {...props} interactionKey='HK/all/YTD'/>);
 expect(screen.queryByText('已固定')).not.toBeInTheDocument();
});

it('keeps an expired frozen link explicit until the user requests a fresh homepage',async()=>{
 const base=createMockSource({scenario:'normal',delayMs:0});
 const home=await base.readHome(DEFAULT_REQUEST,new AbortController().signal);
 window.history.replaceState(null,'',`/home?holding=${encodeURIComponent(home.holdings.rows[0].id)}&panel=detail&release=expired`);
 const readHome=vi.fn(async(r,s,version?:string)=>{if(version==='expired')throw Error('结果版本已过期');return base.readHome(r,s);});
 const source:HomepageSource={...base,kind:'http',readHome,readStatus:async()=>({state:'ready',releaseId:'new-head',asOf:home.stamp.asOf,pendingSequence:0,publishedSequence:0,pendingSince:null,error:null,canRetry:false})};
 render(<HomepagePreview source={source}/>);
 await screen.findByText(/结果版本已过期/);
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,2100));});
 expect(readHome).toHaveBeenCalledTimes(1);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'重新读取'}));
 await screen.findByRole('button',{name:/查看贵州茅台详情/});
 expect(new URLSearchParams(window.location.search).has('release')).toBe(false);
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
},10000);

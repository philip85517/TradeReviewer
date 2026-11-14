'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stamp, HoldingDetail, HomeRequest, HomepageSource, HomeView, Scenario, TradeCollection, RefreshStatus } from './display-contract';
import { DEFAULT_REQUEST } from './mock-source';
import { parseLocation, serializeLocation, type PreviewLocation } from './location-state';

function verifyIdentity(result: { stamp: Stamp }, stamp: Stamp, actual: string, expected: string) {
  if (JSON.stringify(result.stamp) !== JSON.stringify(stamp) || actual !== expected) throw new Error('结果版本或持仓身份不匹配，已保留原视图');
}

export function useHomepagePreview(source: HomepageSource, scenario: Scenario) {
  const defaults=source.initialRequest??DEFAULT_REQUEST;
  const [refreshStatus,setRefreshStatus]=useState<RefreshStatus|null>(null);
  const [view, setView] = useState<HomeView | null>(null);
  const [showPending, setShowPending] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [detail, setDetail] = useState<HoldingDetail | null>(null), [trades, setTrades] = useState<TradeCollection | null>(null);
  const committed = useRef<HomeView | null>(null), location = useRef<PreviewLocation>({ request: defaults, scenario });
  const active = useRef<AbortController | null>(null), generation = useRef(0);
  const origin = useRef<HTMLElement | null>(null);
  const originHeading = useRef('holdings-heading');
  const store = useCallback((next: PreviewLocation, replace = false) => {
    location.current = next;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', serializeLocation(next));
  }, []);
  const run = useCallback(async <T,>(read: (signal: AbortSignal) => Promise<T>, commit: (result: T) => void) => {
    active.current?.abort();
    const controller = new AbortController(), token = ++generation.current;
    active.current = controller; setPending(true); setError(null);
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
    setShowPending(false);
    // A fast read commits directly; only sustained reads need stale-view feedback.
    const feedback = setTimeout(() => {
      if (generation.current === token && !controller.signal.aborted) setShowPending(true);
    }, 250);
    feedbackTimer.current = feedback;
    const timeout = setTimeout(() => {
      if (generation.current !== token) return;
      ++generation.current; controller.abort(); clearTimeout(feedback); setShowPending(false); setPending(false); setError('读取超过15秒，请手动修复或重试');
    }, 15000);
    try { const result = await read(controller.signal); if (!controller.signal.aborted && token === generation.current) commit(result); }
    catch (cause) { if (!controller.signal.aborted && token === generation.current) setError(cause instanceof Error ? cause.message : '读取失败'); }
    finally { clearTimeout(timeout); clearTimeout(feedback); if (token === generation.current) { active.current = null; feedbackTimer.current = null; setShowPending(false); setPending(false); } }
  }, []);
  const load = useCallback((request: HomeRequest, restore?: PreviewLocation, replace = false, partial = false) => run(signal => partial&&committed.current&&source.readChange?source.readChange(committed.current,request,signal):source.readHome(request, signal,restore?.holdingId?restore.releaseId:undefined), result => {
    const scope = JSON.stringify([request.market, request.accountId, request.period]);
    if (result.stamp.scope !== scope) { setError('结果范围不匹配，已保留原视图'); return; }
    if (restore) setNotices(restore.notices ?? []);
    committed.current = result; setView(result); setDetail(null); setTrades(null);
    const next: PreviewLocation = { request: result.request, scenario, ...(restore?.holdingId ? { holdingId: restore.holdingId, panel: restore.panel, releaseId:restore.releaseId } : {}) };
    store(next, replace);
  }), [run, scenario, source, store]);
  const invalidate = useCallback(() => { ++generation.current; active.current?.abort(); if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current); feedbackTimer.current = null; }, []);
  useEffect(() => {
    const initial = parseLocation(window.location.search,defaults,source.kind==='http');
    location.current = initial;
    void load(initial.request, initial, true);
    const pop = () => { const next = parseLocation(window.location.search,defaults,source.kind==='http'); setNotices(next.notices ?? []); void load(next.request, next, true); };
    window.addEventListener('popstate', pop);
    return () => { window.removeEventListener('popstate', pop); invalidate(); };
  }, [load, invalidate, defaults, source.kind]);
  // Restore a direct link only after its exact complete home result has committed.
  useEffect(() => {
    if (!view || !location.current.holdingId) return;
    const restored = location.current, id = restored.holdingId!;
    void run(signal => source.readHolding(view.stamp, id, signal), result => {
      verifyIdentity(result, view.stamp, result.holding.id, id);
      setDetail(result);
      if (restored.panel === 'trades') void run(signal => source.readTrades(view.stamp, id, signal), result => { verifyIdentity(result, view.stamp, result.holdingId, id); setTrades(result); });
    });
  }, [view, run, source]);
  const change = useCallback((patch: Partial<HomeRequest>) => {
    const base = committed.current?.request ?? defaults;
    void load({ ...base, ...patch, page: patch.page ?? 1 },undefined,false,true);
  }, [load, defaults]);
  const openHolding = (id: string, trigger: HTMLElement) => {
    const current = committed.current; if (!current) return;
    origin.current = trigger;
    originHeading.current = trigger.closest('.hp-contribution') ? 'contribution-heading' : 'holdings-heading';
    void run(signal => source.readHolding(current.stamp, id, signal), result => {
      verifyIdentity(result, current.stamp, result.holding.id, id);
      setDetail(result); setTrades(null); store({ request: current.request, scenario, holdingId: id, panel: 'detail', ...(source.kind==='http'?{releaseId:current.stamp.version}:{}) });
    });
  };
  const close = () => {
    invalidate(); setShowPending(false); setPending(false); setError(null); setDetail(null); setTrades(null);
    if (committed.current) store({ request: committed.current.request, scenario });
    requestAnimationFrame(() => {
      if (origin.current?.isConnected) origin.current.focus({ preventScroll: true });
      else document.getElementById(originHeading.current)?.focus({ preventScroll: true });
    });
  };
  useEffect(()=>{
    if(!source.readStatus)return;
    let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|null=null;
    const poll=async()=>{
      controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),5000);
      try {
        const status=await source.readStatus!(controller.signal);
        if(stopped)return;
        setRefreshStatus(previous=>JSON.stringify(previous)===JSON.stringify(status)?previous:status);
        const previous=committed.current,token=generation.current;
        // Details keep their frozen release; an active navigation owns the next commit.
        if(!(location.current.holdingId&&location.current.releaseId&&!previous)&&status.releaseId&&status.releaseId!==previous?.stamp.version&&(!previous||!location.current.holdingId)&&!active.current){
          const result=await source.readHome(previous?.request??location.current.request,controller.signal);
          if(stopped||controller.signal.aborted||token!==generation.current||active.current||(previous&&location.current.holdingId))return;
          const requested=previous?.request??location.current.request;
          if(result.stamp.scope!==JSON.stringify([requested.market,requested.accountId,requested.period]))throw new Error('后台结果范围不一致');
          committed.current=result;setView(result);setError(null);
          store({...location.current,request:result.request},true);
          requestAnimationFrame(()=>{if(origin.current&&!origin.current.isConnected)document.getElementById('holdings-heading')?.focus({preventScroll:true});});
        }
      }catch(cause){
        if(!stopped)setRefreshStatus(previous=>({...previous,state:'failed',releaseId:previous?.releaseId??null,asOf:previous?.asOf??null,publishedSequence:previous?.publishedSequence??0,pendingSequence:previous?.pendingSequence??0,pendingSince:previous?.pendingSince??null,canRetry:true,error:cause instanceof Error?cause.message:'无法确认后台更新状态'}));
      }finally{clearTimeout(timeout);if(!stopped)timer=setTimeout(poll,2000);}
    };
    timer=setTimeout(poll,2000);
    return()=>{stopped=true;clearTimeout(timer);controller?.abort();};
  },[source,store]);
  return { view, refreshStatus, pending, showPending, error, notices, detail, trades, change, close,
    reload: () => { void load(committed.current?.request ?? location.current.request, !committed.current&&location.current.releaseId?{request:location.current.request,scenario}:location.current, true); },
    cancel: () => { invalidate(); setShowPending(false); setPending(false); setError(null); },
    openHolding,
    openTrades: () => { if (!detail) return; void run(signal => source.readTrades(detail.stamp, detail.holding.id, signal), result => { verifyIdentity(result, detail.stamp, result.holdingId, detail.holding.id); setTrades(result); store({ ...location.current, panel: 'trades' }); }); },
    moreTrades:()=>{if(!trades||trades.nextCursor==null)return;const current=trades;void run(signal=>source.readTrades(current.stamp,current.holdingId,signal,current.nextCursor!),result=>{verifyIdentity(result,current.stamp,result.holdingId,current.holdingId);if(result.tradeSetId!==current.tradeSetId)throw new Error('交易集合版本不一致');setTrades({...result,trades:[...current.trades,...result.trades]});});},
    backToDetail: () => { setTrades(null); store({ ...location.current, panel: 'detail' }); },
    repair: () => { const request = committed.current?.request ?? defaults; void run(signal => source.repair(request, signal), result => { if (result.remainingReasons.length) setError(result.remainingReasons.join('；')); else if(!source.readStatus) void load(request); }); },
    exportCSV: () => { const request = committed.current?.request; if (!request) return; void run(signal => source.exportHoldings(request, signal,committed.current?.stamp.version), csv => { const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = source.kind==='http'?'持仓.csv':'持仓-Mock.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }); },
  };
}

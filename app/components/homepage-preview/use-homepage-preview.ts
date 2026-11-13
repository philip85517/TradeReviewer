'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stamp, HoldingDetail, HomeRequest, HomepageSource, HomeView, Scenario, TradeCollection } from './display-contract';
import { DEFAULT_REQUEST } from './mock-source';
import { parseLocation, serializeLocation, type PreviewLocation } from './location-state';

function verifyIdentity(result: { stamp: Stamp }, stamp: Stamp, actual: string, expected: string) {
  if (JSON.stringify(result.stamp) !== JSON.stringify(stamp) || actual !== expected) throw new Error('结果版本或持仓身份不匹配，已保留原视图');
}

export function useHomepagePreview(source: HomepageSource, scenario: Scenario) {
  const [view, setView] = useState<HomeView | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [detail, setDetail] = useState<HoldingDetail | null>(null), [trades, setTrades] = useState<TradeCollection | null>(null);
  const committed = useRef<HomeView | null>(null), location = useRef<PreviewLocation>({ request: DEFAULT_REQUEST, scenario });
  const active = useRef<AbortController | null>(null), generation = useRef(0);
  const origin = useRef<HTMLElement | null>(null);
  const store = useCallback((next: PreviewLocation, replace = false) => {
    location.current = next;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', serializeLocation(next));
  }, []);
  const run = useCallback(async <T,>(read: (signal: AbortSignal) => Promise<T>, commit: (result: T) => void) => {
    active.current?.abort();
    const controller = new AbortController(), token = ++generation.current;
    active.current = controller; setPending(true); setError(null);
    const timeout = setTimeout(() => {
      if (generation.current !== token) return;
      ++generation.current; controller.abort(); setPending(false); setError('读取超过15秒，请手动修复或重试');
    }, 15000);
    try { const result = await read(controller.signal); if (!controller.signal.aborted && token === generation.current) commit(result); }
    catch (cause) { if (!controller.signal.aborted && token === generation.current) setError(cause instanceof Error ? cause.message : '读取失败'); }
    finally { clearTimeout(timeout); if (token === generation.current) { active.current = null; setPending(false); } }
  }, []);
  const load = useCallback((request: HomeRequest, restore?: PreviewLocation, replace = false) => run(signal => source.readHome(request, signal), result => {
    const scope = JSON.stringify([request.market, request.accountId, request.period]);
    if (result.stamp.scope !== scope) { setError('结果范围不匹配，已保留原视图'); return; }
    if (restore) setNotices(restore.notices ?? []);
    committed.current = result; setView(result); setDetail(null); setTrades(null);
    const next: PreviewLocation = { request: result.request, scenario, ...(restore?.holdingId ? { holdingId: restore.holdingId, panel: restore.panel } : {}) };
    store(next, replace);
  }), [run, scenario, source, store]);
  const invalidate = useCallback(() => { ++generation.current; active.current?.abort(); }, []);
  useEffect(() => {
    const initial = parseLocation(window.location.search);
    void load(initial.request, initial, true);
    const pop = () => { const next = parseLocation(window.location.search); setNotices(next.notices ?? []); void load(next.request, next, true); };
    window.addEventListener('popstate', pop);
    return () => { window.removeEventListener('popstate', pop); invalidate(); };
  }, [load, invalidate]);
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
    const base = committed.current?.request ?? DEFAULT_REQUEST;
    void load({ ...base, ...patch, page: patch.page ?? 1 });
  }, [load]);
  const openHolding = (id: string, trigger: HTMLElement) => {
    const current = committed.current; if (!current) return;
    origin.current = trigger;
    void run(signal => source.readHolding(current.stamp, id, signal), result => {
      verifyIdentity(result, current.stamp, result.holding.id, id);
      setDetail(result); setTrades(null); store({ request: current.request, scenario, holdingId: id, panel: 'detail' });
    });
  };
  const close = () => {
    ++generation.current; active.current?.abort(); setPending(false); setError(null); setDetail(null); setTrades(null);
    if (committed.current) store({ request: committed.current.request, scenario });
    requestAnimationFrame(() => {
      if (origin.current?.isConnected) origin.current.focus({ preventScroll: true });
      else document.getElementById('holdings-heading')?.focus({ preventScroll: true });
    });
  };
  return { view, pending, error, notices, detail, trades, change, close,
    cancel: () => { ++generation.current; active.current?.abort(); setPending(false); setError(null); },
    openHolding,
    openTrades: () => { if (!detail) return; void run(signal => source.readTrades(detail.stamp, detail.holding.id, signal), result => { verifyIdentity(result, detail.stamp, result.holdingId, detail.holding.id); setTrades(result); store({ ...location.current, panel: 'trades' }); }); },
    backToDetail: () => { setTrades(null); store({ ...location.current, panel: 'detail' }); },
    repair: () => { const request = committed.current?.request ?? DEFAULT_REQUEST; void run(signal => source.repair(request, signal), result => { if (result.remainingReasons.length) setError(result.remainingReasons.join('；')); else void load(request); }); },
    exportCSV: () => { const request = committed.current?.request; if (!request) return; void run(signal => source.exportHoldings(request, signal), csv => { const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = '持仓-Mock.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }); },
  };
}

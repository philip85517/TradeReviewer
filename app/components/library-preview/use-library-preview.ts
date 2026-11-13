import { useCallback, useEffect, useRef, useState } from 'react';
import { LibraryReadError, type LibraryOptions, type LibraryReadPort, type PracticePage, type PracticeQuery, type PreviewLocation, type PracticeKey, type PracticeDetail, type PairPage } from '../../lib/library-preview/contracts';
import { decodePreviewLocation, encodePreviewLocation, validatePreviewLocation } from '../../lib/library-preview/preview-url';

type State = {
  options: LibraryOptions | null;
  page: PracticePage | null;
  error: string;
  listReadError: LibraryReadError | null;
  pending: boolean;
  appliedLocation: PreviewLocation;
  notice: string;
  desiredLocation: PreviewLocation;
  detail: PracticeDetail | null;
  pairs: PairPage | null;
  detailStatus: 'idle' | 'loading' | 'ready' | 'error';
  detailError: LibraryReadError | null;
  pairPending: boolean;
  pairError: LibraryReadError | null;
};

export function useLibraryPreview(port: LibraryReadPort, initialLocation?: PreviewLocation) {
  const initial = useRef(initialLocation ?? decodePreviewLocation(''));
  const [state, setState] = useState<State>(() => ({
    options: null, page: null, error: '', listReadError: null, pending: false,
    appliedLocation: initial.current, desiredLocation: initial.current, notice: '', detail: null, pairs: null, detailStatus: 'idle', detailError: null, pairPending: false, pairError: null,
  }));
  const stateRef = useRef(state);
  type Intent = 'initial' | 'push' | 'replace' | 'pop';
  const failedTarget = useRef<{ target: PreviewLocation; intent: Intent } | null>(null);
  const write = (location: PreviewLocation, method: 'push' | 'replace') => {
    if (typeof window === 'undefined') return;
    const url = window.location.pathname + encodePreviewLocation(location);
    window.history[method === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', url);
  };
  const requestId = useRef(0);
  const failedPair = useRef<number | null>(null);
  const asError = (error: unknown) => error instanceof LibraryReadError ? error : new LibraryReadError('network', error instanceof Error ? error.message : String(error), true);
  const sameKey = (a: PracticeKey, b: PracticeKey) => a.practiceId === b.practiceId && a.revisionId === b.revisionId && a.practiceVersion === b.practiceVersion;
  const validatePairs = (pairs: PairPage, key: PracticeKey, snapshot: string) => {
    if (!sameKey(pairs.key, key) || pairs.rows.some(row => !sameKey(row.key, key))) throw new LibraryReadError('contract', '配对身份不匹配', false);
    if (pairs.snapshotVersion !== snapshot) throw new LibraryReadError('version-expired', '快照已过期', false);
  };
  const controller = useRef<AbortController | null>(null);
  const update = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const run = useCallback(async (target: PreviewLocation, intent: Intent) => {
    controller.current?.abort();
    const id = ++requestId.current;
    const abort = new AbortController();
    controller.current = abort;
    const active = () => id === requestId.current && !abort.signal.aborted;
    if (target.detail) {
      if (intent === 'push') {
        const predecessor = !stateRef.current.desiredLocation.detail ? window.location.pathname + encodePreviewLocation(stateRef.current.appliedLocation) : null;
        window.history.pushState({ ...window.history.state, previewListPredecessor: predecessor }, '', window.location.pathname + encodePreviewLocation(target));
      }
      update({ ...stateRef.current, desiredLocation: target, detail: null, pairs: null, detailStatus: 'loading', detailError: null, pairPending: false, pairError: null, pending: false });
      try {
        const detail = await port.readPracticeDetail(target.detail, { signal: abort.signal });
        if (!active()) return;
        const requested = target.detail;
        const key = detail.practice.key;
        if (key.practiceId !== requested.practiceId || ('revisionId' in requested && (key.revisionId !== requested.revisionId || key.practiceVersion !== requested.practiceVersion))) throw new LibraryReadError('version-expired', '版本已过期', false);
        validatePairs(detail.pairs, key, detail.snapshotVersion);
        const resolved = { ...target, detail: key };
        write(resolved, 'replace');
        update({ ...stateRef.current, desiredLocation: resolved, detail, pairs: detail.pairs, detailStatus: 'ready', detailError: null });
      } catch (error) {
        if (active()) update({ ...stateRef.current, detailStatus: 'error', detailError: asError(error) });
      }
      return;
    }
    const validation = validatePreviewLocation(target);
    if (validation) {
      failedTarget.current = { target, intent };
      if (intent === 'pop' && stateRef.current.page) write(stateRef.current.appliedLocation, 'replace');
      update({ ...stateRef.current, desiredLocation: intent === 'pop' && stateRef.current.page ? stateRef.current.appliedLocation : target, detail: null, pairs: null, detailStatus: 'idle', detailError: null, pairPending: false, pairError: null, pending: false, listReadError: null, error: `${stateRef.current.page ? '新范围未应用：' : ''}${validation}` });
      return;
    }
    update({ ...stateRef.current, desiredLocation: target, detail: null, pairs: null, detailStatus: 'idle', detailError: null, pairPending: false, pairError: null, pending: true, error: '', listReadError: null });
    try {
      const { from, to } = target.query;
      const options = await port.readOptions({ mode: 'simulation', from, to }, { signal: abort.signal });
      if (!active()) return;
      const market = target.query.market === 'all' || options.markets.some(item => item.id === target.query.market) ? target.query.market : 'all';
      const accountId = target.query.accountId === 'all' || options.accounts.some(item => item.id === target.query.accountId) ? target.query.accountId : 'all';
      const notice = market !== target.query.market || accountId !== target.query.accountId ? '未知市场或账户已重置为全部' : '';
      const query = { ...target.query, market, accountId };
      const page = await port.readPracticePage(query, { signal: abort.signal, snapshotVersion: options.snapshotVersion });
      if (!active()) return;
      if (page.snapshotVersion !== options.snapshotVersion) throw new LibraryReadError('contract', '列表快照不匹配', false);
      failedTarget.current = null;
      const applied = { ...target, query: page.query };
      if (typeof window !== 'undefined') {
        const encoded = encodePreviewLocation(applied);
        if (intent === 'push') write(applied, window.location.search === encoded ? 'replace' : 'push');
        else if (intent !== 'pop' || window.location.search !== encoded) write(applied, 'replace');
      }
      update({ ...stateRef.current, options, page, error: '', listReadError: null, pending: false, appliedLocation: applied, desiredLocation: applied, notice });
    } catch (error) {
      if (!active()) return;
      failedTarget.current = { target, intent };
      if (intent === 'pop' && stateRef.current.page) write(stateRef.current.appliedLocation, 'replace');
      const reason = error instanceof Error ? error.message : String(error);
      update({ ...stateRef.current, pending: false, listReadError: asError(error), error: `${stateRef.current.page ? '新范围未应用：' : ''}${reason}` });
    }
  }, [port, update]);

  useEffect(() => {
    void run(initial.current, 'initial');
    const onPop = () => {
      const next = decodePreviewLocation(window.location.search);
      if (next.scenario === initial.current.scenario) void run(next, 'pop');
    };
    if (typeof window !== 'undefined') window.addEventListener('popstate', onPop);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('popstate', onPop); controller.current?.abort(); requestId.current++; };
  }, [run]);

  const changeQuery = useCallback((query: PracticeQuery) => {
    void run({ scenario: stateRef.current.appliedLocation.scenario, query }, 'push');
  }, [run]);
  const refresh = useCallback(() => { void run(stateRef.current.appliedLocation, 'replace'); }, [run]);
  const retry = useCallback(() => { const failed = failedTarget.current; void run(failed?.target ?? stateRef.current.appliedLocation, failed?.intent ?? 'replace'); }, [run]);
  const openDetail = useCallback((key: PracticeKey) => { void run({ ...stateRef.current.appliedLocation, detail: key }, 'push'); }, [run]);
  const backToList = useCallback(() => {
    const predecessor = window.history.state?.previewListPredecessor;
    const { detail: _unused, ...list } = stateRef.current.desiredLocation;
    if (predecessor === window.location.pathname + encodePreviewLocation(list)) { window.history.back(); return; }
    const { detail: _detail, ...target } = stateRef.current.desiredLocation;
    write(target, 'replace'); void run(target, 'replace');
  }, [run]);
  const retryDetail = useCallback(() => { void run(stateRef.current.desiredLocation, 'replace'); }, [run]);
  const changePairPage = useCallback(async (pageIndex: number) => {
    const detail = stateRef.current.detail;
    if (!detail) return;
    controller.current?.abort(); const id = ++requestId.current; const abort = new AbortController(); controller.current = abort;
    failedPair.current = pageIndex;
    update({ ...stateRef.current, pairPending: true, pairError: null });
    try {
      const pairs = await port.readPairPage(detail.practice.key, { pageIndex, pageSize: 6 }, { signal: abort.signal, snapshotVersion: detail.snapshotVersion });
      if (id !== requestId.current || abort.signal.aborted) return;
      validatePairs(pairs, detail.practice.key, detail.snapshotVersion);
      failedPair.current = null; update({ ...stateRef.current, pairs, pairPending: false, pairError: null });
    } catch (error) { if (id === requestId.current && !abort.signal.aborted) update({ ...stateRef.current, pairPending: false, pairError: asError(error) }); }
  }, [port, update]);
  const retryPairs = useCallback(() => { if (failedPair.current !== null) void changePairPage(failedPair.current); }, [changePairPage]);
  return { ...state, changeQuery, refresh, retry, openDetail, backToList, retryDetail, changePairPage, retryPairs };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibraryOptions, LibraryReadPort, PracticePage, PracticeQuery, PreviewLocation } from '../../lib/library-preview/contracts';
import { decodePreviewLocation, validatePreviewLocation } from '../../lib/library-preview/preview-url';

type State = {
  options: LibraryOptions | null;
  page: PracticePage | null;
  error: string;
  pending: boolean;
  appliedLocation: PreviewLocation;
  notice: string;
};

export function useLibraryPreview(port: LibraryReadPort, initialLocation?: PreviewLocation) {
  const initial = useRef(initialLocation ?? decodePreviewLocation(''));
  const [state, setState] = useState<State>(() => ({
    options: null, page: null, error: '', pending: false,
    appliedLocation: initial.current, notice: '',
  }));
  const stateRef = useRef(state);
  const failedTarget = useRef<PreviewLocation | null>(null);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const update = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const run = useCallback(async (target: PreviewLocation) => {
    controller.current?.abort();
    const id = ++requestId.current;
    const abort = new AbortController();
    controller.current = abort;
    const active = () => id === requestId.current && !abort.signal.aborted;
    const validation = validatePreviewLocation(target);
    if (validation) {
      failedTarget.current = target;
      update({ ...stateRef.current, pending: false, error: `${stateRef.current.page ? '新范围未应用：' : ''}${validation}` });
      return;
    }
    update({ ...stateRef.current, pending: true, error: '' });
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
      failedTarget.current = null;
      update({ options, page, error: '', pending: false, appliedLocation: { ...target, query: page.query }, notice });
    } catch (error) {
      if (!active()) return;
      failedTarget.current = target;
      const reason = error instanceof Error ? error.message : String(error);
      update({ ...stateRef.current, pending: false, error: `${stateRef.current.page ? '新范围未应用：' : ''}${reason}` });
    }
  }, [port, update]);

  useEffect(() => {
    void run(initial.current);
    return () => { controller.current?.abort(); requestId.current++; };
  }, [run]);

  const changeQuery = useCallback((query: PracticeQuery) => {
    void run({ scenario: stateRef.current.appliedLocation.scenario, query });
  }, [run]);
  const refresh = useCallback(() => { void run(stateRef.current.appliedLocation); }, [run]);
  const retry = useCallback(() => { void run(failedTarget.current ?? stateRef.current.appliedLocation); }, [run]);
  return { ...state, changeQuery, refresh, retry };
}

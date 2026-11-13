import { useEffect, useRef, useState } from 'react';
import type { LibraryReadPort, PracticePage } from '../../lib/library-preview/contracts';

export function useLibraryPreview(port: LibraryReadPort) {
  const [page, setPage] = useState<PracticePage | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    setError(''); setPage(null);
    port.readOptions({ mode: 'simulation', from: '2026-10-15', to: '2026-10-19' }, { signal: controller.signal })
      .then(options => port.readPracticePage({ ...options.defaultScope, sort: 'date-asc', pageIndex: 1, pageSize: 6 }, { signal: controller.signal, snapshotVersion: options.snapshotVersion }))
      .then(result => { if (id === requestId.current && !controller.signal.aborted) setPage(result); })
      .catch(err => { if (id === requestId.current && !controller.signal.aborted) setError(err instanceof Error ? err.message : '加载失败'); });
    return () => { controller.abort(); if (requestId.current === id) requestId.current++; };
  }, [port, revision]);
  return { page, error, refresh: () => setRevision(x => x + 1) };
}

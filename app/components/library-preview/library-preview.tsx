'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LibraryReadPort, PreviewLocation, PracticeQuery } from '../../lib/library-preview/contracts';
import { createMockReadPort } from '../../lib/library-preview/mock-read-port';
import { decodePreviewLocation, encodePreviewLocation } from '../../lib/library-preview/preview-url';
import { saveReturnContext, readReturnContext } from '../../lib/library-preview/return-context';
import { useLibraryPreview } from './use-library-preview';
import { PreviewShell } from './preview-shell';
import { PracticeList } from './practice-list';
import './preview.css';

export function LibraryPreviewEntry({ initialSearch }: { initialSearch: string }) {
 const [location, setLocation] = useState(() => decodePreviewLocation(initialSearch && !initialSearch.includes('=') ? `scenario=${encodeURIComponent(initialSearch)}` : initialSearch));
 useEffect(() => { const onPop = () => { const next = decodePreviewLocation(window.location.search); setLocation(current => current.scenario === next.scenario ? current : next); }; window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
 const port = useMemo(() => createMockReadPort(location.scenario), [location.scenario]);
 return <LibraryPreview key={location.scenario} port={port} initialLocation={location} />;
}
export function LibraryPreview({ port, initialLocation }: { port: LibraryReadPort; initialLocation?: PreviewLocation | string }) {
 const initial = typeof initialLocation === 'string' ? decodePreviewLocation(initialLocation) : initialLocation;
 const { page, error, refresh, retry, pending, options, appliedLocation, notice, changeQuery } = useLibraryPreview(port, initial);
 const host = useRef<HTMLDivElement>(null);
 const restore = useRef(true);
 const ready = useRef(false);
 const key = encodePreviewLocation({ ...appliedLocation, detail: undefined });
 const keyRef = useRef(key); keyRef.current = key;
 const save = useCallback(() => { if (!ready.current) return; const container = host.current?.querySelector<HTMLElement>('.library-preview'); if (!container) return; const active = document.activeElement; const focusId = active instanceof HTMLButtonElement && active.id.startsWith('practice-row-') ? active.id : null; saveReturnContext(keyRef.current, { scrollTop: container.scrollTop, focusId }); }, []);
 useEffect(() => { const pop = () => { save(); restore.current = true; ready.current = false; }; window.addEventListener('popstate', pop); window.addEventListener('pagehide', save); const container = host.current?.querySelector<HTMLElement>('.library-preview'); container?.addEventListener('scroll', save); return () => { window.removeEventListener('popstate', pop); window.removeEventListener('pagehide', save); container?.removeEventListener('scroll', save); }; }, [save]);
 useLayoutEffect(() => { if (!page || pending || !restore.current) return; const container = host.current?.querySelector<HTMLElement>('.library-preview'); if (!container) return; const stored = readReturnContext(key); container.scrollTop = stored?.scrollTop ?? 0; const target = stored?.focusId ? document.getElementById(stored.focusId) : null; (target ?? document.getElementById('practice-list-heading'))?.focus({ preventScroll: true }); restore.current = false; ready.current = true; }, [page, pending, key]);
 const change = (query: PracticeQuery) => { save(); changeQuery(query); };
 return <div ref={host}><PreviewShell query={appliedLocation.query} options={options} onQueryChange={change}><PracticeList page={page} error={error} onRefresh={refresh} onRetry={retry} pending={pending} notice={notice} options={options} appliedQuery={appliedLocation.query} onQueryChange={change} /></PreviewShell></div>;
}

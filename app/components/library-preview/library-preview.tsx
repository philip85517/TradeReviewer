'use client';
import { useMemo } from 'react';
import type { LibraryReadPort, ScenarioId } from '../../lib/library-preview/contracts';
import { createMockReadPort } from '../../lib/library-preview/mock-read-port';
import { useLibraryPreview } from './use-library-preview';
import { PreviewShell } from './preview-shell';
import { PracticeList } from './practice-list';
import './preview.css';
const scenarios: ScenarioId[] = ['reference','pagination','empty','slow','retry','stale','not-found','version-expired','extreme','explicit-end-price'];
export function LibraryPreviewEntry({ initialSearch }: { initialSearch: string }) {
 const scenario = scenarios.includes(initialSearch as ScenarioId) ? initialSearch as ScenarioId : 'reference';
 const port = useMemo(() => createMockReadPort(scenario), [scenario]);
 return <LibraryPreview port={port} initialLocation={initialSearch} />;
}
export function LibraryPreview({ port }: { port: LibraryReadPort; initialLocation: string }) {
 const { page, error, refresh } = useLibraryPreview(port);
 return <PreviewShell><PracticeList page={page} error={error} onRefresh={refresh} /></PreviewShell>;
}

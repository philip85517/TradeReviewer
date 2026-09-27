import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecallDocument } from '../../lib/recall/types';
import type { TradeEpisode } from '../../lib/trades/types';
import { RecallExportDialog } from './recall-export-dialog';

const generate = vi.hoisted(() => vi.fn());
vi.mock('../../lib/recall-export/pptx', () => ({ createRecallPptxBlob: generate }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); generate.mockReset(); });
const episode: TradeEpisode = { id: 'episode', accountId: 'account', accountLabel: 'Test', instrument: { id: 'US:TEST', symbol: 'TEST', name: '测试', market: 'US', currency: 'USD' },
    direction: 'long', status: 'open', startedAt: '2026-01-01', openingQuantity: '1', remainingQuantity: '1', executions: [] };
function document(): RecallDocument {
    return { version: 1, episodeId: 'episode', revision: 1, decisions: [], snapshots: [], working: { drawings: [], timeframe: '1D', cursor: '2026-01-01', executionCursor: '2026-01-01', selectedDecisionId: null }, status: 'in-progress', updatedAt: '2026-01-01' };
}
describe('PPTX export action', () => {
    it('downloads a PPTX without saving/reordering and retains existing ZIP action', async () => {
        generate.mockResolvedValue(new Blob(['PPTX']));
        const url = vi.fn(() => 'blob:pptx'); const revoke = vi.fn();
        Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: url });
        Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: revoke });
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        const input = document(); const before = JSON.stringify(input); const onOrderChange = vi.fn(); const onExported = vi.fn();
        render(<RecallExportDialog document={input} episode={episode} onClose={() => {}} onOrderChange={onOrderChange} onExported={onExported} generatedAt="2026-01-02" />);
        expect(screen.getByRole('button', { name: '下载 ZIP' })).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: '下载 PPTX' }));
        await screen.findByText('PPTX 已开始下载');
        expect(click).toHaveBeenCalledOnce();
        expect(onExported).toHaveBeenCalledWith(expect.objectContaining({ status: 'pptx', fileName: expect.stringMatching(/\.pptx$/) }));
        expect(onOrderChange).not.toHaveBeenCalled(); expect(JSON.stringify(input)).toBe(before);
    });
    it('reports generator failures while preserving the document and allowing retry', async () => {
        generate.mockRejectedValue(new Error('图片不可用'));
        const input = document(); const before = JSON.stringify(input);
        render(<RecallExportDialog document={input} episode={episode} onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: '下载 PPTX' }));
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('图片不可用'));
        expect(screen.getByRole('button', { name: '下载 PPTX' })).toBeEnabled();
        expect(JSON.stringify(input)).toBe(before);
    });
});

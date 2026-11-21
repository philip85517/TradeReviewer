import type { Amount, Holding, HomeRequest, Scenario, HomeFilters } from '../display-contract';

/** Frontend presentation DTOs; no storage, indexing, valuation, or transport policy. */
export type HistoryRange = { fromYear: number; toYear: number };
export type AdditionalFilters = HomeFilters;
export const EMPTY_FILTERS: AdditionalFilters = { assetTypes: [], openOnly: false, review: 'all' };
export type MockInstrument = Holding & { assetType: '股票' | 'ETF'; review: 'pending' | 'done'; open: boolean };
export type OpenInstrument = (id: string, trigger: HTMLElement) => void;
export type HistoryProps = { request: HomeRequest; scenario: Scenario; range: HistoryRange; onRangeChange: (range: HistoryRange) => void };
export type ContributionProps = { request: HomeRequest; scenario: Scenario; historyRange: HistoryRange; currentNet: Amount | null; currentRealized?: Amount | null; currentFloating?: Amount | null; instruments: MockInstrument[]; onOpenInstrument: OpenInstrument };

import { describe, expect, it } from 'vitest';
import { parseLocation, serializeLocation } from './location-state';
import { DEFAULT_REQUEST } from './mock-source';
describe('applied location', () => {
  it('round trips scope, page and full object identity', () => {
    const state = { request: { ...DEFAULT_REQUEST, page: 2, query: '腾讯' }, scenario: 'nine' as const, holdingId: 'account-2:HKEX:00700:1', panel: 'trades' as const };
    expect(parseLocation(serializeLocation(state))).toEqual(state);
  });
  it('rejects invalid dates, market, page, and scenario', () => {
    const state = parseLocation('?market=bad&page=-2&from=2026-02-31&to=x&scenario=bad');
    expect(state.request).toEqual(DEFAULT_REQUEST);
    expect(state.scenario).toBe('normal');
  });
});

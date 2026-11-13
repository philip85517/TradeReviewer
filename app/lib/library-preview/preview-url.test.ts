import { it, expect } from 'vitest';
import { decodePreviewLocation, encodePreviewLocation, validatePreviewLocation } from './preview-url';
it('defaults and round trips identity', () => { const l = decodePreviewLocation(''); expect(l.scenario).toBe('reference'); expect(l.query.pageSize).toBe(6); const d = {...l, detail:{practiceId:'same',revisionId:'r',practiceVersion:'v'}}; expect(decodePreviewLocation(encodePreviewLocation(d))).toEqual(d); });
it('preserves invalid dates and rejects unsafe pages', () => { const l=decodePreviewLocation('?from=&to=bad&page=999999999999999999999&scenario=bad'); expect(l.query.pageIndex).toBe(1); expect(l.scenario).toBe('reference'); expect(validatePreviewLocation(l)).not.toBeNull(); });
it('decodes and round trips the pair retry scenario', () => {
  const location = decodePreviewLocation('?scenario=pair-retry');
  expect(location.scenario).toBe('pair-retry');
  expect(decodePreviewLocation(encodePreviewLocation(location))).toEqual(location);
});

it.each([['-1', 1], ['0', 1], ['NaN', 1], ['9007199254740992', 1], ['', 1], ['2', 2]])('normalizes page %s', (page, expected) => { expect(decodePreviewLocation(page ? `?page=${page}` : '').query.pageIndex).toBe(expected); });
it('defaults an unknown scenario', () => { expect(decodePreviewLocation('?scenario=unknown').scenario).toBe('reference'); });

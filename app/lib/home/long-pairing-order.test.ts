import { describe, expect, it } from 'vitest';
import { validateLongPairingOrder as validate, type LongPairingExecution, type LongPairingQuantity } from './long-pairing-order';

const e = (executionId: string, side: 'buy' | 'sell', day: number, quantity: string): LongPairingExecution => ({ executionId, side, executedAt: `2026-01-${String(day).padStart(2, '0')}T00:00:00Z`, quantity });
const p = (openingExecutionId: string, closingExecutionId: string, quantity: string): LongPairingQuantity => ({ openingExecutionId, closingExecutionId, quantity });
const executions = [e('a', 'buy', 1, '100'), e('b', 'buy', 2, '50'), e('c', 'sell', 3, '80'), e('d', 'sell', 4, '70')];
const pairings = [p('b', 'c', '50'), p('a', 'c', '30'), p('a', 'd', '70')];
const check = (es = executions, cs = ['c', 'd'], ps = pairings) => validate({ executions: es, confirmedClosingExecutionIds: cs, pairings: ps }).valid;
describe('long pairing order', () => {
  it('accepts exact LIFO allocations regardless of input order', () => expect(check([...executions].reverse())).toBe(true));
  it('accepts separately confirmed partial closes', () => expect(check([e('a','buy',1,'50'),e('c','sell',2,'20'),e('d','sell',3,'20')], ['c','d'], [p('a','c','20'),p('a','d','20')])).toBe(true));
  it('consumes pending sells before a confirmed close', () => {
    expect(check(executions, ['d'], [p('a','d','70')])).toBe(true);
    expect(check(executions, ['d'], [p('b','d','50'),p('a','d','20')])).toBe(false);
  });
  it('rejects incorrect, missing, duplicated or unconfirmed allocations', () => {
    for (const ps of [[p('a','c','80'),p('a','d','70')], pairings.slice(0,2), [...pairings,p('a','d','1')], [p('a','c','30')]]) expect(check(executions, ['c','d'], ps)).toBe(false);
    expect(check(executions, ['d'], pairings)).toBe(false);
    expect(check(executions, ['c','c'], pairings)).toBe(false);
    expect(check([...executions, executions[0]], ['c','d'], pairings)).toBe(false);
    expect(check(executions, ['missing'], [p('a','missing','1')])).toBe(false);
    expect(check(executions, ['c'], [p('missing','c','80')])).toBe(false);
  });
  it('rejects negative inventory and future buys even when pending', () => expect(check([e('c','sell',1,'1'),e('a','buy',2,'1')], [], [])).toBe(false));
  it('rejects invalid, date-only and ambiguous timestamps', () => {
    for (const date of ['2026-02-30T00:00:00Z','2026-01-01','nonsense']) expect(check([{...executions[0], executedAt: date}], [], [])).toBe(false);
    expect(check([executions[0], {...executions[1], executedAt: '2026-01-01T01:00:00+01:00'}], [], [])).toBe(false);
  });
  it('compares large and fractional quantities exactly and enforces the length bound', () => {
    const qty = '123456789012345678901234567890.00000000000000000001';
    expect(check([e('a','buy',1,qty),e('c','sell',2,qty)], ['c'], [p('a','c',qty)])).toBe(true);
    expect(check([e('a','buy',1,qty),e('c','sell',2,qty)], ['c'], [p('a','c','123456789012345678901234567890')])).toBe(false);
    expect(check([e('a','buy',1,'1'.repeat(1025))], [], [])).toBe(false);
    expect(check([e('a','buy',1,'1'.repeat(1024))], [], [])).toBe(true);
  });
});

describe('parent execution allocations', () => {
  const fill = (id: string, parent: string, side: 'buy' | 'sell', day: number, amount: string) => ({ ...e(id, side, day, amount), parentExecutionId: parent });
  it('aggregates a close across interleaved fills and rejects first-time aggregation', () => {
    const es = [fill('b1f','b1','buy',1,'10'), fill('s1','s','sell',2,'4'), fill('b2f','b2','buy',3,'6'), fill('s2','s','sell',4,'6')];
    expect(check(es.reverse(), ['s'], [p('b1','s','4'), p('b2','s','6')])).toBe(true);
    expect(check(es, ['s'], [p('b1','s','10')])).toBe(false);
    expect(check(es, ['s1'], [p('b1','s1','4')])).toBe(false);
  });
  it('accumulates repeated consumption exactly and consumes pending closes', () => {
    const es = [fill('a1','a','buy',1,'0.1'), fill('pending','p','sell',2,'0.1'), fill('a2','a','buy',3,'12345678901234567890.2'), fill('s1','s','sell',4,'0.1'), fill('s2','s','sell',5,'12345678901234567890.1')];
    expect(check(es, ['s'], [p('a','s','12345678901234567890.2')])).toBe(true);
    expect(check(es, ['s'], [p('a','s','12345678901234567890.1')])).toBe(false);
  });
  it('adds consumption of multiple opening fills for one parent', () => {
    const es = [fill('a1','a','buy',1,'4'), fill('p','p','sell',2,'2'), fill('a2','a','buy',3,'6'), fill('s','s','sell',4,'8')];
    expect(check(es, ['s'], [p('a','s','8')])).toBe(true);
    expect(check(es, ['p','s'], [p('a','p','2'), p('a','s','8')])).toBe(true);
    expect(check([fill('a1','a','buy',1,'4'), fill('p','p','sell',2,'5'), fill('a2','a','buy',3,'6')], [], [])).toBe(false);
  });
  it('rejects empty or mixed-side parents and event identities as parent confirmations', () => {
    expect(check([fill('a',' ','buy',1,'1')], [], [])).toBe(false);
    expect(check([fill('a','x','buy',1,'1'), fill('s','x','sell',2,'1')], [], [])).toBe(false);
    expect(check([fill('a','x','buy',1,'1'), fill('s','y','sell',2,'1')], ['s'], [p('a','s','1')])).toBe(false);
  });
});

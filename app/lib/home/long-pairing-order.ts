export type LongPairingExecution = { executionId: string; parentExecutionId?: string; side: 'buy' | 'sell'; executedAt: string; quantity: string };
export type LongPairingQuantity = { openingExecutionId: string; closingExecutionId: string; quantity: string };
type Quantity = { n: bigint; s: number };
const zero = BigInt(0);
function quantity(value: string): Quantity | null {
  if (typeof value !== 'string' || value.length > 1024 || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const n = BigInt(whole + fraction);
  return n > zero ? { n, s: fraction.length } : null;
}
function subtract(a: Quantity, b: Quantity): Quantity {
  const s = Math.max(a.s, b.s);
  return { n: a.n * BigInt(10) ** BigInt(s - a.s) - b.n * BigInt(10) ** BigInt(s - b.s), s };
}
function add(a: Quantity, b: Quantity): Quantity {
  const s = Math.max(a.s, b.s);
  return { n: a.n * BigInt(10) ** BigInt(s - a.s) + b.n * BigInt(10) ** BigInt(s - b.s), s };
}
function timestamp(value: string): { second: number; fraction: string } | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/i.exec(value);
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59) return null;
  if (m[8].toUpperCase() !== 'Z' && (Number(m[8].slice(1, 3)) > 23 || Number(m[8].slice(4, 6)) > 59)) return null;
  const second = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);
  return Number.isFinite(second) ? { second, fraction: (m[7] ?? '').replace(/0+$/, '') } : null;
}
function compareTime(a: { second: number; fraction: string }, b: { second: number; fraction: string }): number {
  if (a.second !== b.second) return a.second - b.second;
  const width = Math.max(a.fraction.length, b.fraction.length);
  const x = a.fraction.padEnd(width, '0'), y = b.fraction.padEnd(width, '0');
  return x < y ? -1 : x > y ? 1 : 0;
}
export function validateLongPairingOrder(input: { executions: readonly LongPairingExecution[]; confirmedClosingExecutionIds: readonly string[]; pairings: readonly LongPairingQuantity[] }): { valid: boolean; issues: { code: string }[] } {
  const issues: { code: string }[] = [];
  const fail = (code: string) => { issues.push({ code }); };
  const byId = new Map<string, LongPairingExecution>();
  const parents = new Map<string, 'buy' | 'sell'>();
  const ordered: { execution: LongPairingExecution; time: NonNullable<ReturnType<typeof timestamp>>; amount: Quantity }[] = [];
  for (const execution of input.executions) {
    const time = timestamp(execution.executedAt), amount = quantity(execution.quantity);
    if (!execution.executionId?.trim() || byId.has(execution.executionId)) fail('invalid-execution-id');
    byId.set(execution.executionId, execution);
    const parent = execution.parentExecutionId === undefined ? execution.executionId : execution.parentExecutionId;
    if (typeof parent !== 'string' || !parent.trim() || (parents.has(parent) && parents.get(parent) !== execution.side)) fail('invalid-parent');
    else parents.set(parent, execution.side);
    if (!time || !amount || (execution.side !== 'buy' && execution.side !== 'sell')) fail('invalid-execution');
    else ordered.push({ execution, time, amount });
  }
  ordered.sort((a, b) => compareTime(a.time, b.time));
  for (let i = 1; i < ordered.length; i++) if (compareTime(ordered[i - 1].time, ordered[i].time) === 0) fail('ambiguous-time');
  const confirmed = new Set<string>();
  for (const id of input.confirmedClosingExecutionIds) {
    if (confirmed.has(id) || parents.get(id) !== 'sell') fail('invalid-confirmed-close');
    confirmed.add(id);
  }
  const supplied = new Map<string, Map<string, Quantity>>();
  for (const pair of input.pairings) {
    const amount = quantity(pair.quantity);
    if (!amount || parents.get(pair.openingExecutionId) !== 'buy' || parents.get(pair.closingExecutionId) !== 'sell' || !confirmed.has(pair.closingExecutionId)) { fail('invalid-pairing'); continue; }
    const close = supplied.get(pair.closingExecutionId) ?? new Map<string, Quantity>();
    if (close.has(pair.openingExecutionId)) fail('duplicate-pairing');
    close.set(pair.openingExecutionId, amount);
    supplied.set(pair.closingExecutionId, close);
  }
  const expectedByClose = new Map<string, Map<string, Quantity>>();
  const stack: { id: string; remaining: Quantity }[] = [];
  for (const { execution, amount } of ordered) {
    if (execution.side === 'buy') { stack.push({ id: execution.parentExecutionId ?? execution.executionId, remaining: amount }); continue; }
    let remaining = amount;
    const closeId = execution.parentExecutionId ?? execution.executionId;
    const expected = expectedByClose.get(closeId) ?? new Map<string, Quantity>();
    expectedByClose.set(closeId, expected);
    while (remaining.n > zero && stack.length) {
      const top = stack[stack.length - 1];
      const difference = subtract(top.remaining, remaining);
      const used = difference.n >= zero ? remaining : top.remaining;
      const prior = expected.get(top.id);
      expected.set(top.id, prior ? add(prior, used) : used);
      if (difference.n <= zero) stack.pop(); else top.remaining = difference;
      remaining = difference.n >= zero ? { n: zero, s: 0 } : { n: -difference.n, s: difference.s };
    }
    if (remaining.n > zero) fail('negative-inventory');
  }
  for (const id of confirmed) {
      const expected = expectedByClose.get(id) ?? new Map<string, Quantity>();
      const actual = supplied.get(id) ?? new Map<string, Quantity>();
      if (actual.size !== expected.size || [...expected].some(([openingId, q]) => !actual.has(openingId) || subtract(q, actual.get(openingId)!).n !== zero)) fail('allocation-mismatch');
  }
  return { valid: issues.length === 0, issues };
}

export type CrossZeroExecution = { executionId: string; side: 'buy' | 'sell'; quantity: string };
export type CrossZeroQuantityResult = { status: 'candidate' | 'not-applicable' | 'unsupported'; reasons: string[]; crossing: null | { executionId: string; sourceQuantity: string; closeLongQuantity: string; openShortQuantity: string } };

type Decimal = { n: bigint; scale: number };
const zero = BigInt(0), ten = BigInt(10);
function parse(value: unknown): Decimal | null {
  if (typeof value !== 'string' || value.length > 1024 || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const n = BigInt(whole + fraction);
  return n > zero ? { n, scale: fraction.length } : null;
}
function combine(a: Decimal, b: Decimal, subtract = false): Decimal {
  const scale = Math.max(a.scale, b.scale);
  const x = a.n * ten ** BigInt(scale - a.scale), y = b.n * ten ** BigInt(scale - b.scale);
  return { n: subtract ? x - y : x + y, scale };
}
function format(value: Decimal): string {
  const digits = value.n.toString().padStart(value.scale + 1, '0');
  return value.scale ? `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`.replace(/0+$/, '').replace(/\.$/, '') : digits;
}
export function diagnoseCrossZeroQuantity(ordered: readonly CrossZeroExecution[]): CrossZeroQuantityResult {
  const unsupported = (reason: string): CrossZeroQuantityResult => ({ status: 'unsupported', reasons: [reason], crossing: null });
  const ids = new Set<string>();
  const parsed: { execution: CrossZeroExecution; amount: Decimal }[] = [];
  for (const execution of ordered) {
    if (!execution || typeof execution.executionId !== 'string' || !execution.executionId.trim() || ids.has(execution.executionId)) return unsupported('invalid-execution-id');
    ids.add(execution.executionId);
    if (execution.side !== 'buy' && execution.side !== 'sell') return unsupported('invalid-side');
    const amount = parse(execution.quantity);
    if (!amount) return unsupported('invalid-quantity');
    parsed.push({ execution, amount });
  }
  let inventory: Decimal = { n: zero, scale: 0 };
  for (let i = 0; i < parsed.length; i++) {
    const { execution, amount } = parsed[i];
    if (execution.side === 'buy') { inventory = combine(inventory, amount); continue; }
    if (inventory.n === zero) return unsupported('sell-without-inventory');
    const remaining = combine(inventory, amount, true);
    if (remaining.n < zero) {
      if (i !== parsed.length - 1) return unsupported('crossing-with-tail');
      return { status: 'candidate', reasons: [], crossing: { executionId: execution.executionId, sourceQuantity: format(amount), closeLongQuantity: format(inventory), openShortQuantity: format({ n: -remaining.n, scale: remaining.scale }) } };
    }
    inventory = remaining;
  }
  return { status: 'not-applicable', reasons: [], crossing: null };
}

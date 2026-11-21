type Decimal = { value: bigint; scale: number };

function parse(input: string): Decimal | null {
  if (typeof input !== 'string' || input.length > 1024 || !/^-?\d+(?:\.\d+)?(?![\s\S])/.test(input)) return null;
  const [whole, fraction = ''] = input.split('.');
  return { value: BigInt(whole + fraction), scale: fraction.length };
}

function power(scale: number): bigint {
  return BigInt(10) ** BigInt(scale);
}

export function exactDecimalOperation(operation: 'add' | 'subtract' | 'multiply' | 'divide', left: string, right: string, observed: string): boolean {
  const a = parse(left), b = parse(right), result = parse(observed);
  if (!a || !b || !result) return false;
  if (operation === 'multiply') return a.value * b.value * power(result.scale) === result.value * power(a.scale + b.scale);
  if (operation === 'divide') return b.value !== BigInt(0) && a.value * power(b.scale + result.scale) === result.value * b.value * power(a.scale);
  if (operation !== 'add' && operation !== 'subtract') return false;
  const scale = Math.max(a.scale, b.scale, result.scale);
  const av = a.value * power(scale - a.scale), bv = b.value * power(scale - b.scale);
  return (operation === 'add' ? av + bv : av - bv) === result.value * power(scale - result.scale);
}

export function sumExactDecimals(values: readonly string[]): string | null {
  let total = BigInt(0), scale = 0;
  for (const input of values) {
    const decimal = parse(input);
    if (!decimal) return null;
    const nextScale = Math.max(scale, decimal.scale);
    total = total * power(nextScale - scale) + decimal.value * power(nextScale - decimal.scale);
    scale = nextScale;
  }
  if (total === BigInt(0)) return '0';
  const negative = total < BigInt(0);
  let digits = (negative ? -total : total).toString().padStart(scale + 1, '0');
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/0+$/, '').replace(/\.$/, '');
  const output = (negative ? '-' : '') + digits;
  return output.length <= 1024 ? output : null;
}

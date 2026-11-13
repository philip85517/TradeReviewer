import Decimal from 'decimal.js';
import type { Money } from './contracts';

export function formatMoney(money: Money): { display: string; fullValue: string } {
  if (money.state === 'unknown') return { display: '—', fullValue: money.reason };
  const value = new Decimal(money.value.amount);
  const sign = value.isPositive() && !value.isZero() ? '+' : '';
  const magnitude = value.abs();
  const divisor = magnitude.gte('100000000') ? new Decimal('100000000') : magnitude.gte('10000') ? new Decimal('10000') : new Decimal(1);
  const suffix = divisor.eq('100000000') ? '亿' : divisor.eq('10000') ? '万' : '';
  return { display: `${sign}${value.div(divisor).toFixed(2)}${suffix}`, fullValue: `${sign}${value.toFixed(2)} ${money.value.currency}` };
}

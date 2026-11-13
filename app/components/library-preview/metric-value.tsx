import Decimal from 'decimal.js';
import type { Money } from '../../lib/library-preview/contracts';
import { formatMoney } from '../../lib/library-preview/format';
import { InfoPopover } from './info-popover';

export function MetricValue({ value }: { value: Money }) {
  const { display, fullValue } = formatMoney(value);
  const number = value.state === 'known' ? new Decimal(value.value.amount) : null;
  const color = number?.isZero() ? undefined : number?.isPositive() ? '#53D7A0' : number ? '#FF8592' : undefined;
  return <span className="metric-value" style={{ color }}><span className="metric-value__text">{display}</span><InfoPopover label={value.state === 'unknown' ? '查看未知原因' : '查看完整数值'}>{fullValue}</InfoPopover></span>;
}

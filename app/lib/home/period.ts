import Decimal from 'decimal.js';
import type { Amount, Point } from '../../components/homepage-preview/display-contract';
import type { FxRates, NativeBucket, NativeDay } from './contracts';
import {feeWindowsAmount} from './fees';

const D = Decimal.clone({ precision: 48 });
export const nextDay = (day: string, offset = 1) => new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
export function validDay(day: string) { return /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day; }
export function decimal(value: string) { const d = new D(value); if (!d.isFinite()) throw new Error('invalid decimal'); return d; }

export function convertNative(values: Record<string, string | null>, currency: string, fx: FxRates, reasons: string[] = []): Amount {
  let value = new D(0), available = 0;
  const valuationNotes = [...new Set(reasons.filter(isValuationNote))];
  const errors = new Set(reasons.filter(reason=>!isValuationNote(reason))), sources = new Set<string>(), originals: Record<string, string> = {};
  for (const [code, raw] of Object.entries(values)) {
    if (raw === null) { errors.add('原币金额缺少完整依据'); continue; }
    const amount = decimal(raw); originals[code] = amount.toString();
    if (code === currency || amount.isZero()) { value = value.plus(amount); available++; continue; }
    const source = code === 'CNY' ? new D(1) : fx[code] ? decimal(fx[code].rate) : null;
    const target = currency === 'CNY' ? new D(1) : fx[currency] ? decimal(fx[currency].rate) : null;
    if (!source?.isPositive() || !target?.isPositive()) { errors.add(`${code}/${currency} 边界汇率缺失`); continue; }
    value = value.plus(amount.mul(source).div(target)); available++;
    if (fx[code]) sources.add(`${fx[code].source} · ${fx[code].asOf}`);
    if (fx[currency]) sources.add(`${fx[currency].source} · ${fx[currency].asOf}`);
  }
  return { ...(valuationNotes.length?{valuationNotes}:{}), value: errors.size ? null : value.toString(), currency, reasons: [...errors], coverage: { available, total: Object.keys(values).length }, originals, fxSource: [...sources].join('；') || ([...errors].some(e=>e.includes('汇率缺失')) ? '所需汇率缺失' : '原币或零金额，无需换算') };
}

export const isValuationNote=(reason:string)=>reason.startsWith('拆股推算：');
export function valuationNotes(...days:(NativeDay|null|undefined)[]):string[]{
 return [...new Set(days.flatMap(day=>Object.values(day?.buckets??{}).flatMap(b=>b.reasons.filter(isValuationNote))))];
}
const withNotes=(amount:Amount,notes:string[]):Amount=>notes.length?{...amount,valuationNotes:[...new Set([...(amount.valuationNotes??[]),...notes])]}:amount;
export function currentAmounts(day: NativeDay, currency: string) {
  const values = (field: 'market' | 'unrealized') => convertNative(Object.fromEntries(Object.entries(day.buckets).map(([c, b]) => [c, b[field]])), currency, day.fx);
  return { marketValue: withNotes(values('market'),valuationNotes(day)), unrealized: withNotes(values('unrealized'),valuationNotes(day)) };
}

/** Revalue stored native components; a missing native component stays unknown. */
export function revalueAmount(amount: Amount, currency: string, fx: FxRates): Amount {
  const reasons=amount.reasons.filter(reason=>!reason.endsWith(' 边界汇率缺失'));
  if(Object.keys(amount.originals).length<amount.coverage.total&&!reasons.includes('原币金额缺少完整依据'))reasons.push('原币金额缺少完整依据');
  const converted=convertNative(amount.originals,currency,fx,[...reasons,...(amount.valuationNotes??[])]);
  return {...converted,coverage:{...converted.coverage,total:amount.coverage.total}};
}
function difference(a: NativeBucket | undefined, b: NativeBucket | undefined, field: 'realized' | 'fees' | 'unrealized'): string | null {
  // An absent currency is a proven empty bucket only in an existing, validated daily result.
  if (field !== 'unrealized') {
    const counter = field === 'realized' ? 'realizedMissing' : 'feesMissing';
    const gap = (b?.[counter] ?? 0) - (a?.[counter] ?? 0);
    if (gap < 0) throw new Error('non-monotonic missing prefix');
    if (gap) return null;
  }
  if (a?.[field] === null || b?.[field] === null) return null;
  return decimal(b?.[field] ?? '0').minus(a?.[field] ?? '0').toString();
}

export function periodAmounts(baseline:NativeDay|null,day:NativeDay|undefined,from:string,currency:string) {
  const unknown = (reason:string) => convertNative({},currency,{},[reason]);
    if (!day || !baseline) {
      const amount = unknown(!day ? '该日期结果未覆盖' : '期初结果未覆盖');
      return { realized: amount, unrealizedChange: amount, net: amount, fees: amount };
    }
    const currencies = new Set([...Object.keys(baseline.buckets), ...Object.keys(day.buckets)]);
    const deltas = (field: 'realized' | 'fees' | 'unrealized') => Object.fromEntries([...currencies].map(code => [code, difference(baseline.buckets[code], day.buckets[code], field)]));
    const realized = deltas('realized'), unrealized = deltas('unrealized');
    const net = Object.fromEntries([...currencies].map(c => [c, realized[c] === null || unrealized[c] === null ? null : decimal(realized[c]!).plus(unrealized[c]!).toString()]));
    const fees=deltas('fees');
    for(const [code,amount]of Object.entries(feeWindowsAmount(day.feeWindows??[],from,day.date)))fees[code]=amount===null||fees[code]===null?null:decimal(fees[code]??'0').plus(amount).toFixed();
    const notes=valuationNotes(baseline,day);
    const realizedNotes=[...new Set([...currencies].flatMap(code=>(day.buckets[code]?.realizedValuationCount??0)>(baseline.buckets[code]?.realizedValuationCount??0)?(day.buckets[code]?.realizedValuationNotes??[]):[]))];
    return { realized: withNotes(convertNative(realized, currency, day.fx),realizedNotes), unrealizedChange: withNotes(convertNative(unrealized, currency, day.fx),notes), net: withNotes(convertNative(net, currency, day.fx),[...notes,...realizedNotes]), fees: convertNative(fees, currency, day.fx) };
}

export function projectPeriod(baseline: NativeDay | null, days: NativeDay[], period: { from: string; to: string }, currency: string, businessDate: string) {
  if (!validDay(period.from) || !validDay(period.to) || period.from > period.to) throw new Error('invalid period');
  const byDate = new Map(days.map(day => [day.date, day]));
  const unknown = (reason: string) => convertNative({}, currency, {}, [reason]);
  const endpoint = (day:NativeDay|undefined) => periodAmounts(baseline,day,period.from,currency);
  const effectiveEnd = period.to < businessDate ? period.to : businessDate;
  const metrics = endpoint(byDate.get(effectiveEnd));
  const points: Point[] = [];
  for (let date = period.from; date <= period.to; date = nextDay(date)) {
    const day = byDate.get(date), future = date > businessDate;
    const periodValues = future ? { net: unknown('未来日期'), fees: unknown('未来日期') } : endpoint(day);
    const current = day && !future ? currentAmounts(day, currency) : { marketValue: unknown(future ? '未来日期' : '日期结果未覆盖'), unrealized: unknown(future ? '未来日期' : '日期结果未覆盖') };
    const lifetime = (net: boolean) => day && !future ? convertNative(Object.fromEntries(Object.entries(day.buckets).map(([c, b]) => [c, !b.lifetimeComplete || net && b.unrealized === null ? null : decimal(b.realized).plus(net ? b.unrealized! : '0').toString()])), currency, day.fx, [...(net?valuationNotes(day):[]),...Object.values(day.buckets).flatMap(b=>b.realizedValuationNotes??[])]) : unknown(future ? '未来日期' : '日期结果未覆盖');
    points.push({ key: date, businessDate: date, state: future ? 'future' : periodValues.net.value === null ? 'source-missing' : 'value', plottable: !future && periodValues.net.value !== null, ...current, realized: lifetime(false), net: lifetime(true), periodNet: periodValues.net, periodFees: periodValues.fees, reasons: [...new Set([...(day?.reasons ?? []).filter(reason=>!isValuationNote(reason)), ...periodValues.net.reasons])] });
  }
  return { ...metrics, points, effectiveEnd };
}

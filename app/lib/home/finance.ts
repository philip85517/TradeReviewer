import {verifiedSplitBoundaries} from './split-valuation-safety';
import { replayPositionAtPrice, type NativePositionFacts } from '../replay/position-ledger';
import { nativeExecutionAt } from '../replay/native-boundary';
import { decimal, validDay } from './period';

export const businessDay = (instant: string) => new Date(Date.parse(instant) + 8 * 3600000).toISOString().slice(0, 10);
export function executionBusinessDay(execution: Parameters<typeof replayPositionAtPrice>[0]['executions'][number]) {
  return businessDay(nativeExecutionAt(execution));
}
export type NativePosition = NativePositionFacts & { marketValue: string | null };
/** The existing inventory/cost kernel remains the sole authority; normalize malformed facts before it. */
export function nativePosition(input: Omit<Parameters<typeof replayPositionAtPrice>[0], 'nativeFacts'>): NativePosition {
  const errors = new Set<string>(); let invalidQuantity = false;
  const nativeErrors = new Map<string, string[]>();
  let currentErrors: string[] = [];
  const finite = (value: string, positive: boolean, reason: string) => {
    try { const n = decimal(value); if (positive ? n.lte(0) : n.lt(0)) throw new Error(reason); return n.toString(); }
    catch { currentErrors.push(reason); return '0'; }
  };
  const cursor = input.cursor ?? new Date().toISOString();
  const day = businessDay(cursor);
  const selected = input.executions.filter(e => {
    try { const date = executionBusinessDay(e); if (!validDay(date)) throw new Error('date');
      const at=nativeExecutionAt(e);
      return date <= day && Date.parse(at) <= Date.parse(cursor);
    } catch { errors.add('execution-time-invalid'); invalidQuantity = true; return false; }
  });
  const executions = selected.map(e => {
    currentErrors = []; nativeErrors.set(e.id, currentErrors);
    const fee = finite(e.fee, false, 'fees-invalid');
    let settlement = e.source.settlement;
    if (settlement) {
      const gross = finite(settlement.grossAmount, false, 'settlement-invalid');
      const quantity = finite(settlement.quantity, true, 'settlement-invalid');
      try { if(!decimal(quantity).eq(decimal(e.quantity))) currentErrors.push('settlement-invalid'); } catch { currentErrors.push('quantity-invalid'); }
      if (quantity === '0') settlement = undefined;
      else {
        const fees = Object.values(settlement.fees).map(f => finite(f, false, 'fees-invalid'));
        if (!fees.reduce((sum, f) => sum.plus(f), decimal('0')).eq(fee)) currentErrors.push('fees-conflict');
        if(settlement.netAmount!==undefined)try {
          const expected=e.side==='buy'?decimal(gross).negated().minus(fee):decimal(gross).minus(fee);
          if(!expected.eq(decimal(settlement.netAmount)))currentErrors.push('settlement-invalid');
        } catch { currentErrors.push('settlement-invalid'); }
        settlement = { ...settlement, grossAmount: gross, quantity };
      }
    }
    return { ...e, quantity: finite(e.quantity, true, 'quantity-invalid'), price: finite(e.price, false, 'execution-price-invalid'), fee, source: { ...e.source, settlement } };
  });
  let facts: NativePositionFacts | undefined;
  const selectedIds=new Set(executions.map(e=>e.id));
  // Future fills can carry earlier statement evidence. Keep that context, while
  // the explicit visible IDs prevent the future fills themselves from entering the ledger.
  const context=[...executions,...input.executions.filter(e=>!selectedIds.has(e.id))];
  replayPositionAtPrice({ ...input, nativeSplits:verifiedSplitBoundaries, executions:context, nativeErrors, cursor, visibleExecutionIds: executions.map(e => e.id), nativeFacts: result => { facts = result; } });
  if (!facts) throw new Error('native facts were not produced');
  const result = facts as NativePositionFacts;
  const quantity = invalidQuantity ? null : result.quantity;
  const pnlInvalid = errors.size > 0;
  const unknownTime = {currency:input.executions[0]?.instrument.currency??input.inventoryIdentity?.currency??'UNKNOWN',amount:null};
  return { ...result, ...(errors.size ? { realizedContributions:{...result.realizedContributions, 'invalid-time':unknownTime},closedFeeContributions:{...result.closedFeeContributions,'invalid-time':unknownTime},realizedMissing:result.realizedMissing+1,lifetimeComplete:false } : {}), quantity, averageCost: pnlInvalid ? null : result.averageCost, realized: pnlInvalid ? null : result.realized,
    unrealized: pnlInvalid || quantity === null ? null : result.unrealized,
    fees: [...errors].some(e => e.includes('fee')) ? null : result.fees,
    marketValue: quantity === null ? null : decimal(quantity).mul(input.markPrice).toFixed(), reasons: [...new Set([...result.reasons, ...errors])] };
}

import Decimal from 'decimal.js';
import { verifiedSplitBoundaries, splitValuationQuote } from '../home/split-valuation-safety';
import { replayExecutionAt, statementPositionAt, statementEventAt } from '../import/statement-evidence';
import { marketTradingDate } from '../market/trading-date';
import type { TradeExecution } from '../trades/types';
import type { StatementPosition } from '../import/monthly-statement';

/** Calculation-only unit projection. Source fills, markers and statement evidence stay untouched. */
export function projectRecallSplitUnits(executions: TradeExecution[], cursor: string | undefined, mark?: { price: string; time: string }) {
    const instrument = executions[0]?.instrument;
    const actions = verifiedSplitBoundaries.filter(action => instrument?.id === action.instrumentId && cursor && Date.parse(action.effectiveAt) <= Date.parse(cursor));
    // Ancillary quantity-changing events need their own ordered reconciliation;
    // never project fills while silently leaving an event in old units.
    if (actions.length && executions.some(e => e.source.positionEvents?.some(event => event.quantity !== undefined && event.symbol === instrument!.symbol && event.market === instrument!.market && Date.parse(statementEventAt(event)) <= Date.parse(cursor!)))) {
        return { executions, markPrice: null, notes: ['拆股推算暂停：存在数量变动凭证，需先核对公司行动与持仓单位'], reason: 'corporate-action-reconciliation-required' };
    }
    const hasOpeningInventory = actions.length && executions.some(e => [...(e.source.openingPosition ? [e.source.openingPosition] : []), ...(e.source.statementPositions ?? [])].some(p => p.phase === 'opening' && p.symbol === instrument!.symbol && p.market === instrument!.market && Date.parse(statementPositionAt(p)) <= Date.parse(cursor!) && !new Decimal(p.quantity).isZero()));
    if (hasOpeningInventory) return { executions, markPrice: null, notes: ['拆股推算暂停：期初持仓需先核对公司行动与持仓单位'], reason: 'corporate-action-reconciliation-required' };
    const notes: string[] = [];
    let projected = executions;
    for (const action of actions) {
        const inventoryAtAction = projected.filter(e => Date.parse(replayExecutionAt(e)) < Date.parse(action.effectiveAt)).reduce((q, e) => q.plus(new Decimal(e.quantity).times(e.side === "buy" ? 1 : -1)), new Decimal(0));
        // A fully closed historical round never held inventory across this action.
        if (inventoryAtAction.isZero()) continue;
        const ratio = new Decimal(action.ratio);
        const before = (at: string) => Date.parse(at) < Date.parse(action.effectiveAt);
        const position = (p: StatementPosition): StatementPosition => p.symbol === instrument!.symbol && p.market === instrument!.market && before(statementPositionAt(p))
            ? { ...p, quantity: new Decimal(p.quantity).times(ratio).toString(), ...(p.cost !== undefined ? { cost: new Decimal(p.cost).div(ratio).toString() } : {}) } : p;
        projected = projected.map(execution => ({
            ...execution,
            ...(before(replayExecutionAt(execution)) ? { quantity: new Decimal(execution.quantity).times(ratio).toString(), price: new Decimal(execution.price).div(ratio).toString() } : {}),
            source: {
                ...execution.source,
                ...(execution.source.settlement && before(replayExecutionAt(execution)) ? { settlement: { ...execution.source.settlement, quantity: new Decimal(execution.source.settlement.quantity).times(ratio).toString() } } : {}),
                ...(execution.source.openingPosition ? { openingPosition: position(execution.source.openingPosition) } : {}),
                ...(execution.source.statementPositions ? { statementPositions: execution.source.statementPositions.map(position) } : {}),
            },
        }));
        notes.push(`拆股推算：${instrument!.symbol} 按 1 拆 ${action.ratio} 换算持仓及成本，暂估，待账户凭证确认`);
    }
    const quote = instrument && cursor && mark ? splitValuationQuote(instrument.id, cursor, marketTradingDate(mark.time, instrument.market), mark.price) : { price: mark?.price ?? null, notes: [] };
    if (quote.price !== null && mark && quote.price !== mark.price) quote.notes.push(`估值换算价 ${quote.price} ${instrument!.currency}（原始收盘 ${mark.price} ${instrument!.currency}）`);
    return { executions: projected, markPrice: quote.price, notes: [...notes, ...quote.notes], reason: null };
}

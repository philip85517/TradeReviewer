import type { DatabaseSync } from 'node:sqlite';
import {canonicalInstrumentId} from '../instruments/display-name';
import { SqliteStore } from '../storage/sqlite-store';
import { selectMonthlyEvidenceHistory, applyMonthlyHistoryEvidence } from '../import/statement-evidence';
import type { MonthlyStatement } from '../import/monthly-statement';
import type { DailyCandleRecord } from '../market/contracts';
import type { Instrument, TradeExecution } from '../trades/types';
import { resolvedTradeNatureOf } from '../trades/nature-resolution';
import { readFxSnapshot } from '../fx/storage';
import { decimal } from './period';
import { businessDay, executionBusinessDay } from './finance';
import type { FxRates } from './contracts';

export type HistoricalFx = { date: string; knownAt: string; rates: FxRates };
export type HomeQuote = Pick<DailyCandleRecord,'instrumentId'|'tradingDate'|'close'|'currency'|'provider'|'adjustmentMode'>;
export type SourceSnapshot = {
  sequence: number; asOf: string; businessDate: string;
  executions: TradeExecution[]; monthly: MonthlyStatement[]; instruments: Instrument[];
  candles: HomeQuote[]; currentFx: FxRates; historicalFx: HistoricalFx[];
  classification: Record<'live' | 'simulation' | 'unknown', number>;
  unclassified?: {accountId:string;accountLabel:string;instrumentId:string;market:string;knownAt:string}[];
  timings?:Record<string,number>;
};
/** One WAL read transaction fixes the source watermark and every input. No bootstrap/reviews/Recall. */
export function readSourceSnapshot(db: DatabaseSync, asOf = new Date().toISOString()): SourceSnapshot {
  db.exec('BEGIN');
  try {
    let phaseStart=performance.now();const timings:Record<string,number>={};const phase=(name:string)=>{const now=performance.now();timings[name]=now-phaseStart;phaseStart=now;};
    const sequence = Number((db.prepare('SELECT coalesce(max(seq),0) n FROM home_source_change').get() as { n: number }).n);
    const store = new SqliteStore(db);
    const originals = store.getExecutions(), classification = { live: 0, simulation: 0, unknown: 0 };
    const unclassified: NonNullable<SourceSnapshot['unclassified']> = [];
    const live = originals.filter(e => {
      const nature = resolvedTradeNatureOf(e); classification[nature]++;
      if (nature === 'unknown') unclassified.push({accountId:e.accountId,accountLabel:e.accountLabel,instrumentId:e.instrument.id,market:e.instrument.market,knownAt:e.source.timePrecision==='date-only'||e.executedAt.length===10?`${executionBusinessDay(e)}T15:59:59.999Z`:e.executedAt});
      return nature === 'live';
    });
    phase('executions');
    const selected = selectMonthlyEvidenceHistory(store.getImportHistory());
    phase('statements');
    const executions = applyMonthlyHistoryEvidence(live, selected);
    phase('evidenceOverlay');
    // The same scoped overlay rule also applies to evidence-only inventory.
    const monthly = selected.map(statement => {
      if (statement.evidenceScope) return statement;
      const superseding = selected.filter(other => other.documentId === statement.documentId && other.evidenceScope).map(other => other.evidenceScope!);
      const retained = (p: { accountId: string; market?: string; symbol?: string }) => !superseding.some(scope => p.accountId === scope.accountId && canonicalInstrumentId(p.symbol??"",p.market??"") === scope.instrumentId);
      return { ...statement, positions: statement.positions.filter(retained), events: statement.events.filter(retained) };
    });
    const fx = readFxSnapshot(db), currentFx: FxRates = {};
    if (fx && Date.parse(fx.fetchedAt) <= Date.parse(asOf)) for (const [currency, rate] of Object.entries(fx.rates)) {
      // Both provider and read model expose CNY per currency unit.
      currentFx[currency] = { rate: decimal(String(rate)).toFixed(), source: fx.source.id, asOf: fx.rateDate };
    }
    const historicalFx = db.prepare("SELECT business_date,known_at,rates_json FROM home_fx_history WHERE convention='CNY-per-unit-v1' AND known_at<=? ORDER BY business_date,known_at").all(asOf).map(row => ({ date: String(row.business_date), knownAt: String(row.known_at), rates: JSON.parse(String(row.rates_json)) as FxRates }));
    phase('monthlyAndFx');
    // The projection needs raw closing prices only. Do not materialize OHLC,
    // volume, provider symbols or adjusted candles for every background refresh.
    const candles:HomeQuote[]=[];
    // Cross the native/JS boundary once per instrument, rather than once per
    // candle. Ordered compact tuples preserve decimals and bound each JSON block.
    const quoteQuery=db.prepare("SELECT instrument_id,json_group_array(json_array(date,close,currency,provider) ORDER BY date) payload FROM daily_candles WHERE adjustment_mode='raw' GROUP BY instrument_id ORDER BY instrument_id");
    for(const group of quoteQuery.iterate())for(const row of JSON.parse(String(group.payload)) as [string,string,string|null,string|null][]){
      candles.push({instrumentId:String(group.instrument_id),tradingDate:row[0],close:row[1],currency:typeof row[2]==='string'?row[2]:'UNKNOWN',provider:(typeof row[3]==='string'?row[3]:'') as HomeQuote['provider'],adjustmentMode:'raw'});
    }
    phase('quotes');const instruments=store.getInstruments();phase('instruments');
    const result = { sequence, asOf, businessDate: businessDay(asOf), executions, monthly, instruments, candles, currentFx, historicalFx, classification,unclassified,timings };
    db.exec('COMMIT'); return result;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

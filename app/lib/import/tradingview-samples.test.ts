import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { parseBrokerStatement } from './dispatcher';
import { buildTradeEpisodes } from '../trades/episodes';
import { replayPositionAtPrice } from '../replay/position-ledger';

// Opt-in local acceptance: the private original CSVs are never copied into the repo.
const sampleDirectory = process.env.TRADINGVIEW_SAMPLE_DIR;
describe.skipIf(!sampleDirectory)('local TradingView reference exports',()=>{
  for (const sample of [
    {file:'回放交易_SSE_600330_2026-09-03.csv',rows:34,pairs:17,episodes:12,fees:'0',net:'20580'},
    {file:'回放交易_SSE_600869_2026-09-04.csv',rows:24,pairs:12,episodes:10,fees:'9.6',net:'21290.4'},
  ]) it(`accepts ${sample.file}`, async()=>{
    const bytes=readFileSync(join(sampleDirectory!,sample.file));
    const result=await parseBrokerStatement({name:sample.file,arrayBuffer:async()=>Uint8Array.from(bytes).buffer});
    expect(result.blocked).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.records).toHaveLength(sample.rows);
    expect(new Set(result.records.map(r=>r.source.simulationTradeId)).size).toBe(sample.pairs);
    const episodes=buildTradeEpisodes(result.records);
    expect(episodes).toHaveLength(sample.episodes);
    expect(episodes.every(e=>e.status==='closed')).toBe(true);
    expect(result.records.reduce((sum,r)=>sum.plus(r.fee),new Decimal(0)).toString()).toBe(sample.fees);
    expect(result.records.reduce((sum,r)=>sum.plus(r.source.simulationReport?.['净损益 CNY']??'0'),new Decimal(0)).toString()).toBe(sample.net);
    expect(episodes.reduce((sum,e)=>sum.plus(replayPositionAtPrice({executions:e.executions,markPrice:e.executions.at(-1)!.price}).netPnl),new Decimal(0)).toString()).toBe(sample.net);
  });
});

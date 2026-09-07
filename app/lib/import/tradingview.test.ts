import { createReplaySnapshot } from "../replay/replay-engine";
import { describe, expect, it } from 'vitest';
import { parseBrokerStatement } from './dispatcher';
import { buildTradeEpisodes } from '../trades/episodes';
import { mergeExecutions } from '../storage/import-library';
import { replayPositionAtPrice } from '../replay/position-ledger';

import { header, row, csv, fileFor } from './__fixtures__/tradingview';

describe('TradingView CSV import through the dispatcher', () => {
  it('imports paired date-only trades and charges the pair fee once at exit', async () => {
    const result = await parseBrokerStatement(fileFor());
    expect(result.broker).toBe('tradingview');
    expect(result.blocked).toBe(false);
    expect(result.records.map(r=>r.side)).toEqual(['buy','sell']);
    expect(result.records.map(r=>r.fee)).toEqual(['0','0.6']);
    expect(result.records[0].source).toMatchObject({ tradingNature:'simulated', timePrecision:'date-only', sourceTimezone:'Asia/Shanghai' });
    expect(result.records[0].executedAt).toBe('2021-02-19T07:00:00.000Z');
    expect(replayPositionAtPrice({ executions:result.records, markPrice:'11' }).netPnl).toBe('99.4');
  });
  it('retains identical entry portions for separate partial exits and supports shorts', async () => {
    const text = [header,row(1,'空头出场','2021-03-01','9'),row(1,'空头进场','2021-02-19','10'),row(2,'空头出场','2021-03-02','8'),row(2,'空头进场','2021-02-19','10')].join('\n');
    const {records} = await parseBrokerStatement(fileFor(text));
    expect(mergeExecutions([],records)).toHaveLength(4);
    const episodes=buildTradeEpisodes(records);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({direction:'short',openingQuantity:'200',remainingQuantity:'0',status:'closed'});
  });
  it('deduplicates renamed reimports but isolates separate simulation runs and real trades', async () => {
    const a=await parseBrokerStatement(fileFor());
    expect(a.records).toHaveLength(2);
    const renamed=await parseBrokerStatement(fileFor(csv,'renamed_SSE_600330.csv'));
    const other=await parseBrokerStatement(fileFor(csv.replaceAll('signal, quoted','other run')));
    const real=a.records.map(r=>({...r,id:'real:'+r.id,source:{platform:'futu',row:r.source.row},accountId:a.records[0].accountId}));
    expect(mergeExecutions(a.records,renamed.records)).toHaveLength(2);
    expect(mergeExecutions(a.records,other.records)).toHaveLength(4);
    expect(buildTradeEpisodes([...a.records,...other.records,...real])).toHaveLength(3);
  });
  it('excludes an entire invalid pair without losing valid pairs', async () => {
    const parsed=await parseBrokerStatement(fileFor(csv+'\n'+row(2,'多头进场','2021-02-20','10')));
    expect(parsed.records).toHaveLength(2);
    expect(parsed.diagnostics.some(d=>d.severity==='warning' && d.message.includes('2'))).toBe(true);
    expect(parsed.exclusions.reduce((sum,e)=>sum+e.count,0)).toBe(1);
  });
  it('rejects conflicting pair fees and reverse dates', async () => {
    const parsed=await parseBrokerStatement(fileFor(csv.replace('2021-03-01','2020-03-01')));
    expect(parsed.blocked).toBe(true);
    expect(parsed.records).toHaveLength(0);
    const badFee=await parseBrokerStatement(fileFor(csv.replace('0.60','3.00')));
    expect(badFee.blocked).toBe(true);
  });
});

it('hides pair report results and exit fees before exit is revealed', async()=>{
 const {records}=await parseBrokerStatement(fileFor());
 const snapshot=createReplaySnapshot({candles:[],executions:records,cursor:'2021-02-20T07:00:00.000Z'});
 expect(snapshot.executions).toHaveLength(1);
 expect(snapshot.executions[0].source.simulationReport).toBeUndefined();
 expect(snapshot.position.fees).toBe('0');
 expect(snapshot.position.realizedPnl).toBe('0');
});

it('rejects ambiguous same-day transitions while accepting one same-day pair', async()=>{
 const text=[header,row(1,'多头进场','2021-02-19','10'),row(1,'多头出场','2021-02-19','11')].join('\n');
 const parsed=await parseBrokerStatement(fileFor(text));
 expect(parsed.records.map(r=>r.side)).toEqual(['buy','sell']);
 const ambiguous=await parseBrokerStatement(fileFor(text+'\n'+row(2,'多头进场','2021-02-19','11')+'\n'+row(2,'多头出场','2021-02-20','12')));
 expect(ambiguous.blocked).toBe(true);
 expect(ambiguous.records).toHaveLength(0);
});

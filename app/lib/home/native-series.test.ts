import {expect,it} from 'vitest';
import {compactSeries,NativeSeriesAccumulator} from './native-series';
import type {NativeDay} from './contracts';
const day=(date:string,market:string|null,count=1):NativeDay=>({date,fx:{},reasons:[],buckets:{CNY:{market,unrealized:market,realized:'7',realizedMissing:0,fees:'2',feesMissing:0,count,marketKnown:market===null?0:count,unrealizedKnown:market===null?0:count,lifetimeComplete:false,reasons:market===null?['缺行情']:[]}}});
it('stores changes only and sweeps exact sums, missing values and reason removals',()=>{
 const dates=['2026-01-01','2026-01-02','2026-01-03','2026-01-04'];
 const a=[day(dates[0],'10'),day(dates[1],'10'),day(dates[2],null),day(dates[3],'0',0)];
 const compact=compactSeries(a);expect(compact.map(d=>d.date)).toEqual([dates[0],dates[2],dates[3]]);
 const series=new NativeSeriesAccumulator();series.add(compact);series.add([day(dates[0],'0.1')]);
 const rows=series.finish(dates,()=>({}));
 expect(rows.map(d=>d.buckets.CNY.market)).toEqual(['10.1','10.1',null,'0.1']);
 expect(rows.map(d=>d.buckets.CNY.marketKnown)).toEqual([2,2,1,1]);
 expect(rows.map(d=>d.buckets.CNY.realized)).toEqual(['14','14','14','14']);
 expect(rows[2].buckets.CNY.reasons).toEqual(['缺行情']);
 expect(rows[3].buckets.CNY.reasons).toEqual([]);
 expect(rows[0].buckets.CNY.fees).toBe('4');
});

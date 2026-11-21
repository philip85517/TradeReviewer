import {it,expect} from 'vitest';
import type {TradeExecution} from '../trades/types';
import {validateAtomicExecutionGroup as validate, validateNonInterleavedExecutionGroups as scope} from './atomic-execution-group';

function fixture(): TradeExecution {
  return {
    id:'atomic', accountId:'a', accountLabel:'A', side:'buy', fee:'0',
    quantity:'100', price:'10.2', executedAt:'2026-01-10T02:00:00Z',
    instrument:{id:'US:X',market:'US',symbol:'X',name:'X',currency:'USD'},
    source:{platform:'test',row:1,executionGroup:{kind:'order',fillCount:2,quantity:'100',grossAmount:'1020',fills:[
      {page:1,row:1,quantity:'40',price:'9',grossAmount:'360',executedAt:'2026-01-10T02:00:00Z',timePrecision:'second',timeEvidence:'row'},
      {page:1,row:2,quantity:'60',price:'11',grossAmount:'660',executedAt:'2026-01-10T10:00:00+08:00',timePrecision:'second',timeEvidence:'document'},
    ]}},
  };
}
function group(e:TradeExecution) {
  if(!e.source.executionGroup) throw new Error('Fixture requires execution group');
  return e.source.executionGroup;
}
it('proves exact fills and equivalent instants, preserving legacy singles',()=>{
  expect(validate(fixture()).valid).toBe(true);
  const e=fixture();delete e.source.executionGroup;expect(validate(e).valid).toBe(true);
});
const invalidCases: Array<[string,(e:TradeExecution)=>void]> = [
  ['different instant',e=>{group(e).fills[0].executedAt='2026-01-10T02:00:01Z';}],
  ['meaningful submillisecond',e=>{group(e).fills[0].executedAt='2026-01-10T02:00:00.000001Z';}],
  ['invalid calendar day',e=>{e.executedAt='2026-02-30T02:00:00Z';}],
  ['missing time evidence',e=>{delete group(e).fills[0].timeEvidence;}],
  ['duplicate source location',e=>{group(e).fills[1].row=1;}],
  ['incorrect fill count',e=>{group(e).fillCount=3;}],
  ['difference beyond 48 decimal places',e=>{group(e).reportedGrossAmount='1020.000000000000000000000000000000000000000000000000001';}],
  ['parent gross mismatch',e=>{e.price='10';}],
  ['trailing newline',e=>{group(e).quantity='100\n';}],
  ['same-currency settlement quantity mismatch',e=>{e.source.settlement={currency:'USD',quantity:'99',grossAmount:'1020',netAmount:'0',fees:{}};}],
];
it.each(invalidCases)('rejects %s',(_name,mutate)=>{
  const e=fixture();mutate(e);expect(validate(e).valid).toBe(false);
});
it('does not cross-prove settlement currencies',()=>{
  const e=fixture();e.source.settlement={currency:'HKD',quantity:'1',grossAmount:'1',netAmount:'1',fees:{}};
  expect(validate(e).valid).toBe(true);
});

function span(): TradeExecution {
  const e=fixture();group(e).fills[1].executedAt='2026-01-10T02:00:02Z';return e;
}
it('proves disjoint multi-instant blocks while atomic keeps rejecting them',()=>{
  const buy=span(),sell=span();sell.side='sell';sell.quantity='40';sell.price='12';
  sell.executedAt='2026-01-10T02:00:03Z';
  Object.assign(group(sell),{quantity:'40',grossAmount:'480'});
  group(sell).fills.forEach((f,i)=>Object.assign(f,{quantity:'20',price:'12',grossAmount:'240',executedAt:`2026-01-10T02:00:0${3+i}Z`}));
  expect(scope([buy,sell])).toEqual({valid:true,issues:[],hasMultiInstantGroup:true});
  expect(validate(buy).valid).toBe(false);
});
it('preserves ungrouped scope compatibility',()=>{
  const e=fixture();delete e.source.executionGroup;e.executedAt='legacy';
  expect(scope([e])).toEqual({valid:true,issues:[],hasMultiInstantGroup:false});
});
it.each(['interior','touch','overlap','parent','time','structure'])('rejects unsafe scope %s',kind=>{
 const e=span(),other=fixture();delete other.source.executionGroup;
 other.executedAt='2026-01-10T02:00:01Z';
 if(kind==='touch') other.executedAt='2026-01-10T02:00:02Z';
 if(kind==='overlap') {other.source.executionGroup=group(span());}
 if(kind==='parent') {e.executedAt='2026-01-10T02:00:01Z';other.executedAt='2026-01-10T02:00:05Z';}
 if(kind==='time') other.executedAt='2026-02-30T02:00:00Z';
 if(kind==='structure') group(e).fillCount=3;
 expect(scope([e,other]).valid).toBe(false);
});
it.each(invalidCases.filter(([name])=>name!=='different instant'))('range proof retains financial/time rejection: %s',(_name,mutate)=>{
 const e=fixture();mutate(e);expect(scope([e]).valid).toBe(false);
});

it('preserves atomic scope compatibility with an ordinary submillisecond point',()=>{
  const ordinary=fixture();delete ordinary.source.executionGroup;
  ordinary.executedAt='2026-01-03T15:00:00.0001Z';
  expect(scope([fixture(),ordinary])).toEqual({valid:true,issues:[],hasMultiInstantGroup:false});
  expect(scope([span(),ordinary]).valid).toBe(false);
});

it('independently proves a chronological parent without relaxing the legacy overlap guard',async()=>{
 const {validateChronologicalExecutionGroup:chronological}=await import('./atomic-execution-group');
 const e=span(),other=fixture();delete other.source.executionGroup;other.executedAt='2026-01-10T02:00:01Z';
 expect(chronological(e)).toEqual({valid:true,issues:[]});
 expect(scope([e,other]).valid).toBe(false);expect(validate(e).valid).toBe(false);
 group(e).grossAmount='1';expect(chronological(e).valid).toBe(false);
});

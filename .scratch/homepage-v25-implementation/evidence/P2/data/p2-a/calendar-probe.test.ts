import { it } from 'vitest';
import { requiredMarketDataRange } from '../../../../../../app/lib/market/sync-range';
import { expectedTradingDates } from '../../../../../../app/lib/market/calendar';
it('traces calendar',()=>{
 const cursor='2025-12-31T15:59:59.999Z';
 console.log(requiredMarketDataRange(cursor,cursor,{market:'US',open:true,now:new Date(cursor)}));
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(cursor));
 console.log({day,expected:expectedTradingDates('US',day,day)});
});

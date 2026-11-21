import {expect,it} from 'vitest';
import {valuationRawClose,valuationSession} from './valuation-quote';
it('shares exact-date nonnegative raw validation and keeps unknown live schedules explicit',()=>{
 const quote={instrumentId:'US:AAPL',tradingDate:'2025-03-04',adjustmentMode:'raw' as const,currency:'USD',provider:'yahoo' as const,close:'0'};
 expect(valuationRawClose(quote,'US:AAPL','USD','2025-03-04')).toBe('0');
 expect(valuationRawClose(quote,'US:AAPL','USD','2025-03-05')).toBeNull();
 expect(valuationRawClose({...quote,close:'-1'},'US:AAPL','USD','2025-03-04')).toBeNull();
 expect(valuationSession('US',new Date('2025-03-05T15:59:59.999Z'))).toBe('2025-03-04');
 expect(()=>valuationSession('US',new Date('2025-03-05T15:00:00Z'))).toThrow();
 expect(()=>valuationSession('US',new Date('2045-03-05T15:59:59.999Z'))).toThrow();
});

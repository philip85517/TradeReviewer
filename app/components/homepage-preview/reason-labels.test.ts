import {expect,it} from 'vitest';
import {explainReasons} from './reason-labels';
it('labels domain reason codes for the UI without changing identities or amounts',()=>{
 const result=explainReasons({id:'unknown-cost',value:'0.00000000001',reasons:['unknown-cost','已完成交易日行情缺失'],description:'证券 · position-gap',nested:{reasons:['execution-direction-unavailable']}});
 expect(result).toEqual({id:'unknown-cost',value:'0.00000000001',reasons:['缺少完整成本依据','已完成交易日行情缺失'],description:'证券 · 持仓记录存在缺口',nested:{reasons:['缺少明确的开仓或平仓方向依据']}});
});

const labels:Record<string,string>={
 'ambiguous-execution-order':'同日成交缺少可靠先后顺序',
 'unknown-cost':'缺少完整成本依据','position-gap':'持仓记录存在缺口','initial-position':'期初持仓缺少完整来源',
 'execution-direction-unavailable':'缺少明确的开仓或平仓方向依据','ambiguous-opening':'期初开仓记录不明确',
 'settlement-currency-mismatch':'成交与结算币种不一致','ambiguous-event-order':'成交与持仓变动的先后顺序待核实',
 'position-event':'持仓变动资料待核实','currency-conflict':'币种资料存在冲突','history-incomplete':'历史记录不完整',
 'unknown-fees':'费用依据不完整','duplicate-position-event':'持仓变动记录可能重复',
 'fees-invalid':'费用金额无效','fees-conflict':'费用与结算依据不一致','quantity-invalid':'成交数量无效',
 'execution-price-invalid':'成交价格无效','execution-time-invalid':'成交时间无效','settlement-invalid':'结算资料无效',
};
/** Translate explanatory fields only; financial values and immutable IDs stay untouched. */
export function explainReasons<T>(value:T):T{
 const visit=(v:unknown):unknown=>{
  if(Array.isArray(v))return v.map(visit);
  if(!v||typeof v!=='object')return v;
  return Object.fromEntries(Object.entries(v).map(([key,item])=>[key,
   key==='reasons'&&Array.isArray(item)?item.map(reason=>typeof reason==='string'?labels[reason]??reason:reason):
   key==='description'&&typeof item==='string'?item.split(' · ').map(part=>labels[part]??part).join(' · '):visit(item)]));
 };return visit(value) as T;
}

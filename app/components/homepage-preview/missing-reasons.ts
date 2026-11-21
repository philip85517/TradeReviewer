/** Translate missing inputs without treating every gap as a quote failure. */
export function missingReasonLabels(reasons:readonly string[]):string[]{
 const labels=new Set<string>();
 for(const reason of reasons){
  if(reason.startsWith("拆股推算："))continue;
  if(/汇率|fx|currency-conversion/i.test(reason))labels.add('汇率');
  else if(/拆股|拆分|按 1 拆/.test(reason))labels.add('拆股后的持仓数量与成本');
  else if(/行情|quote|price|valuation.*missing/i.test(reason))labels.add('收盘报价');
  else if(/pairing|closing-executions|business-round|close-business-day/.test(reason))labels.add('平仓确认');
  else if(/allocat|direction-conflict/.test(reason))labels.add('贡献分类');
  else if(/source|inventory|cost|opening|期初|成本|数量|估值|gross|settlement|precision|fee|time/i.test(reason))labels.add('持仓或成交依据');
  else if(reason)labels.add('数据依据');
 }
 return [...labels];
}
export function missingReasonText(reasons:readonly string[]):string{return missingReasonLabels(reasons).join('、');}

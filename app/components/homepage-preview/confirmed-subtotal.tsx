import type {ConfirmedSubtotal,HomeView} from './display-contract';
import {EvidenceAmount} from './evidence-amount';

export function missingDataNextStep(reasons:readonly string[]):string {
 const text=reasons.join(' ');
 if(/先后顺序|ambiguous-execution-order/.test(text))return '核对同日成交的原始时间或券商明确的逐笔顺序。';
 if(/方向|开仓记录|execution-direction|ambiguous-opening/.test(text))return '核对券商的开仓、平仓方向凭证及完整成交记录。';
 if(/持仓变动|转仓|position-event|ambiguous-event/.test(text))return '核对转仓或公司行动的账户记录、数量与生效日期。';
 if(/持仓记录|期初持仓|position-gap|initial-position/.test(text))return '对照缺口前后的持仓结单，补齐期间成交或转仓记录。';
 if(/成本|unknown-cost/.test(text))return '补齐原始买入或转入的成本与费用资料。';
 if(/行情/.test(text))return '核对证券代码、生效日期及拆股单位，再补齐对应交易日行情。';
 if(/汇率/.test(text))return '更新所需币种的当前汇率后重新发布结果。';
 if(/费用|fee/.test(text))return '核对券商费用明细及其结算币种。';
 return '核对期间边界的持仓、成交和费用依据，补齐后重新计算。';
}
export function SubtotalEvidence({partial,accounts=[]}:{partial:ConfirmedSubtotal;accounts?:HomeView['accounts']}) {
 const c=partial.coverage,labels=new Map(accounts.map(a=>[a.id,a.name]));
 return <section className="hp-subtotal-evidence" aria-label="已确认小计依据">
  <dl className="hp-metric-cards__facts">
   <dt>已确认小计</dt><dd>{partial.value===null?'—':<EvidenceAmount value={partial.value} currency={partial.currency}/>}</dd>
   <dt>对象覆盖</dt><dd>{c.available} / {c.total} 项（账户 × 证券）</dd>
   <dt>小计原币</dt><dd>{Object.entries(partial.originals).map(([code,value])=><EvidenceAmount key={code} value={value} currency={code}/>)}</dd>
   <dt>小计汇率</dt><dd>{partial.fxSource}</dd>
  </dl>
  <p className="hp-metric-cards__context">仅限已导入范围，不代表券商全部历史。各指标独立计算覆盖；净盈亏只计入已实现与两端浮盈均可计算的同一批对象。</p>
  {partial.missing.length>0&&<>
   <h5>尚未计入小计：{c.total-c.available} 项</h5>
   <ul className="hp-subtotal-missing">{partial.missing.map(item=><li key={`${item.accountId}/${item.code}`}>
    <strong>{item.name}（{item.code}）</strong><span>{labels.get(item.accountId)??item.accountId}</span>
    <span>{item.reasons.join('；')}</span><span>{missingDataNextStep(item.reasons)}</span>
   </li>)}</ul>
   {c.total-c.available>partial.missing.length&&<p className="hp-metric-cards__context">此处列出前 {partial.missing.length} 项，共 {c.total-c.available} 项未计入。</p>}
  </>}
 </section>;
}

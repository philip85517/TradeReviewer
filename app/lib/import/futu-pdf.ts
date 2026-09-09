import Decimal from 'decimal.js';
import type { DetectionResult, StatementParseResult } from './contracts';
import type { PdfTextItem, PdfTextPage } from './pdf-text';
import { groupItemsIntoRows } from './pdf-layout';
import type { StatementFragment, StatementTimeOptions } from './monthly-statement';
import { resolveStatementTime } from './statement-time';
import { inferFutuTransactionTimezone } from './futu-time-policy';
import { futuTemplateRuleId, resolveFutuTemplate } from './futu-template-profile';

type Row = { page: number; row: number; items: PdfTextItem[]; text: string };
type Layout = { identity: number; order?: number; timeEnd: number; settlement?: number; numericEnds: number[]; family: string };
type Fill = { row: Row; time: string; quantity: string; price: string; gross: string; cash?: string; settlement?: string; venue?: string; fragments: StatementFragment[] };
type Group = { row: Row; identity: string; orderReference?: string; side: 'buy'|'sell'; positionEffect?: 'open-short'|'close-short'; family: string; date?: string; currency?: string; market?: 'US'|'HK'; venue?: string; displayTimePolicy?: 'session-open'; total?: Fill; fills: Fill[]; fees: Decimal[]; subtotal?: Decimal; settlement?: string; fragments: StatementFragment[] };
const compact = (s: string) => s.replace(/\s+/g,'');
const numberPattern = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const datePattern = /\d{4}[/-]\d{2}[/-]\d{2}/;
const timePattern = /\d{2}:\d{2}:\d{2}/;
const fragment = (r: Row, role: string): StatementFragment => ({page:r.page,row:r.row,role});
function venueFromText(text: string): string | undefined {
  const named = text.match(/市場[：:]\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i)?.[1];
  const venue = named ?? text.match(/\b(FUTU\s+OTC|SEHK|HKEX|NASDAQ|NYSE|EDGX|OCEA)\b/i)?.[1];
  return venue?.replace(/\s+/g, ' ').trim().toUpperCase();
}

function rowsOf(pages: PdfTextPage[]): Row[] {
  return pages.flatMap(p=>groupItemsIntoRows(p.items.filter(i=>i.text.trim()),2).map((r,index)=>{
    // Overprinted glyph runs share geometry; equal fills on different baselines do not.
    const items = r.items.filter((item,i,all)=>!all.slice(0,i).some(a=>a.text===item.text && Math.abs(a.x-item.x)<1.2 && Math.abs(a.y-item.y)<1.2));
    return {page:p.pageNumber,row:index+1,items,text:items.map(i=>i.text.trim()).join(' ')};
  }));
}

export function detectFutuPdfStatement(pages: PdfTextPage[]): DetectionResult {
  const text=compact(rowsOf(pages).map(r=>r.text).join('\n'));
  const statement=/月[結结][單单]/.test(text);
  const brand=/富途|futu(?:securities|hk|5\.com|\.com)|futuhk/i.test(text);
  // Old originals have the brand in legal text, but sparse summary exports can
  // retain only this distinctive account/report structure.
  const structure=/(?:美股|港股|綜合|综合).{0,12}[賬账]戶月[結结][單单]/.test(text) && /[賬账]戶號碼/.test(text) && /(?:期初總覽|資產總覽|交易明細)/.test(text);
  return {matched:statement&&(brand||structure),confidence:statement&&brand?0.99:statement&&structure?0.9:0};
}

export function parseFutuPdfPages(pages: PdfTextPage[], options: {fileName:string;fileFingerprint:string;accountId?:string;accountLabel?:string}&StatementTimeOptions): StatementParseResult {
  const rows=rowsOf(pages), text=compact(rows.map(r=>r.text).join('\n'));
  const result: StatementParseResult={broker:'futu',records:[],candidates:[],exclusions:[],diagnostics:[],blocked:false,
    monthly:{documentId:`futu:${options.fileFingerprint}`,templateIds:[],positions:[],events:[],reviewRequired:false}};
  const warn=(code:string,message:string,row?:Row,severity:'warning'|'error'='warning')=>{
    result.diagnostics.push({severity,code,message,...(row?{page:row.page,row:row.row}:{})});
    result.monthly!.reviewRequired=true;
    if(severity==='error')result.blocked=true;
  };
  if(!detectFutuPdfStatement(pages).matched){warn('not-futu-statement','未识别到富途月结单内容',undefined,'error');return result;}
  const top=rows.filter(r=>r.row<=4).map(r=>compact(r.text)).join(' ');
  const month=/(\d{4})(?:年|\/|-)(\d{2})(?:月|\b)/.exec(top)??/結單日期[：:]?(\d{4})-(\d{2})/.exec(text);
  if(month)result.monthly!.month=`${month[1]}-${month[2]}`;
  const account=/[賬账]戶號碼[：:]?(\d+)/.exec(text)?.[1];
  const accountId=options.accountId??(account?`futu:${account}`:`futu:document:${options.fileFingerprint}`);
  result.monthly!.accountId=accountId;
  if(!account&&!options.accountId)warn('missing-statement-account','未识别账户；以文档隔离，合并历史前需确认账户');
  const hkLegend=/本[結结][單单]所展示的時間按照香港時間顯示/.test(text);
  const localLegend=/本[結结][單单]所展示的時間按照當地證券(?:及期貨)?市場時間顯示/.test(text);
  const documentTimezone=hkLegend&&!localLegend?'Asia/Hong_Kong':localLegend&&!hkLegend?'market-local':undefined;
  const reviewedTimeOverride=Boolean(options.sourceTimezone?.trim()&&options.overrideDocumentTimezone);
  if(hkLegend&&localLegend&&!reviewedTimeOverride)warn('conflicting-statement-timezone','文档包含相互冲突的时间图例，请根据证据明确覆盖来源时区',undefined,'error');
  result.monthly!.timePolicy=options.sourceTimezone&&(!documentTimezone||options.overrideDocumentTimezone)
    ?`user:${options.sourceTimezone}`
    :documentTimezone==='market-local'
    ?'inferred:per-transaction-market-session'
    :documentTimezone??'inferred:market-default';
  const overnight=/20:00.{0,15}04:00.{0,80}T\+1/.test(text);
  const documentMarket=/(?:美股).{0,10}[賬账]戶/.test(top)?'US':/(?:港股).{0,10}[賬账]戶/.test(top)?'HK':undefined;
  let layout:Layout|undefined, group:Group|undefined, pendingIdentity='', pendingDate='', active=false, darkPoolActive=false, excluded:'fund'|'unknown-asset'|undefined;
  const consumed=new Set<Row>();
  let pendingFragments:StatementFragment[]=[];
  const templates=new Set<string>();

  function finish() {
    if(!group)return;
    const g=group;group=undefined;
    if(!g.fills.length){warn('missing-futu-executions','订单主行没有可核验的成交明细',g.row,'error');return;}
    const identity=compact(g.identity);
    const m=/^([A-Z][A-Z0-9.-]{0,14}|\d{5})[（(]([^]*)/.exec(identity) ?? /^(\d{5})([^\d(（].*)/.exec(identity);
    const explicitDerivative=/\d{6}[CP]\d{6,}|期權|期权|认购|認購|認沽|认沽/.test(identity);
    if(!m||explicitDerivative) {
      result.exclusions.push({category:'unknown-asset',label:'非股票或证券身份不明确',count:g.fills.length});
      warn('unsupported-futu-instrument','交易组无法确认为股票/ETF，保留为排除项',g.row,explicitDerivative?'warning':'error');return;
    }
    const symbol=m[1], market=g.market??documentMarket??(/^\d{5}$/.test(symbol)&&g.currency==='HKD'?'HK':/^[A-Z]/.test(symbol)&&g.currency==='USD'?'US':undefined);
    if(!market){warn('unknown-futu-market','缺少证券市场身份依据',g.row,'error');return;}
    const sum=(key:'quantity'|'gross')=>g.fills.reduce((s,f)=>s.plus(f[key]),new Decimal(0));
    if(g.total&&(!sum('quantity').eq(g.total.quantity)||sum('gross').minus(g.total.gross).abs().gt(new Decimal('0.01').mul(g.fills.length))))warn('futu-group-mismatch','成交子行数量或金额不等于订单主行',g.row,'error');
    const detailFee=g.fees.length?g.fees.reduce((a,b)=>a.plus(b),new Decimal(0)):undefined;
    if(g.subtotal&&detailFee&&!g.subtotal.eq(detailFee))warn('futu-fee-mismatch','费用明细与小计不一致',g.row,'error');
    const fee=g.subtotal??detailFee;
    if(fee?.lt(0)||g.fees.some(f=>f.lt(0)))warn('unsupported-futu-fee-sign','费用返还或负值语义尚未验证',g.row,'error');
    if(!fee)warn('unknown-futu-fee','未找到费用证据；费用状态未知',g.row);
    const netFees=g.family==='F4'&&g.fills.every(f=>f.cash!==undefined)?g.fills.map(f=>g.side==='buy'?new Decimal(f.cash!).neg().minus(f.gross):new Decimal(f.gross).minus(f.cash!)):undefined;
    if(fee&&netFees&&!netFees.reduce((a,b)=>a.plus(b),new Decimal(0)).eq(fee))warn('futu-cash-mismatch','综合成交净现金与成交金额、组费用不守恒',g.row,'error');
    const resolved = g.fills.map((f) => {
      const rawTime=f.time || g.date || '';
      if(g.family!=='F0'&&g.family!=='F2'&&!timePattern.test(rawTime)) {
        warn('missing-futu-clock','交易时间列缺少时钟片段，不能自动降级为日期成交',f.row,'error');
        return undefined;
      }
      const inference=inferFutuTransactionTimezone({text:rawTime,market,documentTimezone,venue:f.venue ?? g.venue ?? venueFromText(f.row.text)});
      const time=resolveStatementTime({text:rawTime,market,kind:g.family==='F0'?'date':g.family==='F2'?'order':'execution',documentTimezone,options,overnightNextDay:overnight,
        inferredTimezone:inference?.timezone,inferenceConfidence:inference?.confidence,inferenceReason:inference?.reason,inferenceRuleId:inference?.ruleId,inferenceCandidates:inference?.candidates,inferenceOverridesDocument:inference?.overridesDocumentTimezone});
      if(!time.ok){warn(time.code,time.message,f.row,'error');return undefined;}
      if(g.family==='F0')warn('futu-contract-date-only','原件合约仅报告交易日，无法进行秒级回放',f.row);
      if(g.family==='F2')warn('futu-order-time','原件为下单时间，仅保留日级时间精度',f.row);
      return { fill: f, time };
    });
    if(resolved.some(item => item === undefined)) return;
    const resolvedFills = resolved as Array<NonNullable<typeof resolved[number]>>;
    const representative = resolvedFills.find(item => timePattern.test(item.fill.time)) ?? resolvedFills[0];
    const aggregateQuantity=sum('quantity');
    const aggregateGross=sum('gross');
    const aggregatePrice=aggregateQuantity.isZero() ? representative.fill.price : aggregateGross.div(aggregateQuantity).toDecimalPlaces(8).toString();
    const instrument={id:`${market}:${symbol}`,symbol,name:m[2].replace(/[）)]$/,''),market,currency:market==='HK'?'HKD':'USD'};
    const sourceOrder=result.records.length;
    const positionEvidence=g.positionEffect?{positionEffect:g.positionEffect}:{};
    const displayTimePolicy=g.displayTimePolicy ?? (g.venue?.includes('OTC') || g.fragments.some(item => item.role === 'dark-pool') ? 'session-open' as const : 'execution-time' as const);
    const executionGroup=g.fills.length > 1 || Boolean(g.total) ? {
      kind: 'order' as const,
      ...(g.orderReference ? { orderReference: g.orderReference } : {}),
      fillCount: g.fills.length,
      quantity: aggregateQuantity.toString(),
      grossAmount: aggregateGross.toString(),
      ...(g.total ? { reportedQuantity: g.total.quantity, reportedPrice: g.total.price, reportedGrossAmount: g.total.gross } : {}),
      fills: resolvedFills.map(({ fill, time }) => ({ page: fill.row.page, row: fill.row.row, ...(fill.time ? { sourceTimestampText: fill.time } : {}), executedAt: time.executedAt, sourceTimezone: time.sourceTimezone, marketCalendarDate: time.marketCalendarDate, timePrecision: time.timePrecision, timeEvidence: time.timeEvidence, ...(time.timeConfidence !== undefined ? { timeConfidence: time.timeConfidence } : {}), quantity: fill.quantity, price: fill.price, grossAmount: fill.gross, ...(fill.settlement ?? g.settlement ? { settlementDate: fill.settlement ?? g.settlement } : {}), ...(fill.venue ? { venue: fill.venue } : {}) })),
    } : undefined;
    result.records.push({id:`futu:${options.fileFingerprint}:${g.row.page}:${g.row.row}`,accountId,accountLabel:options.accountLabel??'富途',instrument,side:g.side,executedAt:representative.time.executedAt,quantity:aggregateQuantity.toString(),price:aggregatePrice,fee:(fee??new Decimal(0)).toString(),source:{...positionEvidence,platform:'futu',inputKind:'statement',fileName:options.fileName,fileFingerprint:options.fileFingerprint,page:g.row.page,row:g.row.row,sourceOrder,templateId:g.family,formatRuleId:futuTemplateRuleId(g.family as Parameters<typeof futuTemplateRuleId>[0]),statementMonth:result.monthly!.month,sourceTimestampText:representative.fill.time,sourceTimezone:representative.time.sourceTimezone,timePrecision:representative.time.timePrecision,timeEvidence:representative.time.timeEvidence,timeConfidence:representative.time.timeConfidence,timeInferenceReason:representative.time.timeInferenceReason,timeRuleId:representative.time.timeRuleId,timeCandidates:representative.time.timeCandidates,sourceTimeKind:representative.time.sourceTimeKind,marketCalendarDate:representative.time.marketCalendarDate,tradingDate:representative.time.tradingDate,timeRuleVersion:representative.time.timeRuleVersion,settlementDate:representative.fill.settlement??g.settlement,grossAmount:aggregateGross.toString(),cashChange:g.fills.every(fill => fill.cash !== undefined) ? g.fills.reduce((total, fill) => total.plus(fill.cash!), new Decimal(0)).toString() : undefined,feeStatus:fee?'reported':'unknown',...(g.venue ? { venue: g.venue } : {}),displayTimePolicy, ...(executionGroup ? { executionGroup } : {}),fragments:[...g.fragments,...g.fills.flatMap(fill => fill.fragments)]}});
    if(!result.candidates.some(c=>c.market===market&&c.symbol===symbol))result.candidates.push({market,symbol,sourceName:instrument.name,sourceAssetType:'unknown'});
  }

  if(resolveFutuTemplate({documentText:text}).id === 'F0') {
    result.monthly!.templateIds=['F0'];
    for(const contract of readContractGroups(rows,warn)){group=contract;finish();}
    return result;
  }

  for(let index=0;index<rows.length;index++){
    const r=rows[index], c=compact(r.text);
    if(consumed.has(r))continue;
    if(/^(?:期初|期末|資產總覽|资产总览|資金進出|资金进出|資金流水|资金流水|現金|现金|公司行動|公司行动|融資總覽|融券總覽|其他|備註|备注)/.test(c)) {finish();active=false;darkPoolActive=false;pendingIdentity='';pendingDate='';pendingFragments=[];continue;}
    if(/^(?:交易-|交易－|股票订单|股票訂單|基金订单|基金訂單|期权订单|期權訂單)/.test(c)) {
      finish(); pendingIdentity='';pendingDate='';pendingFragments=[];darkPoolActive=false;excluded=/基金/.test(c)?'fund':/^(?:期权|期權)/.test(c)?'unknown-asset':undefined;active=true;
    }
    if(c==='暗盤交易明細'||c==='暗盘交易明细') {finish();active=true;darkPoolActive=true;excluded=undefined;pendingIdentity='';pendingDate='';pendingFragments=[fragment(r,'dark-pool')];continue;}
    if(c==='交易明細'||c==='交易明细') {finish();active=true;darkPoolActive=false;excluded=undefined;pendingIdentity='';continue;}
    if(/(?:方向|成交方向)/.test(c)&&/(?:價格|价格|成交金額|成交金额)/.test(c)){
      const find=(re:RegExp)=>r.items.find(i=>re.test(compact(i.text)));
      const nearby=rows.slice(Math.max(0,index-1),index+2).filter(a=>a.page===r.page).flatMap(a=>a.items);
      const identity=nearby.find(i=>/^(?:股票|名稱代碼?|代碼名稱)$/.test(compact(i.text))), time=nearby.find(i=>/(?:成交.*時|下單時間|日期\/時間|订单日期|訂單日期)/.test(compact(i.text)));
      const price=nearby.find(i=>/^價格?$/.test(compact(i.text))),gross=nearby.find(i=>/^成交金額?$/.test(compact(i.text))),cash=nearby.find(i=>/^變動金額?$/.test(compact(i.text)));
      const quantity=nearby.find(i=>/^(?:數量|數|量)$/.test(i.text.trim()));
      if(!identity||!time||!price||!gross||!cash||!quantity){
        const template=resolveFutuTemplate({documentText:text,headerText:c});
        warn(template.id==='unknown'?'unsupported-futu-template':'unsupported-futu-columns',template.id==='unknown'?'交易表头未匹配已验证的富途模板，已停止套用旧版规则':'无法确定交易表列边界',r,'error');
        layout=undefined;
        continue;
      }
      const template=resolveFutuTemplate({documentText:text,headerText:c});
      if(template.id==='unknown') {
        warn('unsupported-futu-template','交易表头未匹配已验证的富途模板，已停止套用旧版规则',r,'error');
        layout=undefined;
        continue;
      }
      const family=template.id;
      layout={identity:identity.x,order:find(/^(?:單號|订单号|訂單編號|订单编号)$/)?.x,timeEnd:time.x+time.width,settlement:find(/^交收日期$/)?.x,numericEnds:[quantity,price,gross,cash].map(i=>i.x+i.width),family};
      templates.add(family);active=true;
      if(family==='F4a')warn('unsupported-futu-f4a','订单日期综合变体尚未验证明细恢复规则',r,'error');
      continue;
    }
    if(active && /(?:方向|成交方向)/.test(c) && /(?:價格|价格|成交金額|成交金额)/.test(c) && !layout) {
      warn('unsupported-futu-template','交易表头未匹配已验证的富途模板，已停止套用旧版规则',r,'error');
      continue;
    }
    if(!active||!layout)continue;
    if(/(?:成交金額合計|交易費用合計|佣金合計|變動金額合計|^合計|^總計)/.test(c)){finish();continue;}
    if(r.items.some(i=>/客戶姓名|賬戶號碼|製備日期/.test(i.text))||/月結單/.test(c))continue;
    if(layout.family==='F4a')continue;
    const direction=r.items.find(i=>i.x<layout!.identity-5&&/^(?:買入(?:開倉|平倉)?|賣出(?:開倉|平倉)?|沽空|賣空|補回|买入(?:开仓|平仓)?|卖出(?:开仓|平仓)?|卖空|补回)$/.test(compact(i.text)));
    const identityParts=r.items.filter(i=>Math.abs(i.x-layout!.identity)<4).map(i=>i.text).join('');
    const isIdentityStart=/^[A-Z][A-Z0-9.-]*[（(]|^\d{5}(?:[（(]|\s+\S|$)/.test(identityParts);
    if(isIdentityStart&&!direction){pendingIdentity=identityParts;pendingFragments=[fragment(r,'identity')];}
    else if(identityParts&&!direction&&!numberPattern.test(identityParts)&&!/[數量:：]/.test(identityParts)){
      if(pendingIdentity){pendingIdentity+=identityParts;pendingFragments.push(fragment(r,'identity'));}else if(group){group.identity+=identityParts;group.fragments.push(fragment(r,'identity'));}
    }
    if(direction){
      if(excluded){result.exclusions.push({category:excluded,label:'非股票交易分区',count:1});pendingIdentity='';continue;}
      const side=/買|买|補|补/.test(direction.text)?'buy':'sell' as const;
      const candidateIdentity=compact(pendingIdentity+identityParts);
      const orderReference=layout!.order === undefined ? undefined : r.items.find(i=>i.x>=layout!.order!-4&&i.x<layout!.identity-4&&/^\d{4,}$/.test(compact(i.text)))?.text.trim();
      const sameIdentity=!candidateIdentity || compact(group?.identity ?? '') === candidateIdentity || compact(group?.identity ?? '').startsWith(candidateIdentity) || candidateIdentity.startsWith(compact(group?.identity ?? ''));
      const sameOrder=Boolean(group && orderReference && group.orderReference === orderReference && group.side === side && sameIdentity);
      if(!sameOrder) {
        finish();
        group={row:r,identity:pendingIdentity?pendingIdentity+identityParts:identityParts,orderReference,date:pendingDate||undefined,side,family:layout.family,currency:r.items.find(i=>/^(?:HKD|USD)$/.test(i.text))?.text,venue:venueFromText(r.text),...(darkPoolActive ? { displayTimePolicy: 'session-open' as const } : {}),fills:[],fees:[],fragments:[...pendingFragments,fragment(r,'identity')]};
      } else if (group && venueFromText(r.text)) {
        group.venue=venueFromText(r.text);
      }
      const explicit=compact(direction.text);
      if(group && !group.positionEffect && /^(?:沽空|賣空|卖空|賣出開倉|卖出开仓)$/.test(explicit))group.positionEffect='open-short';
      if(group && !group.positionEffect && /^(?:補回|补回|買入平倉|买入平仓)$/.test(explicit))group.positionEffect='close-short';
      pendingIdentity='';pendingDate='';pendingFragments=[];
    }
    const dateAbove=r.items.find(i=>i.x>layout!.identity+25&&i.x<layout!.timeEnd+4&&datePattern.test(i.text));
    if(!direction&&dateAbove&&!r.items.some(i=>i.x>layout!.timeEnd+5&&numberPattern.test(i.text.trim()))&&!timePattern.test(c)){
      pendingDate=datePattern.exec(dateAbove.text)![0];pendingFragments.push(fragment(r,'time'));continue;
    }
    if(!group) {
      if(excluded)continue;
      if(timePattern.test(c)&&r.items.some(i=>numberPattern.test(i.text.trim())))warn('orphan-futu-execution','成交行缺少有界订单身份',r,'error');
      continue;
    }
    const rowVenue=venueFromText(r.text);
    if(rowVenue) group.venue=rowVenue;
    const feeMatches=[...r.text.matchAll(/([^\s:：]+)\s*[:：]\s*([+-]?[\d,]+(?:\.\d+)?)/g)].filter(m=>/佣金|費|费|稅|税|小計|小计/.test(m[1]));
    if(!feeMatches.length&&/佣金[：:]/.test(c)&&/小計[：:]/.test(c)){
      const subtotalX=r.items.find(i=>/小計/.test(i.text))!.x;
      const following=rows.slice(index+1,index+5).filter(a=>a.page===r.page);
      let found=false;
      for(const next of following){
        if(/市場|交收日|合計|方向/.test(next.text))break;
        const numbers=next.items.filter(i=>numberPattern.test(i.text.trim()));
        if(!numbers.length)continue;
        for(const i of numbers){
          const value=new Decimal(i.text.replaceAll(',',''));
          if(Math.abs(i.x-subtotalX)<10){group.subtotal=value;found=true;}else group.fees.push(value);
        }
        consumed.add(next);group.fragments.push(fragment(next,'fee'));
      }
      if(!found)warn('invalid-futu-fee','费用网格缺少数值小计',r,'error');
      group.fragments.push(fragment(r,'fee'));continue;
    }
    if(feeMatches.length){
      for(const m of feeMatches){const value=new Decimal(m[2].replaceAll(',',''));if(/小[計计]/.test(m[1]))group.subtotal=value;else group.fees.push(value);}
      group.fragments.push(fragment(r,'fee'));
      const settlement=/交收日期[：:]\s*(\d{4}[/-]\d{2}[/-]\d{2})/.exec(r.text)?.[1];if(settlement)group.settlement=settlement.replaceAll('/','-');
      continue;
    }
    const timeItems=r.items.filter(i=>i.x<=layout!.timeEnd+4&&i.x>layout!.identity+25);
    const timeText=timeItems.map(i=>i.text).join(' ');
    const date=datePattern.exec(timeText)?.[0], clock=timePattern.exec(timeText)?.[0];
    if(date&&direction)group.date=date;
    const values=layout.numericEnds.map(end=>r.items.filter(i=>Math.abs(i.x+i.width-end)<7&&numberPattern.test(i.text.trim())).map(i=>i.text.trim()));
    if(values.slice(0,3).some(v=>v.length)){
      if(values.slice(0,3).some(v=>v.length!==1)){warn('invalid-futu-numbers','成交数量、价格或金额缺失/歧义',r,'error');continue;}
      const [quantity,price,gross,cash]=values.map(v=>v[0]===undefined?undefined:new Decimal(v[0].replaceAll(',','')).toString());
      const isTotal=direction&&(layout.family==='F3'||layout.family==='F4');
      if(new Decimal(quantity!).lte(0)||new Decimal(price!).lt(0)||new Decimal(gross!).lt(0)||(!isTotal&&new Decimal(quantity!).mul(price!).minus(gross!).abs().gt('0.02'))){warn('invalid-futu-amount','成交数量、价格与金额不守恒',r,'error');continue;}
      const settlement=layout.settlement?r.items.filter(i=>i.x>=layout!.settlement!-2&&i.x<layout!.numericEnds[0]-50).map(i=>i.text).join(' ').match(datePattern)?.[0]:undefined;
      const sourceDate=date??group.date;
      const fill:Fill={row:r,quantity:quantity!,price:price!,gross:gross!,cash,time:sourceDate?`${sourceDate}${clock?' '+clock:''}`:'',settlement:settlement?.replaceAll('/','-'),venue:venueFromText(r.text),fragments:[fragment(r,'execution')]};
      if(direction&&(layout.family==='F3'||layout.family==='F4'))group.total=fill;
      else group.fills.push(fill);
    } else if(clock&&group.fills.length){
      const last=group.fills.at(-1)!;
      if(datePattern.test(last.time)&&!timePattern.test(last.time)){last.time+=` ${clock}`;last.fragments.push(fragment(r,'time'));}
    }
  }
  finish();
  result.monthly!.templateIds=[...templates];
  if(!templates.size){
    const template=resolveFutuTemplate({documentText:text});
    result.monthly!.templateIds=[template.id];
    if(/交易明[細细]|買賣方向|交易合約明細/.test(text))warn('unsupported-futu-table','存在交易章节但未识别可验证的表格',undefined,'error');
  }
  return result;
}

/** Older left-aligned contract tables. Their cash ledger repeats the contracts. */
function readContractGroups(
  rows: Row[],
  diagnostic: (code:string,message:string,row?:Row,severity?:'warning'|'error')=>void,
): Group[] {
  const groups:Group[]=[];
  const error=(code:string,message:string,row:Row)=>diagnostic(code,message,row,'error');
  let active=false, columns:number[]|undefined, current:Group|undefined;
  let pendingName='', pendingSource:StatementFragment[]=[];
  let feeColumns:number[]|undefined, feeHeader:Row|undefined;
  let sectionStart=0, sectionCash=new Decimal(0), sawSubtotal=false, sawHeader=false;

  function close() {
    if(!current)return;
    const fill=current.fills[0];
    if(!fill.gross){error('missing-futu-contract-value','合约缺少成交价值及费用数值行',current.row);}
    else {
      const gross=new Decimal(fill.gross), fee=current.fees.reduce((a,b)=>a.plus(b),new Decimal(0));
      if(new Decimal(fill.quantity).mul(fill.price).minus(gross).abs().gt('0.01'))error('futu-contract-value-mismatch','合约成交价值与数量乘价格不守恒',current.row);
      const expected=current.side==='buy'?gross.plus(fee).neg():gross.minus(fee);
      if(!expected.eq(fill.cash!))error('futu-contract-cash-mismatch','合约净现金与成交价值、费用不守恒',current.row);
      groups.push(current);
    }
    current=undefined;feeColumns=undefined;feeHeader=undefined;
  }

  for(const row of rows) {
    const text=compact(row.text);
    if(text==='交易合約明細') {
      if(!active){active=true;sectionStart=groups.length;sectionCash=new Decimal(0);sawSubtotal=false;}
      continue;
    }
    if(/^(?:現金及庫存調撥|投資組合|資產組合總覽)/.test(text)) {
      if(active){close();if(!sawSubtotal)error('missing-futu-contract-total','合约交易表缺少币种小计，无法确认章节完整性',row);}
      active=false;columns=undefined;pendingName='';pendingSource=[];continue;
    }
    if(!active)continue;
    if(/交易日/.test(text)&&/商品代號及名稱/.test(text)) {
      const labels=[/^交易日$/, /^結算日$/, /^參考編號$/, /^買(?:\/賣)?$/, /^商品代號及名稱$/, /^數量$/, /^單位價格$/, /^金額變動$/];
      const cells=labels.map(label=>row.items.find(i=>label.test(compact(i.text))));
      if(cells.some(i=>!i)){error('unsupported-futu-contract-columns','合约交易表缺少必要列',row);columns=undefined;continue;}
      columns=cells.map(i=>i!.x);sawHeader=true;continue;
    }
    if(!columns)continue;
    const cell=(index:number)=>row.items.filter(i=>i.x>=columns![index]-2&&i.x<(columns![index+1]??Infinity)-2).map(i=>i.text.trim()).join(' ');
    const summary=/^小計(USD|HKD)$/.exec(compact(cell(6)));
    if(summary){
      close();sawSubtotal=true;
      const value=compact(cell(7));
      if(!numberPattern.test(value)||!sectionCash.eq(value.replaceAll(',','')))error('futu-contract-total-mismatch','合约净现金合计与币种小计不一致',row);
      for(const g of groups.slice(sectionStart)){
        g.currency=summary[1];
        // This supported family explicitly reports the US-equity SEC/TAF fee
        // schedule, USD section and ordinary equity identity. Currency alone
        // (or a file's directory) never establishes a security's market.
        if(summary[1]==='USD'&&g.fragments.some(f=>f.role==='us-equity-fees'))g.market='US';
        else error('unsupported-futu-contract-market','合约缺少已验证的股票市场与费用表证据',g.row);
        g.fragments.push(fragment(row,'currency-total'));
      }
      pendingName='';pendingSource=[];continue;
    }
    if(/WWW\.FUTU|賬戶姓名|賬戶號碼|結單日期|印單日期|帳戶綜合月結單|香港證券及期貨/.test(text))continue;
    if(/成交價值/.test(text)&&/Commission/.test(text)) {
      if(!current){error('orphan-futu-contract-fees','费用表缺少对应合约',row);continue;}
      const names=['成交價值','Commission','ClearingFee','SECFee','TAF'];
      const cells=names.map(name=>row.items.find(i=>compact(i.text)===name));
      if(cells.some(i=>!i)){error('unsupported-futu-contract-fees','合约费用列不完整',row);continue;}
      feeColumns=cells.map(i=>i!.x);feeHeader=row;continue;
    }
    if(feeColumns&&current){
      const values=feeColumns.map(x=>row.items.filter(i=>Math.abs(i.x-x)<3).map(i=>i.text.trim()).join(''));
      if(values.some(v=>v.length)){
        if(values.some(v=>!numberPattern.test(v)))error('invalid-futu-contract-fees','合约成交价值或费用含无效数字',row);
        else {
          const parsed=values.map(v=>new Decimal(v.replaceAll(',','')));
          if(parsed.some(v=>v.lt(0)))error('unsupported-futu-contract-fee-sign','合约负费用或负成交价值语义未验证',row);
          current.fills[0].gross=parsed[0].toString();current.fees=parsed.slice(1);
          current.fragments.push(fragment(feeHeader!,'us-equity-fees'),fragment(row,'gross-and-fees'));
        }
        feeColumns=undefined;feeHeader=undefined;continue;
      }
    }
    const tradeDate=compact(cell(0)), side=compact(cell(3)), name=cell(4);
    if(datePattern.test(tradeDate)||/^[買賣]$/.test(side)){
      close();
      const settlement=compact(cell(1)), quantity=compact(cell(5)), price=compact(cell(6)), cash=compact(cell(7));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)||!/^\d{4}-\d{2}-\d{2}$/.test(settlement)||!/^IF\d+$/.test(compact(cell(2)))||!/^[買賣]$/.test(side)||[quantity,price,cash].some(v=>!numberPattern.test(v))){
        error('invalid-futu-contract-row','合约日期、方向、编号或数字缺失/无效',row);pendingName='';pendingSource=[];continue;
      }
      const q=new Decimal(quantity.replaceAll(',','')),p=new Decimal(price.replaceAll(',','')),net=new Decimal(cash.replaceAll(',',''));
      if(q.lte(0)||p.lt(0)){error('invalid-futu-contract-row','合约数量或价格无效',row);continue;}
      sectionCash=sectionCash.plus(net);
      current={row,identity:pendingName+name,side:side==='買'?'buy':'sell',family:'F0',fills:[{row,time:tradeDate,settlement,quantity:q.toString(),price:p.toString(),gross:'',cash:net.toString(),fragments:[fragment(row,'date-only-contract')]}],fees:[],fragments:[...pendingSource,fragment(row,'identity')]};
      pendingName='';pendingSource=[];continue;
    }
    if(name){
      if(/^[A-Z][A-Z0-9.-]*\s*[（(]/.test(name)){pendingName=name;pendingSource=[fragment(row,'identity')];}
      else if(pendingName){pendingName+=name;pendingSource.push(fragment(row,'identity'));}
      else if(current){current.identity+=name;current.fragments.push(fragment(row,'identity'));}
    }
  }
  close();
  if(!sawHeader&&rows[0])error('unsupported-futu-contract-columns','未识别合约交易表头',rows[0]);
  if(active&&!sawSubtotal&&rows[0])error('missing-futu-contract-total','合约交易表缺少币种小计',rows[0]);
  return groups;
}

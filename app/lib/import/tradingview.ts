import Decimal from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
import type { StatementInput, StatementParseResult } from './contracts';
import type { TradeExecution } from '../trades/types';

export type TradingViewInstrument = { market: 'CN-SH'; symbol: string };
const columns = ['交易编号','类型','日期和时间','信号','价格 CNY','大小（数量）','大小（价值）','净损益 CNY','回报 %','手续费 CNY','有利波动 CNY','有利波动 %','不利波动 CNY','不利波动 %','累计损益 CNY','累计损益 %','持续时间（K线）'];

export function tradingViewInstrumentFromName(fileName: string): TradingViewInstrument | undefined {
  const match = fileName.match(/(?:^|_)SSE_(\d{6})(?=_|\.|$)/i);
  return match ? { market: 'CN-SH', symbol: match[1] } : undefined;
}

// A strict local CSV reader; quotes and embedded newlines do not shift source rows.
function readCsv(text: string): Array<{ cells: string[]; row: number }> {
  const result: Array<{ cells: string[]; row: number }> = [];
  let cells: string[] = [], value = '', quoted = false, closed = false, line = 1, start = 1;
  const field = () => { cells.push(value.trim()); value = ''; closed = false; };
  const record = () => { field(); if (cells.some(Boolean)) result.push({ cells, row:start }); cells = []; };
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i=0; i<input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i+1] === '"') { value+='"'; i++; }
      else if (char === '"') { quoted=false; closed=true; }
      else { value+=char; if (char==='\n') line++; }
    } else if (char===',') field();
    else if (char==='\n') { record(); line++; start=line; }
    else if (char==='"' && !value && !closed) quoted=true;
    else if (char==='"' || (closed && char.trim())) throw new Error(`第 ${line} 行 CSV 引号格式错误`);
    else value+=char;
  }
  if (quoted) throw new Error('CSV 引号未闭合');
  if (value || cells.length) record();
  return result;
}

export function isTradingViewCsv(bytes: Uint8Array): boolean {
  const first = new TextDecoder().decode(bytes.slice(0,4096)).replace(/^\uFEFF/, '').split(/\r?\n/)[0];
  return first.includes('交易编号') && first.includes('日期和时间') && first.includes('类型');
}

export function parseTradingViewCsv(input: StatementInput, selected?: TradingViewInstrument): StatementParseResult {
  const result: StatementParseResult = { broker:'tradingview', records:[], candidates:[], diagnostics:[], exclusions:[], blocked:false };
  try {
    const instrument = selected ?? tradingViewInstrumentFromName(input.fileName);
    if (!instrument || instrument.market !== 'CN-SH' || !/^\d{6}$/.test(instrument.symbol)) throw new Error('请核对并选择该 CSV 对应的上海证券代码');
    const table = readCsv(new TextDecoder('utf-8',{fatal:true}).decode(input.bytes));
    const headers = table.shift()?.cells ?? [];
    if (new Set(headers).size !== headers.length || columns.some(c=>!headers.includes(c))) throw new Error('不支持的 TradingView CSV 表头：需要中文 CNY 回放交易格式');
    const groups = new Map<string, typeof table>();
    for (const row of table) {
      const id = row.cells[headers.indexOf('交易编号')];
      const key = id || `缺失编号（行 ${row.row}）`;
      groups.set(key,[...(groups.get(key)??[]),row]);
    }
    const runId = `${input.fileFingerprint}:${instrument.market}:${instrument.symbol}`;
    const pairs: Array<{ id: string; records: TradeExecution[]; start: string; end: string; direction: string; rows: number }> = [];
    const exclude = (id: string, rows: typeof table, message: string) => {
      result.diagnostics.push({ severity:'warning',code:'invalid-tradingview-pair',row:rows[0]?.row,message:`交易 ${id}：${message}（行 ${rows.map(r=>r.row).join('、')}）` });
      result.exclusions.push({category:'invalid-row',label:`交易 ${id}：${message}`,count:rows.length});
    };
    for (const [id, rows] of groups) {
      try {
        if (!/^\d+$/.test(id) || rows.length!==2) throw new Error('需要且只能有一条进场和一条出场');
        const values = rows.map(r=> {
          if (r.cells.length!==headers.length) throw new Error('列数量不匹配');
          return { row:r.row, data:Object.fromEntries(headers.map((h,i)=>[h,r.cells[i]])) };
        });
        const entry=values.find(r=>['多头进场','空头进场'].includes(r.data['类型']));
        const exit=values.find(r=>['多头出场','空头出场'].includes(r.data['类型']));
        if (!entry || !exit || entry.data['类型'].slice(0,2)!==exit.data['类型'].slice(0,2)) throw new Error('进出场类型不匹配');
        for (const r of values) {
          const date = r.data['日期和时间'];
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('本格式仅支持交易日期');
          Temporal.PlainDate.from(date);
          for (const col of columns.slice(4)) {
            const raw=r.data[col];
            if (!/^-?\d+(?:\.\d+)?$/.test(raw) || !new Decimal(raw).isFinite()) throw new Error(`${col} 数值无效`);
          }
          if (!new Decimal(r.data['价格 CNY']).gt(0) || !new Decimal(r.data['大小（数量）']).gt(0) || new Decimal(r.data['手续费 CNY']).lt(0)) throw new Error('价格、数量必须大于零，费用不能为负');
        }
        if (entry.data['日期和时间']>exit.data['日期和时间']) throw new Error('出场日期早于进场');
        for (const col of ['大小（数量）',...columns.slice(7)]) {
          if (!new Decimal(entry.data[col]).eq(exit.data[col])) throw new Error(`${col} 在配对内不一致`);
        }
        const records = [entry,exit].map((r,index):TradeExecution=>({
          id:`tradingview:${runId}:${id}:${index===0?'entry':'exit'}`,
          source:{ platform:'tradingview',inputKind:'statement',tradingNature:'simulated', simulationRunId:runId,simulationTradeId:id, simulationRole:index===0?'entry':'exit', simulationSignal:r.data['信号'], ...(index===1 ? { simulationReport:Object.fromEntries(columns.slice(6).map(c=>[c,r.data[c]])) } : {}),
            fileName:input.fileName,fileFingerprint:input.fileFingerprint,row:r.row,timePrecision:'date-only',sourceTimestampText:r.data['日期和时间'],sourceTimezone:'Asia/Shanghai' },
          accountId:`tradingview:${runId}`, accountLabel:`TradingView · 模拟盘 · ${input.fileFingerprint.slice(0,8)}`,
          instrument:{id:`CN-SH:${instrument.symbol}`,market:'CN-SH',symbol:instrument.symbol,name:'名称待行情源补充',currency:'CNY'},
          side:['多头进场','空头出场'].includes(r.data['类型'])?'buy':'sell',
          executedAt:`${r.data['日期和时间']}T07:00:00.000Z`,quantity:new Decimal(r.data['大小（数量）']).toString(), price:new Decimal(r.data['价格 CNY']).toString(),fee:index===0?'0':new Decimal(r.data['手续费 CNY']).toString(),
        }));
        pairs.push({id,records,start:entry.data['日期和时间'],end:exit.data['日期和时间'],direction:entry.data['类型'].slice(0,2),rows:rows.length});
      } catch (error) { exclude(id,rows,error instanceof Error?error.message:'配对无效'); }
    }
    const ambiguous = new Set<string>();
    for (let i=0;i<pairs.length;i++) for (let j=i+1;j<pairs.length;j++) {
      const a=pairs[i], b=pairs[j];
      const overlap=a.start<=b.end && b.start<=a.end;
      const sameDayTurn=a.end===b.start || b.end===a.start;
      if ((overlap && a.direction!==b.direction) || sameDayTurn) { ambiguous.add(a.id); ambiguous.add(b.id); }
    }
    for (const pair of pairs) {
      if (ambiguous.has(pair.id)) exclude(pair.id,groups.get(pair.id)!, '日期精度不足以确定同日顺序或存在相反持仓，请拆分或修正后重试');
      else result.records.push(...pair.records);
    }
    result.records.sort((a,b)=>a.executedAt.localeCompare(b.executedAt) || Number(a.source.simulationTradeId)-Number(b.source.simulationTradeId) || Number(a.source.simulationRole==='exit')-Number(b.source.simulationRole==='exit'));
    result.records.forEach((r,i)=>{r.source.sourceOrder=i;});
    result.candidates=result.records.length?[{...instrument,sourceAssetType:'unknown'}]:[];
    result.blocked=result.records.length===0;
    if (result.blocked) result.diagnostics.push({severity:'error',code:'no-valid-tradingview-pairs',message:result.diagnostics[0]?.message ?? '没有可导入的完整交易配对'});
  } catch (error) {
    result.blocked=true;
    result.diagnostics.push({severity:'error',code:'invalid-tradingview-csv',message:error instanceof Error?error.message:'CSV 无法解析'});
  }
  return result;
}

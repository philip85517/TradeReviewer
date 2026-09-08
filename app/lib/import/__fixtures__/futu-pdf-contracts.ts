import type { PdfTextPage } from '../pdf-text';

// Synthetic, left-aligned contract columns from the older content family.
export function contracts(empty = false): PdfTextPage[] {
  const lines: Array<Array<[number,string]>> = [
    [[23,'賬戶號碼：900001'],[333,'富途證券']],
    [[23,'結單日期：2016-01-29']], [[235,'帳戶綜合月結單']],
    [[257,'交易合約明細']],
    [[26,'交易日'],[92,'結算日'],[158,'參考編號'],[224,'買/賣'],[268,'商品代號及名稱'],[389,'數量'],[455,'單位價格'],[510,'金額變動']],
    ...(!empty ? [
      [[268,'DEMO(Synthetic Long']] as Array<[number,string]>,
      [[26,'2016-01-04'],[92,'2016-01-07'],[158,'IF90001'],[224,'買'],[389,'100.00'],[455,'10.25'],[510,'-1033.00']] as Array<[number,string]>,
      [[268,'Name ETF)']] as Array<[number,string]>,
      [[26,'成交價值'],[92,'Commission'],[158,'Clearing Fee'],[224,'SEC Fee'],[268,'TAF']] as Array<[number,string]>,
      [[26,'1025.00'],[92,'5.00'],[158,'3.00'],[224,'0.00'],[268,'0.00']] as Array<[number,string]>,
      [[26,'2016-01-05'],[92,'2016-01-08'],[158,'IF90002'],[224,'賣'],[268,'DEMO(Synthetic ETF)'],[389,'100.00'],[455,'11'],[510,'1091.96']] as Array<[number,string]>,
      [[26,'成交價值'],[92,'Commission'],[158,'Clearing Fee'],[224,'SEC Fee'],[268,'TAF']] as Array<[number,string]>,
      [[26,'1100.00'],[92,'5.00'],[158,'3.00'],[224,'0.03'],[268,'0.01']] as Array<[number,string]>,
    ]:[]),
    [[455,'小計USD'],[510,empty?'0.00':'58.96']],
    [[250,'現金及庫存調撥']],
    // A repeated ledger trade is not an additional execution.
    [[26,'2016-01-04'],[92,'2016-01-07'],[158,'IF90001'],[224,'買'],[268,'DEMO(Synthetic ETF)'],[389,'100.00'],[455,'10.25'],[510,'-1033.00']],
    [[271,'投資組合']],[[26,'商品代號'],[70,'證券名稱'],[260,'承上結存'],[316,'變更股數'],[409,'結存股數']],
    [[26,'DEMO'],[70,'Synthetic ETF'],[260,'0'],[316,'0'],[409,'0']],[[23,'WWW.FUTU5.COM']],
  ];
  return [{pageNumber:1,width:595,height:842,items:lines.flatMap((line,index)=>line.map(([x,text])=>({x,text,y:30+index*25,width:text.length*4,height:8})))}];
}
